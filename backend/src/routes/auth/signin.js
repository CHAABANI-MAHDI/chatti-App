const registerSigninRoute = (app, ctx) => {
  app.post("/auth/signin", async (req, res) => {
    if (!ctx.supabaseAuthClient) {
      return res.status(500).json({
        message:
          "Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.",
      });
    }

    const email = ctx.normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!ctx.validateEmail(email)) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }

    if (!password) {
      return res.status(400).json({ message: "Password is required." });
    }

    const { data, error } =
      await ctx.supabaseAuthClient.auth.signInWithPassword({
        email,
        password,
      });

    if (error) {
      return res.status(401).json({
        message:
          error.message ||
          "Sign in failed. Check your email/password and verify your email first.",
      });
    }

    return res.status(200).json({
      message: "Signed in successfully.",
      user: ctx.mapAuthUserForClient(data?.user || {}),
      session: {
        access_token: data?.session?.access_token || null,
        refresh_token: data?.session?.refresh_token || null,
      },
    });
  });
};

module.exports = registerSigninRoute;
