import { useMemo, useState } from "react";
import Detail from "./Detail";
import List from "./List";

const sampleChats = [
  {
    id: 1,
    name: "Rahma",
    status: "Online",
    lastSeen: "Active now",
    avatar: "R",
    email: "rahma@chatapp.dev",
    phone: "+1 202 555 0198",
    role: "Project Manager",
    timezone: "UTC-5",
    lastMessage: "Can we deploy tonight?",
    time: "10:24 PM",
    unread: 2,
    messages: [
      {
        id: 1,
        fromMe: false,
        text: "Hey, can we deploy tonight?",
        timestamp: "10:20 PM",
        read: true,
      },
      {
        id: 2,
        fromMe: true,
        text: "Yes, after final testing.",
        timestamp: "10:21 PM",
        read: true,
      },
      {
        id: 3,
        fromMe: false,
        text: "Perfect. I will prepare notes.",
        timestamp: "10:24 PM",
        read: false,
      },
    ],
  },
  {
    id: 2,
    name: "Helmi",
    status: "Away",
    lastSeen: "Last seen 8m ago",
    avatar: "N",
    email: "helmi@chatapp.dev",
    phone: "+1 202 555 0145",
    role: "Frontend Engineer",
    timezone: "UTC+1",
    lastMessage: "UI is looking good now.",
    time: "09:58 PM",
    unread: 0,
    messages: [
      {
        id: 1,
        fromMe: true,
        text: "Did you check the new login page?",
        timestamp: "09:55 PM",
        read: true,
      },
      {
        id: 2,
        fromMe: false,
        text: "Yes, UI is looking good now.",
        timestamp: "09:58 PM",
        read: true,
      },
    ],
  },
  {
    id: 3,
    name: "Maher",
    status: "Online",
    lastSeen: "Active now",
    avatar: "E",
    email: "maher@chatapp.dev",
    phone: "+1 202 555 0112",
    role: "Product Designer",
    timezone: "UTC+3",
    lastMessage: "Let’s sync in 10 mins.",
    time: "09:41 PM",
    unread: 1,
    messages: [
      {
        id: 1,
        fromMe: false,
        text: "Let's sync in 10 mins.",
        timestamp: "09:38 PM",
        read: true,
      },
      {
        id: 2,
        fromMe: true,
        text: "Sure, I am joining.",
        timestamp: "09:41 PM",
        read: false,
      },
    ],
  },
];

function Chat() {
  // Feature: selected chat state
  const [selectedChatId, setSelectedChatId] = useState(
    sampleChats[0]?.id ?? null,
  );

  // Feature: mobile sidebar toggle
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Feature: active chat data
  const selectedChat = useMemo(
    () => sampleChats.find((chat) => chat.id === selectedChatId) ?? null,
    [selectedChatId],
  );

  return (
    <>
      {/* Feature: mobile chat layout */}
      <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/20 bg-[#15241d]/70 text-white shadow-2xl backdrop-blur-xl md:hidden">
        {/* Feature: mobile top bar */}
        <div className="flex items-center gap-2 border-b border-white/15 bg-[#0f1a14]/75 px-3 py-3">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-md border border-white/20 bg-white/10 p-2 text-white/90 transition-colors hover:bg-white/15"
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
          <h2 className="flex-1 text-sm font-semibold tracking-wide text-white/90">
            {selectedChat?.name || "Messages"}
          </h2>
          <span className="rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[10px] text-white/80">
            {sampleChats.length}
          </span>
        </div>

        {/* Feature: mobile sidebar chat list */}
        <div
          className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-white/15 bg-[#0f1a14]/95 backdrop-blur-xl transition-transform duration-300 md:hidden ${
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
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {sampleChats.map((chat) => {
                const isActive = chat.id === selectedChatId;
                return (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => {
                      setSelectedChatId(chat.id);
                      setSidebarOpen(false);
                    }}
                    className={`w-full rounded-lg border p-2 text-left text-xs transition-all ${
                      isActive
                        ? "border-lime-300/70 bg-lime-200/20"
                        : "border-white/15 bg-white/10"
                    }`}
                  >
                    <p className="font-medium text-white">{chat.name}</p>
                    <p className="text-white/70">{chat.lastMessage}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Feature: mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Feature: mobile chat detail panel */}
        <div className="min-h-0 flex-1">
          <Detail chat={selectedChat} />
        </div>
      </div>

      {/* Feature: desktop 3-panel layout */}
      <div className="hidden h-full w-full overflow-hidden rounded-2xl border border-white/20 bg-[#15241d]/70 text-white shadow-2xl backdrop-blur-xl md:flex md:flex-row">
        <List
          chats={sampleChats}
          selectedChatId={selectedChatId}
          onSelectChat={setSelectedChatId}
        />
        <Detail chat={selectedChat} />
      </div>
    </>
  );
}

export default Chat;
