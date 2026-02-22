const registerGoogleStartRoute = (app, ctx) => {
  app.post("/auth/google/start", async (req, res) => {
    if (!ctx.supabaseAuthClient) {
      return res.status(500).json({
        message:
          "Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.",
      });
    }

    const requestedRedirectTo = String(req.body?.redirectTo || "").trim();
    const defaultRedirectTo = String(
      process.env.GOOGLE_AUTH_REDIRECT_TO || "",
    ).trim();
    const redirectTo = requestedRedirectTo || defaultRedirectTo;

    if (redirectTo) {
      try {
        const parsed = new URL(redirectTo);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          return res.status(400).json({
            message: "redirectTo must be a valid http/https URL.",
          });
        }
      } catch {
        return res.status(400).json({
          message: "redirectTo must be a valid URL.",
        });
      }
    }

    const { data, error } = await ctx.supabaseAuthClient.auth.signInWithOAuth({
      provider: "google",
      options: {
        ...(redirectTo
          ? {
              redirectTo,
            }
          : {}),
        skipBrowserRedirect: true,
      },
    });

    if (error || !data?.url) {
      return res.status(400).json({
        message: error?.message || "Failed to start Google sign-in.",
      });
    }

    return res.status(200).json({
      message: "Google sign-in started.",
      url: data.url,
    });
  });
};

module.exports = registerGoogleStartRoute;
