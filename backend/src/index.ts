import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import routes from "./routes";
import { initializeDatabase } from "./db";
import { startMqtt } from "./mqtt";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: (process.env.CORS_ORIGIN || "http://localhost:5173").split(","), methods: ["GET", "POST", "PATCH"] }
});

app.use(cors({ origin: (process.env.CORS_ORIGIN || "http://localhost:5173").split(",") }));
app.use(express.json({ limit: "1mb" }));
app.use("/api", routes);

io.on("connection", (socket) => {
  console.log("Dashboard connected:", socket.id);
  socket.on("disconnect", () => console.log("Dashboard disconnected:", socket.id));
});

const port = Number(process.env.PORT) || 4000;

async function start() {
  await initializeDatabase();
  startMqtt(io);
  server.listen(port, () => console.log(`IIoT API listening on :${port}`));
}

start().catch((error) => {
  console.error("Failed to start API:", error);
  process.exit(1);
});
