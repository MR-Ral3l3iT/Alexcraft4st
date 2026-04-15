/**
 * Custom HTTP server: Next.js + Socket.IO (หน้าจอ TV /display/checkin)
 * ต้องรันผ่าน `npm run dev` / `npm start` — ไม่ใช้ `next dev` / `next start` โดยตรง
 */
import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const port = Number.parseInt(process.env.PORT ?? "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const CHECKIN_DISPLAY_ROOM = "checkin-display";

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url ?? "", true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Request handler error", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  const io = new SocketIOServer(httpServer, {
    path: "/socket.io",
    cors: { origin: true, methods: ["GET", "POST"] }
  });

  globalThis.__SOCKET_IO__ = io;

  io.on("connection", (socket) => {
    socket.join(CHECKIN_DISPLAY_ROOM);
  });

  httpServer.once("error", (err) => {
    console.error(err);
    process.exit(1);
  });

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port} (Socket.IO at /socket.io)`);
  });
});
