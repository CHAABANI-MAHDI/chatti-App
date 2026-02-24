function DetailHeader({
  chat,
  avatarInitial,
  connectionLabel,
  connectionTone,
  isInfoOpen,
  onToggleInfo,
}) {
  return (
    <header className="mb-3 shrink-0 flex items-center justify-between gap-2 rounded-2xl border border-white/20 bg-white/12 px-3 py-2.5 sm:mb-4 sm:px-4 sm:py-3 md:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/30 text-base font-semibold text-white">
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
          <h2 className="truncate text-lg font-semibold tracking-tight text-white">
            {chat.name}
          </h2>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-white/70">
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${connectionTone}`}
            >
              {connectionLabel}
            </span>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onToggleInfo}
          className={`rounded-md border px-2 py-1 text-xs text-white/90 ${
            isInfoOpen
              ? "border-lime-300/70 bg-lime-200/20"
              : "border-white/20 bg-white/10"
          }`}
        >
          {isInfoOpen ? "Hide Info" : "Info"}
        </button>
      </div>
    </header>
  );
}

export default DetailHeader;
