const registerPostMessageRoute = (app, ctx) => {
  app.post("/messages", async (req, res) => {
    const profileClient = ctx.getProfileClient(req);
    if (!profileClient) {
      return res.status(500).json({
        message:
          "Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.",
      });
    }

    const rawSenderPhone = ctx.normalizePhone(req.body?.senderPhone);
    const rawReceiverPhone = ctx.normalizePhone(req.body?.receiverPhone);
    const body = String(req.body?.text || "").trim();

    if (!ctx.validatePhoneForProfile(rawSenderPhone)) {
      return res.status(400).json({ message: "senderPhone is invalid." });
    }

    if (!ctx.validatePhoneForProfile(rawReceiverPhone)) {
      return res.status(400).json({ message: "receiverPhone is invalid." });
    }

    if (!body) {
      return res.status(400).json({ message: "Message text is required." });
    }

    const senderPhoneForDb = ctx.normalizePhoneForDb(rawSenderPhone);
    const receiverPhoneForDb = ctx.normalizePhoneForDb(rawReceiverPhone);

    if (senderPhoneForDb === receiverPhoneForDb) {
      return res.status(400).json({
        message: "Cannot send message to your own phone.",
      });
    }

    const { data: senderProfiles, error: senderProfileError } =
      await profileClient
        .from(ctx.profilesTable)
        .select("id")
        .eq("phone", senderPhoneForDb)
        .limit(1);

    if (senderProfileError) {
      return res.status(500).json({
        message:
          senderProfileError.message || "Failed to fetch sender profile.",
      });
    }

    const { data: receiverProfiles, error: receiverProfileError } =
      await profileClient
        .from(ctx.profilesTable)
        .select("id")
        .eq("phone", receiverPhoneForDb)
        .limit(1);

    if (receiverProfileError) {
      return res.status(500).json({
        message:
          receiverProfileError.message || "Failed to fetch receiver profile.",
      });
    }

    const senderProfileId = senderProfiles?.[0]?.id || "";
    const receiverProfileId = receiverProfiles?.[0]?.id || "";

    if (!senderProfileId || !receiverProfileId) {
      return res.status(404).json({
        message: "Sender or receiver profile was not found.",
      });
    }

    const { data: senderMemberships, error: senderMembershipError } =
      await profileClient
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", senderProfileId);

    if (senderMembershipError) {
      return res.status(500).json({
        message:
          senderMembershipError.message ||
          "Failed to fetch sender conversations.",
      });
    }

    const senderConversationIds = [
      ...new Set(
        (senderMemberships || [])
          .map((membership) => membership?.conversation_id)
          .filter(Boolean),
      ),
    ];

    let conversationId = "";

    if (senderConversationIds.length) {
      const { data: receiverMemberships, error: receiverMembershipError } =
        await profileClient
          .from("conversation_members")
          .select("conversation_id")
          .eq("user_id", receiverProfileId)
          .in("conversation_id", senderConversationIds)
          .limit(1);

      if (receiverMembershipError) {
        return res.status(500).json({
          message:
            receiverMembershipError.message ||
            "Failed to fetch receiver conversation membership.",
        });
      }

      conversationId = receiverMemberships?.[0]?.conversation_id || "";
    }

    if (!conversationId) {
      const { data: createdConversation, error: conversationError } =
        await profileClient
          .from("conversations")
          .insert({
            created_by: senderProfileId,
            is_group: false,
          })
          .select("id")
          .single();

      if (conversationError || !createdConversation?.id) {
        return res.status(500).json({
          message:
            conversationError?.message || "Failed to create conversation.",
        });
      }

      conversationId = createdConversation.id;

      const { error: membersInsertError } = await profileClient
        .from("conversation_members")
        .insert([
          {
            conversation_id: conversationId,
            user_id: senderProfileId,
            role: "member",
          },
          {
            conversation_id: conversationId,
            user_id: receiverProfileId,
            role: "member",
          },
        ]);

      if (membersInsertError) {
        return res.status(500).json({
          message:
            membersInsertError.message || "Failed to add conversation members.",
        });
      }
    }

    const { data, error } = await profileClient
      .from(ctx.messagesTable)
      .insert({
        conversation_id: conversationId,
        sender_id: senderProfileId,
        body,
      })
      .select("id, sender_id, conversation_id, body, created_at")
      .single();

    if (error) {
      return res.status(500).json({
        message: error.message || "Failed to save message.",
      });
    }

    return res.status(201).json({
      message: {
        id: data?.id || null,
        text: String(data?.body || ""),
        timestamp: data?.created_at || null,
        fromMe: true,
        senderPhone: ctx.formatPhoneFromDb(senderPhoneForDb),
        receiverPhone: ctx.formatPhoneFromDb(receiverPhoneForDb),
        read: false,
        readAt: null,
      },
    });
  });
};

module.exports = registerPostMessageRoute;
