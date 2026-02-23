const registerGetMessagesRoute = (app, ctx) => {
  app.get("/messages", async (req, res) => {
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

    const rawOwnerId = String(req.query?.ownerId || "").trim();
    const rawContactId = String(req.query?.contactId || "").trim();
    const hasOwnerId = isUuid(rawOwnerId);
    const hasContactId = isUuid(rawContactId);

    if (!hasOwnerId) {
      return res.status(400).json({
        message: "ownerId must be a valid UUID.",
      });
    }

    if (!hasContactId) {
      return res.status(400).json({
        message: "contactId must be a valid UUID.",
      });
    }

    const { profile: ownerProfile, error: ownerError } =
      await ctx.resolveOwnerProfile(req, profileClient, rawOwnerId);

    if (ownerError) {
      return res.status(500).json({
        message: ownerError.message || "Failed to fetch owner profile.",
      });
    }

    const contactLookupQuery = profileClient
      .from(ctx.profilesTable)
      .select("id, email, phone")
      .limit(1);

    const { data: contactProfiles, error: contactError } =
      await contactLookupQuery.eq("id", rawContactId);

    if (contactError) {
      return res.status(500).json({
        message: contactError.message || "Failed to fetch contact profile.",
      });
    }

    const ownerProfileId = ownerProfile?.id || "";
    const contactProfileId = contactProfiles?.[0]?.id || "";
    const contactProfile = contactProfiles?.[0] || null;
    const ownerPhoneFromDb = ownerProfile?.phone || "";
    const contactPhoneFromDb = contactProfiles?.[0]?.phone || "";

    const memberUserColumn =
      await ctx.resolveConversationMemberUserColumn(profileClient);
    const messageColumns = await ctx.resolveMessageColumns(profileClient);

    const ownerMemberValue = ctx.resolveConversationMemberValue(
      ownerProfile,
      memberUserColumn,
    );
    const contactMemberValue = ctx.resolveConversationMemberValue(
      contactProfile,
      memberUserColumn,
    );
    const ownerMessageSenderValue = ctx.resolveMessageSenderValue(
      ownerProfile,
      messageColumns.senderColumn,
    );

    if (
      !ownerProfileId ||
      !contactProfileId ||
      !ownerMemberValue ||
      !contactMemberValue
    ) {
      return res.status(200).json({ messages: [] });
    }

    const { data: ownerMemberships, error: ownerMembershipError } =
      await profileClient
        .from("conversation_members")
        .select("conversation_id")
        .eq(memberUserColumn, ownerMemberValue);

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
        .eq(memberUserColumn, contactMemberValue)
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

    const selectedColumns = [
      "id",
      messageColumns.senderColumn,
      "conversation_id",
      messageColumns.bodyColumn,
      "created_at",
      ...(messageColumns.imageColumn ? [messageColumns.imageColumn] : []),
      ...(messageColumns.audioColumn ? [messageColumns.audioColumn] : []),
    ];

    const { data, error } = await profileClient
      .from(ctx.messagesTable)
      .select(selectedColumns.join(", "))
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(5000);

    if (error) {
      return res.status(500).json({
        message: error.message || "Failed to fetch messages.",
      });
    }

    const imageUrlCache = new Map();
    const audioUrlCache = new Map();
    const resolveImageUrl = async (imagePath = "") => {
      const normalizedPath = String(imagePath || "").trim();
      if (!normalizedPath) {
        return "";
      }

      if (imageUrlCache.has(normalizedPath)) {
        return imageUrlCache.get(normalizedPath);
      }

      const resolved = await ctx.resolveAvatarForClient(
        normalizedPath,
        ctx.supabaseServiceClient || profileClient,
      );
      imageUrlCache.set(normalizedPath, resolved || "");
      return resolved || "";
    };

    const resolveAudioUrl = async (audioPath = "") => {
      const normalizedPath = String(audioPath || "").trim();
      if (!normalizedPath) {
        return "";
      }

      if (audioUrlCache.has(normalizedPath)) {
        return audioUrlCache.get(normalizedPath);
      }

      const resolved = await ctx.resolveAvatarForClient(
        normalizedPath,
        ctx.supabaseServiceClient || profileClient,
      );
      audioUrlCache.set(normalizedPath, resolved || "");
      return resolved || "";
    };

    const mappedMessages = await Promise.all(
      (data || []).map(async (row) => {
        const rawBody = String(row?.[messageColumns.bodyColumn] || "");
        const decodedImageBody = ctx.decodeInlineImageMessageBody(rawBody);
        const decodedAudioBody = ctx.decodeInlineAudioMessageBody(
          String(decodedImageBody.text || ""),
        );
        const imagePath = messageColumns.imageColumn
          ? String(row?.[messageColumns.imageColumn] || "").trim()
          : decodedImageBody.imagePath;
        const audioPath = messageColumns.audioColumn
          ? String(row?.[messageColumns.audioColumn] || "").trim()
          : decodedAudioBody.audioPath;
        const imageUrl = await resolveImageUrl(imagePath);
        const audioUrl = await resolveAudioUrl(audioPath);
        const text =
          messageColumns.imageColumn || messageColumns.audioColumn
            ? rawBody
            : decodedAudioBody.text;

        return {
          id: row.id || null,
          text,
          imageUrl,
          audioUrl,
          timestamp: row.created_at || null,
          fromMe: row[messageColumns.senderColumn] === ownerMessageSenderValue,
          senderPhone:
            row[messageColumns.senderColumn] === ownerMessageSenderValue
              ? ctx.formatPhoneFromDb(ownerPhoneFromDb)
              : ctx.formatPhoneFromDb(contactPhoneFromDb),
          receiverPhone:
            row[messageColumns.senderColumn] === ownerMessageSenderValue
              ? ctx.formatPhoneFromDb(contactPhoneFromDb)
              : ctx.formatPhoneFromDb(ownerPhoneFromDb),
          read: row[messageColumns.senderColumn] === ownerMessageSenderValue,
          readAt: null,
        };
      }),
    );

    return res.status(200).json({
      messages: mappedMessages,
    });
  });
};

module.exports = registerGetMessagesRoute;
