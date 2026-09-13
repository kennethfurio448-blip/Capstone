const SUPABASE_URL = process.env.SUPABASE_URL || "https://agztgijxasjypmrndvyj.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_4JmtsAj-OqKIl3r-MdWy2A_Cr-RUtIk";
const LEGACY_TRUST_COOKIE = "__Host-medtrack_trusted_device";

function requestOriginAllowed(request) {
    const origin = request.headers.origin;
    if (!origin) return true;
    try {
        return new URL(origin).host === request.headers.host;
    } catch (error) {
        return false;
    }
}

module.exports = async function handler(request, response) {
    response.setHeader("Cache-Control", "no-store, max-age=0");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader(
        "Set-Cookie",
        `${LEGACY_TRUST_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`
    );

    if (request.method !== "POST") {
        return response.status(405).json({ error: "Method not allowed." });
    }
    if (!requestOriginAllowed(request)) {
        return response.status(403).json({ error: "This request origin is not allowed." });
    }

    const proxySecret = process.env.LOGIN_PROXY_SECRET || "";
    if (proxySecret.length < 32) {
        return response.status(503).json({ error: "Login service is not configured." });
    }

    const body = request.body && typeof request.body === "object" ? request.body : {};
    const forwardedFor = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
    const clientIp = forwardedFor || String(request.headers["x-real-ip"] || "") || "Unavailable";
    const country = String(request.headers["x-vercel-ip-country"] || "").trim();
    const region = String(request.headers["x-vercel-ip-country-region"] || "").trim();
    const city = String(request.headers["x-vercel-ip-city"] || "").trim();
    const approximateLocation = [city, region, country].filter(Boolean).join(", ") || "Unavailable";

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
