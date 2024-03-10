const http = require("http");
const express = require("express");
const bodyParser = require("body-parser");
const WebSocket = require("ws");
const jwt = require("jsonwebtoken");
const jwtConfig = require("./config/jwt.config");
const fs = require("fs");

const app = express();
app.use(bodyParser.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const userTokens = new Map();
const userSockets = new Map();

app.post("/orders", (req, res) => {
  console.log(req.body);
  const order = req.body;

  const userId = order.dhanClientId;
  // console.log(userId);
  const targetSocket = userSockets.get(userId);

  // order.arriveTime = Date.now();
  if (targetSocket) {
    targetSocket.send(JSON.stringify({ order }));
    order.socketMessage = "Succesfully Send";
    res.status(200).json({ message: "Order sent to the client" });
  } else {
    console.error(`User ${userId} not found or not authenticated.`);
    order.socketMessage = "User ${userId} not found or not authenticated.";
    res
      .status(404)
      .json({ message: `User ${userId} not found or not authenticated.` });
  }
  // Save the order as JSON in a text file
  order.arriveTime = getForDateTime();

  fs.appendFile("orders.txt", JSON.stringify(order) + "\n", (err) => {
    if (err) {
      console.log("Error saving order:", err);
    } else {
      console.log("Saving successfully");
    }
  });
});

app.get("/logs", (req, res) => {
  fs.readFile("orders.txt", "utf8", (err, data) => {
    if (err) {
      console.error("Error reading log file:", err);
      res.status(500).json({ message: "Error reading log file" });
    } else {
      // Split the data by newlines to get individual log entries
      const logs = data.trim().split("\n");

      // Parse each log entry as JSON
      const parsedLogs = logs.map((log) => JSON.parse(log));

      res.status(200).json({ logs: parsedLogs });
    }
  });
});

app.delete("/logs", (req, res) => {
  fs.unlink("orders.txt", (err) => {
    if (err) {
      console.error("Error deleting log file:", err);
      res.status(500).json({ message: "Error deleting log file" });
    } else {
      console.log("Log file deleted successfully");
      res.status(200).json({ message: "Log file deleted successfully" });
    }
  });
});

function getForDateTime() {
  let date_time = new Date();

  let date = ("0" + date_time.getDate()).slice(-2);

  // get current month
  let month = ("0" + (date_time.getMonth() + 1)).slice(-2);

  // get current year
  let year = date_time.getFullYear();

  // get current hours
  let hours = date_time.getHours();

  // get current minutes
  let minutes = date_time.getMinutes();

  // get current seconds
  let seconds = date_time.getSeconds();
  let miliseconds = date_time.getMilliseconds();

  // prints date & time in YYYY-MM-DD HH:MM:SS format
  let format =
    year +
    "-" +
    month +
    "-" +
    date +
    " " +
    hours +
    ":" +
    minutes +
    ":" +
    seconds +
    ":" +
    miliseconds;
  console.log(format);
  return format;
}

function generateToken(userId) {
  // Token will expire in 1 hour (3600 seconds)
  // clearExpTokens();
  const token = jwt.sign({ id: userId }, jwtConfig.secret, { expiresIn: 3600 });
  return token;
}
function clearExpTokens() {
  const now = Date.now();
  for (let [userId, token] of userTokens.entries()) {
    try {
      const decoded = jwt.verify(token, jwtConfig.secret);
      if (decoded.exp * 1000 < now) {
        userTokens.delete(userId);
      }
    } catch (err) {
      console.error(err);
      userTokens.delete(userId);
    }
  }
}

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    const data = JSON.parse(message);

    if (data.authenticate) {
      const userId = String(data.userId);
      let token = userTokens.get(userId);

      if (!token) {
        token = generateToken(userId);
        userTokens.set(userId, token);
      }
      console.log(userId);
      userSockets.set(userId, ws);
      ws.send(JSON.stringify({ token }));
    }

    if (data.sentMessageToUser) {
      const userId = String(data.userId);
      const message = data.message;

      const targetSocket = userSockets.get(userId);
      if (targetSocket) {
        targetSocket.send(JSON.stringify({ message }));
        ws.send(JSON.stringify({ message }));
      } else {
        console.error(`User ${userId} not found or not authenticated.`);
      }
    }
  });
});

const port = 80;
server.listen(port, () => {
  console.log(`WS server running at http://localhost:${port}/`);
});
