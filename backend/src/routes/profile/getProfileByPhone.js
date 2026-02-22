const registerGetProfileByPhoneRoute = (app, ctx) => {
  app.get("/profile/:phone", async (req, res) => {
    const profileClient = ctx.getProfileClient(req);
    if (!profileClient) {
      return res.status(500).json({
        message:
          "Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.",
      });
    }

    const rawPhone = ctx.normalizePhone(String(req.params?.phone || ""));

    if (!ctx.validatePhoneForProfile(rawPhone)) {
      return res.status(400).json({
        message:
          "Phone must be a valid number with country code (example: +216123456).",
      });
    }

    const phoneForDb = ctx.normalizePhoneForDb(rawPhone);
    const { data, error } = await profileClient
      .from(ctx.profilesTable)
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
      profile: await ctx.mapProfileRecord(record, profileClient),
    });
  });
};

module.exports = registerGetProfileByPhoneRoute;
