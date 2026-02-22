import { useState } from "react";
import Auth from "./components/Auth";
import Chat from "./components/Chat";
import ProfileOnboarding from "./components/ProfileOnboarding";

const SESSION_STORAGE_KEY = "chat-firebase-app-session";
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const App = () => {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const savedSession = localStorage.getItem(SESSION_STORAGE_KEY);
      return savedSession ? JSON.parse(savedSession) : null;
    } catch {
      return null;
    }
  });
  const [pendingUser, setPendingUser] = useState(null);

  const startUserSession = (user) => {
    setCurrentUser(user);
    setPendingUser(null);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
  };

  const fetchProfileByPhone = async (phone) => {
    const response = await fetch(
      `${API_BASE_URL}/profile/${encodeURIComponent(phone)}`,
    );

    if (response.status === 404) {
      return null;
    }

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message || "Failed to fetch profile.");
    }

    return payload.profile || null;
  };

  const saveProfile = async ({ phone, name, image, statusText = "" }) => {
    const response = await fetch(`${API_BASE_URL}/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone,
        name,
        image,
        statusText,
      }),
    });

    const payload = await response.json();
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
    };

    try {
      const existingProfile = await fetchProfileByPhone(authUser.phone);
      if (!existingProfile) {
        setPendingUser(authUser);
        return;
      }

      startUserSession({
        ...authUser,
        ...existingProfile,
      });
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
    });

    startUserSession({
      ...pendingUser,
      ...savedProfile,
      phone: pendingUser.phone,
    });
  };

  const handleOnboardingSkip = async () => {
    if (!pendingUser) {
      return;
    }

    const savedProfile = await saveProfile({
      phone: pendingUser.phone,
      name: pendingUser.name || "User",
      image: "",
    });

    startUserSession({
      ...pendingUser,
      ...savedProfile,
      phone: pendingUser.phone,
    });
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
    });

    const nextUser = {
      ...currentUser,
      ...savedProfile,
      phone: currentUser.phone,
    };

    setCurrentUser(nextUser);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextUser));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem(SESSION_STORAGE_KEY);
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
