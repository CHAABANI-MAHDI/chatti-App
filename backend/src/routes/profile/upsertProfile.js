const registerUpsertProfileRoute = (app, ctx) => {
  app.put("/profile", async (req, res) => {
    const profileClient = ctx.getProfileClient(req);
    if (!profileClient) {
      return res.status(500).json({
        message:
          "Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.",
      });
    }

    const rawPhone = ctx.normalizePhone(req.body?.phone);
    const displayName = String(req.body?.name || "").trim() || "User";
    const avatarUrl = String(req.body?.image || "").trim();
    const statusText = String(req.body?.statusText || "").trim();

    if (!ctx.validatePhoneForProfile(rawPhone)) {
      return res.status(400).json({
        message:
          "Phone must be a valid number with country code (example: +216123456).",
      });
    }

    const phoneForDb = ctx.normalizePhoneForDb(rawPhone);

    let resolvedAvatarUrl = ctx.normalizeAvatarForStorage(avatarUrl) || null;
    const imagePayload = ctx.parseImageDataUrl(avatarUrl);

    if (imagePayload) {
      if (imagePayload.buffer.length > 3 * 1024 * 1024) {
        return res.status(400).json({
          message: "Profile image is too large. Max allowed size is 3MB.",
        });
      }

      const requesterId = await ctx.resolveRequesterId(req);
      const fileExtension = ctx.extensionFromMime(imagePayload.mimeType);
      const filePath = `${requesterId || phoneForDb}/avatar-${Date.now()}.${fileExtension}`;

      const { error: uploadError } = await profileClient.storage
        .from(ctx.storageBucket)
        .upload(filePath, imagePayload.buffer, {
          contentType: imagePayload.mimeType,
          upsert: true,
        });

      if (uploadError) {
        return res.status(500).json({
          message: uploadError.message || "Failed to upload profile image.",
        });
      }

      resolvedAvatarUrl = filePath;
    }

    const { data: existingRecords, error: findError } = await profileClient
      .from(ctx.profilesTable)
      .select("*")
      .eq("phone", phoneForDb)
      .limit(1);

    if (findError) {
      return res.status(500).json({
        message: findError.message || "Failed to fetch current profile.",
      });
    }

    const payload = {
      phone: phoneForDb,
      display_name: displayName,
      avatar_url: resolvedAvatarUrl,
      status_text: statusText || null,
    };

    let writeQuery = profileClient.from(ctx.profilesTable);
    if (existingRecords?.length > 0) {
      writeQuery = writeQuery
        .update(payload)
        .eq("phone", phoneForDb)
        .select("id, phone, display_name, avatar_url, status_text")
        .single();
    } else {
      writeQuery = writeQuery
        .insert(payload)
        .select("id, phone, display_name, avatar_url, status_text")
        .single();
    }

    const { data: savedProfile, error: writeError } = await writeQuery;

    if (writeError) {
      if (
        String(writeError.message || "")
          .toLowerCase()
          .includes("row-level security")
      ) {
        return res.status(403).json({
          message:
            "Profile write blocked by Supabase RLS. Add SUPABASE_SERVICE_ROLE_KEY to backend .env, or update your RLS policy for the profiles table.",
        });
      }

      return res.status(500).json({
        message: writeError.message || "Failed to save profile.",
      });
    }

    return res.status(200).json({
      message: "Profile saved successfully.",
      profile: await ctx.mapProfileRecord(savedProfile, profileClient),
    });
  });
};

module.exports = registerUpsertProfileRoute;
