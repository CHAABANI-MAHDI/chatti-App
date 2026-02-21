import { useEffect, useMemo, useState } from "react";
import ChatListItem from "./chat/ChatListItem";
import ProfileModal from "./modals/ProfileModal";
import SettingsModal from "./modals/SettingsModal";
import ProfileSummaryCard from "./shared/ProfileSummaryCard";

function List({ chats, selectedChatId, onSelectChat, currentUser, onLogout }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [profile, setProfile] = useState({
    name: currentUser?.name || "My Profile",
    phone: currentUser?.phone || "+1 000 000 0000",
    image: currentUser?.image || "",
  });
  const [draftProfile, setDraftProfile] = useState(profile);
  const [preferences, setPreferences] = useState({
    showMessagePreview: true,
    showUnreadBadge: true,
    muteNotifications: false,
  });

  const filteredChats = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    if (!query) {
      return chats;
    }

    return chats.filter((chat) => {
      const name = chat.name?.toLowerCase() ?? "";
      const message = chat.lastMessage?.toLowerCase() ?? "";
      return name.includes(query) || message.includes(query);
    });
  }, [chats, searchTerm]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    setProfile((previous) => ({
      ...previous,
      name: currentUser.name || previous.name,
      phone: currentUser.phone || previous.phone,
      image: currentUser.image || previous.image,
    }));
  }, [currentUser]);

  const openProfileEditor = () => {
    setDraftProfile(profile);
    setIsProfileOpen(true);
  };

  const handleProfileImageUpload = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const fileReader = new FileReader();
    fileReader.onload = () => {
      setDraftProfile((previous) => ({
        ...previous,
        image: typeof fileReader.result === "string" ? fileReader.result : "",
      }));
    };
    fileReader.readAsDataURL(file);
  };

  const saveProfile = () => {
    setProfile(draftProfile);
    setIsProfileOpen(false);
  };

  return (
    <aside className="relative flex h-full w-full flex-col border-r border-white/15 bg-[#193027]/65 p-4 md:p-5">
      <div className="mb-4">
        <ProfileSummaryCard
          profile={profile}
          onProfile={openProfileEditor}
          onSettings={() => setIsSettingsOpen(true)}
          onLogout={onLogout}
        />

        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-white">
              Messages
            </h2>
            <p className="text-xs text-white/70">Recent conversations</p>
          </div>
          <span className="rounded-full border border-white/20 bg-white/10 px-2 py-1 text-xs text-white/90">
            {filteredChats.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search messages..."
            className="w-full rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/60 outline-none transition-colors focus:border-lime-200/45"
          />
          <button
            type="button"
            title="Add new user"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-lg leading-none text-white/90 transition-colors hover:bg-white/15"
          >
            +
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
        {filteredChats.length === 0 ? (
          <div className="rounded-lg border border-white/15 bg-black/15 p-3 text-sm text-white/75">
            No users found.
          </div>
        ) : (
          filteredChats.map((chat) => (
            <ChatListItem
              key={chat.id}
              chat={chat}
              isActive={chat.id === selectedChatId}
              onClick={() => onSelectChat(chat.id)}
              showMessagePreview={preferences.showMessagePreview}
              showUnreadBadge={preferences.showUnreadBadge}
              variant="desktop"
            />
          ))
        )}
      </div>

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        draftProfile={draftProfile}
        setDraftProfile={setDraftProfile}
        onImageUpload={handleProfileImageUpload}
        onSave={saveProfile}
        containerClassName="absolute inset-0 z-20 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        preferences={preferences}
        setPreferences={setPreferences}
        description="Suggested quick preferences for cleaner chat experience."
        containerClassName="absolute inset-0 z-20 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      />
    </aside>
  );
}

export default List;
