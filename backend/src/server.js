const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const profilesTable = process.env.PROFILES_TABLE || "profiles";
const storageBucket = process.env.SUPABASE_STORAGE_BUCKET || "Chatti - App";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const createSupabase = (key, accessToken = "") =>
  supabaseUrl && key
    ? createClient(supabaseUrl, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        ...(accessToken
          ? {
              global: {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              },
            }
          : {}),
      })
    : null;

const supabaseAuthClient = createSupabase(
  supabaseAnonKey || supabaseServiceRoleKey,
);
const supabaseServiceClient = createSupabase(supabaseServiceRoleKey);

const getBearerToken = (req) => {
  const rawHeader = String(req.headers?.authorization || "").trim();
  if (!rawHeader.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return rawHeader.slice(7).trim();
};

const getProfileClient = (req) => {
  const accessToken = getBearerToken(req);

  if (accessToken && supabaseAnonKey) {
    return createSupabase(supabaseAnonKey, accessToken);
  }

  if (supabaseServiceClient) {
    return supabaseServiceClient;
  }

  return supabaseAuthClient;
};

const normalizePhone = (value = "") => value.trim().replace(/[^\d+]/g, "");

const validatePhone = (phone) => /^\+[1-9]\d{7,14}$/.test(phone);
const normalizePhoneForDb = (phone) => phone.replace(/\D/g, "");
const validatePhoneForProfile = (phone) => {
  const digits = normalizePhoneForDb(phone);
  return /^[1-9]\d{7,14}$/.test(digits);
};
const formatPhoneFromDb = (phone) => {
  const digits = normalizePhoneForDb(phone);
  return digits ? `+${digits}` : "";
};

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

const getBucketPathFromUrl = (value = "") => {
  const rawValue = String(value || "").trim();
  if (!rawValue) {
    return "";
  }

  try {
    const parsedUrl = new URL(rawValue);
    const pathname = decodeURIComponent(parsedUrl.pathname || "");
    const publicPrefix = `/storage/v1/object/public/${storageBucket}/`;
    const signPrefix = `/storage/v1/object/sign/${storageBucket}/`;

    if (pathname.includes(publicPrefix)) {
      return pathname.split(publicPrefix)[1] || "";
    }

    if (pathname.includes(signPrefix)) {
      return pathname.split(signPrefix)[1] || "";
    }

    return "";
  } catch {
    return "";
  }
};

const isExternalHttpUrl = (value = "") => /^https?:\/\//i.test(String(value));

const resolveAvatarForClient = async (
  avatarValue = "",
  profileClient = null,
) => {
  const rawValue = String(avatarValue || "").trim();
  if (!rawValue) {
    return "";
  }

  if (rawValue.startsWith("data:image/")) {
    return rawValue;
  }

  const bucketPath = getBucketPathFromUrl(rawValue);
  const looksLikeStoragePath =
    !isExternalHttpUrl(rawValue) && !rawValue.startsWith("/");
  const objectPath = bucketPath || (looksLikeStoragePath ? rawValue : "");

  if (!objectPath) {
    return rawValue;
  }

  const signedClient = supabaseServiceClient || profileClient;
  if (signedClient) {
    const { data: signedUrlData, error: signedUrlError } =
      await signedClient.storage
        .from(storageBucket)
        .createSignedUrl(objectPath, 60 * 60 * 24 * 7);

    if (!signedUrlError && signedUrlData?.signedUrl) {
      return signedUrlData.signedUrl;
    }
  }

  const publicClient =
    profileClient || supabaseAuthClient || supabaseServiceClient;
  if (publicClient) {
    const { data: publicUrlData } = publicClient.storage
      .from(storageBucket)
      .getPublicUrl(objectPath);

    const rawPublicUrl = publicUrlData?.publicUrl || "";
    return rawPublicUrl ? encodeURI(rawPublicUrl) : "";
  }

  return rawValue;
};

const normalizeAvatarForStorage = (avatarValue = "") => {
  const rawValue = String(avatarValue || "").trim();
  if (!rawValue) {
    return "";
  }

  const bucketPath = getBucketPathFromUrl(rawValue);
  if (bucketPath) {
    return bucketPath;
  }

  return rawValue;
};

const mapProfileRecord = async (record = {}, profileClient = null) => ({
  id: record.id || null,
  phone: formatPhoneFromDb(record.phone),
  name: record.display_name || "User",
  image: await resolveAvatarForClient(record.avatar_url || "", profileClient),
  statusText: record.status_text || "",
});

const parseImageDataUrl = (value = "") => {
  const match = String(value)
    .trim()
    .match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

  if (!match) {
    return null;
  }

  const mimeType = match[1].toLowerCase();
  const base64Body = match[2];

  try {
    const buffer = Buffer.from(base64Body, "base64");
    if (!buffer.length) {
      return null;
    }

    return {
      mimeType,
      buffer,
    };
  } catch {
    return null;
  }
};

const extensionFromMime = (mimeType = "") => {
  const map = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
  };

  return map[mimeType] || "jpg";
};

const resolveRequesterId = async (req) => {
  const accessToken = getBearerToken(req);
  if (!accessToken || !supabaseAnonKey) {
    return "";
  }

  const authClient = createSupabase(supabaseAnonKey, accessToken);
  if (!authClient) {
    return "";
  }

  const { data, error } = await authClient.auth.getUser();
  if (error) {
    return "";
  }

  return data?.user?.id || "";
};

app.use(
  cors({
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "chatti-app-backend",
    timestamp: new Date().toISOString(),
  });
});

app.post("/send-otp", async (req, res) => {
  if (!supabaseAuthClient) {
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

  const { error } = await supabaseAuthClient.auth.signInWithOtp({
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
  if (!supabaseAuthClient) {
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

  const { data, error } = await supabaseAuthClient.auth.verifyOtp({
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
      name: data?.user?.user_metadata?.full_name || "User",
    },
    session: {
      access_token: data?.session?.access_token || null,
      refresh_token: data?.session?.refresh_token || null,
    },
  });
});

app.get("/profile/:phone", async (req, res) => {
  const profileClient = getProfileClient(req);
  if (!profileClient) {
    return res.status(500).json({
      message:
        "Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.",
    });
  }

  const rawPhone = normalizePhone(String(req.params?.phone || ""));

  if (!validatePhoneForProfile(rawPhone)) {
    return res.status(400).json({
      message:
        "Phone must be a valid number with country code (example: +216123456).",
    });
  }

  const phoneForDb = normalizePhoneForDb(rawPhone);
  const { data, error } = await profileClient
    .from(profilesTable)
    .select("id, phone, display_name, avatar_url, status_text")
    .eq("phone", phoneForDb)
    .limit(1);

  if (error) {
    if (
      String(error.message || "")
        .toLowerCase()
        .includes("row-level security")
    ) {
      return res.status(403).json({
        message:
          "Profile read blocked by Supabase RLS. Add SUPABASE_SERVICE_ROLE_KEY to backend .env, or update your RLS policy for the profiles table.",
      });
    }

    return res.status(500).json({
      message: error.message || "Failed to fetch profile.",
    });
  }

  const record = data?.[0];
  if (!record) {
    return res.status(200).json({ profile: null });
  }

  return res.status(200).json({
    profile: await mapProfileRecord(record, profileClient),
  });
});

app.put("/profile", async (req, res) => {
  const profileClient = getProfileClient(req);
  if (!profileClient) {
    return res.status(500).json({
      message:
        "Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.",
    });
  }

  const rawPhone = normalizePhone(req.body?.phone);
  const displayName = String(req.body?.name || "").trim() || "User";
  const avatarUrl = String(req.body?.image || "").trim();
  const statusText = String(req.body?.statusText || "").trim();

  if (!validatePhoneForProfile(rawPhone)) {
    return res.status(400).json({
      message:
        "Phone must be a valid number with country code (example: +216123456).",
    });
  }

  const phoneForDb = normalizePhoneForDb(rawPhone);

  let resolvedAvatarUrl = normalizeAvatarForStorage(avatarUrl) || null;
  const imagePayload = parseImageDataUrl(avatarUrl);

  if (imagePayload) {
    if (imagePayload.buffer.length > 3 * 1024 * 1024) {
      return res.status(400).json({
        message: "Profile image is too large. Max allowed size is 3MB.",
      });
    }

    const requesterId = await resolveRequesterId(req);
    const fileExtension = extensionFromMime(imagePayload.mimeType);
    const filePath = `${requesterId || phoneForDb}/avatar-${Date.now()}.${fileExtension}`;

    const { error: uploadError } = await profileClient.storage
      .from(storageBucket)
      .upload(filePath, imagePayload.buffer, {
        contentType: imagePayload.mimeType,
        upsert: true,
      });

    if (uploadError) {
      return res.status(500).json({
        message: uploadError.message || "Failed to upload profile image.",
      });
    }

    resolvedAvatarUrl = filePath;
  }

  const { data: existingRecords, error: findError } = await profileClient
    .from(profilesTable)
    .select("*")
    .eq("phone", phoneForDb)
    .limit(1);

  if (findError) {
    return res.status(500).json({
      message: findError.message || "Failed to fetch current profile.",
    });
  }

  const payload = {
    phone: phoneForDb,
    display_name: displayName,
    avatar_url: resolvedAvatarUrl,
    status_text: statusText || null,
  };

  let writeQuery = profileClient.from(profilesTable);
  if (existingRecords?.length > 0) {
    // Update existing profile by phone
    writeQuery = writeQuery
      .update(payload)
      .eq("phone", phoneForDb)
      .select("id, phone, display_name, avatar_url, status_text")
      .single();
  } else {
    // Insert new profile
    // Note: This requires that the profiles table has a DEFAULT for id column
    // If you get "null value in column id", run this in Supabase SQL Editor:
    // ALTER TABLE profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();
    writeQuery = writeQuery
      .insert(payload)
      .select("id, phone, display_name, avatar_url, status_text")
      .single();
  }

  const { data: savedProfile, error: writeError } = await writeQuery;

  if (writeError) {
    if (
      String(writeError.message || "")
        .toLowerCase()
        .includes("row-level security")
    ) {
      return res.status(403).json({
        message:
          "Profile write blocked by Supabase RLS. Add SUPABASE_SERVICE_ROLE_KEY to backend .env, or update your RLS policy for the profiles table.",
      });
    }

    return res.status(500).json({
      message: writeError.message || "Failed to save profile.",
    });
  }

  return res.status(200).json({
    message: "Profile saved successfully.",
    profile: await mapProfileRecord(savedProfile, profileClient),
  });
});

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
