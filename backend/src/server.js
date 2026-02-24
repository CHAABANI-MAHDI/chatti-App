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
const onlineUsers = new Map();
const lastSeenByUser = new Map();

const toIsoNow = () => new Date().toISOString();

const setUserOnline = (userId = "") => {
  const nextId = String(userId || "").trim();
  if (!nextId) return;
  const nextCount = Number(onlineUsers.get(nextId) || 0) + 1;
  onlineUsers.set(nextId, nextCount);
  io.emit("chat:user:presence", {
    userId: nextId,
    status: "Online",
    lastSeen: "Online now",
    timestamp: toIsoNow(),
  });
};

const setUserOffline = (userId = "") => {
  const nextId = String(userId || "").trim();
  if (!nextId) return;

  const currentCount = Number(onlineUsers.get(nextId) || 0);
  if (currentCount > 1) {
    onlineUsers.set(nextId, currentCount - 1);
    return;
  }

  onlineUsers.delete(nextId);
  const lastSeenAt = toIsoNow();
  lastSeenByUser.set(nextId, lastSeenAt);
  io.emit("chat:user:presence", {
    userId: nextId,
    status: "Offline",
    lastSeen: lastSeenAt,
    timestamp: lastSeenAt,
  });
};

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

context.emitMessageUpdated = (payload = {}) => {
  const senderId = String(payload.senderId || "").trim();
  const receiverId = String(payload.receiverId || "").trim();

  if (senderId) {
    io.to(buildUserRoom(senderId)).emit("chat:message:updated", payload);
  }

  if (receiverId && receiverId !== senderId) {
    io.to(buildUserRoom(receiverId)).emit("chat:message:updated", payload);
  }
};

context.emitMessageDeleted = (payload = {}) => {
  const senderId = String(payload.senderId || "").trim();
  const receiverId = String(payload.receiverId || "").trim();

  if (senderId) {
    io.to(buildUserRoom(senderId)).emit("chat:message:deleted", payload);
  }

  if (receiverId && receiverId !== senderId) {
    io.to(buildUserRoom(receiverId)).emit("chat:message:deleted", payload);
  }
};

io.on("connection", (socket) => {
  socket.on("chat:join-user", ({ userId } = {}) => {
    const nextUserId = String(userId || "").trim();
    if (!nextUserId) {
      return;
    }

    const previousUserId = String(socket.data?.userId || "").trim();
    if (previousUserId && previousUserId !== nextUserId) {
      socket.leave(buildUserRoom(previousUserId));
      setUserOffline(previousUserId);
    }

    socket.data.userId = nextUserId;
    socket.join(buildUserRoom(nextUserId));
    setUserOnline(nextUserId);

    socket.emit("chat:presence:snapshot", {
      onlineUserIds: Array.from(onlineUsers.keys()),
      lastSeenByUser: Object.fromEntries(lastSeenByUser.entries()),
      timestamp: toIsoNow(),
    });
  });

  socket.on("chat:typing", ({ fromUserId, toUserId, isTyping } = {}) => {
    const senderId = String(fromUserId || socket.data?.userId || "").trim();
    const receiverId = String(toUserId || "").trim();
    if (!senderId || !receiverId || senderId === receiverId) {
      return;
    }

    io.to(buildUserRoom(receiverId)).emit("chat:typing", {
      fromUserId: senderId,
      toUserId: receiverId,
      isTyping: Boolean(isTyping),
      timestamp: toIsoNow(),
    });
  });

  socket.on("disconnect", () => {
    const userId = String(socket.data?.userId || "").trim();
    if (!userId) {
      return;
    }
    setUserOffline(userId);
  });
});

httpServer.listen(context.port, () => {
  console.log(`Backend running on http://localhost:${context.port}`);
});
