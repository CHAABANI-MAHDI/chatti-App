function DetailInfoPanel({ chat, avatarInitial, sharedImages = [] }) {
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
          { label: "Email", value: chat.email ?? "No email" },
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

      <div className="mt-5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-white/70">
          Shared images
        </h4>

        {sharedImages.length === 0 ? (
          <p className="mt-2 rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-xs text-white/65">
            No images in this conversation yet.
          </p>
        ) : (
          <div className="mt-2 grid grid-cols-4 gap-2">
            {sharedImages.map((imageUrl, index) => (
              <a
                key={`${imageUrl}-${index}`}
                href={imageUrl}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-lg border border-white/20 bg-black/20"
              >
                <img
                  src={imageUrl}
                  alt={`Shared ${index + 1}`}
                  className="h-14 w-full object-cover"
                  loading="lazy"
                />
              </a>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

export default DetailInfoPanel;
