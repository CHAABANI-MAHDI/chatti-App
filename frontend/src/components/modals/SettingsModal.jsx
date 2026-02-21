import OverlayModal from "../shared/OverlayModal";

function SettingsModal({
  isOpen,
  onClose,
  preferences,
  setPreferences,
  onLogout,
  description,
  containerClassName,
}) {
  return (
    <OverlayModal
      isOpen={isOpen}
      onClose={onClose}
      containerClassName={containerClassName}
    >
      <h3 className="mb-1 text-base font-semibold text-white">Settings</h3>
      <p className="mb-4 text-xs text-white/65">{description}</p>

      <div className="space-y-2.5">
        <p className="text-left text-xs font-semibold uppercase tracking-wide text-white/60">
          Chat list
        </p>
        <button
          type="button"
          onClick={() =>
            setPreferences((previous) => ({
              ...previous,
              showMessagePreview: !previous.showMessagePreview,
            }))
          }
          className="flex w-full items-center justify-between rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-left"
        >
          <span className="text-sm text-white/90">
            Show last message preview
          </span>
          <span className="text-xs text-white/70">
            {preferences.showMessagePreview ? "On" : "Off"}
          </span>
        </button>

        <button
          type="button"
          onClick={() =>
            setPreferences((previous) => ({
              ...previous,
              showUnreadBadge: !previous.showUnreadBadge,
            }))
          }
          className="flex w-full items-center justify-between rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-left"
        >
          <span className="text-sm text-white/90">Show unread badges</span>
          <span className="text-xs text-white/70">
            {preferences.showUnreadBadge ? "On" : "Off"}
          </span>
        </button>

        <p className="pt-1 text-left text-xs font-semibold uppercase tracking-wide text-white/60">
          Notifications
        </p>

        <button
          type="button"
          onClick={() =>
            setPreferences((previous) => ({
              ...previous,
              muteNotifications: !previous.muteNotifications,
            }))
          }
          className="flex w-full items-center justify-between rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-left"
        >
          <span className="text-sm text-white/90">Mute notifications</span>
          <span className="text-xs text-white/70">
            {preferences.muteNotifications ? "On" : "Off"}
          </span>
        </button>

        <p className="pt-1 text-left text-xs font-semibold uppercase tracking-wide text-white/60">
          Account
        </p>

        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center justify-center rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm text-white/90 hover:bg-white/10"
        >
          Logout
        </button>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-[#5e8b5a]/85 px-3 py-2 text-xs font-medium text-white hover:bg-[#5e8b5a]"
        >
          Done
        </button>
      </div>
    </OverlayModal>
  );
}

export default SettingsModal;
