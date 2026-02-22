import { useState } from "react";
import Auth from "./components/Auth";
import Chat from "./components/Chat";
import ProfileOnboarding from "./components/ProfileOnboarding";

const PERSISTENT_SESSION_KEY = "chat-firebase-app-session-persistent";
const TAB_SESSION_KEY = "chat-firebase-app-session-tab";
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
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
  const [pendingUser, setPendingUser] = useState(null);

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
    setPendingUser(null);
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
    phone,
    name,
    image,
    statusText = "",
    accessToken = "",
  }) => {
    const response = await fetch(`${API_BASE_URL}/profile`, {
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
        phone,
        name,
        image,
        statusText,
      }),
    });

    const payload = await parseApiPayload(response);
    if (!response.ok) {
      throw new Error(payload.message || "Failed to save profile.");
    }

    return payload.profile || null;
  };

  const handleAuthSuccess = async (user) => {
    const authUser = {
      name: user.name,
      phone: user.phone,
      image: user.image || "",
      accessToken: user.accessToken || "",
      rememberMe: Boolean(user.rememberMe),
    };

    try {
      const existingProfile = await fetchProfileByPhone(
        authUser.phone,
        authUser.accessToken,
      );
      if (!existingProfile) {
        setPendingUser(authUser);
        return;
      }

      startUserSession(
        {
          ...authUser,
          ...existingProfile,
        },
        authUser.rememberMe,
      );
    } catch {
      setPendingUser(authUser);
    }
  };

  const handleOnboardingComplete = async ({ name, image }) => {
    if (!pendingUser) {
      return;
    }

    const savedProfile = await saveProfile({
      phone: pendingUser.phone,
      name: name || pendingUser.name || "User",
      image: image || "",
      accessToken: pendingUser.accessToken || "",
    });

    startUserSession(
      {
        ...pendingUser,
        ...savedProfile,
        phone: pendingUser.phone,
      },
      pendingUser.rememberMe,
    );
  };

  const handleOnboardingSkip = async () => {
    if (!pendingUser) {
      return;
    }

    const savedProfile = await saveProfile({
      phone: pendingUser.phone,
      name: pendingUser.name || "User",
      image: "",
      accessToken: pendingUser.accessToken || "",
    });

    startUserSession(
      {
        ...pendingUser,
        ...savedProfile,
        phone: pendingUser.phone,
      },
      pendingUser.rememberMe,
    );
  };

  const handleProfileSave = async (updates) => {
    if (!currentUser?.phone) {
      return;
    }

    const savedProfile = await saveProfile({
      phone: currentUser.phone,
      name: updates?.name || currentUser.name || "User",
      image: updates?.image || "",
      statusText: updates?.statusText || "",
      accessToken: currentUser.accessToken || "",
    });

    const nextUser = {
      ...currentUser,
      ...savedProfile,
      phone: currentUser.phone,
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
      ) : pendingUser ? (
        <ProfileOnboarding
          phone={pendingUser.phone}
          initialName={pendingUser.name}
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
        />
      ) : (
        <Auth onAuthSuccess={handleAuthSuccess} />
      )}
    </main>
  );
};

export default App;
