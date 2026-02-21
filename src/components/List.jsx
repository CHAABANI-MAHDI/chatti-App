function List({ chats, selectedChatId, onSelectChat }) {
  return (
    <aside className="flex h-full w-full flex-col border-b border-white/15 bg-[#1c3126]/60 p-3 md:w-[26%] md:min-w-[240px] md:max-w-[300px] md:border-b-0 md:border-r md:p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Messages</h2>
          <p className="text-xs text-white/75">Recent conversations</p>
        </div>
        <span className="rounded-full border border-white/20 bg-white/10 px-2 py-1 text-xs text-white/90">
          {chats.length}
        </span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {chats.map((chat) => {
          const isActive = chat.id === selectedChatId;

          return (
            <button
              key={chat.id}
              type="button"
              onClick={() => onSelectChat(chat.id)}
              className={`w-full rounded-xl border p-3 text-left transition-all duration-200 ${
                isActive
                  ? "border-white/55 bg-white/20 shadow-lg"
                  : "border-white/15 bg-black/15 hover:bg-white/15"
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
                  <p className="truncate text-sm text-white/80">
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
