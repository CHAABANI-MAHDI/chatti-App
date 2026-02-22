const registerSendOtpRoute = (app, ctx) => {
  app.post("/send-otp", async (req, res) => {
    if (!ctx.supabaseAuthClient) {
      return res.status(500).json({
        message:
          "Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.",
      });
    }

    const phone = ctx.normalizePhone(req.body?.phone);

    if (!ctx.validatePhone(phone)) {
      return res.status(400).json({
        message:
          "Phone must include country code in E.164 format (example: +216123456).",
      });
    }

    const { error } = await ctx.supabaseAuthClient.auth.signInWithOtp({
      phone,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      return res.status(400).json({
        message: ctx.mapSmsProviderError(error.message),
      });
    }

    return res.status(200).json({ message: "OTP sent successfully." });
  });
};

module.exports = registerSendOtpRoute;
