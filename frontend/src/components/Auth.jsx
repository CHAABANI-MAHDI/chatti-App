import { useMemo, useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

function Auth({ onAuthSuccess }) {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const sanitizedOtp = useMemo(() => otp.replace(/\D/g, "").slice(0, 6), [otp]);

  const normalizePhone = (value) => value.trim().replace(/[^\d+]/g, "");

  const sendOtp = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone || !normalizedPhone.startsWith("+")) {
      setErrorMessage(
        "Enter a valid phone number with country code (example: +216123456).",
      );
      return;
    }

    setIsSendingCode(true);
    try {
      const response = await fetch(`${API_BASE_URL}/send-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone: normalizedPhone }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || "Failed to send OTP code.");
      }

      setCodeSent(true);
      setSuccessMessage("Code sent successfully. Please check your phone.");
    } catch (error) {
      setErrorMessage(error.message || "Failed to send OTP code.");
    } finally {
      setIsSendingCode(false);
    }
  };

  const verifyOtp = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!codeSent) {
      setErrorMessage("Send the code first.");
      return;
    }

    if (sanitizedOtp.length !== 6) {
      setErrorMessage("Enter the 6-digit OTP code.");
      return;
    }

    setIsVerifyingCode(true);
    try {
      const response = await fetch(`${API_BASE_URL}/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: normalizePhone(phone),
          token: sanitizedOtp,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || "OTP verification failed.");
      }

      setSuccessMessage("Phone verified successfully. Redirecting to chat...");

      const user = payload.user || {};
      onAuthSuccess({
        name: user.name || user.full_name || "User",
        phone: user.phone || normalizePhone(phone),
        accessToken: payload.session?.access_token || "",
        rememberMe,
      });
      window.history.replaceState({}, "", "/chat");
    } catch (error) {
      setErrorMessage(error.message || "OTP verification failed.");
    } finally {
      setIsVerifyingCode(false);
    }
  };

  return (
    <section className="mx-auto flex h-full w-full max-w-[460px] items-center justify-center">
      <div className="w-full rounded-3xl border border-white/25 bg-[#132219]/75 p-6 text-white shadow-2xl backdrop-blur-2xl sm:p-7">
        <div className="mb-5">
          <h1 className="text-left text-2xl font-semibold tracking-tight text-white">
            Phone Sign In
          </h1>
          <p className="mt-1 text-left text-sm text-white/70">
            Use your phone number and one-time code to continue.
          </p>
        </div>

        <form className="space-y-3">
          <div>
            <p className="mb-1 text-left text-xs text-white/70">Phone Number</p>
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+216123456"
              className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/55 outline-none"
            />
            <p className="mt-1 text-left text-[11px] text-white/55">
              Include country code (e.g. +216)
            </p>
          </div>

          <button
            type="button"
            onClick={sendOtp}
            disabled={isSendingCode}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-[#5e8b5a]/85 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#5e8b5a] disabled:cursor-not-allowed disabled:opacity-75"
          >
            {isSendingCode ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                Sending...
              </>
            ) : (
              "Send Code"
            )}
          </button>

          <div>
            <p className="mb-1 text-left text-xs text-white/70">OTP Code</p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              disabled={!codeSent || isSendingCode}
              value={sanitizedOtp}
              onChange={(event) => setOtp(event.target.value)}
              placeholder="6-digit code"
              className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/55 outline-none"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-white/75">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-white/30 bg-black/20"
            />
            Keep me signed-in on this device
          </label>

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

          <button
            type="button"
            onClick={verifyOtp}
            disabled={!codeSent || isVerifyingCode || sanitizedOtp.length !== 6}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-[#5e8b5a]/85 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#5e8b5a] disabled:cursor-not-allowed disabled:opacity-75"
          >
            {isVerifyingCode ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                Verifying...
              </>
            ) : (
              "Verify Code"
            )}
          </button>
        </form>
      </div>
    </section>
  );
}

export default Auth;
