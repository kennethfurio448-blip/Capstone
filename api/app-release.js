"use strict";

module.exports = async function handler(request, response) {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");

    if (!request || !["GET", "HEAD"].includes(request.method)) {
        response.setHeader("Allow", "GET, HEAD");
        return response.status(405).json({ error: "Method not allowed." });
    }

    const payload = {
        application: "MedTrack",
        installation: "pwa",
        officialOrigin: "https://www.medtrackmanagement.com",
        windows: {
            available: false,
            reason: "Unsigned installers are not publicly distributed."
        },
        browser: {
            available: true,
            installation: "pwa",
            updates: "automatic"
        }
    };

    response.setHeader("Cache-Control", "public, max-age=300, s-maxage=900");
    if (request.method === "HEAD") return response.status(200).end();
    return response.status(200).json(payload);
};
