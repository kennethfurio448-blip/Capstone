"use strict";

const RELEASE_API_URL =
    "https://api.github.com/repos/kennethfurio448-blip/Capstone/releases/latest";
const FALLBACK_RELEASE = Object.freeze({
    version: "1.0.1",
    sizeBytes: 123136086,
    publishedAt: "2026-11-01T11:09:47Z"
});

function sizeLabel(bytes) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

module.exports = async function handler(request, response) {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");

    if (!request || !["GET", "HEAD"].includes(request.method)) {
        response.setHeader("Allow", "GET, HEAD");
        return response.status(405).json({ error: "Method not allowed." });
    }

    let release = FALLBACK_RELEASE;

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

        if (installer) {
            release = {
                version: String(result.tag_name || "").replace(/^v/i, "") || FALLBACK_RELEASE.version,
                sizeBytes: Number(installer.size) || FALLBACK_RELEASE.sizeBytes,
                publishedAt: result.published_at || FALLBACK_RELEASE.publishedAt
            };
        }
    } catch (error) {
        console.warn("Using the verified MedTrack release fallback:", error.message);
    }

    const payload = {
        application: "MedTrack",
        version: release.version,
        publishedAt: release.publishedAt,
        windows: {
            available: true,
            architecture: "64-bit",
            sizeBytes: release.sizeBytes,
            sizeLabel: sizeLabel(release.sizeBytes),
            downloadUrl: "/api/download-windows"
        },
        android: {
            apkAvailable: false,
            installation: "pwa"
        }
    };

    response.setHeader("Cache-Control", "public, max-age=300, s-maxage=900");
    if (request.method === "HEAD") return response.status(200).end();
    return response.status(200).json(payload);
};
