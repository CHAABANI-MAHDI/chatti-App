const registerGetMessagesRoute = (app, ctx) => {
  app.get("/messages", async (req, res) => {
    const profileClient = ctx.getProfileClient(req);
    if (!profileClient) {
      return res.status(500).json({
        message:
          "Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.",
      });
    }

    const rawOwnerPhone = ctx.normalizePhone(
      String(req.query?.ownerPhone || ""),
    );
    const rawContactPhone = ctx.normalizePhone(
      String(req.query?.contactPhone || ""),
    );

    if (!ctx.validatePhoneForProfile(rawOwnerPhone)) {
      return res.status(400).json({
        message: "ownerPhone is invalid.",
      });
    }

    if (!ctx.validatePhoneForProfile(rawContactPhone)) {
      return res.status(400).json({
        message: "contactPhone is invalid.",
      });
    }

    const ownerPhoneForDb = ctx.normalizePhoneForDb(rawOwnerPhone);
    const contactPhoneForDb = ctx.normalizePhoneForDb(rawContactPhone);

    const { data: ownerProfiles, error: ownerError } = await profileClient
      .from(ctx.profilesTable)
      .select("id")
      .eq("phone", ownerPhoneForDb)
      .limit(1);

    if (ownerError) {
      return res.status(500).json({
        message: ownerError.message || "Failed to fetch owner profile.",
      });
    }

    const { data: contactProfiles, error: contactError } = await profileClient
      .from(ctx.profilesTable)
      .select("id")
      .eq("phone", contactPhoneForDb)
      .limit(1);

    if (contactError) {
      return res.status(500).json({
        message: contactError.message || "Failed to fetch contact profile.",
      });
    }

    const ownerProfileId = ownerProfiles?.[0]?.id || "";
    const contactProfileId = contactProfiles?.[0]?.id || "";

    if (!ownerProfileId || !contactProfileId) {
      return res.status(200).json({ messages: [] });
    }

    const { data: ownerMemberships, error: ownerMembershipError } =
      await profileClient
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", ownerProfileId);

    if (ownerMembershipError) {
      return res.status(500).json({
        message:
          ownerMembershipError.message ||
          "Failed to fetch owner conversations.",
      });
    }

    const ownerConversationIds = [
      ...new Set(
        (ownerMemberships || [])
          .map((membership) => membership?.conversation_id)
          .filter(Boolean),
      ),
    ];

    if (!ownerConversationIds.length) {
      return res.status(200).json({ messages: [] });
    }

    const { data: contactMemberships, error: contactMembershipError } =
      await profileClient
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", contactProfileId)
        .in("conversation_id", ownerConversationIds)
        .limit(1);

    if (contactMembershipError) {
      return res.status(500).json({
        message:
          contactMembershipError.message ||
          "Failed to fetch contact conversation membership.",
      });
    }

    const conversationId = contactMemberships?.[0]?.conversation_id;
    if (!conversationId) {
      return res.status(200).json({ messages: [] });
    }

    const { data, error } = await profileClient
      .from(ctx.messagesTable)
      .select("id, sender_id, conversation_id, body, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(5000);

    if (error) {
      return res.status(500).json({
        message: error.message || "Failed to fetch messages.",
      });
    }

    return res.status(200).json({
      messages: (data || []).map((row) => ({
        id: row.id || null,
        text: String(row.body || ""),
        timestamp: row.created_at || null,
        fromMe: row.sender_id === ownerProfileId,
        senderPhone:
          row.sender_id === ownerProfileId
            ? ctx.formatPhoneFromDb(ownerPhoneForDb)
            : ctx.formatPhoneFromDb(contactPhoneForDb),
        receiverPhone:
          row.sender_id === ownerProfileId
            ? ctx.formatPhoneFromDb(contactPhoneForDb)
            : ctx.formatPhoneFromDb(ownerPhoneForDb),
        read: row.sender_id === ownerProfileId,
        readAt: null,
      })),
    });
  });
};

module.exports = registerGetMessagesRoute;
