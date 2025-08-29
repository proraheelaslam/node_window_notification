import express from "express";
import { WebSocketServer } from "ws";
import bodyParser from "body-parser";
import http from "http";

const app = express();
app.use(bodyParser.json());

// 🔹 Heroku ke liye dynamic port
const PORT = process.env.PORT || 4000;

// HTTP server banaya jo Express + WS dono handle karega
const server = http.createServer(app);

// 🔹 WebSocket server attach kiya HTTP server pe
const wss = new WebSocketServer({ server });

// Map: userId -> WebSocket(s)
const clients = {};

wss.on("connection", (ws) => {
  console.log("✅ New client connected");

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);

      // 🔹 User register karega jab connect hoga
      if (data.type === "register" && data.userId) {
        if (!clients[data.userId]) {
          clients[data.userId] = [];
        }
        clients[data.userId].push(ws);
        console.log(`👤 Registered user: ${data.userId}`);
      }
    } catch (err) {
      console.error("❌ Invalid message", err);
    }
  });

  ws.on("close", () => {
    // 🔹 Cleanup disconnected sockets
    for (const userId in clients) {
      clients[userId] = clients[userId].filter((client) => client !== ws);
      if (clients[userId].length === 0) {
        delete clients[userId];
      }
    }
    console.log("❌ Client disconnected");
  });
});

// 🔹 Function: Notification bhejna specific users ko
function sendNotification(userIds, title, message) {
  const payload = JSON.stringify({ type: "notification", title, message });

  userIds.forEach((userId) => {
    const userSockets = clients[userId] || [];
    userSockets.forEach((client) => {
      if (client.readyState === 1) {
        client.send(payload);
      }
    });
  });
}

// 🔹 REST API endpoint (notification trigger karega)
app.post("/send", (req, res) => {
  const { userIds, title, message } = req.body;

  if (!userIds || !Array.isArray(userIds)) {
    return res.status(400).json({ error: "userIds[] array is required" });
  }
  if (!title || !message) {
    return res.status(400).json({ error: "title and message are required" });
  }

  sendNotification(userIds, title, message);
  res.json({ success: true, sentTo: userIds, title, message });
});

// 🔹 Start Express + WebSocket server
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
