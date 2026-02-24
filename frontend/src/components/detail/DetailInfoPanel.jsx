function DetailInfoPanel({ chat, avatarInitial }) {
  return (
    <aside className="h-full overflow-y-auto rounded-2xl border border-white/20 bg-white/12 p-4">
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/30 text-2xl font-semibold text-white">
          {chat.image ? (
            <img
              src={chat.image}
              alt={chat.name || "User"}
              className="h-full w-full object-cover"
            />
          ) : (
            avatarInitial
          )}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-white">
            {chat.name}
          </h3>
          <p className="text-sm text-white/70">{chat.status}</p>
        </div>
      </div>

      <div className="space-y-3 text-sm text-white/90">
        {[
          { label: "Phone", value: chat.phone ?? "+1 000 000 0000" },
          { label: "Role", value: chat.role ?? "Team member" },
          { label: "Status", value: chat.lastSeen },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-lg border border-white/20 bg-black/20 p-3"
          >
            <p className="text-[11px] text-white/60">{label}</p>
            <p className="text-white">{value}</p>
          </div>
        ))}
      </div>
    </aside>
  );
}

export default DetailInfoPanel;
