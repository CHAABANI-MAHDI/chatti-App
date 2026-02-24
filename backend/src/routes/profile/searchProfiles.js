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
    const parsedLimit = Number.parseInt(String(req.query?.limit || "20"), 10);
    const parsedOffset = Number.parseInt(String(req.query?.offset || "0"), 10);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 50)
      : 20;
    const offset = Number.isFinite(parsedOffset)
      ? Math.max(parsedOffset, 0)
      : 0;

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
    const rangeEnd = offset + limit;

    if (!rawQuery) {
      const { data, error } = await applyExclusions(
        profileClient
          .from(ctx.profilesTable)
          .select(baseSelect)
          .order("display_name", { ascending: true })
          .range(offset, rangeEnd),
      );

      rows = data || [];
      queryError = error;
    } else if (ctx.validateEmail(rawQuery)) {
      const { data, error } = await applyExclusions(
        profileClient
          .from(ctx.profilesTable)
          .select(baseSelect)
          .eq("email", ctx.normalizeEmail(rawQuery))
          .order("display_name", { ascending: true })
          .range(offset, rangeEnd),
      );

      rows = data || [];
      queryError = error;
    } else {
      const { data, error } = await applyExclusions(
        profileClient
          .from(ctx.profilesTable)
          .select(baseSelect)
          .or(
            `display_name.ilike.%${rawQuery}%,email.ilike.%${normalizedQuery}%`,
          )
          .order("display_name", { ascending: true })
          .range(offset, rangeEnd),
      );

      rows = data || [];
      queryError = error;
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
    const hasMore = rows.length > limit;
    const slicedProfiles = profiles.slice(0, limit);

    return res.status(200).json({
      profile: slicedProfiles[0] || null,
      profiles: slicedProfiles,
      pagination: {
        limit,
        offset,
        nextOffset: offset + slicedProfiles.length,
        hasMore,
      },
    });
  });
};

module.exports = registerSearchProfilesRoute;
