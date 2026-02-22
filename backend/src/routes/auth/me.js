const registerAuthMeRoute = (app, ctx) => {
  app.get("/auth/me", async (req, res) => {
    const { user, error } = await ctx.resolveAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        message: error || "Unauthorized user.",
      });
    }

    return res.status(200).json({
      user: ctx.mapAuthUserForClient(user),
    });
  });
};

module.exports = registerAuthMeRoute;
