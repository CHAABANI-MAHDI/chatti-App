const { createApp } = require("./app");
const { createServer } = require("http");
const { Server } = require("socket.io");

const { app, context } = createApp();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: true,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  },
});

const buildUserRoom = (userId = "") => `user:${String(userId || "").trim()}`;

context.emitMessageCreated = (payload = {}) => {
  const senderId = String(payload.senderId || "").trim();
  const receiverId = String(payload.receiverId || "").trim();

  if (senderId) {
    io.to(buildUserRoom(senderId)).emit("chat:message:new", payload);
  }

  if (receiverId && receiverId !== senderId) {
    io.to(buildUserRoom(receiverId)).emit("chat:message:new", payload);
  }
};

io.on("connection", (socket) => {
  socket.on("chat:join-user", ({ userId } = {}) => {
    const nextUserId = String(userId || "").trim();
    if (!nextUserId) {
      return;
    }

    socket.join(buildUserRoom(nextUserId));
  });
});

httpServer.listen(context.port, () => {
  console.log(`Backend running on http://localhost:${context.port}`);
});
