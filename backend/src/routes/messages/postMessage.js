const registerPostMessageRoute = (app, ctx) => {
  app.post("/messages", async (req, res) => {
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

    const rawSenderId = String(req.body?.senderId || "").trim();
    const rawReceiverId = String(req.body?.receiverId || "").trim();
    const body = String(req.body?.text || "").trim();

    const hasSenderId = isUuid(rawSenderId);
    const hasReceiverId = isUuid(rawReceiverId);

    if (!hasSenderId) {
      return res.status(400).json({
        message: "senderId must be a valid UUID.",
      });
    }

    if (!hasReceiverId) {
      return res.status(400).json({
        message: "receiverId must be a valid UUID.",
      });
    }

    if (!body) {
      return res.status(400).json({ message: "Message text is required." });
    }

    if (rawSenderId === rawReceiverId) {
      return res.status(400).json({
        message: "Cannot send message to yourself.",
      });
    }

    const { profile: senderProfile, error: senderProfileError } =
      await ctx.resolveOwnerProfile(req, profileClient, rawSenderId);

    if (senderProfileError) {
      return res.status(500).json({
        message:
          senderProfileError.message || "Failed to fetch sender profile.",
      });
    }

    const receiverLookupQuery = profileClient
      .from(ctx.profilesTable)
      .select("id, email, phone")
      .limit(1);

    const { data: receiverProfiles, error: receiverProfileError } =
      await receiverLookupQuery.eq("id", rawReceiverId);

    if (receiverProfileError) {
      return res.status(500).json({
        message:
          receiverProfileError.message || "Failed to fetch receiver profile.",
      });
    }

    const senderProfileId = senderProfile?.id || "";
    const receiverProfileId = receiverProfiles?.[0]?.id || "";
    const receiverProfile = receiverProfiles?.[0] || null;
    const senderPhoneFromDb = senderProfile?.phone || "";
    const receiverPhoneFromDb = receiverProfiles?.[0]?.phone || "";

    const memberUserColumn =
      await ctx.resolveConversationMemberUserColumn(profileClient);
    const messageColumns = await ctx.resolveMessageColumns(profileClient);

    const senderMemberValue = ctx.resolveConversationMemberValue(
      senderProfile,
      memberUserColumn,
    );
    const receiverMemberValue = ctx.resolveConversationMemberValue(
      receiverProfile,
      memberUserColumn,
    );
    const senderMessageSenderValue = ctx.resolveMessageSenderValue(
      senderProfile,
      messageColumns.senderColumn,
    );

    if (
      !senderProfileId ||
      !receiverProfileId ||
      !senderMemberValue ||
      !receiverMemberValue
    ) {
      return res.status(404).json({
        message: "Sender or receiver profile was not found.",
      });
    }

    const { data: senderMemberships, error: senderMembershipError } =
      await profileClient
        .from("conversation_members")
        .select("conversation_id")
        .eq(memberUserColumn, senderMemberValue);

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
          .eq(memberUserColumn, receiverMemberValue)
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
      const participantEmails = [
        ctx.normalizeEmail(senderProfile?.email || ""),
        ctx.normalizeEmail(receiverProfile?.email || ""),
      ].filter(Boolean);

      const candidateConversationPayloads = [
        {
          created_by: senderProfileId,
          is_group: false,
          participant_emails: participantEmails,
        },
        {
          is_group: false,
          participant_emails: participantEmails,
        },
        {
          participant_emails: participantEmails,
        },
        {
          participant_emails: participantEmails.join(","),
        },
        {
          is_group: false,
        },
        {},
      ];

      let createdConversation = null;
      let conversationError = null;

      for (const payload of candidateConversationPayloads) {
        const { data, error } = await profileClient
          .from("conversations")
          .insert(payload)
          .select("id")
          .single();

        if (!error && data?.id) {
          createdConversation = data;
          conversationError = null;
          break;
        }

        conversationError = error;

        const lowerMessage = String(error?.message || "").toLowerCase();
        const hasUnknownColumnError =
          lowerMessage.includes("could not find") ||
          lowerMessage.includes("column") ||
          lowerMessage.includes("schema cache");

        if (!hasUnknownColumnError) {
          break;
        }
      }

      if (conversationError || !createdConversation?.id) {
        return res.status(500).json({
          message:
            conversationError?.message || "Failed to create conversation.",
        });
      }

      conversationId = createdConversation.id;

      const memberRowsWithRole = [
        {
          conversation_id: conversationId,
          [memberUserColumn]: senderMemberValue,
          role: "member",
        },
        {
          conversation_id: conversationId,
          [memberUserColumn]: receiverMemberValue,
          role: "member",
        },
      ];

      const memberRowsWithoutRole = [
        {
          conversation_id: conversationId,
          [memberUserColumn]: senderMemberValue,
        },
        {
          conversation_id: conversationId,
          [memberUserColumn]: receiverMemberValue,
        },
      ];

      let membersInsertError = null;
      for (const payload of [memberRowsWithRole, memberRowsWithoutRole]) {
        const { error } = await profileClient
          .from("conversation_members")
          .insert(payload);

        if (!error) {
          membersInsertError = null;
          break;
        }

        membersInsertError = error;

        const lowerMessage = String(error?.message || "").toLowerCase();
        const hasUnknownColumnError =
          lowerMessage.includes("could not find") ||
          lowerMessage.includes("column") ||
          lowerMessage.includes("schema cache");

        if (!hasUnknownColumnError) {
          break;
        }
      }

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
        [messageColumns.senderColumn]: senderMessageSenderValue,
        [messageColumns.bodyColumn]: body,
      })
      .select(
        `id, ${messageColumns.senderColumn}, conversation_id, ${messageColumns.bodyColumn}, created_at`,
      )
      .single();

    if (error) {
      return res.status(500).json({
        message: error.message || "Failed to save message.",
      });
    }

    if (typeof ctx.emitMessageCreated === "function") {
      ctx.emitMessageCreated({
        id: data?.id || null,
        text: String(data?.[messageColumns.bodyColumn] || ""),
        timestamp: data?.created_at || null,
        senderId: senderProfileId,
        receiverId: receiverProfileId,
        conversationId,
      });
    }

    return res.status(201).json({
      message: {
        id: data?.id || null,
        text: String(data?.[messageColumns.bodyColumn] || ""),
        timestamp: data?.created_at || null,
        fromMe: true,
        senderPhone: ctx.formatPhoneFromDb(senderPhoneFromDb),
        receiverPhone: ctx.formatPhoneFromDb(receiverPhoneFromDb),
        read: false,
        readAt: null,
      },
    });
  });
};

module.exports = registerPostMessageRoute;
