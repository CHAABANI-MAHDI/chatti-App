function ChatListItem({
  chat,
  isActive,
  onClick,
  showMessagePreview,
  showUnreadBadge,
  variant = "desktop",
}) {
  const isMobile = variant === "mobile";
  const previewText = chat.lastMessage
    ? `${chat.lastMessageFromMe ? "You: " : ""}${chat.lastMessage}`
    : "No messages yet";

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${chat.name} • ${chat.status}`}
      className={`w-full rounded-2xl border px-3 py-2 text-left transition-all ${
        isActive
          ? isMobile
            ? "border-lime-300/70 bg-lime-200/20"
            : "border-lime-200/45 bg-white/18 shadow-lg"
          : isMobile
            ? "border-white/15 bg-white/10"
            : "border-white/15 bg-black/15 hover:bg-white/12"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`relative flex items-center justify-center rounded-full bg-white/25 text-sm font-semibold text-white ${
            isMobile ? "h-11 w-11" : "h-10 w-10"
          }`}
        >
          <span>{chat.avatar}</span>
          <span
            className={`absolute -bottom-0.5 -right-0.5 rounded-full border ${
              isMobile
                ? "h-3 w-3 border-[#1a2f23]"
                : "h-2.5 w-2.5 border-[#2d4a2f]"
            } ${chat.status === "Online" ? "bg-lime-300" : "bg-amber-300"}`}
          />
        </div>

        <div className="min-w-0 flex-1 text-left">
          <div
            className={`mb-0.5 ${isMobile ? "block" : "flex items-center justify-between gap-2"}`}
          >
            <p className="truncate text-sm font-medium text-white/95">
              {chat.name}
            </p>
            {!isMobile && (
              <span className="text-[11px] text-white/65">{chat.time}</span>
            )}
          </div>
          {showMessagePreview && (
            <p
              className={`truncate text-white/65 ${isMobile ? "text-xs" : "text-sm text-white/80"}`}
            >
              {previewText}
            </p>
          )}
        </div>

        {showUnreadBadge && chat.unread > 0 && (
          <span
            className={`rounded-full bg-lime-300/85 font-semibold text-[#1d2a1d] ${
              isMobile ? "px-2 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
            }`}
          >
            {chat.unread > 99 ? "99+" : chat.unread}
          </span>
        )}
      </div>
    </button>
  );
}

export default ChatListItem;
