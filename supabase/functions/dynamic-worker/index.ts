import { withSupabase } from "npm:@supabase/server@1.6.0";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const MAX_REQUEST_BYTES = 64 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GMAIL_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@gmail\.com$/i;
const USERNAME_PATTERN = /^[a-z0-9._ -]{4,32}$/i;

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
      if (request.method !== "POST") {
        return errorResponse("Method not allowed.", 405);
      }

      const contentType = request.headers.get("Content-Type") || "";
      if (!contentType.toLowerCase().includes("application/json")) {
        return errorResponse("Content-Type must be application/json.", 415);
      }

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
        const requestText = await request.text();
        if (new TextEncoder().encode(requestText).byteLength > MAX_REQUEST_BYTES) {
          return errorResponse("Request body is too large.", 413);
        }
        const parsedBody = JSON.parse(requestText);
        if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
          return errorResponse("Invalid request body.");
        }
        body = parsedBody as Record<string, unknown>;
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

         const { data: trashedProfiles, error: trashError } = await supabaseAdmin
           .from("trash_records")
           .select("record_id")
           .eq("source_table", "profiles")
           .is("restored_at", null)
           .is("permanently_deleted_at", null);

         if (trashError) {
           return internalError("trashed account lookup", trashError);
         }

         const trashedUserIds = new Set(
           (trashedProfiles || []).map((record) => String(record.record_id)),
         );

        const profileById = new Map(
          (profiles || []).map((profile) => [profile.id, profile]),
        );

        const users = authData.users
          .filter((user) => !trashedUserIds.has(user.id))
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
      const isTrashAccountAction = [
        "restore-trash-account",
        "permanently-delete-trash-account",
      ].includes(action);

      if (!isTrashAccountAction && !UUID_PATTERN.test(userId)) {
        return errorResponse("A valid user ID is required.");
      }

      if (action === "update") {
        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");
        const fullName = String(body.fullName || "").trim();
        const username = String(body.username || "").trim();
        const role = normalizeRole(body.role);
        const status = normalizeStatus(body.status);

        if (fullName.length < 2 || fullName.length > 100) {
          return errorResponse("Full name must contain 2 to 100 characters.");
        }

        if (!USERNAME_PATTERN.test(username)) {
          return errorResponse("Username must contain 4 to 32 letters, numbers, spaces, periods, underscores, or hyphens.");
        }

        if (email.length > 254 || !GMAIL_PATTERN.test(email)) {
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

        const { data: authData, error: lookupError } =
          await supabaseAdmin.auth.admin.getUserById(userId);
        const { data: profile, error: profileLookupError } = await supabaseAdmin
          .from("profiles")
          .select("id, full_name, username, email, role, status, created_at, updated_at")
          .eq("id", userId)
          .maybeSingle();

        if (lookupError || !authData.user || profileLookupError || !profile) {
          return internalError(
            "account Trash lookup",
            lookupError || profileLookupError || new Error("Account not found"),
          );
        }

        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          { ban_duration: "876000h" },
        );
        if (authError) return internalError("account Trash lock", authError);

        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .update({ status: "disabled" })
          .eq("id", userId);
        if (profileError) {
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            ban_duration: normalizeStatus(profile.status) === "active" ? "none" : "876000h",
          });
          return internalError("account Trash profile update", profileError);
        }

        const trashId = crypto.randomUUID();
        const operationKey = `account-trash-${crypto.randomUUID()}`;
        const { error: trashError } = await supabaseAdmin.from("trash_records").insert({
          id: trashId,
          source_table: "profiles",
          record_id: userId,
          module: "User Management",
          record_name: profile.full_name || profile.username || authData.user.email || userId,
          record_details: {
            username: profile.username,
            email: authData.user.email || profile.email,
            role: profile.role,
            status: profile.status,
          },
          record_data: {
            ...profile,
            email: authData.user.email || profile.email,
          },
          deleted_by: callerId,
          operation_key: operationKey,
        });

        if (trashError) {
          await supabaseAdmin.from("profiles").update({ status: profile.status }).eq("id", userId);
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            ban_duration: normalizeStatus(profile.status) === "active" ? "none" : "876000h",
          });
          return internalError("account Trash creation", trashError);
        }

        await recordAccountEvent(
          supabaseAdmin,
          callerId,
          "Moved to Trash",
          userId,
          "Moved an account to the Trash Bin and disabled sign-in.",
        );

        return successResponse({
          message: "Account moved to the Trash Bin.",
          trashId,
        });
      }

      if (action === "restore-trash-account" || action === "permanently-delete-trash-account") {
        const trashId = String(body.trashId || "").trim();
        if (!UUID_PATTERN.test(trashId)) {
          return errorResponse("A valid Trash record ID is required.");
        }

        const { data: trash, error: trashError } = await supabaseAdmin
          .from("trash_records")
          .select("*")
          .eq("id", trashId)
          .eq("source_table", "profiles")
          .is("restored_at", null)
          .is("permanently_deleted_at", null)
          .maybeSingle();

        if (trashError) return internalError("account Trash lookup", trashError);
        if (!trash) return errorResponse("The recoverable account was not found.", 404);

        const targetUserId = String(trash.record_id);
        const snapshot = (trash.record_data || {}) as Record<string, unknown>;

        if (action === "restore-trash-account") {
          const originalStatus = normalizeStatus(snapshot.status) || "disabled";
          const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
            targetUserId,
            { ban_duration: originalStatus === "active" ? "none" : "876000h" },
          );
          if (authError) return internalError("account restoration", authError);

          const { error: profileError } = await supabaseAdmin.from("profiles").update({
            full_name: snapshot.full_name,
            username: snapshot.username,
            email: snapshot.email,
            role: snapshot.role,
            status: originalStatus,
          }).eq("id", targetUserId);
          if (profileError) return internalError("restored profile update", profileError);

          const { error: updateError } = await supabaseAdmin.from("trash_records").update({
            restored_by: callerId,
            restored_at: new Date().toISOString(),
          }).eq("id", trashId);
          if (updateError) return internalError("account Trash completion", updateError);

          await recordAccountEvent(
            supabaseAdmin, callerId, "Restored", targetUserId,
            "Restored an account from the Trash Bin.",
          );
          return successResponse({ message: "Account restored successfully." });
        }

        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
        if (deleteError) return internalError("permanent account deletion", deleteError);

        const { error: updateError } = await supabaseAdmin.from("trash_records").update({
          permanently_deleted_by: callerId,
          permanently_deleted_at: new Date().toISOString(),
          record_data: {},
        }).eq("id", trashId);
        if (updateError) return internalError("permanent Trash completion", updateError);

        await recordAccountEvent(
          supabaseAdmin, callerId, "Permanently Deleted", targetUserId,
          "Permanently deleted an account from the Trash Bin.",
        );
        return successResponse({ message: "Account permanently deleted." });
      }

      return errorResponse("Unsupported account operation.");
    },
  ),
};
