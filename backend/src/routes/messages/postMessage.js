const {
  buildMessageSelectedColumns,
  hasSchemaColumnError,
  isUuid,
} = require("./messageRouteUtils");

const registerPostMessageRoute = (app, ctx) => {
  app.post("/messages", async (req, res) => {
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
    const rawImageDataUrl = String(req.body?.imageDataUrl || "").trim();
    const rawAudioDataUrl = String(req.body?.audioDataUrl || "").trim();
    const clientId = String(req.body?.clientId || "").trim();

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

    if (!body && !rawImageDataUrl && !rawAudioDataUrl) {
      return res.status(400).json({
        message: "Message text, image, or audio is required.",
      });
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

        if (!hasSchemaColumnError(error)) {
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

        if (!hasSchemaColumnError(error)) {
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

    const profileWriteClient = ctx.supabaseServiceClient || profileClient;
    const parsedImage = rawImageDataUrl
      ? ctx.parseImageDataUrl(rawImageDataUrl)
      : null;
    const parsedAudio = rawAudioDataUrl
      ? ctx.parseAudioDataUrl(rawAudioDataUrl)
      : null;

    if (rawImageDataUrl && !parsedImage) {
      return res.status(400).json({
        message: "Invalid image payload. Expected a valid image data URL.",
      });
    }

    if (rawAudioDataUrl && !parsedAudio) {
      return res.status(400).json({
        message: "Invalid audio payload. Expected a valid audio data URL.",
      });
    }

    if (parsedImage && parsedImage.buffer.length > 6 * 1024 * 1024) {
      return res.status(400).json({
        message: "Image is too large. Max allowed size is 6MB.",
      });
    }

    if (parsedAudio && parsedAudio.buffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({
        message: "Audio is too large. Max allowed size is 10MB.",
      });
    }

    let storedImagePath = "";
    let storedAudioPath = "";

    if (parsedImage) {
      const fileExtension = ctx.extensionFromMime(parsedImage.mimeType);
      const filePath = `${senderProfileId}/messages/${conversationId}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}.${fileExtension}`;

      const { error: uploadError } = await profileWriteClient.storage
        .from(ctx.storageBucket)
        .upload(filePath, parsedImage.buffer, {
          contentType: parsedImage.mimeType,
          upsert: false,
        });

      if (uploadError) {
        return res.status(500).json({
          message: uploadError.message || "Failed to upload image.",
        });
      }

      storedImagePath = filePath;
    }

    if (parsedAudio) {
      const fileExtension = ctx.audioExtensionFromMime(parsedAudio.mimeType);
      const filePath = `${senderProfileId}/messages/${conversationId}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}.${fileExtension}`;

      const { error: uploadError } = await profileWriteClient.storage
        .from(ctx.storageBucket)
        .upload(filePath, parsedAudio.buffer, {
          contentType: parsedAudio.mimeType,
          upsert: false,
        });

      if (uploadError) {
        return res.status(500).json({
          message: uploadError.message || "Failed to upload audio.",
        });
      }

      storedAudioPath = filePath;
    }

    let storedBody = body;

    if (!messageColumns.imageColumn) {
      storedBody = ctx.encodeInlineImageMessageBody(
        storedBody,
        storedImagePath,
      );
    }

    if (!messageColumns.audioColumn) {
      storedBody = ctx.encodeInlineAudioMessageBody(
        storedBody,
        storedAudioPath,
      );
    }

    const insertPayload = {
      conversation_id: conversationId,
      [messageColumns.senderColumn]: senderMessageSenderValue,
      [messageColumns.bodyColumn]: storedBody,
    };

    if (messageColumns.imageColumn) {
      insertPayload[messageColumns.imageColumn] = storedImagePath || null;
    }

    if (messageColumns.audioColumn) {
      insertPayload[messageColumns.audioColumn] = storedAudioPath || null;
    }

    const selectedColumns = buildMessageSelectedColumns(messageColumns);

    const { data, error } = await profileClient
      .from(ctx.messagesTable)
      .insert(insertPayload)
      .select(selectedColumns.join(", "))
      .single();

    if (error) {
      return res.status(500).json({
        message: error.message || "Failed to save message.",
      });
    }

    const decodedImageBody = ctx.decodeInlineImageMessageBody(
      String(data?.[messageColumns.bodyColumn] || ""),
    );
    const decodedAudioBody = ctx.decodeInlineAudioMessageBody(
      String(decodedImageBody.text || ""),
    );
    const resolvedImagePath = messageColumns.imageColumn
      ? String(data?.[messageColumns.imageColumn] || "").trim()
      : decodedImageBody.imagePath;
    const resolvedAudioPath = messageColumns.audioColumn
      ? String(data?.[messageColumns.audioColumn] || "").trim()
      : decodedAudioBody.audioPath;
    const resolvedImageUrl = resolvedImagePath
      ? await ctx.resolveAvatarForClient(resolvedImagePath, profileWriteClient)
      : "";
    const resolvedAudioUrl = resolvedAudioPath
      ? await ctx.resolveAvatarForClient(resolvedAudioPath, profileWriteClient)
      : "";
    const resolvedText =
      messageColumns.imageColumn || messageColumns.audioColumn
        ? String(data?.[messageColumns.bodyColumn] || "")
        : decodedAudioBody.text;

    if (typeof ctx.emitMessageCreated === "function") {
      ctx.emitMessageCreated({
        id: data?.id || null,
        clientId: clientId || null,
        text: resolvedText,
        imageUrl: resolvedImageUrl,
        audioUrl: resolvedAudioUrl,
        timestamp: data?.created_at || null,
        senderId: senderProfileId,
        receiverId: receiverProfileId,
        conversationId,
      });
    }

    return res.status(201).json({
      message: {
        id: data?.id || null,
        clientId: clientId || null,
        text: resolvedText,
        imageUrl: resolvedImageUrl,
        audioUrl: resolvedAudioUrl,
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
