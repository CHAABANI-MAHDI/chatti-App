import { useCallback, useEffect, useState } from "react";
import Auth from "./components/Auth";
import Chat from "./components/Chat";
import { API_BASE_URL } from "./lib/apiBaseUrl";

const PERSISTENT_SESSION_KEY = "chat-firebase-app-session-persistent";
const TAB_SESSION_KEY = "chat-firebase-app-session-tab";
const PERSISTENT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TAB_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const parseApiPayload = async (response) => {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      message: text.includes("<!DOCTYPE")
        ? `Request failed (${response.status}). Backend route may be missing or server was not restarted.`
        : text,
    };
  }
};

const readStoredSession = (storage, key) => {
  try {
    const rawValue = storage.getItem(key);
    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue);
    const expiresAt = Number(parsedValue?.expiresAt || 0);

    if (!parsedValue?.user || !expiresAt || Date.now() > expiresAt) {
      storage.removeItem(key);
      return null;
    }

    return {
      user: parsedValue.user,
      rememberMe: Boolean(parsedValue.rememberMe),
    };
  } catch {
    storage.removeItem(key);
    return null;
  }
};

const initialSession = (() => {
  const tabSession = readStoredSession(window.sessionStorage, TAB_SESSION_KEY);
  if (tabSession) {
    return tabSession;
  }

  const persistentSession = readStoredSession(
    window.localStorage,
    PERSISTENT_SESSION_KEY,
  );
  return persistentSession || { user: null, rememberMe: true };
})();

const App = () => {
  const [currentUser, setCurrentUser] = useState(initialSession.user);
  const [rememberMeSession, setRememberMeSession] = useState(
    initialSession.rememberMe,
  );

  const persistSession = useCallback((user, rememberMe) => {
    const sessionPayload = {
      user,
      rememberMe,
      expiresAt:
        Date.now() +
        (rememberMe ? PERSISTENT_SESSION_TTL_MS : TAB_SESSION_TTL_MS),
    };

    if (rememberMe) {
      localStorage.setItem(
        PERSISTENT_SESSION_KEY,
        JSON.stringify(sessionPayload),
      );
      sessionStorage.removeItem(TAB_SESSION_KEY);
      return;
    }

    sessionStorage.setItem(TAB_SESSION_KEY, JSON.stringify(sessionPayload));
    localStorage.removeItem(PERSISTENT_SESSION_KEY);
  }, []);

  const startUserSession = useCallback(
    (user, rememberMe) => {
      setCurrentUser(user);
      setRememberMeSession(rememberMe);
      persistSession(user, rememberMe);
    },
    [persistSession],
  );

  const fetchProfileById = useCallback(async (id, accessToken = "") => {
    const response = await fetch(
      `${API_BASE_URL}/profile/${encodeURIComponent(id)}`,
      {
        headers: accessToken
          ? {
              Authorization: `Bearer ${accessToken}`,
            }
          : undefined,
      },
    );

    if (response.status === 404) {
      return null;
    }

    const payload = await parseApiPayload(response);
    if (!response.ok) {
      throw new Error(payload.message || "Failed to fetch profile.");
    }

    return payload.profile || null;
  }, []);

  const fetchProfileByIdentifier = useCallback(
    async (identifier, accessToken = "") => {
      if (!identifier) {
        return null;
      }

      return fetchProfileById(identifier, accessToken);
    },
    [fetchProfileById],
  );

  const saveProfile = async ({
    name,
    image,
    email,
    phone,
    accessToken = "",
  }) => {
    const response = await fetch(`${API_BASE_URL}/auth/me/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken
          ? {
              Authorization: `Bearer ${accessToken}`,
            }
          : {}),
      },
      body: JSON.stringify({
        name,
        image,
        email,
        phone,
      }),
    });

    const payload = await parseApiPayload(response);
    if (!response.ok) {
      throw new Error(payload.message || "Failed to save profile.");
    }

    return payload.user || null;
  };

  const handleAuthSuccess = useCallback(
    async (user) => {
      const authUser = {
        id: user.id || "",
        name: user.name || "User",
        email: user.email || "",
        phone: user.phone || "",
        image: user.image || "",
        statusText: user.statusText || "",
        accessToken: user.accessToken || "",
        rememberMe: Boolean(user.rememberMe),
      };

      if (!authUser.id) {
        startUserSession(authUser, authUser.rememberMe);
        return;
      }

      try {
        let existingProfile = await fetchProfileById(
          authUser.id,
          authUser.accessToken,
        );
        if (!existingProfile) {
          const identifier = authUser.email || authUser.phone || "";
          existingProfile = await fetchProfileByIdentifier(
            identifier,
            authUser.accessToken,
          );
        }
        if (!existingProfile && authUser.accessToken) {
          try {
            await saveProfile({
              name: authUser.name || "User",
              image: authUser.image || "",
              email: authUser.email || "",
              phone: authUser.phone || "",
              accessToken: authUser.accessToken,
            });

            existingProfile = await fetchProfileById(
              authUser.id,
              authUser.accessToken,
            );
            if (!existingProfile) {
              const identifier = authUser.email || authUser.phone || "";
              existingProfile = await fetchProfileByIdentifier(
                identifier,
                authUser.accessToken,
              );
            }
          } catch {
            existingProfile = null;
          }
        }

        const profileId = String(existingProfile?.id || "").trim();
        startUserSession(
          {
            ...authUser,
            ...(existingProfile || {}),
            id: authUser.id,
            profileId: profileId || authUser.id,
            email: authUser.email,
            accessToken: authUser.accessToken,
          },
          authUser.rememberMe,
        );
      } catch {
        startUserSession(authUser, authUser.rememberMe);
      }
    },
    [fetchProfileById, fetchProfileByIdentifier, startUserSession],
  );

  useEffect(() => {
    const hash = String(window.location.hash || "");
    if (!hash || currentUser) {
      return;
    }

    const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
    const accessToken = String(hashParams.get("access_token") || "").trim();
    const oauthError = String(hashParams.get("error_description") || "").trim();

    if (oauthError) {
      console.error(oauthError);
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

    if (!accessToken) {
      return;
    }

    window.history.replaceState({}, "", window.location.pathname);

    fetch(`${API_BASE_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
      .then(async (response) => {
        const payload = await parseApiPayload(response);
        if (!response.ok) {
          throw new Error(payload.message || "Google sign-in failed.");
        }

        const user = payload?.user || {};
        return handleAuthSuccess({
          ...user,
          accessToken,
          rememberMe: true,
        });
      })
      .catch((error) => {
        console.error(error);
      });
  }, [currentUser, handleAuthSuccess]);

  useEffect(() => {
    let isMounted = true;

    if (!currentUser?.accessToken || currentUser?.id) {
      return () => {
        isMounted = false;
      };
    }

    const hydrateMissingIdentity = async () => {
      try {
        const meResponse = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${currentUser.accessToken}`,
          },
        });

        const mePayload = await parseApiPayload(meResponse);
        if (!meResponse.ok) {
          throw new Error(mePayload.message || "Failed to restore session.");
        }

        const authUser = mePayload.user || {};
        const recoveredId = String(authUser.id || "").trim();
        if (!recoveredId) {
          return;
        }

        let existingProfile = null;
        try {
          existingProfile = await fetchProfileById(
            recoveredId,
            currentUser.accessToken,
          );
          if (!existingProfile) {
            const identifier = authUser.email || authUser.phone || "";
            existingProfile = await fetchProfileByIdentifier(
              identifier,
              currentUser.accessToken,
            );
          }
        } catch {
          existingProfile = null;
        }

        if (!isMounted) {
          return;
        }

        const profileId = String(existingProfile?.id || "").trim();
        const nextUser = {
          ...currentUser,
          ...authUser,
          ...(existingProfile || {}),
          id: authUser.id || currentUser.id,
          profileId: profileId || currentUser.profileId || authUser.id,
          accessToken: currentUser.accessToken,
        };

        setCurrentUser(nextUser);
        persistSession(nextUser, rememberMeSession);
      } catch (error) {
        console.error(error);
      }
    };

    hydrateMissingIdentity();

    return () => {
      isMounted = false;
    };
  }, [
    currentUser,
    rememberMeSession,
    fetchProfileById,
    fetchProfileByIdentifier,
    persistSession,
  ]);

  const handleProfileSave = async (updates) => {
    if (!currentUser?.accessToken) {
      throw new Error("Auth session missing. Please sign in again.");
    }

    const savedProfile = await saveProfile({
      phone: updates?.phone ?? currentUser.phone ?? "",
      email: updates?.email || currentUser.email || "",
      name: updates?.name || currentUser.name || "User",
      image: updates?.image || "",
      accessToken: currentUser.accessToken || "",
    });

    const nextUser = {
      ...currentUser,
      ...savedProfile,
      profileId: currentUser?.profileId || currentUser?.id,
    };

    setCurrentUser(nextUser);
    persistSession(nextUser, rememberMeSession);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setRememberMeSession(true);
    localStorage.removeItem(PERSISTENT_SESSION_KEY);
    sessionStorage.removeItem(TAB_SESSION_KEY);
  };

  return (
    <main className="mx-auto flex h-[100dvh] w-full max-w-[1400px] p-0 sm:h-[min(900px,96dvh)] sm:p-2 lg:p-3">
      {currentUser ? (
        <Chat
          currentUser={currentUser}
          onLogout={handleLogout}
          onProfileSave={handleProfileSave}
        />
      ) : (
        <Auth onAuthSuccess={handleAuthSuccess} />
      )}
    </main>
  );
};

export default App;
