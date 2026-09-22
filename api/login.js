const SUPABASE_URL = process.env.SUPABASE_URL || "https://agztgijxasjypmrndvyj.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_4JmtsAj-OqKIl3r-MdWy2A_Cr-RUtIk";
const MAX_REQUEST_BYTES = 32 * 1024;

function requestOriginAllowed(request) {
    const origin = request.headers.origin;
    if (!origin) return true;
    try {
        return new URL(origin).host === request.headers.host;
    } catch (error) {
        return false;
    }
}

async function verifyTurnstile(token, clientIp) {
    const secret = String(process.env.TURNSTILE_SECRET_KEY || "").trim();
    if (!secret) return true;
    if (!token || String(token).length > 2048) return false;

    const controller = new AbortController();
    const timeout = setTimeout(function () {
        controller.abort();
    }, 5000);

    try {
        const verification = await fetch(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: new URLSearchParams({
                    secret: secret,
                    response: String(token),
                    remoteip: clientIp
                }),
                signal: controller.signal
            }
        );
        const result = await verification.json();
        return Boolean(result.success) && (!result.action || result.action === "login");
    } catch (error) {
        console.error("Turnstile validation failed:", error);
        return false;
    } finally {
        clearTimeout(timeout);
    }
}

module.exports = async function handler(request, response) {
    response.setHeader("Cache-Control", "no-store, max-age=0");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("X-Content-Type-Options", "nosniff");

    if (request.method !== "POST") {
        return response.status(405).json({ error: "Method not allowed." });
    }
    if (!requestOriginAllowed(request)) {
        return response.status(403).json({ error: "This request origin is not allowed." });
    }
    if (!String(request.headers["content-type"] || "").toLowerCase().includes("application/json")) {
        return response.status(415).json({ error: "Content-Type must be application/json." });
    }

    const contentLength = Number(request.headers["content-length"] || 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
        return response.status(413).json({ error: "Request body is too large." });
    }

    const proxySecret = process.env.LOGIN_PROXY_SECRET || "";
    if (proxySecret.length < 32) {
        return response.status(503).json({ error: "Login service is not configured." });
    }

    const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
        ? request.body
        : {};
    const forwardedFor = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
    const clientIp = forwardedFor || String(request.headers["x-real-ip"] || "") || "Unavailable";
    const country = String(request.headers["x-vercel-ip-country"] || "").trim();
    const region = String(request.headers["x-vercel-ip-country-region"] || "").trim();
    const city = String(request.headers["x-vercel-ip-city"] || "").trim();
    const approximateLocation = [city, region, country].filter(Boolean).join(", ") || "Unavailable";

    if (!await verifyTurnstile(body.turnstileToken, clientIp)) {
        return response.status(403).json({
            error: "Human verification failed. Refresh the challenge and try again."
        });
    }

    try {
        const upstream = await fetch(`${SUPABASE_URL}/functions/v1/login-auth`, {
            method: "POST",
            headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                identifier: String(body.identifier || ""),
                password: String(body.password || ""),
                proxySecret,
                clientIp,
                approximateLocation,
                userAgent: String(request.headers["user-agent"] || "Unknown browser or device")
            })
        });
        const result = await upstream.json().catch(function () {
            return { error: "The login service returned an invalid response." };
        });

        if (result.retryAfter) response.setHeader("Retry-After", String(result.retryAfter));
        return response.status(upstream.status).json(result);
    } catch (error) {
        console.error("Login proxy failed:", error);
        return response.status(502).json({ error: "Unable to reach the login service." });
    }
};
