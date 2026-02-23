const registerUpdateMeProfileRoute = (app, ctx) => {
  app.put("/auth/me/profile", async (req, res) => {
    const profileClient = ctx.getProfileClient(req);
    if (!profileClient) {
      return res.status(500).json({
        message:
          "Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.",
      });
    }

    const profileWriteClient = ctx.supabaseServiceClient || profileClient;

    const {
      authClient,
      user,
      error: authError,
    } = await ctx.resolveAuthenticatedUser(req);

    if (!authClient || !user) {
      return res.status(401).json({
        message: authError || "Unauthorized user.",
      });
    }

    const existingMetadata = user.user_metadata || {};
    const currentAuthEmail = ctx.normalizeEmail(
      user.email || existingMetadata.email || "",
    );
    const providedEmail = ctx.normalizeEmail(req.body?.email);
    const targetEmail = providedEmail || currentAuthEmail;
    const providedName = String(req.body?.name || "").trim();
    const providedPhone = ctx.normalizePhone(req.body?.phone);
    const providedImage = String(req.body?.image || "").trim();

    if (!ctx.validateEmail(targetEmail)) {
      return res.status(400).json({
        message: "Email is missing or invalid.",
      });
    }

    const resolvedName =
      providedName ||
      String(
        existingMetadata.full_name || existingMetadata.name || "",
      ).trim() ||
      ctx.mapAuthUserForClient(user).name ||
      "User";

    if (providedPhone && !ctx.validatePhoneForProfile(providedPhone)) {
      return res.status(400).json({
        message:
          "Phone must be a valid number with country code (example: +216123456).",
      });
    }

    let resolvedAvatarUrl = ctx.normalizeAvatarForStorage(providedImage) || "";
    const imagePayload = ctx.parseImageDataUrl(providedImage);

    if (imagePayload) {
      if (imagePayload.buffer.length > 3 * 1024 * 1024) {
        return res.status(400).json({
          message: "Profile image is too large. Max allowed size is 3MB.",
        });
      }

      const fileExtension = ctx.extensionFromMime(imagePayload.mimeType);
      const filePath = `${user.id}/avatar-${Date.now()}.${fileExtension}`;

      const { error: uploadError } = await profileWriteClient.storage
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

    const previousPhone = ctx.normalizePhone(
      String(existingMetadata.phone || user.phone || ""),
    );
    const nextPhone = providedPhone || previousPhone;
    const nextPhoneForDb = nextPhone ? ctx.normalizePhoneForDb(nextPhone) : "";

    const { data: byIdRows, error: findIdError } = await profileWriteClient
      .from(ctx.profilesTable)
      .select("id, email, phone")
      .eq("id", user.id)
      .limit(1);

    if (findIdError) {
      if (
        String(findIdError.message || "")
          .toLowerCase()
          .includes("row-level security")
      ) {
        return res.status(403).json({
          message:
            "Profile write blocked by Supabase RLS. Add SUPABASE_SERVICE_ROLE_KEY to backend .env, or update your RLS policy for the profiles table.",
        });
      }

      return res.status(500).json({
        message: findIdError.message || "Failed to validate profile id.",
      });
    }

    const byId = byIdRows?.[0] || null;

    let byCurrentEmail = null;
    if (ctx.validateEmail(currentAuthEmail)) {
      const { data: byCurrentEmailRows, error: findCurrentEmailError } =
        await profileWriteClient
          .from(ctx.profilesTable)
          .select("id, email, phone")
          .eq("email", currentAuthEmail)
          .limit(1);

      if (findCurrentEmailError) {
        if (
          String(findCurrentEmailError.message || "")
            .toLowerCase()
            .includes("row-level security")
        ) {
          return res.status(403).json({
            message:
              "Profile write blocked by Supabase RLS. Add SUPABASE_SERVICE_ROLE_KEY to backend .env, or update your RLS policy for the profiles table.",
          });
        }

        return res.status(500).json({
          message:
            findCurrentEmailError.message ||
            "Failed to validate profile email.",
        });
      }

      byCurrentEmail = byCurrentEmailRows?.[0] || null;
    }

    let byTargetEmail = byCurrentEmail;
    if (targetEmail && targetEmail !== currentAuthEmail) {
      const { data: byTargetEmailRows, error: findTargetEmailError } =
        await profileWriteClient
          .from(ctx.profilesTable)
          .select("id, email, phone")
          .eq("email", targetEmail)
          .limit(1);

      if (findTargetEmailError) {
        if (
          String(findTargetEmailError.message || "")
            .toLowerCase()
            .includes("row-level security")
        ) {
          return res.status(403).json({
            message:
              "Profile write blocked by Supabase RLS. Add SUPABASE_SERVICE_ROLE_KEY to backend .env, or update your RLS policy for the profiles table.",
          });
        }

        return res.status(500).json({
          message:
            findTargetEmailError.message || "Failed to validate profile email.",
        });
      }

      byTargetEmail = byTargetEmailRows?.[0] || null;
    }

    let byPhone = null;
    if (nextPhoneForDb) {
      const { data: byPhoneRows, error: findPhoneError } =
        await profileWriteClient
          .from(ctx.profilesTable)
          .select("id, email, phone")
          .eq("phone", nextPhoneForDb)
          .limit(1);

      if (findPhoneError) {
        if (
          String(findPhoneError.message || "")
            .toLowerCase()
            .includes("row-level security")
        ) {
          return res.status(403).json({
            message:
              "Profile write blocked by Supabase RLS. Add SUPABASE_SERVICE_ROLE_KEY to backend .env, or update your RLS policy for the profiles table.",
          });
        }

        return res.status(500).json({
          message:
            findPhoneError.message || "Failed to validate profile phone.",
        });
      }

      byPhone = byPhoneRows?.[0] || null;
    }

    const matchedProfileIds = [
      byId?.id,
      byCurrentEmail?.id,
      byTargetEmail?.id,
      byPhone?.id,
    ]
      .filter(Boolean)
      .filter((value, index, self) => self.indexOf(value) === index);

    if (matchedProfileIds.length > 1) {
      return res.status(409).json({
        message:
          "This email or phone number is already linked to another profile. Use another one.",
      });
    }

    const profilePayload = {
      email: targetEmail,
      phone: nextPhoneForDb || null,
      display_name: resolvedName,
      avatar_url: resolvedAvatarUrl || null,
    };

    const targetProfileId = byId?.id || matchedProfileIds[0] || "";

    if (targetProfileId) {
      const { error: updateProfileError } = await profileWriteClient
        .from(ctx.profilesTable)
        .update(profilePayload)
        .eq("id", targetProfileId);

      if (updateProfileError) {
        if (
          String(updateProfileError.message || "")
            .toLowerCase()
            .includes("row-level security")
        ) {
          return res.status(403).json({
            message:
              "Profile write blocked by Supabase RLS. Add SUPABASE_SERVICE_ROLE_KEY to backend .env, or update your RLS policy for the profiles table.",
          });
        }

        return res.status(500).json({
          message: updateProfileError.message || "Failed to update profile.",
        });
      }
    } else {
      const { error: insertProfileError } = await profileWriteClient
        .from(ctx.profilesTable)
        .insert({
          ...profilePayload,
          id: user.id,
        });

      if (insertProfileError) {
        if (
          String(insertProfileError.message || "")
            .toLowerCase()
            .includes("row-level security")
        ) {
          return res.status(403).json({
            message:
              "Profile write blocked by Supabase RLS. Add SUPABASE_SERVICE_ROLE_KEY to backend .env, or update your RLS policy for the profiles table.",
          });
        }

        return res.status(500).json({
          message: insertProfileError.message || "Failed to create profile.",
        });
      }
    }

    const nextMetadata = {
      ...existingMetadata,
      full_name: resolvedName,
      name: resolvedName,
      email: targetEmail,
      phone: nextPhone || "",
      image:
        resolvedAvatarUrl || String(existingMetadata.image || "").trim() || "",
    };

    const authUpdatePayload = {
      data: nextMetadata,
    };

    if (targetEmail && targetEmail !== currentAuthEmail) {
      authUpdatePayload.email = targetEmail;
    }

    const { data: updatedAuthData, error: authUpdateError } =
      await authClient.auth.updateUser(authUpdatePayload);

    const authUpdateMessage = String(authUpdateError?.message || "");
    const shouldIgnoreAuthUpdateError =
      authUpdateMessage.toLowerCase().includes("auth session missing") ||
      authUpdateMessage.toLowerCase().includes("invalid jwt") ||
      authUpdateMessage.toLowerCase().includes("jwt expired") ||
      authUpdateMessage.toLowerCase().includes("token expired");

    if (authUpdateError && !shouldIgnoreAuthUpdateError) {
      return res.status(500).json({
        message: authUpdateError.message || "Failed to update auth profile.",
      });
    }

    const mappedUser = ctx.mapAuthUserForClient(updatedAuthData?.user || user);
    const resolvedClientImage = await ctx.resolveAvatarForClient(
      resolvedAvatarUrl,
      profileWriteClient,
    );

    return res.status(200).json({
      message: "Profile updated successfully.",
      user: {
        ...mappedUser,
        name: resolvedName,
        email: targetEmail,
        phone: nextPhone || "",
        image: resolvedClientImage || mappedUser.image || "",
      },
    });
  });
};

module.exports = registerUpdateMeProfileRoute;
