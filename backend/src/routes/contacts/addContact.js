const registerAddContactRoute = (app, ctx) => {
  app.post("/contacts", async (req, res) => {
    const profileClient = ctx.getProfileClient(req);
    if (!profileClient) {
      return res.status(500).json({
        message:
          "Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.",
      });
    }

    const rawOwnerPhone = ctx.normalizePhone(req.body?.ownerPhone);
    const rawContactPhone = ctx.normalizePhone(req.body?.contactPhone);

    if (!ctx.validatePhoneForProfile(rawOwnerPhone)) {
      return res.status(400).json({
        message:
          "Owner phone must be a valid number with country code (example: +216123456).",
      });
    }

    if (!ctx.validatePhoneForProfile(rawContactPhone)) {
      return res.status(400).json({
        message:
          "Contact phone must be a valid number with country code (example: +216123456).",
      });
    }

    const ownerPhoneForDb = ctx.normalizePhoneForDb(rawOwnerPhone);
    const contactPhoneForDb = ctx.normalizePhoneForDb(rawContactPhone);

    if (ownerPhoneForDb === contactPhoneForDb) {
      return res.status(400).json({
        message: "You cannot add your own phone as a contact.",
      });
    }

    const { data: ownerProfiles, error: ownerProfileError } =
      await profileClient
        .from(ctx.profilesTable)
        .select("id, phone")
        .eq("phone", ownerPhoneForDb)
        .limit(1);

    if (ownerProfileError) {
      return res.status(500).json({
        message: ownerProfileError.message || "Failed to fetch owner profile.",
      });
    }

    const ownerProfile = ownerProfiles?.[0];
    if (!ownerProfile?.id) {
      return res.status(404).json({ message: "Owner profile not found." });
    }

    const { data: targetProfiles, error: profileError } = await profileClient
      .from(ctx.profilesTable)
      .select("id, phone, display_name, avatar_url")
      .eq("phone", contactPhoneForDb)
      .limit(1);

    if (profileError) {
      return res.status(500).json({
        message: profileError.message || "Failed to fetch contact profile.",
      });
    }

    const targetProfile = targetProfiles?.[0];
    if (!targetProfile) {
      return res.status(404).json({
        message: "User not found.",
      });
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

    const ownerConversationIds = [
      ...new Set(
        (ownerMemberships || [])
          .map((membership) => membership?.conversation_id)
          .filter(Boolean),
      ),
    ];

    let existingConversationId = "";

    if (ownerConversationIds.length) {
      const { data: targetMemberships, error: targetMembershipError } =
        await profileClient
          .from("conversation_members")
          .select("conversation_id")
          .eq("user_id", targetProfile.id)
          .in("conversation_id", ownerConversationIds);

      if (targetMembershipError) {
        return res.status(500).json({
          message:
            targetMembershipError.message ||
            "Failed to check existing conversation.",
        });
      }

      existingConversationId = targetMemberships?.[0]?.conversation_id || "";
    }

    if (!existingConversationId) {
      const { data: createdConversation, error: conversationError } =
        await profileClient
          .from("conversations")
          .insert({
            created_by: ownerProfile.id,
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

      const { error: membersInsertError } = await profileClient
        .from("conversation_members")
        .insert([
          {
            conversation_id: createdConversation.id,
            user_id: ownerProfile.id,
            role: "member",
          },
          {
            conversation_id: createdConversation.id,
            user_id: targetProfile.id,
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

    return res.status(200).json({
      message: existingConversationId
        ? "Contact already exists."
        : "Contact added.",
      contact: await ctx.mapContactPreview(targetProfile, profileClient),
    });
  });
};

module.exports = registerAddContactRoute;
