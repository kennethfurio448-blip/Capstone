import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const OTP_LIFETIME_SECONDS = 10 * 60;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;
const GMAIL_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@gmail\.com$/i;

class RateLimitError extends Error {
  retryAfter: number;

  constructor(retryAfter: number) {
    super(`Too many verification requests. Please try again in ${retryAfter} seconds.`);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

function requestOriginAllowed(request: Request) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;

  const configuredOrigins = (Deno.env.get("ALLOWED_ORIGINS") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const localDevelopmentOrigin =
    origin === "null" ||
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);

  return localDevelopmentOrigin || configuredOrigins.includes(origin);
}

function corsHeaders(request: Request) {
  const origin = request.headers.get("Origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };

  if (origin && requestOriginAllowed(request)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase server configuration is missing.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function cleanEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function validateEmail(email: string) {
  if (!GMAIL_PATTERN.test(email)) {
    throw new Error("Enter a valid Gmail address.");
  }
}

function passwordPolicyError(password: string) {
  if (password.length < 12) return "Password must contain at least 12 characters.";
  if (password.length > 128) return "Password must not exceed 128 characters.";
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return "Password must include uppercase, lowercase, and a number.";
  }
  return "";
}

function validatePassword(password: string) {
  const error = passwordPolicyError(password);
  if (error) throw new Error(error);
}

function publicErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const safeMessages = [
    /^Enter a valid Gmail address\.$/,
    /^That email address is already registered\.$/,
    /^The account information is invalid\.$/,
    /^Password must /,
    /^Too many /,
    /^Incorrect code\./,
    /^This verification /,
    /^The verified Gmail address was changed\.$/,
    /^The resend limit was reached\./,
    /^Please wait \d+ seconds /,
    /^Administrator authentication is required\.$/,
    /^An active administrator account is required\.$/,
  ];

  return safeMessages.some((pattern) => pattern.test(message))
    ? message
    : "Unable to complete verification securely. Please try again.";
}

function maskEmail(email: string) {
  const [name, domain = ""] = email.split("@");
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}${"*".repeat(Math.max(3, name.length - visible.length))}@${domain}`;
}

function randomOtp() {
  const range = 1_000_000;
  const ceiling = Math.floor(0x1_0000_0000 / range) * range;
  const bytes = new Uint32Array(1);
  do crypto.getRandomValues(bytes); while (bytes[0] >= ceiling);
  return String(bytes[0] % range).padStart(6, "0");
}

async function otpHash(challengeId: string, otp: string) {
  const pepper = Deno.env.get("OTP_PEPPER");
  if (!pepper || pepper.length < 32) {
    throw new Error("OTP_PEPPER must be configured with at least 32 characters.");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${challengeId}:${otp}`),
  );
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function rateLimitKeyHash(value: string) {
  const pepper = Deno.env.get("OTP_PEPPER");
  if (!pepper || pepper.length < 32) {
    throw new Error("OTP_PEPPER must be configured with at least 32 characters.");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`rate-limit:${value}`),
  );
  return Array.from(
    new Uint8Array(signature),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

function clientAddress(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown-client"
  );
}

async function enforceRateLimit(
  supabase: ReturnType<typeof adminClient>,
  action: string,
  key: string,
  limit: number,
  windowSeconds: number,
  blockSeconds: number,
) {
  const { data, error } = await supabase.rpc("medtrack_check_otp_rate_limit", {
    p_key_hash: await rateLimitKeyHash(key),
    p_action: action,
    p_limit: limit,
    p_window_seconds: windowSeconds,
    p_block_seconds: blockSeconds,
  });

  if (error) throw error;
  if (!data?.allowed) {
    throw new RateLimitError(Math.max(1, Number(data?.retryAfter) || blockSeconds));
  }
}

async function sendEmail(destination: string, otp: string, purpose: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("OTP_FROM_EMAIL");
  if (!apiKey || !from) throw new Error("Email OTP service is not configured.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [destination],
      subject: "Your MedTrack verification code",
      text: `Your MedTrack ${purpose === "registration" ? "account registration" : "password reset"} code is ${otp}. It expires in 10 minutes. Never share this code.`,
    }),
  });
  if (!response.ok) {
    const providerBody = await response.text();
    console.error(
      `Resend rejected the OTP email with HTTP ${response.status}: ${providerBody}`,
    );
    throw new Error(
      `The email provider could not send the verification code (HTTP ${response.status}).`,
    );
  }
}

async function recordSecurityEvent(
  supabase: ReturnType<typeof adminClient>,
  actorId: string | null,
  action: string,
  entityId: string,
  details: string,
) {
  const { error } = await supabase.from("audit_events").insert({
    actor_id: actorId,
    action,
    module: "Authentication",
    entity_type: "account",
    entity_id: entityId,
    details,
    metadata: { source: "email_otp" },
  });
  if (error) console.error("Unable to record authentication audit event:", error);
}

async function requireAdmin(request: Request, supabase: ReturnType<typeof adminClient>) {
  const bearer = request.headers.get("Authorization") || "";
  const token = bearer.startsWith("Bearer ") ? bearer.slice(7) : "";
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error("Administrator authentication is required.");
  const { data: profile } = await supabase.from("profiles").select("role, status").eq("id", data.user.id).maybeSingle();
  if (profile?.role !== "admin" || profile?.status !== "active") {
    throw new Error("An active administrator account is required.");
  }
  return data.user.id;
}

async function findAuthUserByEmail(supabase: ReturnType<typeof adminClient>, email: string) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return data.users.find((user) => cleanEmail(user.email) === email) || null;
}

async function createChallenge(
  supabase: ReturnType<typeof adminClient>,
  values: { purpose: string; destination: string; targetUserId?: string | null; requestedBy?: string | null },
) {
  const recentCutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { count } = await supabase.from("otp_challenges").select("id", { count: "exact", head: true })
    .eq("purpose", values.purpose).eq("destination", values.destination).gte("created_at", recentCutoff);
  if ((count || 0) >= 5) throw new Error("Too many codes were requested. Please try again later.");

  const id = crypto.randomUUID();
  const otp = randomOtp();
  const now = Date.now();
  const { error } = await supabase.from("otp_challenges").insert({
    id,
    purpose: values.purpose,
    destination: values.destination,
    target_user_id: values.targetUserId || null,
    requested_by: values.requestedBy || null,
    otp_hash: await otpHash(id, otp),
    expires_at: new Date(now + OTP_LIFETIME_SECONDS * 1000).toISOString(),
    resend_available_at: new Date(now + RESEND_COOLDOWN_SECONDS * 1000).toISOString(),
    max_attempts: MAX_ATTEMPTS,
  });
  if (error) throw error;
  await sendEmail(values.destination, otp, values.purpose);
  return { challengeId: id, maskedDestination: maskEmail(values.destination), expiresIn: OTP_LIFETIME_SECONDS, resendAfter: RESEND_COOLDOWN_SECONDS };
}

async function createDummyResetChallenge(
  supabase: ReturnType<typeof adminClient>,
  destination: string,
) {
  const recentCutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { count } = await supabase.from("otp_challenges").select("id", { count: "exact", head: true })
    .eq("purpose", "password_reset").eq("destination", destination).gte("created_at", recentCutoff);
  if ((count || 0) >= 5) throw new Error("Too many codes were requested. Please try again later.");
  const id = crypto.randomUUID();
  const now = Date.now();
  const fakeOtp = randomOtp();
  const { error } = await supabase.from("otp_challenges").insert({
    id,
    purpose: "password_reset",
    destination,
    target_user_id: null,
    otp_hash: await otpHash(id, fakeOtp),
    expires_at: new Date(now + OTP_LIFETIME_SECONDS * 1000).toISOString(),
    resend_available_at: new Date(now + RESEND_COOLDOWN_SECONDS * 1000).toISOString(),
    max_attempts: MAX_ATTEMPTS,
  });
  if (error) throw error;
  return { challengeId: id, maskedDestination: maskEmail(destination), expiresIn: OTP_LIFETIME_SECONDS, resendAfter: RESEND_COOLDOWN_SECONDS };
}

async function verifyChallenge(
  supabase: ReturnType<typeof adminClient>,
  challengeId: string,
  otp: string,
  purpose: string,
  requester: string | null = null,
) {
  const candidate = /^\d{6}$/.test(otp)
    ? await otpHash(challengeId, otp)
    : await otpHash(challengeId, "invalid-code");
  const { data, error } = await supabase.rpc("medtrack_verify_otp_challenge", {
    p_id: challengeId,
    p_purpose: purpose,
    p_candidate_hash: candidate,
    p_requester: requester,
  });
  if (error) throw error;
  if (data?.status === "verified") return data.challenge;
  if (data?.status === "incorrect") {
    const remaining = Number(data.remaining || 0);
    throw new Error(remaining ? `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.` : "Too many incorrect attempts. Request a new code.");
  }
  if (data?.status === "locked") throw new Error("Too many incorrect attempts. Request a new code.");
  if (data?.status === "forbidden") throw new Error("This verification request belongs to another administrator.");
  if (data?.status === "used") throw new Error("This verification code was already used.");
  throw new Error("This verification code has expired. Request a new code.");
}

Deno.serve(async (request) => {
  const responseHeaders = corsHeaders(request);
  const json = (body: Record<string, unknown>, status = 200) =>
    Response.json(body, { status, headers: responseHeaders });

  if (!requestOriginAllowed(request)) {
    return json({ error: "This request origin is not allowed." }, 403);
  }

  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: responseHeaders });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const supabase = adminClient();
    const body = await request.json();
    const action = String(body.action || "");
    const address = clientAddress(request);

    if (action === "request-registration") {
      const requestedBy = await requireAdmin(request, supabase);
      const email = cleanEmail(body.email);
      validateEmail(email);
      await enforceRateLimit(supabase, action, `client:${address}`, 30, 900, 900);
      await enforceRateLimit(supabase, action, `admin:${requestedBy}`, 30, 3600, 1800);
      await enforceRateLimit(supabase, action, `destination:${email}`, 5, 900, 900);
      await enforceRateLimit(supabase, action, "global", 200, 900, 900);
      const existing = await findAuthUserByEmail(supabase, email);
      if (existing) throw new Error("That email address is already registered.");
      return json(await createChallenge(supabase, {
        purpose: "registration", destination: email, requestedBy,
      }));
    }

    if (action === "verify-registration") {
      const requestedBy = await requireAdmin(request, supabase);
      const challengeId = String(body.challengeId || "");
      await enforceRateLimit(supabase, action, `client:${address}`, 30, 900, 900);
      await enforceRateLimit(supabase, action, `challenge:${challengeId}`, 8, 900, 900);
      const challenge = await verifyChallenge(supabase, challengeId, String(body.otp || ""), "registration", requestedBy);
      const email = cleanEmail(body.email);
      const password = String(body.password || "");
      const fullName = String(body.fullName || "").trim();
      const username = String(body.username || "").trim();
      const role = String(body.role || "").toLowerCase();
      validateEmail(email);
      validatePassword(password);
      if (
        fullName.length < 2 ||
        fullName.length > 100 ||
        !/^[a-z0-9._-]{4,32}$/i.test(username) ||
        !["admin", "staff"].includes(role)
      ) throw new Error("The account information is invalid.");
      if (email !== challenge.destination) throw new Error("The verified Gmail address was changed.");

      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { verified_via: "email" },
      });
      if (authError || !authData.user) throw new Error(authError?.message || "Could not create the account.");
      const { error: profileError } = await supabase.from("profiles").insert({
        id: authData.user.id, full_name: fullName, username, email, role, status: "active",
      });
      if (profileError) {
        await supabase.auth.admin.deleteUser(authData.user.id);
        throw new Error(profileError.message);
      }
      await supabase.from("otp_challenges").update({ consumed_at: new Date().toISOString() }).eq("id", challengeId).is("consumed_at", null);
      await recordSecurityEvent(
        supabase,
        challenge.requested_by,
        "Created",
        authData.user.id,
        "Created a verified MedTrack account.",
      );
      return json({ message: "Contact verified and account created." }, 201);
    }

    if (action === "request-password-reset") {
      const email = cleanEmail(body.email);
      validateEmail(email);
      await enforceRateLimit(supabase, action, `client:${address}`, 10, 900, 900);
      await enforceRateLimit(supabase, action, `destination:${email}`, 5, 900, 900);
      await enforceRateLimit(supabase, action, "global", 100, 900, 900);
      const user = await findAuthUserByEmail(supabase, email);
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("status").eq("id", user.id).maybeSingle();
        if (profile?.status !== "active") {
          return json(await createDummyResetChallenge(supabase, email));
        }
        return json(await createChallenge(supabase, { purpose: "password_reset", destination: email, targetUserId: user.id }));
      }
      // Avoid revealing whether an email is registered. This challenge can never verify.
      return json(await createDummyResetChallenge(supabase, email));
    }

    if (action === "reset-password") {
      const challengeId = String(body.challengeId || "");
      await enforceRateLimit(supabase, action, `client:${address}`, 30, 900, 900);
      await enforceRateLimit(supabase, action, `challenge:${challengeId}`, 8, 900, 900);
      const challenge = await verifyChallenge(supabase, challengeId, String(body.otp || ""), "password_reset");
      const password = String(body.password || "");
      validatePassword(password);
      if (!challenge.target_user_id) throw new Error("This verification request is no longer available.");
      const { error } = await supabase.auth.admin.updateUserById(challenge.target_user_id, { password });
      if (error) throw error;
      await supabase.from("otp_challenges").update({ consumed_at: new Date().toISOString() }).eq("id", challengeId).is("consumed_at", null);
      await recordSecurityEvent(
        supabase,
        challenge.target_user_id,
        "Password Reset",
        challenge.target_user_id,
        "Account password was reset after Gmail OTP verification.",
      );
      return json({ message: "Password reset successfully. You can now sign in." });
    }

    if (action === "resend") {
      const challengeId = String(body.challengeId || "");
      await enforceRateLimit(supabase, action, `client:${address}`, 20, 900, 900);
      await enforceRateLimit(
        supabase,
        action,
        `challenge:${challengeId}`,
        1,
        RESEND_COOLDOWN_SECONDS,
        RESEND_COOLDOWN_SECONDS,
      );
      const { data: old } = await supabase.from("otp_challenges").select("*").eq("id", challengeId).maybeSingle();
      if (!old || old.consumed_at || old.verified_at) throw new Error("This verification request is no longer available.");
      if (old.resend_count >= 5) throw new Error("The resend limit was reached. Start a new verification request.");
      if (new Date(old.resend_available_at).getTime() > Date.now()) {
        const seconds = Math.ceil((new Date(old.resend_available_at).getTime() - Date.now()) / 1000);
        return json({ error: `Please wait ${seconds} seconds before requesting another code.`, retryAfter: seconds }, 429);
      }
      if (old.purpose === "registration") {
        const requestedBy = await requireAdmin(request, supabase);
        if (old.requested_by !== requestedBy) throw new Error("This verification request belongs to another administrator.");
      }
      const otp = randomOtp();
      const now = Date.now();
      const { error } = await supabase.from("otp_challenges").update({
        otp_hash: await otpHash(challengeId, otp), attempts: 0,
        resend_count: old.resend_count + 1,
        expires_at: new Date(now + OTP_LIFETIME_SECONDS * 1000).toISOString(),
        resend_available_at: new Date(now + RESEND_COOLDOWN_SECONDS * 1000).toISOString(),
      }).eq("id", challengeId);
      if (error) throw error;
      if (old.purpose !== "password_reset" || old.target_user_id) {
        await sendEmail(old.destination, otp, old.purpose);
      }
      return json({
        maskedDestination: maskEmail(old.destination),
        expiresIn: OTP_LIFETIME_SECONDS,
        resendAfter: RESEND_COOLDOWN_SECONDS,
      });
    }

    return json({ error: "Unsupported OTP operation." }, 400);
  } catch (error) {
    console.error(error);
    const internalMessage = error instanceof Error ? error.message : "";
    const message = publicErrorMessage(error);
    const status = error instanceof RateLimitError
      ? 429
      : internalMessage.includes("authentication") || internalMessage.includes("administrator")
      ? 401
      : 400;
    return json({
      error: message,
      ...(error instanceof RateLimitError ? { retryAfter: error.retryAfter } : {}),
    }, status);
  }
});
