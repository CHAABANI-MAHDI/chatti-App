import { useEffect, useMemo, useRef, useState } from "react";
import ChatListItem from "./chat/ChatListItem";
import Detail from "./Detail";
import List from "./List";
import ProfileModal from "./modals/ProfileModal";
import SettingsModal from "./modals/SettingsModal";
import UserActions from "./shared/UserActions";
import { API_BASE_URL } from "../lib/apiBaseUrl";

const POLL_INTERVAL_MS = 5000;

const parseApiPayload = async (response) => {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const mapProfileToChat = (profile) => ({
  id: profile.id || profile.phone,
  name: profile.name || "User",
  status: "Online",
  lastSeen: "Available",
  avatar: profile.name?.trim()?.charAt(0)?.toUpperCase() || "U",
  image: profile.image || "",
  phone: profile.phone || "",
  role: "Team member",
  timezone: "UTC",
  lastMessage: "",
  time: "",
  unread: 0,
  messages: [],
});

const formatTime = (timestamp) => {
  if (!timestamp) {
    return "";
  }

  const parsedDate = new Date(timestamp);
  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return parsedDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const mapConversationToChat = (conversation) => ({
  ...mapProfileToChat(conversation),
  lastMessage: conversation.lastMessage || "",
  unread: Number(conversation.unread || 0),
  time: formatTime(conversation.lastMessageAt),
  lastMessageAt: conversation.lastMessageAt || null,
});

const mergeChatsWithPreviousState = (previousChats = [], nextChats = []) => {
  const previousByPhone = new Map(
    previousChats
      .filter((chat) => chat?.phone)
      .map((chat) => [chat.phone, chat]),
  );

  return nextChats.map((chat) => {
    const previous = previousByPhone.get(chat.phone);
    return {
      ...chat,
      messages: previous?.messages || [],
    };
  });
};

function Chat({ currentUser, onLogout, onProfileSave }) {
  const [chats, setChats] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [sendingMessage, setSendingMessage] = useState(false);
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
  const [mobilePreferences, setMobilePreferences] = useState({
    showMessagePreview: true,
    showUnreadBadge: true,
    muteNotifications: false,
  });
  const unreadSnapshotRef = useRef(new Map());
  const hasLoadedConversationsRef = useRef(false);

  const selectedChat = useMemo(
    () => chats.find((chat) => chat.id === selectedChatId) ?? null,
    [chats, selectedChatId],
  );

  const fetchConversations = async ({ notify = false } = {}) => {
    if (!currentUser?.phone) {
      setChats([]);
      unreadSnapshotRef.current = new Map();
      hasLoadedConversationsRef.current = false;
      return;
    }

    const response = await fetch(
      `${API_BASE_URL}/conversations/${encodeURIComponent(currentUser.phone)}`,
      {
        headers: currentUser?.accessToken
          ? {
              Authorization: `Bearer ${currentUser.accessToken}`,
            }
          : undefined,
      },
    );

    const payload = await parseApiPayload(response);
    if (!response.ok) {
      throw new Error(payload.message || "Failed to load conversations.");
    }

    const nextChats = (payload.conversations || []).map(mapConversationToChat);

    setChats((previousChats) =>
      mergeChatsWithPreviousState(previousChats, nextChats),
    );

    const nextUnreadMap = new Map(
      nextChats.map((chat) => [chat.phone, Number(chat.unread || 0)]),
    );

    if (
      notify &&
      hasLoadedConversationsRef.current &&
      "Notification" in window
    ) {
      for (const chat of nextChats) {
        const previousUnread = Number(
          unreadSnapshotRef.current.get(chat.phone) || 0,
        );
        const currentUnread = Number(chat.unread || 0);
        if (
          currentUnread > previousUnread &&
          Notification.permission === "granted" &&
          document.hidden
        ) {
          new Notification(chat.name || "New message", {
            body: chat.lastMessage || "You received a new message.",
          });
        }
      }
    }

    unreadSnapshotRef.current = nextUnreadMap;
    hasLoadedConversationsRef.current = true;
  };

  const fetchMessagesForContact = async (contactPhone) => {
    if (!currentUser?.phone || !contactPhone) {
      return;
    }

    const response = await fetch(
      `${API_BASE_URL}/messages?ownerPhone=${encodeURIComponent(
        currentUser.phone,
      )}&contactPhone=${encodeURIComponent(contactPhone)}`,
      {
        headers: currentUser?.accessToken
          ? {
              Authorization: `Bearer ${currentUser.accessToken}`,
            }
          : undefined,
      },
    );

    const payload = await parseApiPayload(response);
    if (!response.ok) {
      throw new Error(payload.message || "Failed to load messages.");
    }

    const mappedMessages = (payload.messages || []).map((message) => ({
      ...message,
      timestamp: formatTime(message.timestamp),
    }));

    setChats((previous) =>
      previous.map((chat) =>
        chat.phone === contactPhone
          ? {
              ...chat,
              messages: mappedMessages,
            }
          : chat,
      ),
    );
  };

  const markConversationAsRead = async (contactPhone) => {
    if (!currentUser?.phone || !contactPhone) {
      return;
    }

    const response = await fetch(`${API_BASE_URL}/messages/read`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(currentUser?.accessToken
          ? {
              Authorization: `Bearer ${currentUser.accessToken}`,
            }
          : {}),
      },
      body: JSON.stringify({
        ownerPhone: currentUser.phone,
        contactPhone,
      }),
    });

    const payload = await parseApiPayload(response);
    if (!response.ok) {
      throw new Error(payload.message || "Failed to mark messages as read.");
    }

    setChats((previous) =>
      previous.map((chat) =>
        chat.phone === contactPhone
          ? {
              ...chat,
              unread: 0,
              messages: (chat.messages || []).map((message) =>
                !message.fromMe ? { ...message, read: true } : message,
              ),
            }
          : chat,
      ),
    );
  };

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        await fetchConversations({ notify: false });
      } catch (error) {
        if (isMounted) {
          console.error(error);
        }
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [currentUser?.phone, currentUser?.accessToken]);

  useEffect(() => {
    if (!currentUser?.phone) {
      return;
    }

    const timer = window.setInterval(() => {
      fetchConversations({ notify: true })
        .then(async () => {
          if (selectedChat?.phone) {
            await fetchMessagesForContact(selectedChat.phone);
            await markConversationAsRead(selectedChat.phone);
          }
        })
        .catch((error) => console.error(error));
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [currentUser?.phone, currentUser?.accessToken, selectedChat?.phone]);

  useEffect(() => {
    if (!("Notification" in window)) {
      return;
    }

    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => null);
    }
  }, []);

  useEffect(() => {
    if (!chats.length) {
      setSelectedChatId(null);
      return;
    }

    const chatStillSelected = chats.some((chat) => chat.id === selectedChatId);
    if (!chatStillSelected) {
      setSelectedChatId(chats[0].id);
    }
  }, [chats, selectedChatId]);

  useEffect(() => {
    if (!selectedChat?.phone || !currentUser?.phone) {
      return;
    }

    fetchMessagesForContact(selectedChat.phone).catch((error) =>
      console.error(error),
    );
    markConversationAsRead(selectedChat.phone).catch((error) =>
      console.error(error),
    );
  }, [selectedChat?.phone, currentUser?.phone, currentUser?.accessToken]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    setMobileProfile((previous) => ({
      ...previous,
      name: currentUser.name || previous.name,
      email: currentUser.email || previous.email,
      statusText: currentUser.statusText || previous.statusText,
      image: currentUser.image || previous.image,
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

    if (!file) {
      return;
    }

    const fileReader = new FileReader();
    fileReader.onload = () => {
      setMobileDraftProfile((previous) => ({
        ...previous,
        image: typeof fileReader.result === "string" ? fileReader.result : "",
      }));
    };
    fileReader.readAsDataURL(file);
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
      `${API_BASE_URL}/profiles/search?query=${encodeURIComponent(
        query,
      )}&excludePhone=${encodeURIComponent(currentUser?.phone || "")}`,
      {
        headers: currentUser?.accessToken
          ? {
              Authorization: `Bearer ${currentUser.accessToken}`,
            }
          : undefined,
      },
    );

    const payload = await parseApiPayload(response);
    if (!response.ok) {
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
          ? {
              Authorization: `Bearer ${currentUser.accessToken}`,
            }
          : {}),
      },
      body: JSON.stringify({
        ownerPhone: currentUser?.phone,
        contactPhone: profile?.phone,
      }),
    });

    const payload = await parseApiPayload(response);
    if (!response.ok) {
      throw new Error(payload.message || "Failed to add user.");
    }

    const nextChat = mapProfileToChat(payload.contact || profile);

    setChats((previous) => {
      const exists = previous.some((chat) => chat.phone === nextChat.phone);
      if (exists) {
        return previous;
      }

      return [nextChat, ...previous];
    });

    setSelectedChatId(nextChat.id);
  };

  const handleSendMessage = async (chat, text) => {
    if (!chat?.phone || !currentUser?.phone) {
      return;
    }

    setSendingMessage(true);
    try {
      const response = await fetch(`${API_BASE_URL}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(currentUser?.accessToken
            ? {
                Authorization: `Bearer ${currentUser.accessToken}`,
              }
            : {}),
        },
        body: JSON.stringify({
          senderPhone: currentUser.phone,
          receiverPhone: chat.phone,
          text,
        }),
      });

      const payload = await parseApiPayload(response);
      if (!response.ok) {
        throw new Error(payload.message || "Failed to send message.");
      }

      const nextMessage = {
        ...(payload.message || {}),
        timestamp: formatTime(
          payload.message?.timestamp || new Date().toISOString(),
        ),
      };

      setChats((previous) => {
        const updated = previous.map((item) => {
          if (item.phone !== chat.phone) {
            return item;
          }

          return {
            ...item,
            lastMessage: text,
            lastMessageAt:
              payload.message?.timestamp || new Date().toISOString(),
            time: formatTime(
              payload.message?.timestamp || new Date().toISOString(),
            ),
            unread: 0,
            messages: [...(item.messages || []), nextMessage],
          };
        });

        return updated.sort((first, second) => {
          const firstTime = new Date(first.lastMessageAt || 0).getTime();
          const secondTime = new Date(second.lastMessageAt || 0).getTime();
          return secondTime - firstTime;
        });
      });
    } finally {
      setSendingMessage(false);
    }
  };

  return (
    <>
      <div className="flex h-full w-full flex-col overflow-hidden rounded-3xl border border-white/25 bg-[#132219]/75 text-white shadow-2xl backdrop-blur-2xl md:hidden">
        <div className="flex items-center gap-2 border-b border-white/15 bg-[#0d1712]/80 px-4 py-3">
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

        <div
          className={`fixed inset-y-0 left-0 z-40 w-[82%] max-w-[320px] border-r border-white/15 bg-[#0f1a14]/95 backdrop-blur-xl transition-transform duration-300 md:hidden ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-white/15 p-4">
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

            <div className="mx-3 mt-3 mb-2 rounded-2xl border border-white/15 bg-black/20 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white/25 text-sm font-semibold text-white">
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
                      setSelectedChatId(chat.id);
                      setSidebarOpen(false);
                    }}
                    showMessagePreview={mobilePreferences.showMessagePreview}
                    showUnreadBadge={mobilePreferences.showUnreadBadge}
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
          preferences={mobilePreferences}
          setPreferences={setMobilePreferences}
          onLogout={onLogout}
          description="Quick preferences for mobile chat list."
          containerClassName="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm md:hidden"
        />

        <div className="min-h-0 flex-1">
          <Detail
            chat={selectedChat}
            onSendMessage={handleSendMessage}
            sendingMessage={sendingMessage}
          />
        </div>
      </div>

      <div className="hidden h-full w-full overflow-hidden rounded-3xl border border-white/25 bg-[#132219]/75 text-white shadow-2xl backdrop-blur-2xl md:grid md:grid-cols-[320px_minmax(0,1fr)] lg:grid-cols-[360px_minmax(0,1fr)]">
        <List
          chats={chats}
          selectedChatId={selectedChatId}
          onSelectChat={setSelectedChatId}
          currentUser={currentUser}
          onLogout={onLogout}
          onProfileSave={onProfileSave}
          onSearchUser={searchUserByNameOrEmail}
          onAddUser={addUserToChats}
        />
        <Detail
          chat={selectedChat}
          onSendMessage={handleSendMessage}
          sendingMessage={sendingMessage}
        />
      </div>
    </>
  );
}

export default Chat;
