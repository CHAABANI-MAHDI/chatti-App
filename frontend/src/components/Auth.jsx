import { useState } from "react";
import { API_BASE_URL } from "../lib/apiBaseUrl";

function Auth({ onAuthSuccess }) {
  const [authMode, setAuthMode] = useState("signin");
  const [signUpName, setSignUpName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState("");
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showSignUpConfirmPassword, setShowSignUpConfirmPassword] =
    useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const parsePayload = async (response) => {
    const text = await response.text();

    if (!text) {
      return {};
    }

    try {
      return JSON.parse(text);
    } catch {
      return { message: text };
    }
  };

  const normalizeEmail = (value = "") => value.trim().toLowerCase();

  const handleSwitchMode = (nextMode) => {
    setAuthMode(nextMode);
    setErrorMessage("");
    setSuccessMessage("");
  };

  const signUp = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const name = signUpName.trim();
    const email = normalizeEmail(signUpEmail);
    const password = signUpPassword;
    const confirmPassword = signUpConfirmPassword;

    if (!name) {
      setErrorMessage("Please enter your name.");
      return;
    }

    if (!email) {
      setErrorMessage("Please enter your email.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Password confirmation does not match.");
      return;
    }

    setIsSigningUp(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      });

      const payload = await parsePayload(response);
      if (!response.ok) {
        throw new Error(payload.message || "Sign up failed.");
      }

      setSuccessMessage(
        payload.message ||
          "Account created. Verify your email, then sign in with your password.",
      );
      setSignInEmail(email);
      setSignUpPassword("");
      setSignUpConfirmPassword("");
      setAuthMode("signin");
    } catch (error) {
      setErrorMessage(error.message || "Sign up failed.");
    } finally {
      setIsSigningUp(false);
    }
  };

  const signIn = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const email = normalizeEmail(signInEmail);
    const password = signInPassword;

    if (!email) {
      setErrorMessage("Please enter your email.");
      return;
    }

    if (!password) {
      setErrorMessage("Please enter your password.");
      return;
    }

    setIsSigningIn(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/signin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const payload = await parsePayload(response);
      if (!response.ok) {
        throw new Error(payload.message || "Sign in failed.");
      }

      const user = payload.user || {};
      onAuthSuccess({
        id: user.id || "",
        name: user.name || "User",
        email: user.email || email,
        phone: user.phone || "",
        image: user.image || "",
        statusText: user.statusText || "",
        accessToken: payload.session?.access_token || "",
        rememberMe,
      });
      window.history.replaceState({}, "", "/chat");
    } catch (error) {
      setErrorMessage(error.message || "Sign in failed.");
    } finally {
      setIsSigningIn(false);
    }
  };

  const signInWithGoogle = async () => {
    setErrorMessage("");
    setSuccessMessage("");

    setIsGoogleLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/google/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          redirectTo: `${window.location.origin}${window.location.pathname}`,
        }),
      });

      const payload = await parsePayload(response);
      if (!response.ok || !payload?.url) {
        throw new Error(payload.message || "Failed to start Google sign-in.");
      }

      window.location.assign(payload.url);
    } catch (error) {
      setErrorMessage(error.message || "Failed to start Google sign-in.");
      setIsGoogleLoading(false);
    }
  };

  return (
    <section className="mx-auto flex h-full w-full max-w-[520px] items-center justify-center px-3 py-4 sm:px-4 sm:py-6">
      <div className="w-full rounded-2xl border border-white/25 bg-[#132219]/78 p-4 text-white shadow-2xl backdrop-blur-2xl sm:rounded-3xl sm:p-7">
        <div className="mb-5">
          <h1 className="text-left text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Welcome to Chatti
          </h1>
          <p className="mt-1 text-left text-xs text-white/70 sm:text-sm">
            Sign in with email and password, or create a new account.
          </p>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl border border-white/15 bg-black/20 p-1">
          <button
            type="button"
            onClick={() => handleSwitchMode("signin")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              authMode === "signin"
                ? "bg-[#5e8b5a]/85 text-white"
                : "text-white/75 hover:bg-white/10"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => handleSwitchMode("signup")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              authMode === "signup"
                ? "bg-[#5e8b5a]/85 text-white"
                : "text-white/75 hover:bg-white/10"
            }`}
          >
            Sign Up
          </button>
        </div>

        <form
          className="space-y-3"
          onSubmit={authMode === "signup" ? signUp : signIn}
        >
          {errorMessage && (
            <p className="rounded-lg border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">
              {errorMessage}
            </p>
          )}

          {successMessage && (
            <p className="rounded-lg border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100">
              {successMessage}
            </p>
          )}

          {authMode === "signup" && (
            <div>
              <p className="mb-1 text-left text-xs text-white/70">Name</p>
              <input
                type="text"
                value={signUpName}
                onChange={(event) => setSignUpName(event.target.value)}
                placeholder="Your name"
                className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/55 outline-none"
              />
            </div>
          )}

          <div>
            <p className="mb-1 text-left text-xs text-white/70">Email</p>
            <input
              type="email"
              value={authMode === "signup" ? signUpEmail : signInEmail}
              onChange={(event) =>
                authMode === "signup"
                  ? setSignUpEmail(event.target.value)
                  : setSignInEmail(event.target.value)
              }
              placeholder="you@example.com"
              className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/55 outline-none"
            />
          </div>

          <div>
            <p className="mb-1 text-left text-xs text-white/70">Password</p>
            <div className="flex gap-2">
              <input
                type={
                  authMode === "signup"
                    ? showSignUpPassword
                      ? "text"
                      : "password"
                    : showSignInPassword
                      ? "text"
                      : "password"
                }
                value={authMode === "signup" ? signUpPassword : signInPassword}
                onChange={(event) =>
                  authMode === "signup"
                    ? setSignUpPassword(event.target.value)
                    : setSignInPassword(event.target.value)
                }
                placeholder="••••••••"
                className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/55 outline-none"
              />
              <button
                type="button"
                onClick={() =>
                  authMode === "signup"
                    ? setShowSignUpPassword((previous) => !previous)
                    : setShowSignInPassword((previous) => !previous)
                }
                className="shrink-0 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs text-white/85 hover:bg-white/15"
              >
                {authMode === "signup"
                  ? showSignUpPassword
                    ? "Hide"
                    : "Show"
                  : showSignInPassword
                    ? "Hide"
                    : "Show"}
              </button>
            </div>
          </div>

          {authMode === "signup" && (
            <div>
              <p className="mb-1 text-left text-xs text-white/70">
                Confirm Password
              </p>
              <div className="flex gap-2">
                <input
                  type={showSignUpConfirmPassword ? "text" : "password"}
                  value={signUpConfirmPassword}
                  onChange={(event) =>
                    setSignUpConfirmPassword(event.target.value)
                  }
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/55 outline-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowSignUpConfirmPassword((previous) => !previous)
                  }
                  className="shrink-0 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs text-white/85 hover:bg-white/15"
                >
                  {showSignUpConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-white/75">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-white/30 bg-black/20"
            />
            Keep me signed-in on this device
          </label>

          <button
            type="submit"
            disabled={isSigningUp || isSigningIn || isGoogleLoading}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-[#5e8b5a]/85 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#5e8b5a] disabled:cursor-not-allowed disabled:opacity-75"
          >
            {isSigningUp || isSigningIn ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                {authMode === "signup" ? "Creating..." : "Signing in..."}
              </>
            ) : authMode === "signup" ? (
              "Create Account"
            ) : (
              "Sign In"
            )}
          </button>

          <div className="flex items-center gap-2 text-xs text-white/55">
            <span className="h-px flex-1 bg-white/15" />
            <span>or continue with</span>
            <span className="h-px flex-1 bg-white/15" />
          </div>

          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={isSigningUp || isSigningIn || isGoogleLoading}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-75"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/25 text-white/95">
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5 fill-current"
                aria-hidden="true"
              >
                <path d="M12 10.2v3.9h5.42a4.64 4.64 0 0 1-2.01 3.05l3.25 2.52c1.9-1.75 3-4.33 3-7.39 0-.71-.06-1.39-.19-2.04H12Zm0 11.8c2.7 0 4.97-.9 6.63-2.43l-3.25-2.52c-.9.61-2.05.97-3.38.97-2.6 0-4.8-1.75-5.6-4.11H3.04v2.58A9.99 9.99 0 0 0 12 22Zm-5.6-8.07a5.98 5.98 0 0 1 0-3.86V7.49H3.04a10 10 0 0 0 0 8.99l3.36-2.55ZM12 5.98c1.47 0 2.8.5 3.84 1.48l2.88-2.88C16.96 2.94 14.7 2 12 2 8.1 2 4.74 4.22 3.04 7.49l3.36 2.58c.8-2.36 3-4.09 5.6-4.09Z" />
              </svg>
            </span>
            <span>
              {isGoogleLoading
                ? "Redirecting to Google..."
                : "Continue with Google"}
            </span>
          </button>
        </form>
      </div>
    </section>
  );
}

export default Auth;
