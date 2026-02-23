import UserActions from "./UserActions";

function ProfileSummaryCard({ profile, onProfile, onSettings }) {
  const profileInitial = profile.name?.trim()?.charAt(0)?.toUpperCase() || "U";
  const profileSubtitle =
    profile.statusText?.trim() || profile.email || "No bio yet";

  return (
    <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/15 bg-black/20 p-2.5 sm:mb-4 sm:p-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white/25 text-sm font-semibold text-white sm:h-10 sm:w-10">
          {profile.image ? (
            <img
              src={profile.image}
              alt="Profile"
              className="h-full w-full object-cover"
            />
          ) : (
            <span>{profileInitial}</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-white/95 sm:text-sm">
            {profile.name}
          </p>
          <p className="truncate text-xs text-white/65">{profileSubtitle}</p>
        </div>
      </div>

      <UserActions onProfile={onProfile} onSettings={onSettings} />
    </div>
  );
}

export default ProfileSummaryCard;
