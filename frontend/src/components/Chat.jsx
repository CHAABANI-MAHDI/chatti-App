/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import ChatListItem from "./chat/ChatListItem";
import Detail from "./Detail";
import List from "./List";
import ProfileModal from "./modals/ProfileModal";
import SettingsModal from "./modals/SettingsModal";
import UserActions from "./shared/UserActions";
import { API_BASE_URL } from "../lib/apiBaseUrl";

const parseApiPayload = async (response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const mapProfileToChat = (profile) => ({
  id: profile.id || "",
  name: profile.name || "User",
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

const formatTime = (timestamp) => {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const buildMessageFingerprint = (message = {}) => {
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

const normalizeOutgoingMessageInput = (payload) => {
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

const buildLastMessagePreview = (payload = {}) => {
  const text = String(payload.text || "").trim();
  const imageUrl = String(payload.imageUrl || "").trim();
  const audioUrl = String(payload.audioUrl || "").trim();

  if (text) return text;
  if (imageUrl) return "📷 Photo";
  if (audioUrl) return "🎤 Voice message";
  return "";
};

const isAuthExpiredMessage = (message = "") =>
  /jwt expired|invalid jwt|token expired/i.test(String(message || ""));

const mapConversationToChat = (conversation) => ({
  ...mapProfileToChat(conversation),
  lastMessage: conversation.lastMessage || "",
  lastMessageFromMe: Boolean(conversation.lastMessageFromMe),
  unread: Number(conversation.unread || 0),
  time: formatTime(conversation.lastMessageAt),
  lastMessageAt: conversation.lastMessageAt || null,
});

const APP_PREFERENCES_KEY = "relatime-chat-preferences";
const DEFAULT_PREFERENCES = {
  showMessagePreview: true,
  showUnreadBadge: true,
  muteNotifications: false,
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

function Chat({ currentUser, onLogout, onProfileSave }) {
  const effectiveUserId = String(
    currentUser?.profileId || currentUser?.id || "",
  ).trim();
  const [chats, setChats] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [socketStatus, setSocketStatus] = useState("connecting");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileProfile, setMobileProfile] = useState({
    name: currentUser?.name || "My Profile",
    email: currentUser?.email || "",
    statusText: currentUser?.statusText || "",
    image: currentUser?.image || "",
  });
  const [mobileDraftProfile, setMobileDraftProfile] = useState(mobileProfile);
  const [isMobileProfileOpen, setIsMobileProfileOpen] = useState(false);
  const [isMobileSettingsOpen, setIsMobileSettingsOpen] = useState(false);
  const [preferences, setPreferences] = useState(readStoredPreferences);

  const socketRef = useRef(null);
  const isSendingMessageRef = useRef(false);
  const authExpiredHandledRef = useRef(false);
  const selectedChatIdRef = useRef(null);
  const chatsRef = useRef([]);
  const fetchConversationsRef = useRef(async () => {});
  const markConversationAsReadRef = useRef(async () => {});
  const preferencesRef = useRef(preferences);

  const selectedChat = useMemo(
    () => chats.find((chat) => chat.id === selectedChatId) ?? null,
    [chats, selectedChatId],
  );

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

  const handleAuthExpired = (message = "") => {
    if (authExpiredHandledRef.current) return;
    authExpiredHandledRef.current = true;
    alert(message || "Session expired. Please sign in again.");
    onLogout?.();
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
        if (isMounted) console.error(error);
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
    fetchMessagesForContact(selectedChat.id).catch(console.error);
    markConversationAsRead(selectedChat.id).catch(console.error);
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
          };

          const fp = buildMessageFingerprint(incomingMessage);
          const alreadyExists = (chat.messages || []).some(
            (m) => buildMessageFingerprint(m) === fp,
          );

          const nextMessages = alreadyExists
            ? chat.messages || []
            : [...(chat.messages || []), incomingMessage];

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

    socket.on("connect", handleConnected);
    socket.on("disconnect", handleDisconnected);
    socket.io.on("reconnect_attempt", handleReconnectAttempt);
    socket.io.on("reconnect", handleConnected);
    socket.on("connect_error", handleConnectError);
    socket.on("chat:message:new", handleIncomingMessage);
    if (socket.connected) handleConnected();

    return () => {
      socket.off("connect", handleConnected);
      socket.off("disconnect", handleDisconnected);
      socket.io.off("reconnect_attempt", handleReconnectAttempt);
      socket.io.off("reconnect", handleConnected);
      socket.off("connect_error", handleConnectError);
      socket.off("chat:message:new", handleIncomingMessage);
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

  const searchUserByNameOrEmail = async (query) => {
    const response = await fetch(
      `${API_BASE_URL}/profiles/search?query=${encodeURIComponent(query)}&excludeId=${encodeURIComponent(effectiveUserId)}`,
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
    return payload.profile || null;
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

  const handleSendMessage = async (chat, inputPayload) => {
    if (!chat?.id || !effectiveUserId) return;
    if (isSendingMessageRef.current) return;

    const { text, imageDataUrl, audioDataUrl } =
      normalizeOutgoingMessageInput(inputPayload);
    const normalizedText = String(text || "").trim();

    if (!normalizedText && !imageDataUrl && !audioDataUrl) return;

    isSendingMessageRef.current = true;
    setSendingMessage(true);
    try {
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
          receiverId: chat.id,
          text: normalizedText,
          imageDataUrl,
          audioDataUrl,
        }),
      });

      const payload = await parseApiPayload(response);
      if (!response.ok) {
        if (response.status === 401 || isAuthExpiredMessage(payload.message)) {
          handleAuthExpired(payload.message || "JWT expired");
        }
        throw new Error(payload.message || "Failed to send message.");
      }

      const nextMessage = {
        ...(payload.message || {}),
        createdAt: payload.message?.timestamp || new Date().toISOString(),
        timestamp: formatTime(
          payload.message?.timestamp || new Date().toISOString(),
        ),
      };
      const fp = buildMessageFingerprint(nextMessage);

      setChats((prev) => {
        const updated = prev.map((item) => {
          if (item.id !== chat.id) return item;
          const alreadyExists = (item.messages || []).some(
            (m) => buildMessageFingerprint(m) === fp,
          );
          return {
            ...item,
            lastMessage: buildLastMessagePreview({
              text: normalizedText,
              imageUrl: nextMessage.imageUrl,
              audioUrl: nextMessage.audioUrl,
            }),
            lastMessageFromMe: true,
            lastMessageAt:
              payload.message?.timestamp || new Date().toISOString(),
            time: formatTime(
              payload.message?.timestamp || new Date().toISOString(),
            ),
            unread: 0,
            messages: alreadyExists
              ? item.messages || []
              : [...(item.messages || []), nextMessage],
          };
        });
        return updated.sort(
          (a, b) =>
            new Date(b.lastMessageAt || 0).getTime() -
            new Date(a.lastMessageAt || 0).getTime(),
        );
      });
    } finally {
      isSendingMessageRef.current = false;
      setSendingMessage(false);
    }
  };

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

            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {chats.length === 0 ? (
                <div className="rounded-lg border border-white/15 bg-black/15 p-3 text-sm text-white/75">
                  No users yet.
                </div>
              ) : (
                chats.map((chat) => (
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

        {/* CRITICAL FIX: min-h-0 + overflow-hidden so Detail can scroll
            internally without the wrapper growing beyond the screen */}
        <div className="min-h-0 flex-1 overflow-hidden">
          <Detail
            chat={selectedChat}
            onSendMessage={handleSendMessage}
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
          sendingMessage={sendingMessage}
          socketStatus={socketStatus}
        />
      </div>
    </>
  );
}

export default Chat;
