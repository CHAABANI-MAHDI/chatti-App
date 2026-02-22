const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

dotenv.config();

const buildContext = () => {
  const port = process.env.PORT || 5001;
  const profilesTable = process.env.PROFILES_TABLE || "profiles";
  const messagesTable = process.env.MESSAGES_TABLE || "messages";
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
  const normalizeEmail = (value = "") =>
    String(value || "")
      .trim()
      .toLowerCase();

  const validatePhone = (phone) => /^\+[1-9]\d{7,14}$/.test(phone);
  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

  const serializeSupabaseError = (error = null) => {
    if (!error || typeof error !== "object") {
      return {
        message: String(error || "Unknown error"),
      };
    }

    return {
      name: error.name || "",
      message: error.message || "",
      status: Number.isFinite(error.status) ? Number(error.status) : null,
      code: error.code || "",
      details: error.details || "",
      hint: error.hint || "",
    };
  };

  const isDevEnvironment = process.env.NODE_ENV !== "production";

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
    email: normalizeEmail(record.email || ""),
    phone: formatPhoneFromDb(record.phone),
    name: record.display_name || "User",
    image: await resolveAvatarForClient(record.avatar_url || "", profileClient),
    statusText: record.status_text || "",
  });

  const ensureProfileExists = async (
    profileClient,
    rawPhone,
    fallbackName = "User",
  ) => {
    const phoneForDb = normalizePhoneForDb(rawPhone);
    const safeName = String(fallbackName || "").trim() || "User";

    const { data: existingRows, error: findError } = await profileClient
      .from(profilesTable)
      .select("id, phone, display_name, avatar_url, status_text")
      .eq("phone", phoneForDb)
      .limit(1);

    if (findError) {
      return {
        profile: null,
        error: findError,
      };
    }

    if (existingRows?.[0]) {
      const existing = existingRows[0];
      if (String(existing.display_name || "").trim()) {
        return {
          profile: existing,
          error: null,
        };
      }

      const { data: updatedProfile, error: updateError } = await profileClient
        .from(profilesTable)
        .update({
          display_name: safeName,
        })
        .eq("phone", phoneForDb)
        .select("id, phone, display_name, avatar_url, status_text")
        .single();

      if (updateError) {
        return {
          profile: null,
          error: updateError,
        };
      }

      return {
        profile: updatedProfile,
        error: null,
      };
    }

    const { data: insertedProfile, error: insertError } = await profileClient
      .from(profilesTable)
      .insert({
        phone: phoneForDb,
        display_name: safeName,
        avatar_url: null,
        status_text: null,
      })
      .select("id, phone, display_name, avatar_url, status_text")
      .single();

    if (insertError) {
      return {
        profile: null,
        error: insertError,
      };
    }

    return {
      profile: insertedProfile,
      error: null,
    };
  };

  const mapContactPreview = async (record = {}, profileClient = null) => ({
    id: record.id || null,
    phone: formatPhoneFromDb(record.phone),
    name: record.display_name || "User",
    image: await resolveAvatarForClient(record.avatar_url || "", profileClient),
  });

  const mapAuthUserForClient = (user = {}) => {
    const metadata = user?.user_metadata || {};
    const normalizedEmail = normalizeEmail(user?.email || "");
    const normalizedPhone = normalizePhone(
      String(metadata.phone || user?.phone || ""),
    );
    const fallbackName = normalizedEmail
      ? normalizedEmail.split("@")[0]
      : "User";

    return {
      id: user?.id || "",
      email: normalizedEmail,
      phone: normalizedPhone,
      name:
        String(metadata.full_name || metadata.name || "").trim() ||
        fallbackName,
      image: String(metadata.image || "").trim(),
      statusText: String(metadata.statusText || "").trim(),
    };
  };

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

  const resolveAuthenticatedUser = async (req) => {
    const accessToken = getBearerToken(req);
    if (!accessToken || !supabaseAnonKey) {
      return {
        authClient: null,
        user: null,
        accessToken,
        error: "Missing access token.",
      };
    }

    const authClient = createSupabase(supabaseAnonKey, accessToken);
    if (!authClient) {
      return {
        authClient: null,
        user: null,
        accessToken,
        error: "Supabase auth client is not configured.",
      };
    }

    const { data, error } = await authClient.auth.getUser();
    if (error || !data?.user) {
      return {
        authClient,
        user: null,
        accessToken,
        error: error?.message || "Unauthorized user.",
      };
    }

    return {
      authClient,
      user: data.user,
      accessToken,
      error: "",
    };
  };

  return {
    port,
    profilesTable,
    messagesTable,
    storageBucket,
    supabaseAuthClient,
    supabaseServiceClient,
    getBearerToken,
    getProfileClient,
    normalizePhone,
    normalizeEmail,
    validatePhone,
    validateEmail,
    normalizePhoneForDb,
    validatePhoneForProfile,
    formatPhoneFromDb,
    mapSmsProviderError,
    serializeSupabaseError,
    isDevEnvironment,
    getBucketPathFromUrl,
    isExternalHttpUrl,
    resolveAvatarForClient,
    normalizeAvatarForStorage,
    mapProfileRecord,
    ensureProfileExists,
    mapContactPreview,
    mapAuthUserForClient,
    parseImageDataUrl,
    extensionFromMime,
    resolveRequesterId,
    resolveAuthenticatedUser,
  };
};

module.exports = {
  buildContext,
};
