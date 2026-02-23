import { useEffect, useMemo, useState } from "react";
import OverlayModal from "../shared/OverlayModal";

const normalizeQuery = (value = "") => String(value || "").trim();
const isValidEmail = (value = "") => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

function AddUserByPhoneModal({
  isOpen,
  onClose,
  existingIds,
  currentUserId,
  onSearchUser,
  onAddUser,
}) {
  const [queryInput, setQueryInput] = useState("");
  const [lookupResult, setLookupResult] = useState(null);
  const [status, setStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const normalizedQuery = useMemo(
    () => normalizeQuery(queryInput),
    [queryInput],
  );

  const alreadyAdded = useMemo(
    () => existingIds.includes(lookupResult?.id || ""),
    [existingIds, lookupResult?.id],
  );

  useEffect(() => {
    if (!isOpen) {
      setQueryInput("");
      setLookupResult(null);
      setStatus("idle");
      setErrorMessage("");
    }
  }, [isOpen]);

  useEffect(() => {
    let isActive = true;

    const runLookup = async () => {
      setLookupResult(null);
      setErrorMessage("");

      if (!normalizedQuery) {
        setStatus("idle");
        return;
      }

      if (!isValidEmail(normalizedQuery) && normalizedQuery.length < 2) {
        setStatus("too-short");
        return;
      }

      setStatus("loading");

      try {
        const profile = await onSearchUser(normalizedQuery);
        if (!isActive) {
          return;
        }

        if (!profile) {
          setStatus("not-found");
          return;
        }

        if (profile.id === currentUserId) {
          setStatus("self");
          return;
        }

        setLookupResult(profile);
        setStatus("found");
      } catch (error) {
        if (!isActive) {
          return;
        }

        setStatus("error");
        setErrorMessage(error.message || "Failed to search user.");
      }
    };

    runLookup();

    return () => {
      isActive = false;
    };
  }, [normalizedQuery, currentUserId, onSearchUser]);

  const profileInitial =
    lookupResult?.name?.trim()?.charAt(0)?.toUpperCase() || "U";

  const handleAdd = async () => {
    if (!lookupResult || alreadyAdded) {
      return;
    }

    try {
      setStatus("adding");
      await onAddUser(lookupResult);
      onClose();
    } catch (error) {
      setStatus("error");
      setErrorMessage(error.message || "Failed to add user.");
    }
  };

  return (
    <OverlayModal
      isOpen={isOpen}
      onClose={onClose}
      containerClassName="absolute inset-0 z-30 flex items-center justify-center bg-black/45 p-3 backdrop-blur-sm sm:p-4"
    >
      <h3 className="text-base font-semibold text-white sm:text-lg">
        Add user by name or email
      </h3>
      <p className="mt-1 text-xs text-white/70">
        Type a full email or part of a name.
      </p>

      <input
        type="text"
        value={queryInput}
        onChange={(event) => setQueryInput(event.target.value)}
        placeholder="name or email"
        className="mt-3 w-full rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-xs text-white placeholder:text-white/55 outline-none transition-colors focus:border-lime-200/45 sm:text-sm"
      />

      {status === "loading" && (
        <p className="mt-3 text-xs text-white/70">Searching user...</p>
      )}

      {status === "too-short" && (
        <p className="mt-3 text-xs text-amber-200">
          Type at least 2 characters or a valid email.
        </p>
      )}

      {status === "self" && (
        <p className="mt-3 text-xs text-amber-200">You cannot add yourself.</p>
      )}

      {status === "not-found" && (
        <p className="mt-3 text-xs text-white/70">User not found.</p>
      )}

      {(status === "error" || errorMessage) && (
        <p className="mt-3 text-xs text-red-200">{errorMessage}</p>
      )}

      {lookupResult && (status === "found" || status === "adding") && (
        <div className="mt-3 rounded-xl border border-white/20 bg-black/20 p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white/25 text-sm font-semibold text-white">
              {lookupResult.image ? (
                <img
                  src={lookupResult.image}
                  alt={lookupResult.name || "User"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{profileInitial}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white/95 sm:text-sm">
                {lookupResult.name || "User"}
              </p>
              <p className="truncate text-xs text-white/65">
                {lookupResult.email || lookupResult.phone}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={alreadyAdded || status === "adding"}
            className="mt-3 w-full rounded-lg bg-[#5e8b5a]/85 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[#5e8b5a] disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
          >
            {alreadyAdded
              ? "Already added"
              : status === "adding"
                ? "Adding..."
                : "Add user"}
          </button>
        </div>
      )}
    </OverlayModal>
  );
}

export default AddUserByPhoneModal;
