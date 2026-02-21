import { useState } from "react";
import Auth from "./components/Auth";
import Chat from "./components/Chat";

const SESSION_STORAGE_KEY = "chat-firebase-app-session";

const App = () => {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const savedSession = localStorage.getItem(SESSION_STORAGE_KEY);
      return savedSession ? JSON.parse(savedSession) : null;
    } catch {
      return null;
    }
  });

  const handleAuthSuccess = (user) => {
    const sessionUser = {
      name: user.name,
      email: user.email,
      phone: user.phone,
    };
    setCurrentUser(sessionUser);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionUser));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem(SESSION_STORAGE_KEY);
  };

  return (
    <main className="mx-auto flex h-[min(900px,94vh)] w-full max-w-[1400px] p-2 sm:p-4">
      {currentUser ? (
        <Chat currentUser={currentUser} onLogout={handleLogout} />
      ) : (
        <Auth onAuthSuccess={handleAuthSuccess} />
      )}
    </main>
  );
};

export default App;
