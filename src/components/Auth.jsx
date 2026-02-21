import { useState } from "react";

const USERS_STORAGE_KEY = "chat-firebase-app-users";

function Auth({ onAuthSuccess }) {
  const [mode, setMode] = useState("signin");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [errorMessage, setErrorMessage] = useState("");

  const updateField = (field, value) => {
    setFormData((previous) => ({ ...previous, [field]: value }));
  };

  const getStoredUsers = () => {
    try {
      const rawUsers = localStorage.getItem(USERS_STORAGE_KEY);
      return rawUsers ? JSON.parse(rawUsers) : [];
    } catch {
      return [];
    }
  };

  const saveUsers = (users) => {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setErrorMessage("");

    const email = formData.email.trim().toLowerCase();
    const password = formData.password;
    const users = getStoredUsers();

    if (!email || !password) {
      setErrorMessage("Email and password are required.");
      return;
    }

    if (mode === "signup") {
      const name = formData.name.trim();
      const phone = formData.phone.trim();

      if (!name || !phone) {
        setErrorMessage("Name and phone are required for sign up.");
        return;
      }

      if (password.length < 6) {
        setErrorMessage("Password must be at least 6 characters.");
        return;
      }

      if (password !== formData.confirmPassword) {
        setErrorMessage("Confirm password does not match.");
        return;
      }

      const emailExists = users.some((user) => user.email === email);
      if (emailExists) {
        setErrorMessage("This email is already used. Please sign in.");
        return;
      }

      const newUser = {
        id: Date.now(),
        name,
        email,
        phone,
        password,
      };

      saveUsers([...users, newUser]);
      onAuthSuccess(newUser);
      return;
    }

    const foundUser = users.find(
      (user) => user.email === email && user.password === password,
    );

    if (!foundUser) {
      setErrorMessage("Invalid email or password.");
      return;
    }

    onAuthSuccess(foundUser);
  };

  return (
    <section className="mx-auto flex h-full w-full max-w-[460px] items-center justify-center">
      <div className="w-full rounded-3xl border border-white/25 bg-[#132219]/75 p-6 text-white shadow-2xl backdrop-blur-2xl sm:p-7">
        <div className="mb-5">
          <h1 className="text-left text-2xl font-semibold tracking-tight text-white">
            {mode === "signin" ? "Welcome back" : "Create account"}
          </h1>
          <p className="mt-1 text-left text-sm text-white/70">
            {mode === "signin"
              ? "Sign in to continue to your chats"
              : "Sign up to start chatting"}
          </p>
        </div>

              <div className="mb-5 grid grid-cols-2 rounded-xl border border-white/20 bg-black/20 p-1">
                  {/* Feature: switch between sign in and sign up */}
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setErrorMessage("");
            }}
            className={`rounded-lg px-3 py-2 text-sm transition-colors ${
              mode === "signin"
                ? "bg-white/15 text-white"
                : "text-white/70 hover:text-white"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setErrorMessage("");
            }}
            className={`rounded-lg px-3 py-2 text-sm transition-colors ${
              mode === "signup"
                ? "bg-white/15 text-white"
                : "text-white/70 hover:text-white"
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <>
              <div>
                <p className="mb-1 text-left text-xs text-white/70">Name</p>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="Your full name"
                  className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/55 outline-none"
                />
              </div>
              <div>
                <p className="mb-1 text-left text-xs text-white/70">Phone</p>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  placeholder="Your phone number"
                  className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/55 outline-none"
                />
              </div>
            </>
          )}

          <div>
            <p className="mb-1 text-left text-xs text-white/70">Email</p>
            <input
              type="email"
              value={formData.email}
              onChange={(event) => updateField("email", event.target.value)}
              placeholder="Your email"
              className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/55 outline-none"
            />
          </div>

          <div>
            <p className="mb-1 text-left text-xs text-white/70">Password</p>
            <input
              type="password"
              value={formData.password}
              onChange={(event) => updateField("password", event.target.value)}
              placeholder="Your password"
              className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/55 outline-none"
            />
          </div>

          {mode === "signup" && (
            <div>
              <p className="mb-1 text-left text-xs text-white/70">
                Confirm password
              </p>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(event) =>
                  updateField("confirmPassword", event.target.value)
                }
                placeholder="Repeat password"
                className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/55 outline-none"
              />
            </div>
          )}

          {errorMessage && (
            <p className="rounded-lg border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            className="mt-1 w-full rounded-lg bg-[#5e8b5a]/85 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#5e8b5a]"
          >
            {mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </div>
    </section>
  );
}

export default Auth;
