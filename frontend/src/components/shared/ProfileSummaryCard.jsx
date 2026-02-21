import UserActions from "./UserActions";

function ProfileSummaryCard({ profile, onProfile, onSettings }) {
  const profileInitial = profile.name?.trim()?.charAt(0)?.toUpperCase() || "U";

  return (
    <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/15 bg-black/20 p-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white/25 text-sm font-semibold text-white">
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
          <p className="truncate text-sm font-semibold text-white/95">
            {profile.name}
          </p>
          <p className="truncate text-xs text-white/65">{profile.phone}</p>
        </div>
      </div>

      <UserActions onProfile={onProfile} onSettings={onSettings} />
    </div>
  );
}

export default ProfileSummaryCard;
