function List({ chats, selectedChatId, onSelectChat }) {
  return (
    <aside className="w-full border-b border-white/20 bg-[#2d4a2f]/45 p-3 md:w-[26%] md:min-w-[240px] md:max-w-[300px] md:border-b-0 md:border-r md:p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Messages</h2>
          <p className="text-xs text-white/70">Recent conversations</p>
        </div>
        <span className="rounded-full border border-white/20 bg-white/10 px-2 py-1 text-xs text-white/80">
          {chats.length}
        </span>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search chats..."
          className="w-full rounded-lg border border-white/20 bg-black/15 px-3 py-2 text-sm text-white placeholder:text-white/60 outline-none ring-0"
          readOnly
        />
      </div>

      <div className="max-h-[240px] space-y-2 overflow-y-auto md:max-h-none">
        {chats.map((chat) => {
          const isActive = chat.id === selectedChatId;

          return (
            <button
              key={chat.id}
              type="button"
              onClick={() => onSelectChat(chat.id)}
              className={`w-full rounded-xl border p-3 text-left transition-all duration-200 ${
                isActive
                  ? "border-white/50 bg-white/20 shadow-lg"
                  : "border-white/15 bg-black/10 hover:bg-white/12"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/30 font-semibold text-white">
                  <span>{chat.avatar}</span>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-[#2d4a2f] ${
                      chat.status === "Online" ? "bg-lime-300" : "bg-amber-300"
                    }`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-center justify-between gap-2">
                    <p className="truncate font-medium text-white">
                      {chat.name}
                    </p>
                    <span className="text-[11px] text-white/65">
                      {chat.time}
                    </span>
                  </div>
                  <p className="truncate text-sm text-white/75">
                    {chat.lastMessage}
                  </p>
                </div>
                {chat.unread > 0 && (
                  <span className="rounded-full bg-lime-300/85 px-2 py-0.5 text-xs font-semibold text-[#1d2a1d]">
                    {chat.unread}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

export default List;
