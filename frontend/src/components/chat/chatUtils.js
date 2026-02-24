export const parseApiPayload = async (response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

export const mapProfileToChat = (profile) => ({
  id: profile.id || "",
  name: profile.name || "User",
  email: profile.email || "",
  status: "Online",
  lastSeen: "Available",
  avatar: profile.name?.trim()?.charAt(0)?.toUpperCase() || "U",
  image: profile.image || "",
  phone: profile.phone || "",
  role: "Team member",
  timezone: "UTC",
  lastMessage: "",
  lastMessageFromMe: false,
  time: "",
  unread: 0,
  messages: [],
});

export const formatTime = (timestamp) => {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export const buildMessageFingerprint = (message = {}) => {
  const rawId = String(message.id || "").trim();
  if (rawId) return `id:${rawId}`;
  const ts = String(
    message.createdAt || message.rawTimestamp || message.timestamp || "",
  ).trim();
  const text = String(message.text || "").trim();
  const imageUrl = String(message.imageUrl || "").trim();
  const audioUrl = String(message.audioUrl || "").trim();
  const fromMe = message.fromMe ? "1" : "0";
  return `fallback:${ts}:${fromMe}:${text}:${imageUrl}:${audioUrl}`;
};

export const normalizeOutgoingMessageInput = (payload) => {
  if (typeof payload === "string") {
    return {
      text: payload,
      imageDataUrl: "",
      audioDataUrl: "",
    };
  }

  return {
    text: String(payload?.text || ""),
    imageDataUrl: String(payload?.imageDataUrl || ""),
    audioDataUrl: String(payload?.audioDataUrl || ""),
  };
};

export const buildLastMessagePreview = (payload = {}) => {
  const text = String(payload.text || "").trim();
  const imageUrl = String(payload.imageUrl || "").trim();
  const audioUrl = String(payload.audioUrl || "").trim();

  if (text) return text;
  if (imageUrl) return "📷 Photo";
  if (audioUrl) return "🎤 Voice message";
  return "";
};

export const isAuthExpiredMessage = (message = "") =>
  /jwt expired|invalid jwt|token expired/i.test(String(message || ""));

export const mapConversationToChat = (conversation) => ({
  ...mapProfileToChat(conversation),
  lastMessage: conversation.lastMessage || "",
  lastMessageFromMe: Boolean(conversation.lastMessageFromMe),
  unread: Number(conversation.unread || 0),
  time: formatTime(conversation.lastMessageAt),
  lastMessageAt: conversation.lastMessageAt || null,
});
