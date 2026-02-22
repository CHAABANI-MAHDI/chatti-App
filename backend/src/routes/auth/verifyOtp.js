const registerVerifyOtpRoute = (app, ctx) => {
  app.post("/verify-otp", async (req, res) => {
    if (!ctx.supabaseAuthClient) {
      return res.status(500).json({
        message:
          "Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.",
      });
    }

    const phone = ctx.normalizePhone(req.body?.phone);
    const token = String(req.body?.token || "").trim();

    if (!ctx.validatePhone(phone)) {
      return res.status(400).json({
        message:
          "Phone must include country code in E.164 format (example: +216123456).",
      });
    }

    if (!/^\d{6}$/.test(token)) {
      return res.status(400).json({ message: "OTP token must be 6 digits." });
    }

    const { data, error } = await ctx.supabaseAuthClient.auth.verifyOtp({
      phone,
      token,
      type: "sms",
    });

    if (error) {
      return res.status(401).json({ message: error.message || "Invalid OTP." });
    }

    const profileWriteClient =
      ctx.supabaseServiceClient || ctx.supabaseAuthClient;
    if (!profileWriteClient) {
      return res.status(500).json({
        message:
          "Supabase profile client is not configured. Add SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY.",
      });
    }

    const { profile: ensuredProfile, error: ensureProfileError } =
      await ctx.ensureProfileExists(
        profileWriteClient,
        data?.user?.phone || phone,
        data?.user?.user_metadata?.full_name || "User",
      );

    if (ensureProfileError) {
      if (
        String(ensureProfileError.message || "")
          .toLowerCase()
          .includes("row-level security")
      ) {
        return res.status(403).json({
          message:
            "Phone verified, but profile creation is blocked by Supabase RLS. Add SUPABASE_SERVICE_ROLE_KEY to backend .env, or update your RLS policy for the profiles table.",
        });
      }

      return res.status(500).json({
        message:
          ensureProfileError.message ||
          "Phone verified, but failed to create the user profile.",
      });
    }

    return res.status(200).json({
      message: "Phone verified successfully.",
      user: {
        id: data?.user?.id,
        phone: data?.user?.phone || phone,
        name:
          ensuredProfile?.display_name ||
          data?.user?.user_metadata?.full_name ||
          "User",
      },
      session: {
        access_token: data?.session?.access_token || null,
        refresh_token: data?.session?.refresh_token || null,
      },
    });
  });
};

module.exports = registerVerifyOtpRoute;
