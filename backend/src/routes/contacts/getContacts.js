const registerGetContactsRoute = (app, ctx) => {
  app.get("/contacts/:phone", async (req, res) => {
    const profileClient = ctx.getProfileClient(req);
    if (!profileClient) {
      return res.status(500).json({
        message:
          "Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.",
      });
    }

    const rawOwnerPhone = ctx.normalizePhone(String(req.params?.phone || ""));

    if (!ctx.validatePhoneForProfile(rawOwnerPhone)) {
      return res.status(400).json({
        message:
          "Owner phone must be a valid number with country code (example: +216123456).",
      });
    }

    const ownerPhoneForDb = ctx.normalizePhoneForDb(rawOwnerPhone);

    const { data: ownerProfiles, error: ownerError } = await profileClient
      .from(ctx.profilesTable)
      .select("id, phone")
      .eq("phone", ownerPhoneForDb)
      .limit(1);

    if (ownerError) {
      return res.status(500).json({
        message: ownerError.message || "Failed to fetch owner profile.",
      });
    }

    const ownerProfile = ownerProfiles?.[0];
    if (!ownerProfile?.id) {
      return res.status(200).json({ contacts: [] });
    }

    const { data: ownerMemberships, error: membershipsError } =
      await profileClient
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", ownerProfile.id);

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
      .select("conversation_id, user_id")
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
              member?.user_id &&
              member.user_id !== ownerProfile.id,
          )
          .map((member) => member.user_id),
      ),
    ];

    if (!contactUserIds.length) {
      return res.status(200).json({ contacts: [] });
    }

    const { data: profileRows, error: profilesError } = await profileClient
      .from(ctx.profilesTable)
      .select("id, phone, display_name, avatar_url")
      .in("id", contactUserIds);

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
