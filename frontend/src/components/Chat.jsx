import { useEffect, useMemo, useState } from "react";
import ChatListItem from "./chat/ChatListItem";
import Detail from "./Detail";
import List from "./List";
import ProfileModal from "./modals/ProfileModal";
import SettingsModal from "./modals/SettingsModal";
import UserActions from "./shared/UserActions";

const sampleChats = [
  {
    id: 1,
    name: "Rahma",
    status: "Online",
    lastSeen: "Active now",
    avatar: "R",
    phone: "+1 202 555 0198",
    role: "Project Manager",
    timezone: "UTC-5",
    lastMessage: "Can we deploy tonight? ",
    time: "10:24 PM",
    unread: 2,
    messages: [
      {
        id: 1,
        fromMe: false,
        text: "Hey, can we deploy tonight? lorem ipsum dolor sit amet, consectetur adipiscing elit. lorem ipsum dolor sit amet, consectetur adipiscing elit.",
        timestamp: "10:20 PM",
        read: true,
      },
      {
        id: 2,
        fromMe: true,
        text: "Yes, after final testing. lorem ipsum dolor sit amet, consectetur adipiscing elit. lorem ipsum dolor sit amet, consectetur adipiscing elit.lorem ipsum dolor sit amet, consectetur adipiscing elit.",
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
    avatar: "H",
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
    avatar: "M",
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

function Chat({ currentUser, onLogout, onProfileSave }) {
  const [selectedChatId, setSelectedChatId] = useState(
    sampleChats[0]?.id ?? null,
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileProfile, setMobileProfile] = useState({
    name: currentUser?.name || "My Profile",
    phone: currentUser?.phone || "+1 000 000 0000",
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

  const selectedChat = useMemo(
    () => sampleChats.find((chat) => chat.id === selectedChatId) ?? null,
    [selectedChatId],
  );

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    setMobileProfile((previous) => ({
      ...previous,
      name: currentUser.name || previous.name,
      phone: currentUser.phone || previous.phone,
      image: currentUser.image || previous.image,
    }));
  }, [currentUser]);

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
            {sampleChats.length}
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
                      {mobileProfile.phone}
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
              {sampleChats.map((chat) => (
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
              ))}
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
          <Detail chat={selectedChat} />
        </div>
      </div>

      <div className="hidden h-full w-full overflow-hidden rounded-3xl border border-white/25 bg-[#132219]/75 text-white shadow-2xl backdrop-blur-2xl md:grid md:grid-cols-[320px_minmax(0,1fr)] lg:grid-cols-[360px_minmax(0,1fr)]">
        <List
          chats={sampleChats}
          selectedChatId={selectedChatId}
          onSelectChat={setSelectedChatId}
          currentUser={currentUser}
          onLogout={onLogout}
          onProfileSave={onProfileSave}
        />
        <Detail chat={selectedChat} />
      </div>
    </>
  );
}

export default Chat;
