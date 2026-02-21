function UserActions({ onProfile, onSettings, sizeClass = "h-9 w-9" }) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        title="Profile"
        onClick={onProfile}
        className={`flex ${sizeClass} items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white/90 transition-colors hover:bg-white/15`}
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M5.121 17.804A9.955 9.955 0 0112 15c2.6 0 4.967.992 6.758 2.618M15 9a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>
      <button
        type="button"
        title="Settings"
        onClick={onSettings}
        className={`flex ${sizeClass} items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white/90 transition-colors hover:bg-white/15`}
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M4 7h10M18 7h2M10 7a2 2 0 11-4 0 2 2 0 014 0zM4 17h2M10 17h10M18 17a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      </button>
    </div>
  );
}

export default UserActions;
