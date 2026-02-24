const { isUuid } = require("./messageRouteUtils");

const registerDeleteMessageRoute = (app, ctx) => {
  app.delete("/messages/:messageId", async (req, res) => {
    const profileClient = ctx.getProfileClient(req);
    if (!profileClient) {
      return res.status(500).json({
        message:
          "Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.",
      });
    }

    const rawMessageId = String(req.params?.messageId || "").trim();
    const rawOwnerId = String(req.body?.ownerId || "").trim();

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
        message: "Could not resolve owner identity for message deletion.",
      });
    }

    const { data: messageRow, error: messageError } = await profileClient
      .from(ctx.messagesTable)
      .select(`id, conversation_id, ${messageColumns.senderColumn}`)
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
        message: "You can only delete your own messages.",
      });
    }

    const conversationId = String(messageRow?.conversation_id || "").trim();

    const { error: deleteError } = await profileClient
      .from(ctx.messagesTable)
      .delete()
      .eq("id", rawMessageId);

    if (deleteError) {
      return res.status(500).json({
        message: deleteError.message || "Failed to delete message.",
      });
    }

    let receiverId = "";
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

    if (typeof ctx.emitMessageDeleted === "function") {
      ctx.emitMessageDeleted({
        id: rawMessageId,
        senderId: ownerProfile.id,
        receiverId,
        conversationId,
      });
    }

    return res.status(200).json({
      deleted: true,
      id: rawMessageId,
    });
  });
};

module.exports = registerDeleteMessageRoute;
