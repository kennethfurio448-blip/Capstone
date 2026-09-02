import { withSupabase } from "npm:@supabase/server@^1";
import { createClient } from "npm:@supabase/supabase-js@2";

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
  return Response.json({ error: message }, { status });
}

function normalizeRole(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normalizeStatus(value: unknown) {
  return String(value || "").trim().toLowerCase();
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
        return errorResponse(
          `Profile lookup failed: ${callerError.message}`,
          500,
        );
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
          return errorResponse(authError.message, 500);
        }

        const { data: profiles, error: profilesError } =
          await supabaseAdmin
            .from("profiles")
            .select("id, full_name, username, role, status");

        if (profilesError) {
          return errorResponse(profilesError.message, 500);
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

        return Response.json({ users });
      }

      if (action === "create") {
        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");
        const fullName = String(body.fullName || "").trim();
        const username = String(body.username || "").trim();
        const role = normalizeRole(body.role);

        if (!email || !password || !fullName || !username) {
          return errorResponse("All account fields are required.");
        }

        if (!["admin", "staff"].includes(role)) {
          return errorResponse("Role must be admin or staff.");
        }

        if (password.length < 8) {
          return errorResponse(
            "Password must contain at least 8 characters.",
          );
        }

        const { data: authData, error: authError } =
          await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
          });

        if (authError || !authData.user) {
          return errorResponse(
            authError?.message || "Could not create the Auth user.",
          );
        }

        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .insert({
            id: authData.user.id,
            full_name: fullName,
            username,
            role,
            status: "active",
          });

        if (profileError) {
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
          return errorResponse(profileError.message);
        }

        return Response.json(
          { message: "Account created successfully." },
          { status: 201 },
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

        if (!["admin", "staff"].includes(role)) {
          return errorResponse("Role must be admin or staff.");
        }

        if (!["active", "disabled"].includes(status)) {
          return errorResponse("Status must be active or disabled.");
        }

        if (password && password.length < 8) {
          return errorResponse(
            "Password must contain at least 8 characters.",
          );
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

        const authUpdates = {
          email,
          email_confirm: true,
          ban_duration: status === "disabled" ? "876000h" : "none",
          ...(password ? { password } : {}),
        };

        const { error: authError } =
          await supabaseAdmin.auth.admin.updateUserById(
            userId,
            authUpdates,
          );

        if (authError) {
          return errorResponse(authError.message);
        }

        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .update({
            full_name: fullName,
            username,
            role,
            status,
          })
          .eq("id", userId);

        if (profileError) {
          return errorResponse(profileError.message, 500);
        }

        return Response.json({ message: "Account updated successfully." });
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

        const { error: authError } =
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            ban_duration: status === "disabled" ? "876000h" : "none",
          });

        if (authError) {
          return errorResponse(authError.message);
        }

        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .update({ status })
          .eq("id", userId);

        if (profileError) {
          return errorResponse(profileError.message, 500);
        }

        return Response.json({ message: "Account status updated." });
      }

      if (action === "delete") {
        if (userId === callerId) {
          return errorResponse(
            "You cannot delete your own account.",
            403,
          );
        }

        const { error: authError } =
          await supabaseAdmin.auth.admin.deleteUser(userId);

        if (authError) {
          return errorResponse(authError.message);
        }

        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .delete()
          .eq("id", userId);

        if (profileError) {
          return errorResponse(
            `Auth user deleted, but profile cleanup failed: ${profileError.message}`,
            500,
          );
        }

        return Response.json({ message: "Account deleted successfully." });
      }

      return errorResponse("Unsupported account operation.");
    },
  ),
};
