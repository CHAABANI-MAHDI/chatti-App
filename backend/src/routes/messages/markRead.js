const registerMarkReadRoute = (app, ctx) => {
  app.post("/messages/read", async (req, res) => {
    const profileClient = ctx.getProfileClient(req);
    if (!profileClient) {
      return res.status(500).json({
        message:
          "Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.",
      });
    }

    const rawOwnerPhone = ctx.normalizePhone(req.body?.ownerPhone);
    const rawContactPhone = ctx.normalizePhone(req.body?.contactPhone);

    if (!ctx.validatePhoneForProfile(rawOwnerPhone)) {
      return res.status(400).json({ message: "ownerPhone is invalid." });
    }

    if (!ctx.validatePhoneForProfile(rawContactPhone)) {
      return res.status(400).json({ message: "contactPhone is invalid." });
    }

    return res.status(200).json({
      updated: 0,
    });
  });
};

module.exports = registerMarkReadRoute;
