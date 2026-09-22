module.exports = function handler(request, response) {
    response.setHeader("Cache-Control", "no-store, max-age=0");
    response.setHeader("X-Content-Type-Options", "nosniff");

    if (request.method !== "GET") {
        return response.status(405).json({ error: "Method not allowed." });
    }

    const siteKey = String(process.env.TURNSTILE_SITE_KEY || "").trim();
    const secretConfigured =
        String(process.env.TURNSTILE_SECRET_KEY || "").trim().length >= 20;

    return response.status(200).json({
        turnstileSiteKey: secretConfigured ? siteKey : ""
    });
};
