const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null;

const normalizePhone = (value = "") => value.trim().replace(/[^\d+]/g, "");

const validatePhone = (phone) => /^\+[1-9]\d{7,14}$/.test(phone);

const mapSmsProviderError = (message = "") => {
  const rawMessage = String(message);

  if (
    rawMessage.includes("21212") ||
    rawMessage.includes("Invalid From Number")
  ) {
    return "SMS provider is misconfigured: Twilio rejected the sender. In Supabase Auth > Phone, use a valid Twilio sender (phone number in E.164 or a Messaging Service SID that starts with MG), not a Verify SID (VA...).";
  }

  return rawMessage || "Failed to send OTP.";
};

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "chatti-app-backend",
    timestamp: new Date().toISOString(),
  });
});

app.post("/send-otp", async (req, res) => {
  if (!supabase) {
    return res.status(500).json({
      message:
        "Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.",
    });
  }

  const phone = normalizePhone(req.body?.phone);

  if (!validatePhone(phone)) {
    return res.status(400).json({
      message:
        "Phone must include country code in E.164 format (example: +216123456).",
    });
  }

  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: {
      shouldCreateUser: true,
    },
  });

  if (error) {
    return res.status(400).json({
      message: mapSmsProviderError(error.message),
    });
  }

  return res.status(200).json({ message: "OTP sent successfully." });
});

app.post("/verify-otp", async (req, res) => {
  if (!supabase) {
    return res.status(500).json({
      message:
        "Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.",
    });
  }

  const phone = normalizePhone(req.body?.phone);
  const token = String(req.body?.token || "").trim();

  if (!validatePhone(phone)) {
    return res.status(400).json({
      message:
        "Phone must include country code in E.164 format (example: +216123456).",
    });
  }

  if (!/^\d{6}$/.test(token)) {
    return res.status(400).json({ message: "OTP token must be 6 digits." });
  }

  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: "sms",
  });

  if (error) {
    return res.status(401).json({ message: error.message || "Invalid OTP." });
  }

  return res.status(200).json({
    message: "Phone verified successfully.",
    user: {
      id: data?.user?.id,
      phone: data?.user?.phone || phone,
      email: data?.user?.email || "",
      name: data?.user?.user_metadata?.full_name || "User",
    },
    session: {
      access_token: data?.session?.access_token || null,
      refresh_token: data?.session?.refresh_token || null,
    },
  });
});

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
