const registerGetProfileByPhoneRoute = (app, ctx) => {
  app.get("/profile/:identifier", async (req, res) => {
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

    const rawIdentifier = String(req.params?.identifier || "").trim();
    const normalizedEmail = ctx.normalizeEmail(rawIdentifier);
    const isIdQuery = isUuid(rawIdentifier);
    const isEmailQuery = ctx.validateEmail(normalizedEmail);
    const isNameQuery =
      !isIdQuery && !isEmailQuery && rawIdentifier.length >= 2;

    if (!isIdQuery && !isEmailQuery && !isNameQuery) {
      return res.status(400).json({
        message:
          "Provide a valid profile id, email, or at least 2 characters of a name.",
      });
    }

    const baseQuery = profileClient
      .from(ctx.profilesTable)
      .select("id, phone, email, display_name, avatar_url, status_text")
      .limit(1);

    const { data, error } = await (isIdQuery
      ? baseQuery.eq("id", rawIdentifier)
      : isEmailQuery
        ? baseQuery.eq("email", normalizedEmail)
        : baseQuery.ilike("display_name", `%${rawIdentifier}%`));

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
