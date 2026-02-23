const registerGetConversationsRoute = (app, ctx) => {
  app.get("/conversations/:ownerId", async (req, res) => {
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
      if (ctx.isAuthTokenExpired(ownerError)) {
        return res.status(401).json({
          message: "JWT expired",
        });
      }

      return res.status(500).json({
        message: ownerError.message || "Failed to fetch owner profile.",
      });
    }

    if (!ownerProfile?.id) {
      return res.status(200).json({ conversations: [] });
    }

    const memberUserColumn =
      await ctx.resolveConversationMemberUserColumn(profileClient);
    const ownerMemberValue = ctx.resolveConversationMemberValue(
      ownerProfile,
      memberUserColumn,
    );

    if (!ownerMemberValue) {
      return res.status(200).json({ conversations: [] });
    }

    const { data: ownerMemberships, error: ownerMembershipError } =
      await profileClient
        .from("conversation_members")
        .select("conversation_id")
        .eq(memberUserColumn, ownerMemberValue);

    if (ownerMembershipError) {
      if (ctx.isAuthTokenExpired(ownerMembershipError)) {
        return res.status(401).json({
          message: "JWT expired",
        });
      }

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
      .select(`conversation_id, ${memberUserColumn}`)
      .in("conversation_id", conversationIds);

    if (membersError) {
      if (ctx.isAuthTokenExpired(membersError)) {
        return res.status(401).json({
          message: "JWT expired",
        });
      }

      return res.status(500).json({
        message:
          membersError.message || "Failed to fetch conversation members.",
      });
    }

    const conversationToContact = new Map();
    for (const member of allMembers || []) {
      if (
        !member?.conversation_id ||
        !member?.[memberUserColumn] ||
        member[memberUserColumn] === ownerMemberValue
      ) {
        continue;
      }

      conversationToContact.set(
        member.conversation_id,
        member[memberUserColumn],
      );
    }

    const contactUserIds = [
      ...new Set(Array.from(conversationToContact.values()).filter(Boolean)),
    ];

    if (!contactUserIds.length) {
      return res.status(200).json({ conversations: [] });
    }

    const { data: contactProfiles, error: profilesError } = await profileClient
      .from(ctx.profilesTable)
      .select("id, email, phone, display_name, avatar_url")
      .in(memberUserColumn === "user_email" ? "email" : "id", contactUserIds);

    if (profilesError) {
      if (ctx.isAuthTokenExpired(profilesError)) {
        return res.status(401).json({
          message: "JWT expired",
        });
      }

      return res.status(500).json({
        message: profilesError.message || "Failed to fetch contact profiles.",
      });
    }

    const messageColumns = await ctx.resolveMessageColumns(profileClient);
    const ownerMessageSenderValue = ctx.resolveMessageSenderValue(
      ownerProfile,
      messageColumns.senderColumn,
    );

    const { data: messageRows, error: messagesError } = await profileClient
      .from(ctx.messagesTable)
      .select(
        `id, ${messageColumns.senderColumn}, conversation_id, ${messageColumns.bodyColumn}, created_at`,
      )
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (messagesError) {
      if (ctx.isAuthTokenExpired(messagesError)) {
        return res.status(401).json({
          message: "JWT expired",
        });
      }

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
      (contactProfiles || []).map((profile) => [
        memberUserColumn === "user_email"
          ? ctx.normalizeEmail(profile.email)
          : profile.id,
        profile,
      ]),
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
            lastMessage: latestMessage?.[messageColumns.bodyColumn] || "",
            lastMessageAt: latestMessage?.created_at || null,
            lastMessageFromMe:
              latestMessage?.[messageColumns.senderColumn] ===
              ownerMessageSenderValue,
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
