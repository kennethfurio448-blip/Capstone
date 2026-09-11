const SUPABASE_URL = process.env.SUPABASE_URL || "https://agztgijxasjypmrndvyj.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_4JmtsAj-OqKIl3r-MdWy2A_Cr-RUtIk";
const COOKIE_NAME = "__Host-medtrack_trusted_device";
const TRUST_MAX_AGE = 14 * 24 * 60 * 60;

function cookies(header) {
    return String(header || "").split(";").reduce(function (values, pair) {
        const separator = pair.indexOf("=");
        if (separator < 0) return values;
        const name = pair.slice(0, separator).trim();
        const value = pair.slice(separator + 1).trim();
        if (name) values[name] = decodeURIComponent(value);
        return values;
    }, {});
}

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

    if (request.method !== "POST") {
        return response.status(405).json({ error: "Method not allowed." });
    }
    if (!requestOriginAllowed(request)) {
        return response.status(403).json({ error: "This request origin is not allowed." });
    }

    const proxySecret = process.env.LOGIN_PROXY_SECRET || "";
    if (proxySecret.length < 32) {
        return response.status(503).json({ error: "Login approval service is not configured." });
    }

    const body = request.body && typeof request.body === "object" ? request.body : {};
    const action = String(body.action || "");
    const trustedDeviceToken = cookies(request.headers.cookie)[COOKIE_NAME] || "";
    const forwardedFor = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
    const clientIp = forwardedFor || String(request.headers["x-real-ip"] || "") || "Unavailable";
    const country = String(request.headers["x-vercel-ip-country"] || "").trim();
    const region = String(request.headers["x-vercel-ip-country-region"] || "").trim();
    const city = String(request.headers["x-vercel-ip-city"] || "").trim();
    const approximateLocation = [city, region, country].filter(Boolean).join(", ") || "Unavailable";

    try {
        const upstream = await fetch(`${SUPABASE_URL}/functions/v1/login-approval`, {
            method: "POST",
            headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                ...body,
                proxySecret,
                trustedDeviceToken,
                clientIp,
                approximateLocation,
                userAgent: String(request.headers["user-agent"] || "Unknown browser or device"),
            }),
        });
        const result = await upstream.json().catch(function () {
            return { error: "The login approval service returned an invalid response." };
        });

        if (upstream.ok && result.trustedDeviceToken) {
            response.setHeader(
                "Set-Cookie",
                `${COOKIE_NAME}=${encodeURIComponent(result.trustedDeviceToken)}; Path=/; Max-Age=${TRUST_MAX_AGE}; HttpOnly; Secure; SameSite=Strict`,
            );
            delete result.trustedDeviceToken;
        }

        if (result.retryAfter) response.setHeader("Retry-After", String(result.retryAfter));
        return response.status(upstream.status).json(result);
    } catch (error) {
        console.error("Login approval proxy failed:", error);
        return response.status(502).json({ error: "Unable to reach the login approval service." });
    }
};
