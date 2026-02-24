const registerSearchProfilesRoute = (app, ctx) => {
  app.get("/profiles/search", async (req, res) => {
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

    const rawQuery = String(req.query?.query || "").trim();
    const rawExcludeId = String(req.query?.excludeId || "").trim();

    if (rawExcludeId && !isUuid(rawExcludeId)) {
      return res.status(400).json({
        message: "excludeId must be a valid UUID.",
      });
    }

    const baseSelect =
      "id, phone, email, display_name, avatar_url, status_text";
    const normalizedQuery = rawQuery.toLowerCase();

    const applyExclusions = (queryBuilder) => {
      let nextQuery = queryBuilder;

      if (rawExcludeId) {
        nextQuery = nextQuery.neq("id", rawExcludeId);
      }

      return nextQuery;
    };

    let rows = [];
    let queryError = null;

    if (!rawQuery) {
      const { data, error } = await applyExclusions(
        profileClient
          .from(ctx.profilesTable)
          .select(baseSelect)
          .order("display_name", { ascending: true })
          .limit(50),
      );

      rows = data || [];
      queryError = error;
    } else if (ctx.validateEmail(rawQuery)) {
      const { data, error } = await applyExclusions(
        profileClient
          .from(ctx.profilesTable)
          .select(baseSelect)
          .eq("email", ctx.normalizeEmail(rawQuery))
          .limit(20),
      );

      rows = data || [];
      queryError = error;
    } else {
      const { data: byName, error: byNameError } = await applyExclusions(
        profileClient
          .from(ctx.profilesTable)
          .select(baseSelect)
          .ilike("display_name", `%${rawQuery}%`)
          .limit(25),
      );

      if (byNameError) {
        queryError = byNameError;
      } else {
        const { data: byEmail, error: byEmailError } = await applyExclusions(
          profileClient
            .from(ctx.profilesTable)
            .select(baseSelect)
            .ilike("email", `%${normalizedQuery}%`)
            .limit(25),
        );

        if (byEmailError) {
          queryError = byEmailError;
        } else {
          const uniqueRows = new Map();
          [...(byName || []), ...(byEmail || [])].forEach((row) => {
            if (row?.id && !uniqueRows.has(row.id)) {
              uniqueRows.set(row.id, row);
            }
          });

          rows = Array.from(uniqueRows.values());
        }
      }
    }

    if (queryError) {
      if (ctx.isAuthTokenExpired(queryError)) {
        return res.status(401).json({
          message: "JWT expired",
        });
      }

      if (
        String(queryError.message || "")
          .toLowerCase()
          .includes("row-level security")
      ) {
        return res.status(403).json({
          message:
            "Profile read blocked by Supabase RLS. Add SUPABASE_SERVICE_ROLE_KEY to backend .env, or update your RLS policy for the profiles table.",
        });
      }

      return res.status(500).json({
        message: queryError.message || "Failed to search profiles.",
      });
    }

    const mappedProfiles = await Promise.all(
      rows.map((row) => ctx.mapProfileRecord(row, profileClient)),
    );

    const exactProfile = rawQuery
      ? mappedProfiles.find((profile) => {
          const profileName = String(profile?.name || "")
            .trim()
            .toLowerCase();
          const profileEmail = ctx.normalizeEmail(profile?.email || "");
          return (
            profileName === normalizedQuery || profileEmail === normalizedQuery
          );
        })
      : null;

    const profiles = exactProfile
      ? [
          exactProfile,
          ...mappedProfiles.filter(
            (profile) => profile?.id !== exactProfile.id,
          ),
        ]
      : mappedProfiles;

    return res.status(200).json({
      profile: profiles[0] || null,
      profiles,
    });
  });
};

module.exports = registerSearchProfilesRoute;
