import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const REQUEST_LIFETIME_SECONDS = 10 * 60;
const RESEND_COOLDOWN_SECONDS = 60;
const TRUST_LIFETIME_SECONDS = 14 * 24 * 60 * 60;
const APPROVED_SESSION_SECONDS = 12 * 60 * 60;
const GMAIL_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@gmail\.com$/i;

class PublicError extends Error {
  status: number;
  retryAfter?: number;

  constructor(message: string, status = 400, retryAfter?: number) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase server configuration is missing.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function credentialClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !key) throw new Error("Supabase authentication configuration is missing.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function responseHeaders() {
  return {
    "Cache-Control": "no-store, max-age=0",
    "Content-Security-Policy": "default-src 'none'",
    "Content-Type": "application/json; charset=utf-8",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  };
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders() });
}

function safeText(value: unknown, maximum: number, fallback = "") {
  const cleaned = String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, maximum) || fallback;
}

function cleanEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function hmac(value: string, context: string) {
  const pepper = Deno.env.get("LOGIN_APPROVAL_PEPPER") || Deno.env.get("OTP_PEPPER");
  if (!pepper || pepper.length < 32) {
    throw new Error("LOGIN_APPROVAL_PEPPER must contain at least 32 characters.");
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
    new TextEncoder().encode(`${context}:${value}`),
  );
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(first: string, second: string) {
  const left = new TextEncoder().encode(first);
  const right = new TextEncoder().encode(second);
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

function requireProxy(body: Record<string, unknown>) {
  const expected = Deno.env.get("LOGIN_PROXY_SECRET") || "";
  const received = String(body.proxySecret || "");
  if (expected.length < 32) throw new PublicError("Supabase login secret is not configured.", 503);
  if (received.length < 32) throw new PublicError("Vercel login secret was not provided.", 503);
  if (!constantTimeEqual(expected, received)) throw new PublicError("Vercel and Supabase login secrets do not match.", 503);
}

function maskEmail(email: string) {
  const [name, domain = ""] = email.split("@");
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}${"*".repeat(Math.max(3, name.length - visible.length))}@${domain}`;
}

function tokenFromJwt(accessToken: string) {
  const parts = accessToken.split(".");
  if (parts.length !== 3) throw new Error("Invalid authentication token.");
  const encoded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=");
  return JSON.parse(atob(padded));
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
    p_key_hash: await hmac(key, "login-rate-limit"),
    p_action: action,
    p_limit: limit,
    p_window_seconds: windowSeconds,
    p_block_seconds: blockSeconds,
  });
  if (error) throw error;
  if (!data?.allowed) {
    const retryAfter = Math.max(1, Number(data?.retryAfter) || blockSeconds);
    throw new PublicError("Too many login requests. Please try again later.", 429, retryAfter);
  }
}

async function recordEvent(
  supabase: ReturnType<typeof adminClient>,
  userId: string | null,
  action: string,
  requestId: string,
  details: string,
  metadata: Record<string, unknown> = {},
) {
  const { error } = await supabase.from("audit_events").insert({
    actor_id: userId,
    action,
    module: "Authentication",
    entity_type: "login_approval",
    entity_id: requestId,
    details,
    metadata: { source: "login_approval", ...metadata },
  });
  if (error) console.error("Unable to record login approval audit event:", error);
}

async function sendEmail(
  destination: string,
  subject: string,
  text: string,
  idempotencyKey: string,
) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("OTP_FROM_EMAIL");
  if (!apiKey || !from) throw new Error("Email service is not configured.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ from, to: [destination], subject, text }),
  });
  if (!response.ok) {
    console.error(`Resend rejected a login email with HTTP ${response.status}: ${await response.text()}`);
    throw new PublicError("The verification email could not be sent. Please try again.", 502);
  }
}

async function sendApprovalEmail(
  destination: string,
  requestId: string,
  allowToken: string,
  denyToken: string,
  details: { time: string; device: string; ip: string; location: string },
  resendCount: number,
) {
  const baseUrl = String(Deno.env.get("APP_BASE_URL") || "").replace(/\/+$/, "");
  if (!/^https:\/\//i.test(baseUrl) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(baseUrl)) {
    throw new Error("APP_BASE_URL is not configured securely.");
  }
  const approvalPage = `${baseUrl}/login-approval.html`;
  const allowLink = `${approvalPage}#request=${encodeURIComponent(requestId)}&decision=allow&token=${encodeURIComponent(allowToken)}`;
  const denyLink = `${approvalPage}#request=${encodeURIComponent(requestId)}&decision=deny&token=${encodeURIComponent(denyToken)}`;
  const message = [
    "A login to your MedTrack account is waiting for your approval.",
    "",
    `Date and time: ${details.time}`,
    `Browser or device: ${details.device}`,
    `IP address: ${details.ip}`,
    `Approximate location: ${details.location}`,
    "",
    `Yes, it was me — Allow login: ${allowLink}`,
    "",
    `No, it wasn't me — Deny login: ${denyLink}`,
    "",
    "This request expires in 10 minutes. Never forward either link. MedTrack will never ask for your password by email.",
  ].join("\n");
  await sendEmail(
    destination,
    "Approve your MedTrack login",
    message,
    `login-approval-${requestId}-${resendCount}`,
  );
}

async function profileForEmail(supabase: ReturnType<typeof adminClient>, email: string) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, role, status")
    .ilike("email", email)
    .maybeSingle();
  if (error) throw error;
  return profile;
}

async function verifyCredentials(email: string, password: string) {
  const client = credentialClient();
  const result = await client.auth.signInWithPassword({ email, password });
  return { client, result };
}

async function beginLogin(
  body: Record<string, unknown>,
  supabase: ReturnType<typeof adminClient>,
) {
  const email = cleanEmail(body.email);
  const password = String(body.password || "");
  const ip = safeText(body.clientIp, 64, "Unavailable");
  const device = safeText(body.userAgent, 240, "Unknown browser or device");
  const location = safeText(body.approximateLocation, 100, "Unavailable");
  if (!GMAIL_PATTERN.test(email) || password.length < 1 || password.length > 128) {
    throw new PublicError("Email or password is incorrect.", 401);
  }

  const emailHash = await hmac(email, "login-email");
  await enforceRateLimit(supabase, "login-begin-ip", `ip:${ip}`, 20, 900, 900);
  await enforceRateLimit(supabase, "login-begin-email", `email:${email}`, 10, 900, 900);
  const security = await supabase.rpc("medtrack_login_security_check", { p_email_hash: emailHash });
  if (security.error) throw security.error;
  if (!security.data?.allowed) {
    const retryAfter = Math.max(1, Number(security.data?.retryAfter) || 900);
    throw new PublicError("This account is temporarily locked. Please try again later.", 423, retryAfter);
  }

  const { client, result } = await verifyCredentials(email, password);
  if (result.error || !result.data.user || !result.data.session) {
    const failed = await supabase.rpc("medtrack_login_security_failure", { p_email_hash: emailHash });
    await recordEvent(supabase, null, "Login Failed", emailHash.slice(0, 16), "A login failed because the credentials were invalid.");
    if (failed.data?.locked) {
      throw new PublicError("This account is temporarily locked. Please try again later.", 423, Number(failed.data.retryAfter) || 900);
    }
    throw new PublicError("Email or password is incorrect.", 401);
  }

  const user = result.data.user;
  const session = result.data.session;
  const destination = cleanEmail(user.email);
  if (!GMAIL_PATTERN.test(destination)) {
    await client.auth.signOut();
    throw new PublicError("Unable to sign in with this account.", 403);
  }
  const profile = await profileForEmail(supabase, email);
  if (!profile || profile.id !== user.id || profile.status !== "active" || !["admin", "staff"].includes(profile.role)) {
    await client.auth.signOut();
    await recordEvent(supabase, user.id, "Login Blocked", crypto.randomUUID(), "A login was blocked because the account is unavailable.");
    throw new PublicError("Unable to sign in with this account.", 403);
  }

  await supabase.rpc("medtrack_login_security_success", { p_email_hash: emailHash });
  const trustedToken = String(body.trustedDeviceToken || "");
  if (trustedToken) {
    const tokenHash = await hmac(trustedToken, "trusted-device");
    const userAgentHash = await hmac(device, "trusted-user-agent");
    const { data: trusted } = await supabase
      .from("trusted_devices")
      .select("id")
      .eq("user_id", user.id)
      .eq("token_hash", tokenHash)
      .eq("user_agent_hash", userAgentHash)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (trusted) {
      const claims = tokenFromJwt(session.access_token);
      await supabase.from("approved_sessions").upsert({
        session_id: claims.session_id,
        user_id: user.id,
        approved_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + APPROVED_SESSION_SECONDS * 1000).toISOString(),
        revoked_at: null,
      });
      await supabase.from("trusted_devices").update({ last_used_at: new Date().toISOString() }).eq("id", trusted.id);
      await recordEvent(supabase, user.id, "Trusted Login", trusted.id, "A trusted device completed login.");
      return { status: "completed", session };
    }
  }

  await client.auth.signOut();
  const requestId = crypto.randomUUID();
  const browserSecret = randomToken();
  const allowToken = randomToken();
  const denyToken = randomToken();
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + REQUEST_LIFETIME_SECONDS * 1000);
  const { error: insertError } = await supabase.from("login_approval_requests").insert({
    id: requestId,
    user_id: user.id,
    destination,
    browser_secret_hash: await hmac(browserSecret, "login-browser"),
    allow_token_hash: await hmac(allowToken, "login-allow"),
    deny_token_hash: await hmac(denyToken, "login-deny"),
    device_description: device,
    ip_address: ip,
    approximate_location: location,
    remember_me: Boolean(body.rememberMe),
    expires_at: expiresAt.toISOString(),
    resend_available_at: new Date(createdAt.getTime() + RESEND_COOLDOWN_SECONDS * 1000).toISOString(),
  });
  if (insertError) throw insertError;

  try {
    await sendApprovalEmail(destination, requestId, allowToken, denyToken, {
      time: createdAt.toLocaleString("en-PH", { timeZone: "Asia/Manila", timeZoneName: "short" }),
      device,
      ip,
      location,
    }, 0);
  } catch (error) {
    await supabase.from("login_approval_requests").update({ status: "denied", decided_at: new Date().toISOString() }).eq("id", requestId);
    throw error;
  }

  await recordEvent(supabase, user.id, "Login Approval Requested", requestId, "A new login requested Gmail approval.", { device, location });
  return {
    status: "pending",
    requestId,
    browserSecret,
    maskedDestination: maskEmail(destination),
    expiresIn: REQUEST_LIFETIME_SECONDS,
    resendAfter: RESEND_COOLDOWN_SECONDS,
  };
}

async function statusForBrowser(body: Record<string, unknown>, supabase: ReturnType<typeof adminClient>) {
  const requestId = String(body.requestId || "");
  const browserHash = await hmac(String(body.browserSecret || ""), "login-browser");
  const { data: request, error } = await supabase
    .from("login_approval_requests")
    .select("id, user_id, destination, status, expires_at, resend_available_at")
    .eq("id", requestId)
    .eq("browser_secret_hash", browserHash)
    .maybeSingle();
  if (error) throw error;
  if (!request) throw new PublicError("This login request is unavailable.", 404);
  if (request.status === "pending" && new Date(request.expires_at).getTime() <= Date.now()) {
    const now = new Date().toISOString();
    await supabase.from("login_approval_requests").update({ status: "expired", decided_at: now }).eq("id", request.id).eq("status", "pending");
    await recordEvent(supabase, request.user_id, "Login Approval Expired", request.id, "A login approval request expired without an answer.");
    try {
      await sendEmail(request.destination, "MedTrack login request expired", "The recent MedTrack login request expired and access was not granted. If this was not you, reset your password and contact an administrator.", `login-expired-${request.id}`);
    } catch (notificationError) {
      console.error("Unable to send the expiration notification:", notificationError);
    }
    request.status = "expired";
  }
  return {
    status: request.status,
    expiresAt: request.expires_at,
    resendAvailableAt: request.resend_available_at,
  };
}

async function decideLogin(body: Record<string, unknown>, supabase: ReturnType<typeof adminClient>) {
  const requestId = String(body.requestId || "");
  const decision = String(body.decision || "");
  if (!["allow", "deny"].includes(decision)) throw new PublicError("Choose Allow or Deny.");
  const hashColumn = decision === "allow" ? "allow_token_hash" : "deny_token_hash";
  const tokenHash = await hmac(String(body.token || ""), decision === "allow" ? "login-allow" : "login-deny");
  const { data: request, error } = await supabase
    .from("login_approval_requests")
    .select("id, user_id, destination, status, expires_at")
    .eq("id", requestId)
    .eq(hashColumn, tokenHash)
    .maybeSingle();
  if (error) throw error;
  if (!request) throw new PublicError("This approval link is invalid or unavailable.", 404);
  if (request.status !== "pending") throw new PublicError("This approval link has already been used.", 409);
  if (new Date(request.expires_at).getTime() <= Date.now()) {
    await supabase.from("login_approval_requests").update({ status: "expired", decided_at: new Date().toISOString() }).eq("id", request.id).eq("status", "pending");
    await recordEvent(supabase, request.user_id, "Login Approval Expired", request.id, "An expired login approval link was opened.");
    throw new PublicError("This approval link has expired.", 410);
  }
  const nextStatus = decision === "allow" ? "approved" : "denied";
  const { data: updated, error: updateError } = await supabase
    .from("login_approval_requests")
    .update({ status: nextStatus, decided_at: new Date().toISOString() })
    .eq("id", request.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (updateError) throw updateError;
  if (!updated) throw new PublicError("This approval link has already been used.", 409);
  await recordEvent(
    supabase,
    request.user_id,
    decision === "allow" ? "Login Approved" : "Login Denied",
    request.id,
    decision === "allow" ? "The account owner approved a login." : "The account owner denied a login.",
  );
  if (decision === "deny") {
    try {
      await sendEmail(request.destination, "MedTrack login denied", "The pending MedTrack login was denied and access was not granted. If you did not perform this action, reset your password and contact an administrator.", `login-denied-${request.id}`);
    } catch (notificationError) {
      console.error("Unable to send the denial notification:", notificationError);
    }
  }
  return { status: nextStatus, message: decision === "allow" ? "Login approved. You may return to the original browser." : "Login denied. Access has been blocked." };
}

async function resendApproval(body: Record<string, unknown>, supabase: ReturnType<typeof adminClient>) {
  const requestId = String(body.requestId || "");
  const browserHash = await hmac(String(body.browserSecret || ""), "login-browser");
  const { data: request, error } = await supabase.from("login_approval_requests").select("*")
    .eq("id", requestId).eq("browser_secret_hash", browserHash).maybeSingle();
  if (error) throw error;
  if (!request || request.status !== "pending") throw new PublicError("This login request is unavailable.", 404);
  if (request.resend_count >= 5) throw new PublicError("The resend limit was reached. Start a new login request.", 429);
  const wait = Math.ceil((new Date(request.resend_available_at).getTime() - Date.now()) / 1000);
  if (wait > 0) throw new PublicError(`Please wait ${wait} seconds before resending.`, 429, wait);
  const allowToken = randomToken();
  const denyToken = randomToken();
  const now = new Date();
  const resendCount = request.resend_count + 1;
  const expiresAt = new Date(now.getTime() + REQUEST_LIFETIME_SECONDS * 1000);
  const { error: updateError } = await supabase.from("login_approval_requests").update({
    allow_token_hash: await hmac(allowToken, "login-allow"),
    deny_token_hash: await hmac(denyToken, "login-deny"),
    resend_count: resendCount,
    expires_at: expiresAt.toISOString(),
    resend_available_at: new Date(now.getTime() + RESEND_COOLDOWN_SECONDS * 1000).toISOString(),
  }).eq("id", request.id).eq("status", "pending");
  if (updateError) throw updateError;
  await sendApprovalEmail(request.destination, request.id, allowToken, denyToken, {
    time: new Date(request.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila", timeZoneName: "short" }),
    device: request.device_description,
    ip: request.ip_address || "Unavailable",
    location: request.approximate_location || "Unavailable",
  }, resendCount);
  await recordEvent(supabase, request.user_id, "Login Approval Resent", request.id, "The login approval email was resent.");
  return { status: "pending", expiresIn: REQUEST_LIFETIME_SECONDS, resendAfter: RESEND_COOLDOWN_SECONDS };
}

async function finalizeLogin(body: Record<string, unknown>, supabase: ReturnType<typeof adminClient>) {
  const requestId = String(body.requestId || "");
  const browserHash = await hmac(String(body.browserSecret || ""), "login-browser");
  const { data: claimed, error } = await supabase.rpc("medtrack_claim_login_approval", {
    p_request_id: requestId,
    p_browser_secret_hash: browserHash,
  });
  if (error) throw error;
  const request = Array.isArray(claimed) ? claimed[0] : null;
  if (!request) throw new PublicError("This login request is not approved or is no longer available.", 409);
  const password = String(body.password || "");
  const { result } = await verifyCredentials(request.destination, password);
  if (result.error || !result.data.session || !result.data.user || result.data.user.id !== request.user_id) {
    await supabase.from("login_approval_requests").update({ status: "denied", decided_at: new Date().toISOString() }).eq("id", request.id).eq("status", "finalizing");
    await recordEvent(supabase, request.user_id, "Login Finalization Failed", request.id, "An approved login failed final credential verification.");
    throw new PublicError("Unable to complete the approved login. Start again.", 401);
  }
  const session = result.data.session;
  const claims = tokenFromJwt(session.access_token);
  const { error: approvedError } = await supabase.from("approved_sessions").insert({
    session_id: claims.session_id,
    user_id: request.user_id,
    approval_request_id: request.id,
    approved_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + APPROVED_SESSION_SECONDS * 1000).toISOString(),
  });
  if (approvedError) throw approvedError;
  const { error: completeError } = await supabase.from("login_approval_requests").update({
    status: "completed",
    completed_at: new Date().toISOString(),
  }).eq("id", request.id).eq("status", "finalizing");
  if (completeError) throw completeError;

  let trustedDeviceToken = "";
  if (Boolean(body.trustDevice)) {
    trustedDeviceToken = randomToken();
    const device = safeText(body.userAgent, 240, "Unknown browser or device");
    const { error: trustError } = await supabase.from("trusted_devices").insert({
      user_id: request.user_id,
      token_hash: await hmac(trustedDeviceToken, "trusted-device"),
      user_agent_hash: await hmac(device, "trusted-user-agent"),
      device_description: device,
      expires_at: new Date(Date.now() + TRUST_LIFETIME_SECONDS * 1000).toISOString(),
    });
    if (trustError) throw trustError;
  }
  await recordEvent(supabase, request.user_id, "Login", request.id, "Login completed after Gmail approval.");
  return { status: "completed", session, trustedDeviceToken };
}

async function cancelLogin(body: Record<string, unknown>, supabase: ReturnType<typeof adminClient>) {
  const requestId = String(body.requestId || "");
  const browserHash = await hmac(String(body.browserSecret || ""), "login-browser");
  const { data: request } = await supabase.from("login_approval_requests").update({
    status: "denied",
    decided_at: new Date().toISOString(),
  }).eq("id", requestId).eq("browser_secret_hash", browserHash).eq("status", "pending").select("id, user_id").maybeSingle();
  if (request) await recordEvent(supabase, request.user_id, "Login Cancelled", request.id, "The originating browser cancelled a pending login.");
  return { status: "denied" };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > 32 * 1024) {
      throw new PublicError("Request body is too large.", 413);
    }
    const body = JSON.parse(text || "{}");
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new PublicError("Invalid request.");
    requireProxy(body);
    const supabase = adminClient();
    const action = String(body.action || "");
    let result;
    if (action === "begin") result = await beginLogin(body, supabase);
    else if (action === "status") result = await statusForBrowser(body, supabase);
    else if (action === "decide") result = await decideLogin(body, supabase);
    else if (action === "resend") result = await resendApproval(body, supabase);
    else if (action === "finalize") result = await finalizeLogin(body, supabase);
    else if (action === "cancel") result = await cancelLogin(body, supabase);
    else throw new PublicError("Unsupported login approval operation.", 400);
    return json(result);
  } catch (error) {
    console.error("Login approval request failed:", error);
    const publicError = error instanceof PublicError ? error : null;
    return json({
      error: publicError?.message || "Unable to complete login approval securely.",
      ...(publicError?.retryAfter ? { retryAfter: publicError.retryAfter } : {}),
    }, publicError?.status || 500);
  }
});
