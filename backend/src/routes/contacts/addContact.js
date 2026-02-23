const registerAddContactRoute = (app, ctx) => {
  app.post("/contacts", async (req, res) => {
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

    const rawOwnerId = String(req.body?.ownerId || "").trim();
    const rawContactId = String(req.body?.contactId || "").trim();
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

    if (rawOwnerId === rawContactId) {
      return res.status(400).json({
        message: "You cannot add yourself as a contact.",
      });
    }

    const { profile: ownerProfile, error: ownerProfileError } =
      await ctx.resolveOwnerProfile(req, profileClient, rawOwnerId);

    if (ownerProfileError) {
      return res.status(500).json({
        message: ownerProfileError.message || "Failed to fetch owner profile.",
      });
    }

    if (!ownerProfile?.id) {
      return res.status(404).json({ message: "Owner profile not found." });
    }

    const memberUserColumn =
      await ctx.resolveConversationMemberUserColumn(profileClient);

    const targetLookupQuery = profileClient
      .from(ctx.profilesTable)
      .select("id, email, phone, display_name, avatar_url")
      .limit(1);

    const { data: targetProfiles, error: profileError } =
      await targetLookupQuery.eq("id", rawContactId);

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

    const ownerMemberValue = ctx.resolveConversationMemberValue(
      ownerProfile,
      memberUserColumn,
    );
    const targetMemberValue = ctx.resolveConversationMemberValue(
      targetProfile,
      memberUserColumn,
    );

    if (!ownerMemberValue || !targetMemberValue) {
      return res.status(400).json({
        message: "Could not resolve conversation member identity from profile.",
      });
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

    let existingConversationId = "";

    if (ownerConversationIds.length) {
      const { data: targetMemberships, error: targetMembershipError } =
        await profileClient
          .from("conversation_members")
          .select("conversation_id")
          .eq(memberUserColumn, targetMemberValue)
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
      const participantEmails = [
        ctx.normalizeEmail(ownerProfile.email || ""),
        ctx.normalizeEmail(targetProfile.email || ""),
      ].filter(Boolean);

      const candidateConversationPayloads = [
        {
          created_by: ownerProfile.id,
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

      const memberRowsWithRole = [
        {
          conversation_id: createdConversation.id,
          [memberUserColumn]: ownerMemberValue,
          role: "member",
        },
        {
          conversation_id: createdConversation.id,
          [memberUserColumn]: targetMemberValue,
          role: "member",
        },
      ];

      const memberRowsWithoutRole = [
        {
          conversation_id: createdConversation.id,
          [memberUserColumn]: ownerMemberValue,
        },
        {
          conversation_id: createdConversation.id,
          [memberUserColumn]: targetMemberValue,
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

    return res.status(200).json({
      message: existingConversationId
        ? "Contact already exists."
        : "Contact added.",
      contact: await ctx.mapContactPreview(targetProfile, profileClient),
    });
  });
};

module.exports = registerAddContactRoute;
