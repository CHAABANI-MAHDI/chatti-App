import { useEffect, useMemo, useRef, useState } from "react";
import OverlayModal from "../shared/OverlayModal";

const normalizeQuery = (value = "") => String(value || "").trim();
const PAGE_SIZE = 20;

function AddUserByPhoneModal({
  isOpen,
  onClose,
  existingIds,
  currentUserId,
  onSearchUser,
  onSearchUsers,
  onAddUser,
  containerClassName,
}) {
  const [queryInput, setQueryInput] = useState("");
  const [profiles, setProfiles] = useState([]);
  const [addingUserId, setAddingUserId] = useState("");
  const [hideAddedUsers, setHideAddedUsers] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [pagination, setPagination] = useState({
    nextOffset: 0,
    hasMore: false,
  });
  const [status, setStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const requestIdRef = useRef(0);

  const normalizedQuery = useMemo(
    () => normalizeQuery(queryInput),
    [queryInput],
  );

  const existingIdSet = useMemo(
    () => new Set((existingIds || []).filter(Boolean)),
    [existingIds],
  );

  useEffect(() => {
    if (!isOpen) {
      setQueryInput("");
      setProfiles([]);
      setAddingUserId("");
      setHideAddedUsers(false);
      setIsLoadingMore(false);
      setPagination({ nextOffset: 0, hasMore: false });
      setStatus("idle");
      setErrorMessage("");
    }
  }, [isOpen]);

  const visibleProfiles = useMemo(() => {
    if (!hideAddedUsers) {
      return profiles;
    }

    return profiles.filter((profile) => !existingIdSet.has(profile.id));
  }, [profiles, hideAddedUsers, existingIdSet]);

  const extractSearchPayload = (result) => {
    const fallbackProfiles = Array.isArray(result)
      ? result
      : result
        ? [result]
        : [];
    const mappedProfiles = Array.isArray(result?.profiles)
      ? result.profiles
      : fallbackProfiles;
    const payloadPagination = result?.pagination || {};

    return {
      profiles: mappedProfiles,
      hasMore: Boolean(payloadPagination.hasMore),
      nextOffset: Number.isFinite(payloadPagination.nextOffset)
        ? payloadPagination.nextOffset
        : mappedProfiles.length,
    };
  };

  const fetchProfilesPage = async ({ append, offset }) => {
    const searchProfiles = onSearchUsers || onSearchUser;
    if (!searchProfiles) {
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (append) {
      setIsLoadingMore(true);
    } else {
      setStatus("loading");
      setErrorMessage("");
    }

    try {
      const result = await searchProfiles(normalizedQuery, {
        limit: PAGE_SIZE,
        offset,
      });

      if (requestIdRef.current !== requestId) {
        return;
      }

      const payload = extractSearchPayload(result);
      const filteredProfiles = payload.profiles.filter(
        (profile) => profile?.id && profile.id !== currentUserId,
      );

      setProfiles((previous) => {
        if (!append) {
          return filteredProfiles;
        }

        const uniqueProfiles = new Map(
          previous.map((profile) => [profile.id, profile]),
        );
        filteredProfiles.forEach((profile) => {
          uniqueProfiles.set(profile.id, profile);
        });

        return Array.from(uniqueProfiles.values());
      });

      setPagination({
        hasMore: payload.hasMore,
        nextOffset: payload.nextOffset,
      });
      setStatus("ready");
    } catch (error) {
      if (requestIdRef.current !== requestId) {
        return;
      }

      if (!append) {
        setProfiles([]);
        setStatus("error");
      }
      setErrorMessage(error.message || "Failed to fetch users.");
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      fetchProfilesPage({ append: false, offset: 0 });
    }, 220);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [isOpen, normalizedQuery, currentUserId, onSearchUsers, onSearchUser]);

  const handleAdd = async (profile) => {
    if (!profile?.id || existingIdSet.has(profile.id)) {
      return;
    }

    try {
      setAddingUserId(profile.id);
      await onAddUser(profile);
      onClose();
    } catch (error) {
      setStatus("error");
      setErrorMessage(error.message || "Failed to add user.");
    } finally {
      setAddingUserId("");
    }
  };

  return (
    <OverlayModal
      isOpen={isOpen}
      onClose={onClose}
      containerClassName={
        containerClassName ||
        "absolute inset-0 z-30 flex items-center justify-center bg-black/45 p-3 backdrop-blur-sm sm:p-4"
      }
    >
      <h3 className="text-base font-semibold text-white sm:text-lg">
        Invite user
      </h3>
      <p className="mt-1 text-xs text-white/70">
        Search by name or email and invite to start chatting.
      </p>

      <input
        type="text"
        value={queryInput}
        onChange={(event) => setQueryInput(event.target.value)}
        placeholder="Search users..."
        className="mt-3 w-full rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-xs text-white placeholder:text-white/55 outline-none transition-colors focus:border-lime-200/45 sm:text-sm"
      />

      <label className="mt-2 flex items-center gap-2 text-xs text-white/75">
        <input
          type="checkbox"
          checked={hideAddedUsers}
          onChange={(event) => setHideAddedUsers(event.target.checked)}
          className="h-3.5 w-3.5 accent-lime-300"
        />
        Hide already added users
      </label>

      {status === "loading" && (
        <p className="mt-3 text-xs text-white/70">Loading users...</p>
      )}

      {(status === "error" || errorMessage) && (
        <p className="mt-3 text-xs text-red-200">{errorMessage}</p>
      )}

      {status === "ready" && visibleProfiles.length === 0 && (
        <p className="mt-3 text-xs text-white/70">No users found.</p>
      )}

      {visibleProfiles.length > 0 && (
        <div className="mt-3 max-h-[48dvh] space-y-2 overflow-y-auto pr-1">
          {visibleProfiles.map((profile) => {
            const profileInitial =
              profile?.name?.trim()?.charAt(0)?.toUpperCase() || "U";
            const alreadyAdded = existingIdSet.has(profile.id);
            const isAdding = addingUserId === profile.id;

            return (
              <div
                key={profile.id}
                className="flex items-center gap-3 rounded-xl border border-white/20 bg-black/20 p-2.5"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/25 text-sm font-semibold text-white">
                  {profile.image ? (
                    <img
                      src={profile.image}
                      alt={profile.name || "User"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>{profileInitial}</span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-white/95 sm:text-sm">
                    {profile.name || "User"}
                  </p>
                  <p className="truncate text-xs text-white/65">
                    {profile.email || profile.phone}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleAdd(profile)}
                  disabled={alreadyAdded || isAdding}
                  className="rounded-lg bg-[#5e8b5a]/85 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#5e8b5a] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {alreadyAdded ? "Added" : isAdding ? "Adding..." : "Invite"}
                </button>
              </div>
            );
          })}

          {pagination.hasMore && (
            <button
              type="button"
              onClick={() =>
                fetchProfilesPage({
                  append: true,
                  offset: pagination.nextOffset,
                })
              }
              disabled={isLoadingMore}
              className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs text-white/90 transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoadingMore ? "Loading more..." : "Load more users"}
            </button>
          )}
        </div>
      )}
    </OverlayModal>
  );
}

export default AddUserByPhoneModal;
