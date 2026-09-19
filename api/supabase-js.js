const { createHash } = require("node:crypto");

const LIBRARY_URL =
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/dist/umd/supabase.min.js";
const EXPECTED_SHA384 =
    "JBR+x8blGwjDRO63aHCGiZMD4VNiTR4ZUGA+N6ZKLf3zNt1fK8IBpcgPaMrxqWBp";

module.exports = async function handler(request, response) {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");

    if (!request || !["GET", "HEAD"].includes(request.method)) {
        response.setHeader("Allow", "GET, HEAD");
        return response.status(405).send("Method not allowed.");
    }

    try {
        const upstream = await fetch(LIBRARY_URL, {
            headers: { Accept: "application/javascript" }
        });

        if (!upstream.ok) {
            throw new Error(`Library source returned ${upstream.status}.`);
        }

        const bytes = Buffer.from(await upstream.arrayBuffer());
        const digest = createHash("sha384").update(bytes).digest("base64");

        if (digest !== EXPECTED_SHA384) {
            throw new Error("Library integrity verification failed.");
        }

        response.setHeader("Content-Type", "application/javascript; charset=utf-8");
        response.setHeader(
            "Cache-Control",
            "public, max-age=86400, s-maxage=31536000, immutable"
        );
        response.setHeader("Content-Length", String(bytes.length));

        if (request.method === "HEAD") {
            return response.status(200).end();
        }

        return response.status(200).send(bytes);
    } catch (error) {
        console.error("Supabase browser library proxy failed:", error);
        response.setHeader("Cache-Control", "no-store");
        return response.status(502).send(
            "The secure login dependency is temporarily unavailable."
        );
    }
};
