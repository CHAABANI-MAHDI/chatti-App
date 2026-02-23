const registerGetContactsRoute = (app, ctx) => {
  app.get("/contacts/:ownerId", async (req, res) => {
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

    const ownerId = String(req.params?.ownerId || "").trim();

    if (!isUuid(ownerId)) {
      return res.status(400).json({
        message: "ownerId must be a valid UUID.",
      });
    }

    const { profile: ownerProfile, error: ownerError } =
      await ctx.resolveOwnerProfile(req, profileClient, ownerId);

    if (ownerError) {
      return res.status(500).json({
        message: ownerError.message || "Failed to fetch owner profile.",
      });
    }

    if (!ownerProfile?.id) {
      return res.status(200).json({ contacts: [] });
    }

    const memberUserColumn =
      await ctx.resolveConversationMemberUserColumn(profileClient);
    const ownerMemberValue = ctx.resolveConversationMemberValue(
      ownerProfile,
      memberUserColumn,
    );

    if (!ownerMemberValue) {
      return res.status(200).json({ contacts: [] });
    }

    const { data: ownerMemberships, error: membershipsError } =
      await profileClient
        .from("conversation_members")
        .select("conversation_id")
        .eq(memberUserColumn, ownerMemberValue);

    if (membershipsError) {
      return res.status(500).json({
        message: membershipsError.message || "Failed to fetch conversations.",
      });
    }

    const conversationIds = [
      ...new Set(
        (ownerMemberships || [])
          .map((membership) => membership?.conversation_id)
          .filter(Boolean),
      ),
    ];

    if (!conversationIds.length) {
      return res.status(200).json({ contacts: [] });
    }

    const { data: allMembers, error: membersError } = await profileClient
      .from("conversation_members")
      .select(`conversation_id, ${memberUserColumn}`)
      .in("conversation_id", conversationIds);

    if (membersError) {
      return res.status(500).json({
        message:
          membersError.message || "Failed to fetch conversation members.",
      });
    }

    const contactUserIds = [
      ...new Set(
        (allMembers || [])
          .filter(
            (member) =>
              conversationIds.includes(member?.conversation_id) &&
              member?.[memberUserColumn] &&
              member[memberUserColumn] !== ownerMemberValue,
          )
          .map((member) => member[memberUserColumn]),
      ),
    ];

    if (!contactUserIds.length) {
      return res.status(200).json({ contacts: [] });
    }

    const { data: profileRows, error: profilesError } = await profileClient
      .from(ctx.profilesTable)
      .select("id, phone, display_name, avatar_url")
      .in(memberUserColumn === "user_email" ? "email" : "id", contactUserIds);

    if (profilesError) {
      return res.status(500).json({
        message: profilesError.message || "Failed to fetch contact profiles.",
      });
    }

    const contacts = await Promise.all(
      (profileRows || []).map((row) =>
        ctx.mapContactPreview(row, profileClient),
      ),
    );

    return res.status(200).json({ contacts });
  });
};

module.exports = registerGetContactsRoute;
