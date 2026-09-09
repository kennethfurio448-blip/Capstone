import { withSupabase } from "npm:@supabase/server@^1";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

function createAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function errorResponse(message: string, status = 400) {
  return Response.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function successResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(
    body,
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function internalError(operation: string, error: unknown) {
  console.error(`Account administration ${operation} failed:`, error);
  return errorResponse(
    "Unable to complete the account operation securely. Please try again.",
    500,
  );
}

function normalizeRole(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normalizeStatus(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

async function recordAccountEvent(
  supabaseAdmin: ReturnType<typeof createClient>,
  callerId: string,
  action: string,
  userId: string,
  details: string,
) {
  const { error } = await supabaseAdmin.from("audit_events").insert({
    actor_id: callerId,
    action,
    module: "Manage Users",
    entity_type: "account",
    entity_id: userId,
    details,
    metadata: { source: "account_admin_function" },
  });
  if (error) console.error("Unable to record account audit event:", error);
}

async function protectLastActiveAdmin(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  nextRole: string | null,
  nextStatus: string | null,
) {
  const { data: target, error: targetError } = await supabaseAdmin
    .from("profiles")
    .select("role, status")
    .eq("id", userId)
    .maybeSingle();

  if (targetError) {
    return internalError("target profile lookup", targetError);
  }

  if (!target) {
    return errorResponse("The selected account was not found.", 404);
  }

  const removesActiveAdmin =
    normalizeRole(target.role) === "admin" &&
    normalizeStatus(target.status) === "active" &&
    (
      (nextRole !== null && nextRole !== "admin") ||
      (nextStatus !== null && nextStatus !== "active") ||
      (nextRole === null && nextStatus === null)
    );

  if (!removesActiveAdmin) {
    return null;
  }

  const { count, error: countError } = await supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .eq("status", "active");

  if (countError) {
    return internalError("administrator count", countError);
  }

  if ((count || 0) <= 1) {
    return errorResponse(
      "The last active Administrator cannot be disabled, demoted, or deleted.",
      409,
    );
  }

  return null;
}

export default {
  fetch: withSupabase(
    { auth: "user" },
    async (request, context) => {
      const supabaseAdmin = createAdminClient();

      if (!supabaseAdmin) {
        return errorResponse(
          "The Edge Function service-role configuration is missing.",
          500,
        );
      }

      const callerId =
        context.userClaims?.id ?? context.jwtClaims?.sub;

      if (!callerId) {
        return errorResponse(
          "Authenticated user ID was not found.",
          401,
        );
      }

      const { data: callerProfile, error: callerError } =
        await supabaseAdmin
          .from("profiles")
          .select("role, status")
          .eq("id", callerId)
          .maybeSingle();

      if (callerError) {
        return internalError("caller profile lookup", callerError);
      }

      if (
        normalizeRole(callerProfile?.role) !== "admin" ||
        normalizeStatus(callerProfile?.status) !== "active"
      ) {
        return errorResponse("Administrator access is required.", 403);
      }

      let body: Record<string, unknown>;

      try {
        body = await request.json();
      } catch {
        return errorResponse("Invalid request body.");
      }

      const action = String(body.action || "create").trim().toLowerCase();

      if (action === "list") {
        const { data: authData, error: authError } =
          await supabaseAdmin.auth.admin.listUsers({
            page: 1,
            perPage: 1000,
          });

        if (authError) {
          return internalError("user list lookup", authError);
        }

        const { data: profiles, error: profilesError } =
          await supabaseAdmin
            .from("profiles")
            .select("id, full_name, username, role, status");

        if (profilesError) {
          return internalError("profile list lookup", profilesError);
        }

        const profileById = new Map(
          (profiles || []).map((profile) => [profile.id, profile]),
        );

        const users = authData.users
          .map((user) => {
            const profile = profileById.get(user.id);

            return {
              id: user.id,
              fullname: profile?.full_name || "",
              username: profile?.username || "",
              email: user.email || "",
              role: normalizeRole(profile?.role),
              status: normalizeStatus(profile?.status) || "disabled",
              createdAt: user.created_at,
            };
          })
          .sort((first, second) =>
            String(first.createdAt).localeCompare(String(second.createdAt))
          )
          .map((user, index) => ({
            ...user,
            userId: `USR-${String(index + 1).padStart(3, "0")}`,
          }));

        return successResponse({ users });
      }

      if (action === "create") {
        return errorResponse(
          "Account creation requires OTP verification. Use the otp-auth function.",
          409,
        );
      }

      const userId = String(body.userId || "").trim();

      if (!userId) {
        return errorResponse("A user ID is required.");
      }

      if (action === "update") {
        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");
        const fullName = String(body.fullName || "").trim();
        const username = String(body.username || "").trim();
        const role = normalizeRole(body.role);
        const status = normalizeStatus(body.status);

        if (!email || !fullName || !username) {
          return errorResponse("All account fields are required.");
        }

        if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@gmail\.com$/i.test(email)) {
          return errorResponse("Enter a valid Gmail address.");
        }

        if (!["admin", "staff"].includes(role)) {
          return errorResponse("Role must be admin or staff.");
        }

        if (!["active", "disabled"].includes(status)) {
          return errorResponse("Status must be active or disabled.");
        }

        if (password) {
          return errorResponse("Passwords must be reset through OTP verification.");
        }

        if (
          userId === callerId &&
          (role !== "admin" || status !== "active")
        ) {
          return errorResponse(
            "You cannot demote or disable your own account.",
            403,
          );
        }

        const lastAdminProtection = await protectLastActiveAdmin(
          supabaseAdmin,
          userId,
          role,
          status,
        );

        if (lastAdminProtection) {
          return lastAdminProtection;
        }

        const { data: targetAuthData, error: targetAuthError } =
          await supabaseAdmin.auth.admin.getUserById(userId);

        if (targetAuthError || !targetAuthData.user) {
          return targetAuthError
            ? internalError("target account lookup", targetAuthError)
            : errorResponse("The selected account was not found.", 404);
        }

        if (
          String(targetAuthData.user.email || "").trim().toLowerCase() !== email
        ) {
          return errorResponse(
            "Changing a Gmail address requires OTP verification and is not available from Edit User yet.",
            409,
          );
        }

        const authUpdates = {
          ban_duration: status === "disabled" ? "876000h" : "none",
        };

        const { error: authError } =
          await supabaseAdmin.auth.admin.updateUserById(
            userId,
            authUpdates,
          );

        if (authError) {
          return internalError("authentication update", authError);
        }

        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .update({
            full_name: fullName,
            username,
            email,
            role,
            status,
          })
          .eq("id", userId);

        if (profileError) {
          return internalError("profile update", profileError);
        }

        await recordAccountEvent(
          supabaseAdmin,
          callerId,
          "Updated",
          userId,
          "Updated an account profile, role, or status.",
        );

        return successResponse({ message: "Account updated successfully." });
      }

      if (action === "set-status") {
        const status = normalizeStatus(body.status);

        if (!["active", "disabled"].includes(status)) {
          return errorResponse("Status must be active or disabled.");
        }

        if (userId === callerId) {
          return errorResponse(
            "You cannot disable your own account.",
            403,
          );
        }

        const lastAdminProtection = await protectLastActiveAdmin(
          supabaseAdmin,
          userId,
          null,
          status,
        );

        if (lastAdminProtection) {
          return lastAdminProtection;
        }

        const { error: authError } =
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            ban_duration: status === "disabled" ? "876000h" : "none",
          });

        if (authError) {
          return internalError("account status authentication update", authError);
        }

        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .update({ status })
          .eq("id", userId);

        if (profileError) {
          return internalError("account status profile update", profileError);
        }

        await recordAccountEvent(
          supabaseAdmin,
          callerId,
          status === "active" ? "Enabled" : "Disabled",
          userId,
          `${status === "active" ? "Enabled" : "Disabled"} an account.`,
        );

        return successResponse({ message: "Account status updated." });
      }

      if (action === "delete") {
        if (userId === callerId) {
          return errorResponse(
            "You cannot delete your own account.",
            403,
          );
        }

        const lastAdminProtection = await protectLastActiveAdmin(
          supabaseAdmin,
          userId,
          null,
          null,
        );

        if (lastAdminProtection) {
          return lastAdminProtection;
        }

        const { error: authError } =
          await supabaseAdmin.auth.admin.deleteUser(userId);

        if (authError) {
          return internalError("account deletion", authError);
        }

        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .delete()
          .eq("id", userId);

        if (profileError) {
          return internalError("profile cleanup after account deletion", profileError);
        }

        await recordAccountEvent(
          supabaseAdmin,
          callerId,
          "Deleted",
          userId,
          "Deleted an account.",
        );

        return successResponse({ message: "Account deleted successfully." });
      }

      return errorResponse("Unsupported account operation.");
    },
  ),
};
