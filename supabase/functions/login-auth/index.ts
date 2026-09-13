import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const GMAIL_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@gmail\.com$/i;
const USERNAME_PATTERN = /^[a-z0-9._ -]{4,32}$/i;

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

async function hmac(value: string, context: string) {
  const pepper = Deno.env.get("LOGIN_SECURITY_PEPPER");
  if (!pepper || pepper.length < 32) {
    throw new Error("Login security pepper must contain at least 32 characters.");
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
  if (expected.length < 32 || received.length < 32 || !constantTimeEqual(expected, received)) {
    throw new PublicError("Login service is unavailable.", 503);
  }
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
    throw new PublicError("Too many login attempts. Please try again later.", 429, retryAfter);
  }
}

async function recordEvent(
  supabase: ReturnType<typeof adminClient>,
  userId: string | null,
  action: string,
  entityId: string,
  details: string,
  metadata: Record<string, unknown>,
) {
  const { error } = await supabase.from("audit_events").insert({
    actor_id: userId,
    action,
    module: "Authentication",
    entity_type: "session",
    entity_id: entityId,
    details,
    metadata: { source: "password_login", ...metadata },
  });
  if (error) console.error("Unable to record login audit event:", error);
}

async function resolveEmail(supabase: ReturnType<typeof adminClient>, identifier: string) {
  const { data, error } = await supabase.rpc("medtrack_resolve_login_email", {
    p_identifier: identifier,
  });
  if (error) throw error;
  return String(data || "").trim().toLowerCase();
}

async function signIn(body: Record<string, unknown>) {
  const supabase = adminClient();
  const identifier = safeText(body.identifier, 254).toLowerCase();
  const password = String(body.password || "");
  const ip = safeText(body.clientIp, 64, "Unavailable");
  const device = safeText(body.userAgent, 240, "Unknown browser or device");
  const location = safeText(body.approximateLocation, 100, "Unavailable");
  const metadata = { device, ip, location };

  if ((!GMAIL_PATTERN.test(identifier) && !USERNAME_PATTERN.test(identifier)) || password.length < 1 || password.length > 128) {
    throw new PublicError("Email, username, or password is incorrect.", 401);
  }

  await enforceRateLimit(supabase, "login-ip", `ip:${ip}`, 20, 900, 900);
  await enforceRateLimit(supabase, "login-identifier", `identifier:${identifier}`, 10, 900, 900);

  const email = await resolveEmail(supabase, identifier);
  const accountKey = email || identifier;
  const accountHash = await hmac(accountKey, "login-account");
  const security = await supabase.rpc("medtrack_login_security_check", { p_email_hash: accountHash });
  if (security.error) throw security.error;
  if (!security.data?.allowed) {
    const retryAfter = Math.max(1, Number(security.data?.retryAfter) || 900);
    throw new PublicError("This account is temporarily locked. Please try again later.", 423, retryAfter);
  }

  if (!email) {
    await supabase.rpc("medtrack_login_security_failure", { p_email_hash: accountHash });
    await recordEvent(supabase, null, "Login Failed", accountHash.slice(0, 16), "A login failed because the credentials were invalid.", metadata);
    throw new PublicError("Email, username, or password is incorrect.", 401);
  }

  const client = credentialClient();
  const result = await client.auth.signInWithPassword({ email, password });
  if (result.error || !result.data.user || !result.data.session) {
    const failed = await supabase.rpc("medtrack_login_security_failure", { p_email_hash: accountHash });
    await recordEvent(supabase, null, "Login Failed", accountHash.slice(0, 16), "A login failed because the credentials were invalid.", metadata);
    if (failed.data?.locked) {
      throw new PublicError("This account is temporarily locked. Please try again later.", 423, Number(failed.data.retryAfter) || 900);
    }
    throw new PublicError("Email, username, or password is incorrect.", 401);
  }

  const user = result.data.user;
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile || profile.status !== "active" || !["admin", "staff"].includes(profile.role)) {
    await client.auth.signOut();
    await recordEvent(supabase, user.id, "Login Blocked", crypto.randomUUID(), "A login was blocked because the account is unavailable.", metadata);
    throw new PublicError("Unable to sign in with this account.", 403);
  }

  await supabase.rpc("medtrack_login_security_success", { p_email_hash: accountHash });
  await recordEvent(supabase, user.id, "Login", crypto.randomUUID(), "Login completed with a password.", metadata);
  return { session: result.data.session };
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
    return json(await signIn(body));
  } catch (error) {
    console.error("Login request failed:", error);
    const publicError = error instanceof PublicError ? error : null;
    return json({
      error: publicError?.message || "Unable to complete login securely.",
      ...(publicError?.retryAfter ? { retryAfter: publicError.retryAfter } : {}),
    }, publicError?.status || 500);
  }
});
