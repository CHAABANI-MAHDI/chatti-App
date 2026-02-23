const registerMarkReadRoute = (app, ctx) => {
  app.post("/messages/read", async (req, res) => {
    const isUuid = (value = "") =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        String(value || "").trim(),
      );

    const profileClient = ctx.getProfileClient(req);
    if (!profileClient) {
      return res.status(500).json({
        message:
          "Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.",
      });
    }

    const rawOwnerId = String(req.body?.ownerId || "").trim();
    const rawContactId = String(req.body?.contactId || "").trim();
    const hasOwnerId = isUuid(rawOwnerId);
    const hasContactId = isUuid(rawContactId);

    if (!hasOwnerId) {
      return res.status(400).json({ message: "ownerId must be a valid UUID." });
    }

    if (!hasContactId) {
      return res.status(400).json({
        message: "contactId must be a valid UUID.",
      });
    }

    return res.status(200).json({
      updated: 0,
    });
  });
};

module.exports = registerMarkReadRoute;
