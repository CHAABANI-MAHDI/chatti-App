const registerGetConversationsRoute = (app, ctx) => {
  app.get("/conversations/:phone", async (req, res) => {
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
      return res.status(200).json({ conversations: [] });
    }

    const { data: ownerMemberships, error: ownerMembershipError } =
      await profileClient
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", ownerProfile.id);

    if (ownerMembershipError) {
      return res.status(500).json({
        message:
          ownerMembershipError.message ||
          "Failed to fetch owner conversations.",
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
      return res.status(200).json({ conversations: [] });
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

    const conversationToContact = new Map();
    for (const member of allMembers || []) {
      if (
        !member?.conversation_id ||
        !member?.user_id ||
        member.user_id === ownerProfile.id
      ) {
        continue;
      }

      conversationToContact.set(member.conversation_id, member.user_id);
    }

    const contactUserIds = [
      ...new Set(Array.from(conversationToContact.values()).filter(Boolean)),
    ];

    if (!contactUserIds.length) {
      return res.status(200).json({ conversations: [] });
    }

    const { data: contactProfiles, error: profilesError } = await profileClient
      .from(ctx.profilesTable)
      .select("id, phone, display_name, avatar_url")
      .in("id", contactUserIds);

    if (profilesError) {
      return res.status(500).json({
        message: profilesError.message || "Failed to fetch contact profiles.",
      });
    }

    const { data: messageRows, error: messagesError } = await profileClient
      .from(ctx.messagesTable)
      .select("id, sender_id, conversation_id, body, created_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (messagesError) {
      return res.status(500).json({
        message:
          messagesError.message || "Failed to fetch conversation messages.",
      });
    }

    const latestMessageByConversation = new Map();
    for (const message of messageRows || []) {
      if (!message?.conversation_id) {
        continue;
      }

      if (!latestMessageByConversation.has(message.conversation_id)) {
        latestMessageByConversation.set(message.conversation_id, message);
      }
    }

    const contactProfileById = new Map(
      (contactProfiles || []).map((profile) => [profile.id, profile]),
    );

    const conversations = await Promise.all(
      Array.from(conversationToContact.entries()).map(
        async ([conversationId, contactUserId]) => {
          const profileRecord = contactProfileById.get(contactUserId);
          if (!profileRecord) {
            return null;
          }

          const latestMessage = latestMessageByConversation.get(conversationId);
          const baseProfile = await ctx.mapContactPreview(
            profileRecord,
            profileClient,
          );

          return {
            ...baseProfile,
            lastMessage: latestMessage?.body || "",
            lastMessageAt: latestMessage?.created_at || null,
            unread: 0,
          };
        },
      ),
    );

    return res.status(200).json({
      conversations: conversations.filter(Boolean).sort((first, second) => {
        const firstTime = new Date(first.lastMessageAt || 0).getTime();
        const secondTime = new Date(second.lastMessageAt || 0).getTime();
        return secondTime - firstTime;
      }),
    });
  });
};

module.exports = registerGetConversationsRoute;
