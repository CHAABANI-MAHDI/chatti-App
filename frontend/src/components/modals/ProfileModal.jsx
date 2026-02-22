import OverlayModal from "../shared/OverlayModal";

function ProfileModal({
  isOpen,
  onClose,
  draftProfile,
  setDraftProfile,
  onImageUpload,
  onSave,
  containerClassName,
}) {
  return (
    <OverlayModal
      isOpen={isOpen}
      onClose={onClose}
      containerClassName={containerClassName}
    >
      <h3 className="mb-3 text-base font-semibold text-white">Edit profile</h3>

      <div className="space-y-2">
        <div>
          <p className="mb-1 text-left text-xs text-white/70">Profile image</p>
          <div className="flex items-center gap-3 rounded-lg border border-white/20 bg-black/20 px-3 py-2">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white/25 text-xs font-semibold text-white">
              {draftProfile.image ? (
                <img
                  src={draftProfile.image}
                  alt="Draft profile"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>
                  {draftProfile.name?.trim()?.charAt(0)?.toUpperCase() || "U"}
                </span>
              )}
            </div>
            <label className="cursor-pointer rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white/90 hover:bg-white/15">
              Upload new image
              <input
                type="file"
                accept="image/*"
                onChange={onImageUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>
        <div>
          <p className="mb-1 text-left text-xs text-white/70">Name</p>
          <input
            type="text"
            value={draftProfile.name}
            onChange={(event) =>
              setDraftProfile((previous) => ({
                ...previous,
                name: event.target.value,
              }))
            }
            placeholder="Your name"
            className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/60 outline-none"
          />
        </div>
        <div>
          <p className="mb-1 text-left text-xs text-white/70">Phone</p>
          <input
            type="text"
            value={draftProfile.phone}
            disabled
            placeholder="Phone number"
            className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/60 outline-none disabled:cursor-not-allowed disabled:opacity-70"
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs text-white/90 hover:bg-white/15"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          className="rounded-lg bg-[#5e8b5a]/85 px-3 py-2 text-xs font-medium text-white hover:bg-[#5e8b5a]"
        >
          Save
        </button>
      </div>
    </OverlayModal>
  );
}

export default ProfileModal;
