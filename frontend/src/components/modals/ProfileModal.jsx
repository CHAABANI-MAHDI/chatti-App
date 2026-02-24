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
      <h3 className="mb-3 text-base font-semibold text-white sm:text-lg">
        Edit profile
      </h3>

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
            <label className="cursor-pointer rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-[11px] text-white/90 hover:bg-white/15 sm:px-3 sm:text-xs">
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
            className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-xs text-white placeholder:text-white/60 outline-none sm:text-sm"
          />
        </div>
        <div>
          <p className="mb-1 text-left text-xs text-white/70">Email</p>
          <input
            type="email"
            value={draftProfile.email || ""}
            onChange={(event) =>
              setDraftProfile((previous) => ({
                ...previous,
                email: event.target.value,
              }))
            }
            placeholder="Email address"
            className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-xs text-white placeholder:text-white/60 outline-none sm:text-sm"
          />
        </div>
        <div>
          <p className="mb-1 text-left text-xs text-white/70">Phone</p>
          <input
            type="tel"
            value={draftProfile.phone || ""}
            onChange={(event) =>
              setDraftProfile((previous) => ({
                ...previous,
                phone: event.target.value,
              }))
            }
            placeholder="+21612345678"
            className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-xs text-white placeholder:text-white/60 outline-none sm:text-sm"
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-[11px] text-white/90 hover:bg-white/15 sm:text-xs"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          className="rounded-lg bg-[#5e8b5a]/85 px-3 py-2 text-[11px] font-medium text-white hover:bg-[#5e8b5a] sm:text-xs"
        >
          Save
        </button>
      </div>
    </OverlayModal>
  );
}

export default ProfileModal;
