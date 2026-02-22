import { useEffect, useState } from "react";
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

  const persistSession = (user, rememberMe) => {
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
  };

  const startUserSession = (user, rememberMe) => {
    setCurrentUser(user);
    setRememberMeSession(rememberMe);
    persistSession(user, rememberMe);
  };

  const fetchProfileByPhone = async (phone, accessToken = "") => {
    const response = await fetch(
      `${API_BASE_URL}/profile/${encodeURIComponent(phone)}`,
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
  };

  const saveProfile = async ({
    name,
    image,
    email,
    phone,
    statusText = "",
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
        statusText,
      }),
    });

    const payload = await parseApiPayload(response);
    if (!response.ok) {
      throw new Error(payload.message || "Failed to save profile.");
    }

    return payload.user || null;
  };

  const handleAuthSuccess = async (user) => {
    const authUser = {
      name: user.name || "User",
      email: user.email || "",
      phone: user.phone || "",
      image: user.image || "",
      statusText: user.statusText || "",
      accessToken: user.accessToken || "",
      rememberMe: Boolean(user.rememberMe),
    };

    if (!authUser.phone) {
      startUserSession(authUser, authUser.rememberMe);
      return;
    }

    try {
      const existingProfile = await fetchProfileByPhone(
        authUser.phone,
        authUser.accessToken,
      );

      startUserSession(
        {
          ...authUser,
          ...(existingProfile || {}),
          email: authUser.email,
          accessToken: authUser.accessToken,
        },
        authUser.rememberMe,
      );
    } catch {
      startUserSession(authUser, authUser.rememberMe);
    }
  };

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
  }, [currentUser]);

  const handleProfileSave = async (updates) => {
    if (!currentUser?.accessToken) {
      throw new Error("Auth session missing. Please sign in again.");
    }

    const savedProfile = await saveProfile({
      phone: updates?.phone || currentUser.phone || "",
      email: updates?.email || currentUser.email || "",
      name: updates?.name || currentUser.name || "User",
      image: updates?.image || "",
      statusText: updates?.statusText || "",
      accessToken: currentUser.accessToken || "",
    });

    const nextUser = {
      ...currentUser,
      ...savedProfile,
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
    <main className="mx-auto flex h-[min(900px,94vh)] w-full max-w-[1400px] p-2 sm:p-4">
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
