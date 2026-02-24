const { buildMessageSelectedColumns, isUuid } = require("./messageRouteUtils");

const registerUpdateMessageRoute = (app, ctx) => {
  app.patch("/messages/:messageId", async (req, res) => {
    const profileClient = ctx.getProfileClient(req);
    if (!profileClient) {
      return res.status(500).json({
        message:
          "Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.",
      });
    }

    const rawMessageId = String(req.params?.messageId || "").trim();
    const rawOwnerId = String(req.body?.ownerId || "").trim();
    const nextText = String(req.body?.text || "").trim();

    if (!isUuid(rawMessageId)) {
      return res
        .status(400)
        .json({ message: "messageId must be a valid UUID." });
    }

    if (!isUuid(rawOwnerId)) {
      return res.status(400).json({ message: "ownerId must be a valid UUID." });
    }

    const { profile: ownerProfile, error: ownerError } =
      await ctx.resolveOwnerProfile(req, profileClient, rawOwnerId);

    if (ownerError) {
      return res.status(500).json({
        message: ownerError.message || "Failed to fetch owner profile.",
      });
    }

    if (!ownerProfile?.id) {
      return res.status(404).json({ message: "Owner profile not found." });
    }

    const memberUserColumn =
      await ctx.resolveConversationMemberUserColumn(profileClient);
    const messageColumns = await ctx.resolveMessageColumns(profileClient);

    const ownerSenderValue = ctx.resolveMessageSenderValue(
      ownerProfile,
      messageColumns.senderColumn,
    );
    const ownerMemberValue = ctx.resolveConversationMemberValue(
      ownerProfile,
      memberUserColumn,
    );

    if (!ownerSenderValue || !ownerMemberValue) {
      return res.status(400).json({
        message: "Could not resolve owner identity for message update.",
      });
    }

    const selectedColumns = buildMessageSelectedColumns(messageColumns);

    const { data: messageRow, error: messageError } = await profileClient
      .from(ctx.messagesTable)
      .select(selectedColumns.join(", "))
      .eq("id", rawMessageId)
      .limit(1)
      .single();

    if (messageError) {
      return res.status(500).json({
        message: messageError.message || "Failed to fetch message.",
      });
    }

    if (!messageRow?.id) {
      return res.status(404).json({ message: "Message not found." });
    }

    if (messageRow[messageColumns.senderColumn] !== ownerSenderValue) {
      return res.status(403).json({
        message: "You can only edit your own messages.",
      });
    }

    const rawBody = String(messageRow?.[messageColumns.bodyColumn] || "");
    const decodedImageBody = ctx.decodeInlineImageMessageBody(rawBody);
    const decodedAudioBody = ctx.decodeInlineAudioMessageBody(
      String(decodedImageBody.text || ""),
    );

    const existingImagePath = messageColumns.imageColumn
      ? String(messageRow?.[messageColumns.imageColumn] || "").trim()
      : decodedImageBody.imagePath;
    const existingAudioPath = messageColumns.audioColumn
      ? String(messageRow?.[messageColumns.audioColumn] || "").trim()
      : decodedAudioBody.audioPath;

    if (!nextText && !existingImagePath && !existingAudioPath) {
      return res.status(400).json({
        message: "Message text cannot be empty.",
      });
    }

    let updatedBody = nextText;
    if (!messageColumns.imageColumn) {
      updatedBody = ctx.encodeInlineImageMessageBody(
        updatedBody,
        existingImagePath,
      );
    }
    if (!messageColumns.audioColumn) {
      updatedBody = ctx.encodeInlineAudioMessageBody(
        updatedBody,
        existingAudioPath,
      );
    }

    const updatePayload = {
      [messageColumns.bodyColumn]: updatedBody,
    };

    const { data: updatedRow, error: updateError } = await profileClient
      .from(ctx.messagesTable)
      .update(updatePayload)
      .eq("id", rawMessageId)
      .select(selectedColumns.join(", "))
      .single();

    if (updateError) {
      return res.status(500).json({
        message: updateError.message || "Failed to update message.",
      });
    }

    const nextDecodedImageBody = ctx.decodeInlineImageMessageBody(
      String(updatedRow?.[messageColumns.bodyColumn] || ""),
    );
    const nextDecodedAudioBody = ctx.decodeInlineAudioMessageBody(
      String(nextDecodedImageBody.text || ""),
    );

    const resolvedImagePath = messageColumns.imageColumn
      ? String(updatedRow?.[messageColumns.imageColumn] || "").trim()
      : nextDecodedImageBody.imagePath;
    const resolvedAudioPath = messageColumns.audioColumn
      ? String(updatedRow?.[messageColumns.audioColumn] || "").trim()
      : nextDecodedAudioBody.audioPath;

    const profileWriteClient = ctx.supabaseServiceClient || profileClient;
    const resolvedImageUrl = resolvedImagePath
      ? await ctx.resolveAvatarForClient(resolvedImagePath, profileWriteClient)
      : "";
    const resolvedAudioUrl = resolvedAudioPath
      ? await ctx.resolveAvatarForClient(resolvedAudioPath, profileWriteClient)
      : "";
    const resolvedText =
      messageColumns.imageColumn || messageColumns.audioColumn
        ? String(updatedRow?.[messageColumns.bodyColumn] || "")
        : nextDecodedAudioBody.text;

    let receiverId = "";
    const conversationId = String(updatedRow?.conversation_id || "").trim();
    if (conversationId) {
      const { data: members } = await profileClient
        .from("conversation_members")
        .select(`conversation_id, ${memberUserColumn}`)
        .eq("conversation_id", conversationId);

      const peerMemberValue = (members || [])
        .map((row) => row?.[memberUserColumn])
        .find((value) => value && value !== ownerMemberValue);

      if (peerMemberValue) {
        if (memberUserColumn === "user_email") {
          const { data: peerProfile } = await profileClient
            .from(ctx.profilesTable)
            .select("id")
            .eq("email", ctx.normalizeEmail(peerMemberValue))
            .limit(1)
            .single();
          receiverId = String(peerProfile?.id || "").trim();
        } else {
          receiverId = String(peerMemberValue || "").trim();
        }
      }
    }

    const editedAt = new Date().toISOString();

    if (typeof ctx.emitMessageUpdated === "function") {
      ctx.emitMessageUpdated({
        id: updatedRow?.id || rawMessageId,
        text: resolvedText,
        imageUrl: resolvedImageUrl,
        audioUrl: resolvedAudioUrl,
        edited: true,
        editedAt,
        timestamp: updatedRow?.created_at || null,
        senderId: ownerProfile.id,
        receiverId,
        conversationId,
      });
    }

    return res.status(200).json({
      message: {
        id: updatedRow?.id || rawMessageId,
        text: resolvedText,
        imageUrl: resolvedImageUrl,
        audioUrl: resolvedAudioUrl,
        timestamp: updatedRow?.created_at || null,
        edited: true,
        editedAt,
      },
    });
  });
};

module.exports = registerUpdateMessageRoute;
