import { useMemo, useState } from "react";
import OverlayModal from "../shared/OverlayModal";

const formatGroupDate = (value = "") => {
  if (!value) {
    return "Unknown date";
  }

  const dateValue = new Date(value);
  if (Number.isNaN(dateValue.getTime())) {
    return "Unknown date";
  }

  return dateValue.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

function DetailInfoPanel({ chat, avatarInitial, sharedImages = [] }) {
  const [previewImage, setPreviewImage] = useState(null);
  const groupedImages = useMemo(() => {
    const groups = new Map();

    (Array.isArray(sharedImages) ? sharedImages : []).forEach((item) => {
      const url = String(item?.url || item || "").trim();
      if (!url) {
        return;
      }

      const dateLabel = formatGroupDate(item?.createdAt || "");
      if (!groups.has(dateLabel)) {
        groups.set(dateLabel, []);
      }
      groups.get(dateLabel).push({
        url,
        createdAt: item?.createdAt || "",
      });
    });

    return Array.from(groups.entries());
  }, [sharedImages]);

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

        {groupedImages.length === 0 ? (
          <p className="mt-2 rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-xs text-white/65">
            No images in this conversation yet.
          </p>
        ) : (
          <div className="mt-2 space-y-3">
            {groupedImages.map(([dateLabel, items]) => (
              <div key={dateLabel}>
                <p className="mb-2 text-[11px] uppercase tracking-wide text-white/60">
                  {dateLabel}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {items.map((item, index) => (
                    <button
                      key={`${item.url}-${index}`}
                      type="button"
                      onClick={() => setPreviewImage(item)}
                      className="block overflow-hidden rounded-lg border border-white/20 bg-black/20"
                    >
                      <img
                        src={item.url}
                        alt={`Shared ${index + 1}`}
                        className="h-14 w-full object-cover"
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <OverlayModal
        isOpen={Boolean(previewImage)}
        onClose={() => setPreviewImage(null)}
        containerClassName="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      >
        {previewImage ? (
          <div>
            <img
              src={previewImage.url}
              alt="Preview"
              className="max-h-[70dvh] w-full rounded-xl object-contain"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-white/70">
                {formatGroupDate(previewImage.createdAt)}
              </p>
              <a
                href={previewImage.url}
                download
                className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white/90 hover:bg-white/15"
              >
                Download
              </a>
            </div>
          </div>
        ) : null}
      </OverlayModal>
    </aside>
  );
}

export default DetailInfoPanel;
