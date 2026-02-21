import { useState } from "react";
import Auth from "./components/Auth";
import Chat from "./components/Chat";
import ProfileOnboarding from "./components/ProfileOnboarding";

const SESSION_STORAGE_KEY = "chat-firebase-app-session";
const PROFILE_STORAGE_KEY = "chat-firebase-app-profiles";

const readProfiles = () => {
  try {
    const rawProfiles = localStorage.getItem(PROFILE_STORAGE_KEY);
    const parsedProfiles = rawProfiles ? JSON.parse(rawProfiles) : {};
    return parsedProfiles && typeof parsedProfiles === "object"
      ? parsedProfiles
      : {};
  } catch {
    return {};
  }
};

const saveProfileForPhone = (phone, profile) => {
  if (!phone) {
    return;
  }

  const profiles = readProfiles();
  profiles[phone] = profile;
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles));
};

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

  const handleAuthSuccess = (user) => {
    const authUser = {
      name: user.name,
      phone: user.phone,
      image: user.image || "",
    };

    const existingProfile = readProfiles()[authUser.phone];

    if (existingProfile) {
      startUserSession({
        ...authUser,
        ...existingProfile,
      });
      return;
    }

    setPendingUser(authUser);
  };

  const handleOnboardingComplete = ({ name, image }) => {
    if (!pendingUser) {
      return;
    }

    const completedUser = {
      ...pendingUser,
      name: name || pendingUser.name || "User",
      image: image || "",
    };

    saveProfileForPhone(completedUser.phone, {
      name: completedUser.name,
      image: completedUser.image,
    });

    startUserSession(completedUser);
  };

  const handleOnboardingSkip = () => {
    if (!pendingUser) {
      return;
    }

    const skippedUser = {
      ...pendingUser,
      name: pendingUser.name || "User",
      image: "",
    };

    saveProfileForPhone(skippedUser.phone, {
      name: skippedUser.name,
      image: skippedUser.image,
    });

    startUserSession(skippedUser);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem(SESSION_STORAGE_KEY);
  };

  return (
    <main className="mx-auto flex h-[min(900px,94vh)] w-full max-w-[1400px] p-2 sm:p-4">
      {currentUser ? (
        <Chat currentUser={currentUser} onLogout={handleLogout} />
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
