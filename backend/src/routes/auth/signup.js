const registerSignupRoute = (app, ctx) => {
  app.post("/auth/signup", async (req, res) => {
    if (!ctx.supabaseAuthClient) {
      return res.status(500).json({
        message:
          "Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.",
      });
    }

    const name = String(req.body?.name || "").trim();
    const email = ctx.normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!name) {
      return res.status(400).json({ message: "Name is required." });
    }

    if (!ctx.validateEmail(email)) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters." });
    }

    const emailRedirectTo = String(process.env.EMAIL_REDIRECT_TO || "").trim();

    const { data, error } = await ctx.supabaseAuthClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          name,
        },
        ...(emailRedirectTo
          ? {
              emailRedirectTo,
            }
          : {}),
      },
    });

    if (error) {
      const serializedError = ctx.serializeSupabaseError(error);

      console.error("[auth/signup] Supabase signUp failed", {
        email,
        error: serializedError,
      });

      return res.status(400).json({
        message: error.message || "Sign up failed.",
        ...(ctx.isDevEnvironment ? { debug: serializedError } : {}),
      });
    }

    return res.status(200).json({
      message:
        "Account created. We sent a verification link to your email. Please verify, then sign in.",
      email,
      user: ctx.mapAuthUserForClient(data?.user || {}),
    });
  });
};

module.exports = registerSignupRoute;
