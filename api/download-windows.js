"use strict";

const RELEASE_API_URL =
    "https://api.github.com/repos/kennethfurio448-blip/Capstone/releases/latest";
const VERIFIED_FALLBACK_URL =
    "https://github.com/kennethfurio448-blip/Capstone/releases/download/v1.0.1/MedTrack-Setup-1.0.1.exe";

function allowedDownloadUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === "https:" &&
            url.hostname === "github.com" &&
            url.pathname.startsWith("/kennethfurio448-blip/Capstone/releases/download/") &&
            /\/MedTrack-Setup-[^/]+\.exe$/i.test(url.pathname);
    } catch (_error) {
        return false;
    }
}

module.exports = async function handler(request, response) {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");

    if (!request || !["GET", "HEAD"].includes(request.method)) {
        response.setHeader("Allow", "GET, HEAD");
        return response.status(405).send("Method not allowed.");
    }

    let downloadUrl = VERIFIED_FALLBACK_URL;

    try {
        const upstream = await fetch(RELEASE_API_URL, {
            headers: {
                Accept: "application/vnd.github+json",
                "User-Agent": "MedTrack-Download-Center"
            },
            signal: AbortSignal.timeout(5000)
        });
        if (!upstream.ok) throw new Error(`GitHub returned ${upstream.status}.`);

        const result = await upstream.json();
        const installer = Array.isArray(result.assets)
            ? result.assets.find(function (asset) {
                return /^MedTrack-Setup-.*\.exe$/i.test(String(asset.name || ""));
            })
            : null;
        if (installer && allowedDownloadUrl(installer.browser_download_url)) {
            downloadUrl = installer.browser_download_url;
        }
    } catch (error) {
        console.warn("Using the verified MedTrack installer fallback:", error.message);
    }

    response.setHeader("Cache-Control", "public, max-age=300, s-maxage=900");
    response.setHeader("Location", downloadUrl);
    return response.status(302).end();
};
