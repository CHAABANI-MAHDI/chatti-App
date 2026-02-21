import { useMemo, useState } from "react";
import Detail from "./Detail";
import List from "./List";

const sampleChats = [
  {
    id: 1,
    name: "Olivia",
    status: "Online",
    lastSeen: "Active now",
    avatar: "O",
    email: "olivia@chatapp.dev",
    phone: "+1 202 555 0198",
    role: "Project Manager",
    timezone: "UTC-5",
    lastMessage: "Can we deploy tonight?",
    time: "10:24 PM",
    unread: 2,
    messages: [
      { id: 1, fromMe: false, text: "Hey, can we deploy tonight?" },
      { id: 2, fromMe: true, text: "Yes, after final testing." },
      { id: 3, fromMe: false, text: "Perfect. I will prepare notes." },
    ],
  },
  {
    id: 2,
    name: "Noah",
    status: "Away",
    lastSeen: "Last seen 8m ago",
    avatar: "N",
    email: "noah@chatapp.dev",
    phone: "+1 202 555 0145",
    role: "Frontend Engineer",
    timezone: "UTC+1",
    lastMessage: "UI is looking good now.",
    time: "09:58 PM",
    unread: 0,
    messages: [
      { id: 1, fromMe: true, text: "Did you check the new login page?" },
      { id: 2, fromMe: false, text: "Yes, UI is looking good now." },
    ],
  },
  {
    id: 3,
    name: "Emma",
    status: "Online",
    lastSeen: "Active now",
    avatar: "E",
    email: "emma@chatapp.dev",
    phone: "+1 202 555 0112",
    role: "Product Designer",
    timezone: "UTC+3",
    lastMessage: "Let’s sync in 10 mins.",
    time: "09:41 PM",
    unread: 1,
    messages: [
      { id: 1, fromMe: false, text: "Let’s sync in 10 mins." },
      { id: 2, fromMe: true, text: "Sure, I am joining." },
    ],
  },
];

function Chat() {
  const [selectedChatId, setSelectedChatId] = useState(
    sampleChats[0]?.id ?? null,
  );

  const selectedChat = useMemo(
    () => sampleChats.find((chat) => chat.id === selectedChatId) ?? null,
    [selectedChatId],
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/20 bg-white/5 text-white shadow-2xl backdrop-blur-lg md:flex-row">
      <List
        chats={sampleChats}
        selectedChatId={selectedChatId}
        onSelectChat={setSelectedChatId}
      />
      <Detail chat={selectedChat} />
    </div>
  );
}

export default Chat;
