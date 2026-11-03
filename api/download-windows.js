"use strict";

module.exports = async function handler(request, response) {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");

    if (!request || !["GET", "HEAD"].includes(request.method)) {
        response.setHeader("Allow", "GET, HEAD");
        return response.status(405).json({ error: "Method not allowed." });
    }

    const message = {
        error: "The unsigned Windows installer is no longer publicly distributed.",
        safeInstallation: "Open MedTrack in Edge or Chrome and select Install app."
    };

    if (request.method === "HEAD") return response.status(410).end();
    return response.status(410).json(message);
};
