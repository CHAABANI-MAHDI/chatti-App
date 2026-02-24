/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import ChatListItem from "./chat/ChatListItem";
import Detail from "./Detail";
import List from "./List";
import AddUserByPhoneModal from "./modals/AddUserByPhoneModal";
import ProfileModal from "./modals/ProfileModal";
import SettingsModal from "./modals/SettingsModal";
import UserActions from "./shared/UserActions";
import { API_BASE_URL } from "../lib/apiBaseUrl";
import {
  buildLastMessagePreview,
  buildMessageFingerprint,
  formatTime,
  isAuthExpiredMessage,
  mapConversationToChat,
  mapProfileToChat,
  normalizeOutgoingMessageInput,
  parseApiPayload,
} from "./chat/chatUtils";

const APP_PREFERENCES_KEY = "relatime-chat-preferences";
const APP_CHAT_CACHE_PREFIX = "relatime-chat-cache";
const DEFAULT_PREFERENCES = {
  showMessagePreview: true,
  showUnreadBadge: true,
  muteNotifications: false,
};

const toCacheKey = (userId = "") =>
  `${APP_CHAT_CACHE_PREFIX}:${String(userId || "").trim()}`;

const sanitizeMessagesForCache = (messages = []) =>
  (Array.isArray(messages) ? messages : []).slice(-60).map((message) => {
    const imageUrl = String(message?.imageUrl || "");
    const audioUrl = String(message?.audioUrl || "");

    return {
      id: message?.id || null,
      text: String(message?.text || ""),
      imageUrl: imageUrl.startsWith("data:") ? "" : imageUrl,
      audioUrl: audioUrl.startsWith("data:") ? "" : audioUrl,
      timestamp: message?.timestamp || "",
      createdAt: message?.createdAt || null,
      fromMe: Boolean(message?.fromMe),
      read: Boolean(message?.read),
      readAt: message?.readAt || null,
      pending: Boolean(message?.pending),
      failed: Boolean(message?.failed),
      clientId: message?.clientId || null,
      deliveredAt: message?.deliveredAt || null,
    };
  });

const readCachedChats = (userId = "") => {
  const key = toCacheKey(userId);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return { chats: [], selectedChatId: null };
    }

    const parsed = JSON.parse(raw);
    const chats = Array.isArray(parsed?.chats)
      ? parsed.chats.map((chat) => ({
          ...chat,
          messages: sanitizeMessagesForCache(chat?.messages || []),
        }))
      : [];

    return {
      chats,
      selectedChatId: parsed?.selectedChatId || null,
    };
  } catch {
    return { chats: [], selectedChatId: null };
  }
};

const writeCachedChats = (userId = "", chats = [], selectedChatId = null) => {
  const key = toCacheKey(userId);
  const safeChats = (Array.isArray(chats) ? chats : [])
    .slice(0, 40)
    .map((chat) => ({
      ...chat,
      messages: sanitizeMessagesForCache(chat?.messages || []),
    }));

  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        chats: safeChats,
        selectedChatId,
        updatedAt: Date.now(),
      }),
    );
  } catch {
    // Intentionally ignored
  }
};

const readStoredPreferences = () => {
  try {
    const rawPreferences = localStorage.getItem(APP_PREFERENCES_KEY);
    if (!rawPreferences) {
      return DEFAULT_PREFERENCES;
    }

    const parsed = JSON.parse(rawPreferences);
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
};

const recalculateChatSummary = (messages = []) => {
  const list = Array.isArray(messages) ? messages : [];
  const latest = list[list.length - 1] || null;

  if (!latest) {
    return {
      lastMessage: "",
      lastMessageFromMe: false,
      lastMessageAt: null,
      time: "",
    };
  }

  const lastMessageAt =
    latest.createdAt || latest.rawTimestamp || latest.timestamp || null;

  return {
    lastMessage: buildLastMessagePreview({
      text: latest.text,
      imageUrl: latest.imageUrl,
      audioUrl: latest.audioUrl,
    }),
    lastMessageFromMe: Boolean(latest.fromMe),
    lastMessageAt,
    time: formatTime(lastMessageAt),
  };
};

function Chat({ currentUser, onLogout, onProfileSave }) {
  const effectiveUserId = String(
    currentUser?.profileId || currentUser?.id || "",
  ).trim();
  const [chats, setChats] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [socketStatus, setSocketStatus] = useState("connecting");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileSearchTerm, setMobileSearchTerm] = useState("");
  const [mobileProfile, setMobileProfile] = useState({
    name: currentUser?.name || "My Profile",
    email: currentUser?.email || "",
    phone: currentUser?.phone || "",
    statusText: currentUser?.statusText || "",
    image: currentUser?.image || "",
  });
  const [mobileDraftProfile, setMobileDraftProfile] = useState(mobileProfile);
  const [isMobileProfileOpen, setIsMobileProfileOpen] = useState(false);
  const [isMobileSettingsOpen, setIsMobileSettingsOpen] = useState(false);
  const [isMobileAddUserOpen, setIsMobileAddUserOpen] = useState(false);
  const [preferences, setPreferences] = useState(readStoredPreferences);
  const [apiErrorMessage, setApiErrorMessage] = useState("");
  const [typingByChatId, setTypingByChatId] = useState({});

  const socketRef = useRef(null);
  const isSendingMessageRef = useRef(false);
  const authExpiredHandledRef = useRef(false);
  const selectedChatIdRef = useRef(null);
  const chatsRef = useRef([]);
  const fetchConversationsRef = useRef(async () => {});
  const markConversationAsReadRef = useRef(async () => {});
  const preferencesRef = useRef(preferences);
  const typingDebounceRef = useRef({});
  const autoRetryInProgressRef = useRef(false);

  const selectedChat = useMemo(
    () => chats.find((chat) => chat.id === selectedChatId) ?? null,
    [chats, selectedChatId],
  );
  const selectedChatIsTyping = Boolean(
    selectedChat?.id && typingByChatId[selectedChat.id],
  );

  const filteredMobileChats = useMemo(() => {
    const query = mobileSearchTerm.trim().toLowerCase();

    if (!query) {
      return chats;
    }

    return chats.filter((chat) => {
      const name = chat.name?.toLowerCase() ?? "";
      const message = chat.lastMessage?.toLowerCase() ?? "";
      return name.includes(query) || message.includes(query);
    });
  }, [chats, mobileSearchTerm]);

  useEffect(() => {
    selectedChatIdRef.current = selectedChatId;
  }, [selectedChatId]);
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  useEffect(() => {
    preferencesRef.current = preferences;
    try {
      localStorage.setItem(APP_PREFERENCES_KEY, JSON.stringify(preferences));
    } catch {
      // Intentionally ignored
    }
  }, [preferences]);

  useEffect(() => {
    if (!effectiveUserId) {
      return;
    }

    const cached = readCachedChats(effectiveUserId);
    if (cached.chats.length) {
      setChats(cached.chats);
      if (cached.selectedChatId) {
        setSelectedChatId(cached.selectedChatId);
      }
    }
  }, [effectiveUserId]);

  useEffect(() => {
    if (!effectiveUserId) {
      return;
    }

    writeCachedChats(effectiveUserId, chats, selectedChatId);
  }, [effectiveUserId, chats, selectedChatId]);

  useEffect(() => {
    return () => {
      Object.values(typingDebounceRef.current || {}).forEach((timerId) => {
        if (timerId) {
          window.clearTimeout(timerId);
        }
      });
    };
  }, []);

  const handleAuthExpired = (message = "") => {
    if (authExpiredHandledRef.current) return;
    authExpiredHandledRef.current = true;
    alert(message || "Session expired. Please sign in again.");
    onLogout?.();
  };

  const toFriendlyNetworkError = (error = null, fallbackMessage = "") => {
    const message = String(error?.message || fallbackMessage || "").trim();
    if (!message) {
      return "Network request failed.";
    }

    if (/failed to fetch|networkerror|network request failed/i.test(message)) {
      return "You appear to be offline. Check your connection and retry.";
    }

    return message;
  };

  const emitTypingSignal = (contactId, isTyping) => {
    const nextContactId = String(contactId || "").trim();
    if (!nextContactId || !effectiveUserId) {
      return;
    }

    const socket = socketRef.current;
    if (!socket?.connected) {
      return;
    }

    socket.emit("chat:typing", {
      fromUserId: effectiveUserId,
      toUserId: nextContactId,
      isTyping: Boolean(isTyping),
    });
  };

  const queueTypingSignal = (contactId, value = "") => {
    const nextContactId = String(contactId || "").trim();
    if (!nextContactId) {
      return;
    }

    emitTypingSignal(nextContactId, Boolean(String(value || "").trim()));

    if (typingDebounceRef.current[nextContactId]) {
      window.clearTimeout(typingDebounceRef.current[nextContactId]);
    }

    typingDebounceRef.current[nextContactId] = window.setTimeout(() => {
      emitTypingSignal(nextContactId, false);
      typingDebounceRef.current[nextContactId] = null;
    }, 900);
  };

  const retryNetworkData = async () => {
    setApiErrorMessage("");
    try {
      await fetchConversationsRef.current();
    } catch (error) {
      setApiErrorMessage(
        toFriendlyNetworkError(error, "Unable to refresh conversations."),
      );
    }

    if (socketRef.current && !socketRef.current.connected) {
      setSocketStatus("reconnecting");
      socketRef.current.connect();
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchConversations = async () => {
    const ownerIdentifier = effectiveUserId;
    if (!ownerIdentifier) {
      setChats([]);
      return;
    }

    const response = await fetch(
      `${API_BASE_URL}/conversations/${encodeURIComponent(ownerIdentifier)}`,
      {
        headers: currentUser?.accessToken
          ? { Authorization: `Bearer ${currentUser.accessToken}` }
          : undefined,
      },
    );

    const payload = await parseApiPayload(response);
    if (!response.ok) {
      if (response.status === 401 || isAuthExpiredMessage(payload.message)) {
        handleAuthExpired(payload.message || "JWT expired");
      }
      throw new Error(payload.message || "Failed to load conversations.");
    }

    setApiErrorMessage("");

    const nextChats = (payload.conversations || []).map(mapConversationToChat);

    setChats((previousChats) => {
      const previousById = new Map(
        previousChats.filter((c) => c?.id).map((c) => [c.id, c]),
      );

      const mergedChats = nextChats.map((chat) => {
        const previous = previousById.get(chat.id);
        const nextTimestamp = new Date(chat.lastMessageAt || 0).getTime();
        const previousTimestamp = new Date(
          previous?.lastMessageAt || 0,
        ).getTime();
        const serverUnread = Number(chat.unread || 0);
        const previousUnread = Number(previous?.unread || 0);

        let nextUnread = serverUnread;
        const shouldUseLocalUnread = serverUnread <= 0;
        const hasConversationUpdated =
          previous && nextTimestamp > previousTimestamp;

        if (selectedChatId === chat.id) {
          nextUnread = 0;
        } else if (shouldUseLocalUnread && previous) {
          nextUnread = hasConversationUpdated
            ? previousUnread + 1
            : previousUnread;
        }

        return {
          ...chat,
          unread: nextUnread,
          messages: previous?.messages || [],
        };
      });

      return mergedChats.sort(
        (a, b) =>
          new Date(b.lastMessageAt || 0).getTime() -
          new Date(a.lastMessageAt || 0).getTime(),
      );
    });
  };

  useEffect(() => {
    fetchConversationsRef.current = fetchConversations;
  }, [fetchConversations]);

  const fetchMessagesForContact = async (contactId) => {
    const ownerId = effectiveUserId;
    if (!ownerId || !contactId) return;

    const response = await fetch(
      `${API_BASE_URL}/messages?ownerId=${encodeURIComponent(ownerId)}&contactId=${encodeURIComponent(contactId)}`,
      {
        headers: currentUser?.accessToken
          ? { Authorization: `Bearer ${currentUser.accessToken}` }
          : undefined,
      },
    );

    const payload = await parseApiPayload(response);
    if (!response.ok) {
      if (response.status === 401 || isAuthExpiredMessage(payload.message)) {
        handleAuthExpired(payload.message || "JWT expired");
      }
      throw new Error(payload.message || "Failed to load messages.");
    }

    setApiErrorMessage("");

    const sourceMessages = Array.isArray(payload.messages)
      ? payload.messages
      : [];
    const mappedMessages = sourceMessages.map((m) => ({
      ...m,
      createdAt: m.timestamp || null,
      timestamp: formatTime(m.timestamp),
    }));

    const latestMessage = mappedMessages[mappedMessages.length - 1] || null;
    const latestSourceMessage =
      sourceMessages[sourceMessages.length - 1] || null;

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === contactId
          ? {
              ...chat,
              ...(latestMessage
                ? {
                    lastMessage: latestMessage.text || "",
                    lastMessageFromMe: Boolean(latestMessage.fromMe),
                    lastMessageAt:
                      latestSourceMessage?.timestamp || chat.lastMessageAt,
                    time:
                      latestMessage.timestamp ||
                      formatTime(latestSourceMessage?.timestamp),
                  }
                : {}),
              messages: mappedMessages,
            }
          : chat,
      ),
    );
  };

  const markConversationAsRead = async (contactId) => {
    const ownerId = effectiveUserId;
    if (!ownerId || !contactId) return;

    const response = await fetch(`${API_BASE_URL}/messages/read`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(currentUser?.accessToken
          ? { Authorization: `Bearer ${currentUser.accessToken}` }
          : {}),
      },
      body: JSON.stringify({ ownerId, contactId }),
    });

    const payload = await parseApiPayload(response);
    if (!response.ok) {
      if (response.status === 401 || isAuthExpiredMessage(payload.message)) {
        handleAuthExpired(payload.message || "JWT expired");
      }
      throw new Error(payload.message || "Failed to mark messages as read.");
    }

    setApiErrorMessage("");

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === contactId
          ? {
              ...chat,
              unread: 0,
              messages: (chat.messages || []).map((m) =>
                !m.fromMe ? { ...m, read: true } : m,
              ),
            }
          : chat,
      ),
    );
  };

  useEffect(() => {
    markConversationAsReadRef.current = markConversationAsRead;
  }, [markConversationAsRead]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        await fetchConversations();
      } catch (error) {
        if (isMounted) {
          console.error(error);
          setApiErrorMessage(
            toFriendlyNetworkError(error, "Failed to load conversations."),
          );
        }
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [currentUser?.id, currentUser?.accessToken]);

  useEffect(() => {
    if (preferences.muteNotifications) return;
    if (!("Notification" in window)) return;
    if (Notification.permission === "default")
      Notification.requestPermission().catch(() => null);
  }, [preferences.muteNotifications]);

  useEffect(() => {
    if (!chats.length) {
      setSelectedChatId(null);
      return;
    }
    const stillSelected = chats.some((c) => c.id === selectedChatId);
    if (!stillSelected) setSelectedChatId(chats[0].id);
  }, [chats, selectedChatId]);

  useEffect(() => {
    if (!selectedChat?.id || !effectiveUserId) return;
    fetchMessagesForContact(selectedChat.id).catch((error) => {
      console.error(error);
      setApiErrorMessage(
        toFriendlyNetworkError(error, "Failed to load messages."),
      );
    });
    markConversationAsRead(selectedChat.id).catch((error) => {
      console.error(error);
    });
  }, [selectedChat?.id, effectiveUserId, currentUser?.accessToken]);

  useEffect(() => {
    const userId = effectiveUserId;
    if (!userId) return;

    setSocketStatus("connecting");
    const socket = io(API_BASE_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
    });
    socketRef.current = socket;

    const handleConnected = () => {
      setSocketStatus("connected");
      setApiErrorMessage("");
      socket.emit("chat:join-user", { userId });
    };
    const handleDisconnected = () => {
      setSocketStatus("disconnected");
    };
    const handleReconnectAttempt = () => {
      setSocketStatus("reconnecting");
    };
    const handleConnectError = () => {
      setSocketStatus("error");
    };

    const handlePresenceSnapshot = (event = {}) => {
      const onlineUserIds = new Set(
        (Array.isArray(event?.onlineUserIds) ? event.onlineUserIds : []).map(
          (id) => String(id || "").trim(),
        ),
      );
      const lastSeenByUser = event?.lastSeenByUser || {};

      setChats((previous) =>
        previous.map((chat) => {
          const chatId = String(chat?.id || "").trim();
          if (!chatId) {
            return chat;
          }

          const isOnline = onlineUserIds.has(chatId);
          const lastSeen = isOnline
            ? "Online now"
            : String(lastSeenByUser?.[chatId] || chat.lastSeen || "Offline");

          return {
            ...chat,
            status: isOnline ? "Online" : "Offline",
            lastSeen,
          };
        }),
      );
    };

    const handlePresenceUpdate = (event = {}) => {
      const targetUserId = String(event.userId || "").trim();
      if (!targetUserId) {
        return;
      }

      const status = String(event.status || "").trim() || "Offline";
      const lastSeenRaw = String(event.lastSeen || "").trim();

      setChats((previous) =>
        previous.map((chat) =>
          chat.id === targetUserId
            ? {
                ...chat,
                status,
                lastSeen:
                  status === "Online"
                    ? "Online now"
                    : lastSeenRaw || chat.lastSeen || "Offline",
              }
            : chat,
        ),
      );
    };

    const handleTyping = (event = {}) => {
      const fromUserId = String(event.fromUserId || "").trim();
      if (!fromUserId || fromUserId === userId) {
        return;
      }

      if (!event.isTyping) {
        setTypingByChatId((previous) => ({
          ...previous,
          [fromUserId]: false,
        }));
        return;
      }

      setTypingByChatId((previous) => ({
        ...previous,
        [fromUserId]: true,
      }));

      window.setTimeout(() => {
        setTypingByChatId((previous) => ({
          ...previous,
          [fromUserId]: false,
        }));
      }, 1400);
    };

    const handleIncomingMessage = async (event = {}) => {
      const senderId = String(event.senderId || "").trim();
      const receiverId = String(event.receiverId || "").trim();
      if (!senderId || !receiverId) return;
      if (senderId !== userId && receiverId !== userId) return;

      const contactId = senderId === userId ? receiverId : senderId;
      const incomingTimestamp = event.timestamp || new Date().toISOString();
      const isFromMe = senderId === userId;
      let chatExists = false;

      setChats((previous) => {
        const updated = previous.map((chat) => {
          if (chat.id !== contactId) return chat;
          chatExists = true;

          const incomingMessage = {
            id: event.id || null,
            text: String(event.text || ""),
            imageUrl: String(event.imageUrl || ""),
            audioUrl: String(event.audioUrl || ""),
            timestamp: formatTime(incomingTimestamp),
            createdAt: incomingTimestamp,
            fromMe: isFromMe,
            read: isFromMe,
            readAt: null,
            deliveredAt: incomingTimestamp,
          };

          const fp = buildMessageFingerprint(incomingMessage);
          const alreadyExists = (chat.messages || []).some(
            (m) => buildMessageFingerprint(m) === fp,
          );

          let nextMessages = chat.messages || [];
          const incomingClientId = String(event.clientId || "").trim();

          if (isFromMe && incomingClientId) {
            const clientIndex = nextMessages.findIndex(
              (message) => message?.clientId === incomingClientId,
            );

            if (clientIndex >= 0) {
              nextMessages = nextMessages.map((message, index) =>
                index === clientIndex
                  ? {
                      ...message,
                      ...incomingMessage,
                      clientId: incomingClientId,
                      pending: false,
                      failed: false,
                    }
                  : message,
              );
            } else if (!alreadyExists) {
              nextMessages = [...nextMessages, incomingMessage];
            }
          } else if (isFromMe && !alreadyExists) {
            const pendingIndex = nextMessages.findIndex(
              (message) =>
                message?.fromMe &&
                message?.pending &&
                !message?.id &&
                String(message?.text || "").trim() ===
                  String(incomingMessage.text || "").trim() &&
                String(message?.imageUrl || "").trim() ===
                  String(incomingMessage.imageUrl || "").trim() &&
                String(message?.audioUrl || "").trim() ===
                  String(incomingMessage.audioUrl || "").trim(),
            );

            if (pendingIndex >= 0) {
              nextMessages = nextMessages.map((message, index) =>
                index === pendingIndex
                  ? {
                      ...message,
                      ...incomingMessage,
                      pending: false,
                      failed: false,
                    }
                  : message,
              );
            } else {
              nextMessages = [...nextMessages, incomingMessage];
            }
          } else if (!alreadyExists) {
            nextMessages = [...nextMessages, incomingMessage];
          }

          const shouldIncrementUnread =
            !isFromMe &&
            selectedChatIdRef.current !== contactId &&
            !alreadyExists;

          return {
            ...chat,
            lastMessage: buildLastMessagePreview(event),
            lastMessageFromMe: isFromMe,
            lastMessageAt: incomingTimestamp,
            time: formatTime(incomingTimestamp),
            unread: shouldIncrementUnread ? Number(chat.unread || 0) + 1 : 0,
            messages: nextMessages,
          };
        });

        return updated.sort(
          (a, b) =>
            new Date(b.lastMessageAt || 0).getTime() -
            new Date(a.lastMessageAt || 0).getTime(),
        );
      });

      if (!chatExists) await fetchConversationsRef.current();
      if (!isFromMe && selectedChatIdRef.current === contactId)
        await markConversationAsReadRef.current(contactId);

      if (
        !isFromMe &&
        selectedChatIdRef.current !== contactId &&
        !preferencesRef.current.muteNotifications &&
        "Notification" in window &&
        Notification.permission === "granted" &&
        document.hidden
      ) {
        const label =
          chatsRef.current.find((c) => c.id === contactId)?.name ||
          "New message";
        new Notification(label, {
          body: (() => {
            const text = String(event.text || "");
            if (text) return text;
            if (String(event.imageUrl || "")) return "📷 You received a photo.";
            if (String(event.audioUrl || ""))
              return "🎤 You received a voice message.";
            return "You received a new message.";
          })(),
        });
      }
    };

    const handleMessageUpdated = (event = {}) => {
      const messageId = String(event.id || "").trim();
      if (!messageId) {
        return;
      }

      setChats((previous) =>
        previous.map((chatItem) => {
          const hasTarget = (chatItem.messages || []).some(
            (message) => String(message.id || "").trim() === messageId,
          );
          if (!hasTarget) {
            return chatItem;
          }

          const nextMessages = (chatItem.messages || []).map((message) =>
            String(message.id || "").trim() === messageId
              ? {
                  ...message,
                  text: String(event.text || ""),
                  imageUrl: String(event.imageUrl || message.imageUrl || ""),
                  audioUrl: String(event.audioUrl || message.audioUrl || ""),
                  edited: true,
                  editedAt: event.editedAt || new Date().toISOString(),
                }
              : message,
          );

          return {
            ...chatItem,
            ...recalculateChatSummary(nextMessages),
            messages: nextMessages,
          };
        }),
      );
    };

    const handleMessageDeleted = (event = {}) => {
      const messageId = String(event.id || "").trim();
      if (!messageId) {
        return;
      }

      setChats((previous) =>
        previous.map((chatItem) => {
          const nextMessages = (chatItem.messages || []).filter(
            (message) => String(message.id || "").trim() !== messageId,
          );

          if (nextMessages.length === (chatItem.messages || []).length) {
            return chatItem;
          }

          return {
            ...chatItem,
            ...recalculateChatSummary(nextMessages),
            messages: nextMessages,
          };
        }),
      );
    };

    socket.on("connect", handleConnected);
    socket.on("disconnect", handleDisconnected);
    socket.io.on("reconnect_attempt", handleReconnectAttempt);
    socket.io.on("reconnect", handleConnected);
    socket.on("connect_error", handleConnectError);
    socket.on("chat:presence:snapshot", handlePresenceSnapshot);
    socket.on("chat:user:presence", handlePresenceUpdate);
    socket.on("chat:typing", handleTyping);
    socket.on("chat:message:new", handleIncomingMessage);
    socket.on("chat:message:updated", handleMessageUpdated);
    socket.on("chat:message:deleted", handleMessageDeleted);
    if (socket.connected) handleConnected();

    return () => {
      socket.off("connect", handleConnected);
      socket.off("disconnect", handleDisconnected);
      socket.io.off("reconnect_attempt", handleReconnectAttempt);
      socket.io.off("reconnect", handleConnected);
      socket.off("connect_error", handleConnectError);
      socket.off("chat:presence:snapshot", handlePresenceSnapshot);
      socket.off("chat:user:presence", handlePresenceUpdate);
      socket.off("chat:typing", handleTyping);
      socket.off("chat:message:new", handleIncomingMessage);
      socket.off("chat:message:updated", handleMessageUpdated);
      socket.off("chat:message:deleted", handleMessageDeleted);
      socket.disconnect();
      socketRef.current = null;
      setSocketStatus("disconnected");
    };
  }, [effectiveUserId]);

  useEffect(() => {
    if (!currentUser) return;
    setMobileProfile((prev) => ({
      ...prev,
      name: currentUser.name || prev.name,
      email: currentUser.email || prev.email,
      phone: currentUser.phone || prev.phone,
      statusText: currentUser.statusText || prev.statusText,
      image: currentUser.image || prev.image,
    }));
  }, [currentUser]);

  const mobileProfileSubtitle =
    mobileProfile.statusText?.trim() || mobileProfile.email || "No bio yet";
  const mobileProfileInitial =
    mobileProfile.name?.trim()?.charAt(0)?.toUpperCase() || "U";

  const openMobileProfileEditor = () => {
    setMobileDraftProfile(mobileProfile);
    setIsMobileProfileOpen(true);
  };

  const handleMobileImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setMobileDraftProfile((prev) => ({
        ...prev,
        image: typeof reader.result === "string" ? reader.result : "",
      }));
    };
    reader.readAsDataURL(file);
  };

  const saveMobileProfile = async () => {
    try {
      await onProfileSave?.(mobileDraftProfile);
      setMobileProfile(mobileDraftProfile);
      setIsMobileProfileOpen(false);
    } catch (error) {
      alert(error.message || "Failed to save profile.");
    }
  };

  const searchUserByNameOrEmail = async (query, options = {}) => {
    const requestedLimit = Number.isFinite(Number(options?.limit))
      ? Number(options.limit)
      : 20;
    const requestedOffset = Number.isFinite(Number(options?.offset))
      ? Number(options.offset)
      : 0;

    const response = await fetch(
      `${API_BASE_URL}/profiles/search?query=${encodeURIComponent(query)}&excludeId=${encodeURIComponent(effectiveUserId)}&limit=${encodeURIComponent(requestedLimit)}&offset=${encodeURIComponent(requestedOffset)}`,
      {
        headers: currentUser?.accessToken
          ? { Authorization: `Bearer ${currentUser.accessToken}` }
          : undefined,
      },
    );
    const payload = await parseApiPayload(response);
    if (!response.ok) {
      if (response.status === 401 || isAuthExpiredMessage(payload.message)) {
        handleAuthExpired(payload.message || "JWT expired");
      }
      throw new Error(payload.message || "Failed to find user.");
    }

    const profiles = Array.isArray(payload.profiles)
      ? payload.profiles
      : payload.profile
        ? [payload.profile]
        : [];

    return {
      profiles,
      pagination: {
        hasMore: Boolean(payload?.pagination?.hasMore),
        nextOffset: Number.isFinite(payload?.pagination?.nextOffset)
          ? payload.pagination.nextOffset
          : requestedOffset + profiles.length,
      },
    };
  };

  const addUserToChats = async (profile) => {
    const response = await fetch(`${API_BASE_URL}/contacts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(currentUser?.accessToken
          ? { Authorization: `Bearer ${currentUser.accessToken}` }
          : {}),
      },
      body: JSON.stringify({
        ownerId: effectiveUserId,
        contactId: profile?.id,
      }),
    });
    const payload = await parseApiPayload(response);
    if (!response.ok) {
      if (response.status === 401 || isAuthExpiredMessage(payload.message)) {
        handleAuthExpired(payload.message || "JWT expired");
      }
      throw new Error(payload.message || "Failed to add user.");
    }

    const nextChat = mapProfileToChat(payload.contact || profile);
    setChats((prev) => {
      if (prev.some((c) => c.id === nextChat.id)) return prev;
      return [nextChat, ...prev];
    });
    setSelectedChatId(nextChat.id);
  };

  const handleSelectChat = (chatId) => {
    setSelectedChatId(chatId);
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, unread: 0 } : c)),
    );
  };

  const sendMessageRequest = async ({
    chatId,
    text,
    imageDataUrl,
    audioDataUrl,
    clientId,
  }) => {
    const response = await fetch(`${API_BASE_URL}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(currentUser?.accessToken
          ? { Authorization: `Bearer ${currentUser.accessToken}` }
          : {}),
      },
      body: JSON.stringify({
        senderId: effectiveUserId,
        receiverId: chatId,
        text,
        imageDataUrl,
        audioDataUrl,
        clientId,
      }),
    });

    const payload = await parseApiPayload(response);
    if (!response.ok) {
      if (response.status === 401 || isAuthExpiredMessage(payload.message)) {
        handleAuthExpired(payload.message || "JWT expired");
      }
      throw new Error(payload.message || "Failed to send message.");
    }

    return payload;
  };

  const editMessageRequest = async ({ messageId, text }) => {
    const response = await fetch(
      `${API_BASE_URL}/messages/${encodeURIComponent(messageId)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(currentUser?.accessToken
            ? { Authorization: `Bearer ${currentUser.accessToken}` }
            : {}),
        },
        body: JSON.stringify({
          ownerId: effectiveUserId,
          text,
        }),
      },
    );

    const payload = await parseApiPayload(response);
    if (!response.ok) {
      if (response.status === 401 || isAuthExpiredMessage(payload.message)) {
        handleAuthExpired(payload.message || "JWT expired");
      }
      throw new Error(payload.message || "Failed to edit message.");
    }

    return payload;
  };

  const deleteMessageRequest = async ({ messageId }) => {
    const response = await fetch(
      `${API_BASE_URL}/messages/${encodeURIComponent(messageId)}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(currentUser?.accessToken
            ? { Authorization: `Bearer ${currentUser.accessToken}` }
            : {}),
        },
        body: JSON.stringify({
          ownerId: effectiveUserId,
        }),
      },
    );

    const payload = await parseApiPayload(response);
    if (!response.ok) {
      if (response.status === 401 || isAuthExpiredMessage(payload.message)) {
        handleAuthExpired(payload.message || "JWT expired");
      }
      throw new Error(payload.message || "Failed to delete message.");
    }

    return payload;
  };

  const updateOptimisticMessageState = ({
    chatId,
    clientId,
    patch,
    fallbackPayload,
    fallbackTimestamp,
  }) => {
    setChats((previous) =>
      previous.map((chatItem) => {
        if (chatItem.id !== chatId) {
          return chatItem;
        }

        const nextMessages = (chatItem.messages || []).map((message) =>
          message.clientId === clientId ? { ...message, ...patch } : message,
        );

        return {
          ...chatItem,
          lastMessage: buildLastMessagePreview(fallbackPayload),
          lastMessageFromMe: true,
          lastMessageAt: fallbackTimestamp,
          time: formatTime(fallbackTimestamp),
          unread: 0,
          messages: nextMessages,
        };
      }),
    );
  };

  const handleRetryFailedMessage = async (chatId, message = {}) => {
    const nextChatId = String(chatId || "").trim();
    if (!nextChatId || !effectiveUserId) {
      return;
    }

    const clientId = String(message.clientId || message.id || "").trim();
    if (!clientId) {
      return;
    }

    const payload = {
      text: String(message.text || "").trim(),
      imageDataUrl: String(
        message.imageDataUrl || message.imageUrl || "",
      ).trim(),
      audioDataUrl: String(
        message.audioDataUrl || message.audioUrl || "",
      ).trim(),
      clientId,
    };

    const fallbackPayload = {
      text: payload.text,
      imageUrl: payload.imageDataUrl,
      audioUrl: payload.audioDataUrl,
    };

    updateOptimisticMessageState({
      chatId: nextChatId,
      clientId,
      patch: { failed: false, pending: true },
      fallbackPayload,
      fallbackTimestamp: new Date().toISOString(),
    });

    try {
      const payloadResult = await sendMessageRequest({
        chatId: nextChatId,
        text: payload.text,
        imageDataUrl: payload.imageDataUrl,
        audioDataUrl: payload.audioDataUrl,
        clientId: payload.clientId,
      });

      const deliveredAt =
        payloadResult.message?.timestamp || new Date().toISOString();
      const resolvedMessage = {
        ...(payloadResult.message || {}),
        clientId: clientId,
        pending: false,
        failed: false,
        deliveredAt,
        createdAt: deliveredAt,
        timestamp: formatTime(deliveredAt),
      };

      updateOptimisticMessageState({
        chatId: nextChatId,
        clientId,
        patch: resolvedMessage,
        fallbackPayload: {
          text: payload.text,
          imageUrl: resolvedMessage.imageUrl,
          audioUrl: resolvedMessage.audioUrl,
        },
        fallbackTimestamp: deliveredAt,
      });
      setApiErrorMessage("");
    } catch (error) {
      updateOptimisticMessageState({
        chatId: nextChatId,
        clientId,
        patch: { failed: true, pending: false },
        fallbackPayload,
        fallbackTimestamp: new Date().toISOString(),
      });
      setApiErrorMessage(
        toFriendlyNetworkError(error, "Failed to send message."),
      );
    }
  };

  const handleSendMessage = async (chat, inputPayload) => {
    if (!chat?.id || !effectiveUserId) return;

    const { text, imageDataUrl, audioDataUrl } =
      normalizeOutgoingMessageInput(inputPayload);
    const normalizedText = String(text || "").trim();
    const normalizedImage = String(imageDataUrl || "").trim();
    const normalizedAudio = String(audioDataUrl || "").trim();

    if (!normalizedText && !normalizedImage && !normalizedAudio) return;

    const nowIso = new Date().toISOString();
    const clientId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const optimisticMessage = {
      id: null,
      clientId,
      text: normalizedText,
      imageUrl: normalizedImage,
      audioUrl: normalizedAudio,
      imageDataUrl: normalizedImage,
      audioDataUrl: normalizedAudio,
      timestamp: formatTime(nowIso),
      createdAt: nowIso,
      fromMe: true,
      read: false,
      readAt: null,
      deliveredAt: null,
      pending: true,
      failed: false,
    };

    setChats((previous) => {
      const updated = previous.map((chatItem) => {
        if (chatItem.id !== chat.id) {
          return chatItem;
        }

        return {
          ...chatItem,
          lastMessage: buildLastMessagePreview({
            text: normalizedText,
            imageUrl: normalizedImage,
            audioUrl: normalizedAudio,
          }),
          lastMessageFromMe: true,
          lastMessageAt: nowIso,
          time: formatTime(nowIso),
          unread: 0,
          messages: [...(chatItem.messages || []), optimisticMessage],
        };
      });

      return updated.sort(
        (a, b) =>
          new Date(b.lastMessageAt || 0).getTime() -
          new Date(a.lastMessageAt || 0).getTime(),
      );
    });

    if (isSendingMessageRef.current) {
      return;
    }

    isSendingMessageRef.current = true;
    setSendingMessage(true);
    try {
      await handleRetryFailedMessage(chat.id, optimisticMessage);
    } finally {
      isSendingMessageRef.current = false;
      setSendingMessage(false);
    }
  };

  const handleEditMessage = async (chatId, message, nextTextValue) => {
    const nextChatId = String(chatId || "").trim();
    const messageId = String(message?.id || "").trim();
    const nextText = String(nextTextValue || "").trim();

    if (!nextChatId || !messageId) {
      return;
    }

    setChats((previous) =>
      previous.map((chatItem) => {
        if (chatItem.id !== nextChatId) {
          return chatItem;
        }

        const nextMessages = (chatItem.messages || []).map((item) =>
          String(item.id || "").trim() === messageId
            ? {
                ...item,
                text: nextText,
                edited: true,
                editedAt: new Date().toISOString(),
              }
            : item,
        );

        return {
          ...chatItem,
          ...recalculateChatSummary(nextMessages),
          messages: nextMessages,
        };
      }),
    );

    try {
      await editMessageRequest({ messageId, text: nextText });
    } catch (error) {
      setApiErrorMessage(
        toFriendlyNetworkError(error, "Failed to edit message."),
      );
      await fetchMessagesForContact(nextChatId).catch(() => null);
      throw error;
    }
  };

  const handleDeleteMessage = async (chatId, message) => {
    const nextChatId = String(chatId || "").trim();
    const messageId = String(message?.id || "").trim();

    if (!nextChatId || !messageId) {
      return;
    }

    setChats((previous) =>
      previous.map((chatItem) => {
        if (chatItem.id !== nextChatId) {
          return chatItem;
        }

        const nextMessages = (chatItem.messages || []).filter(
          (item) => String(item.id || "").trim() !== messageId,
        );

        return {
          ...chatItem,
          ...recalculateChatSummary(nextMessages),
          messages: nextMessages,
        };
      }),
    );

    try {
      await deleteMessageRequest({ messageId });
    } catch (error) {
      setApiErrorMessage(
        toFriendlyNetworkError(error, "Failed to delete message."),
      );
      await fetchMessagesForContact(nextChatId).catch(() => null);
      throw error;
    }
  };

  useEffect(() => {
    if (socketStatus !== "connected" || autoRetryInProgressRef.current) {
      return;
    }

    const failedMessages = [];
    chats.forEach((chatItem) => {
      (chatItem.messages || []).forEach((message) => {
        if (message?.fromMe && message?.failed) {
          failedMessages.push({ chatId: chatItem.id, message });
        }
      });
    });

    if (!failedMessages.length) {
      return;
    }

    autoRetryInProgressRef.current = true;
    (async () => {
      for (const failedItem of failedMessages.slice(0, 10)) {
        await handleRetryFailedMessage(failedItem.chatId, failedItem.message);
      }
      autoRetryInProgressRef.current = false;
    })();
  }, [socketStatus, chats]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ════════════════ MOBILE layout ════════════════ */}
      <div className="flex h-full w-full flex-col overflow-hidden rounded-none border-0 bg-[#132219]/75 text-white shadow-none backdrop-blur-2xl md:hidden md:rounded-3xl md:border md:border-white/25 md:shadow-2xl">
        {/* Top bar */}
        <div className="shrink-0 flex items-center gap-2 border-b border-white/15 bg-[#0d1712]/80 px-4 py-3">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-lg border border-white/20 bg-white/10 p-2 text-white/90 transition-colors hover:bg-white/15"
            title="Toggle sidebar"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <h2 className="flex-1 text-sm font-semibold tracking-wide text-white/95">
            {selectedChat?.name || "Messages"}
          </h2>
          <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] text-white/80">
            {chats.length}
          </span>
        </div>

        {/* Slide-out sidebar */}
        <div
          className={`fixed inset-y-0 left-0 z-40 w-[86%] max-w-[340px] border-r border-white/15 bg-[#0f1a14]/95 backdrop-blur-xl transition-transform duration-300 md:hidden ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="shrink-0 flex items-center justify-between border-b border-white/15 p-4">
              <h3 className="font-semibold text-white">Chats</h3>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="rounded text-white/70 hover:text-white"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="mx-3 mt-3 mb-2 shrink-0 rounded-2xl border border-white/15 bg-black/20 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/25 text-sm font-semibold text-white">
                    {mobileProfile.image ? (
                      <img
                        src={mobileProfile.image}
                        alt="Mobile profile"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>{mobileProfileInitial}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white/95">
                      {mobileProfile.name}
                    </p>
                    <p className="truncate text-xs text-white/65">
                      {mobileProfileSubtitle}
                    </p>
                  </div>
                </div>
                <UserActions
                  onProfile={openMobileProfileEditor}
                  onSettings={() => setIsMobileSettingsOpen(true)}
                />
              </div>
            </div>

            <div className="mx-3 mb-2 shrink-0 flex items-center gap-2">
              <input
                type="text"
                value={mobileSearchTerm}
                onChange={(event) => setMobileSearchTerm(event.target.value)}
                placeholder="Search messages..."
                className="w-full rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-xs text-white placeholder:text-white/60 outline-none transition-colors focus:border-lime-200/45"
              />
              <button
                type="button"
                title="Invite user"
                aria-label="Invite user"
                onClick={() => setIsMobileAddUserOpen(true)}
                className="flex h-11 min-w-[46px] shrink-0 items-center justify-center rounded-xl border border-lime-300/65 bg-lime-300/30 px-3 text-xl font-semibold leading-none text-lime-50 shadow-[0_0_0_1px_rgba(163,230,53,0.15)] transition-colors hover:bg-lime-300/40"
              >
                +
              </button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {filteredMobileChats.length === 0 ? (
                <div className="rounded-lg border border-white/15 bg-black/15 p-3 text-sm text-white/75">
                  {chats.length === 0 ? "No users yet." : "No users found."}
                </div>
              ) : (
                filteredMobileChats.map((chat) => (
                  <ChatListItem
                    key={chat.id}
                    chat={chat}
                    isActive={chat.id === selectedChatId}
                    onClick={() => {
                      handleSelectChat(chat.id);
                      setSidebarOpen(false);
                    }}
                    showMessagePreview={preferences.showMessagePreview}
                    showUnreadBadge={preferences.showUnreadBadge}
                    variant="mobile"
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <ProfileModal
          isOpen={isMobileProfileOpen}
          onClose={() => setIsMobileProfileOpen(false)}
          draftProfile={mobileDraftProfile}
          setDraftProfile={setMobileDraftProfile}
          onImageUpload={handleMobileImageUpload}
          onSave={saveMobileProfile}
          containerClassName="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm md:hidden"
        />

        <SettingsModal
          isOpen={isMobileSettingsOpen}
          onClose={() => setIsMobileSettingsOpen(false)}
          preferences={preferences}
          setPreferences={setPreferences}
          onLogout={onLogout}
          description="Suggested quick preferences for cleaner chat experience."
          containerClassName="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm md:hidden"
        />

        <AddUserByPhoneModal
          isOpen={isMobileAddUserOpen}
          onClose={() => setIsMobileAddUserOpen(false)}
          existingIds={chats.map((chat) => chat.id).filter(Boolean)}
          currentUserId={currentUser?.id || ""}
          onSearchUser={searchUserByNameOrEmail}
          onSearchUsers={searchUserByNameOrEmail}
          onAddUser={addUserToChats}
          containerClassName="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm md:hidden"
        />

        {/* CRITICAL FIX: min-h-0 + overflow-hidden so Detail can scroll
            internally without the wrapper growing beyond the screen */}
        <div className="min-h-0 flex-1 overflow-hidden">
          <Detail
            chat={selectedChat}
            onSendMessage={handleSendMessage}
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
            onRetryFailedMessage={handleRetryFailedMessage}
            onRetryConnection={retryNetworkData}
            onTypingChange={queueTypingSignal}
            apiErrorMessage={apiErrorMessage}
            isContactTyping={selectedChatIsTyping}
            sendingMessage={sendingMessage}
            socketStatus={socketStatus}
          />
        </div>
      </div>

      {/* ════════════════ DESKTOP layout ════════════════ */}
      {/* CRITICAL FIX: min-h-0 tells the grid to respect its flex-parent's
          height instead of growing to fit content. minmax(0,1fr) on the
          Detail column already prevents horizontal overflow. */}
      <div className="hidden min-h-0 h-full w-full overflow-hidden rounded-3xl border border-white/25 bg-[#132219]/75 text-white shadow-2xl backdrop-blur-2xl md:grid md:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
        <List
          chats={chats}
          selectedChatId={selectedChatId}
          onSelectChat={handleSelectChat}
          currentUser={currentUser}
          preferences={preferences}
          setPreferences={setPreferences}
          onLogout={onLogout}
          onProfileSave={onProfileSave}
          onSearchUser={searchUserByNameOrEmail}
          onAddUser={addUserToChats}
        />
        <Detail
          chat={selectedChat}
          onSendMessage={handleSendMessage}
          onEditMessage={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          onRetryFailedMessage={handleRetryFailedMessage}
          onRetryConnection={retryNetworkData}
          onTypingChange={queueTypingSignal}
          apiErrorMessage={apiErrorMessage}
          isContactTyping={selectedChatIsTyping}
          sendingMessage={sendingMessage}
          socketStatus={socketStatus}
        />
      </div>
    </>
  );
}

export default Chat;
