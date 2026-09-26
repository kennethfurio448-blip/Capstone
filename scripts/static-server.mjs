import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.PORT) || 3000;
let idleTimer = null;
const types = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml"
};

const server = createServer(function (request, response) {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(shutdown, 5000);
    const url = new URL(request.url || "/", `http://${request.headers.host}`);
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const relativePath = normalize(decodeURIComponent(pathname)).replace(/^[/\\]+/, "");
    const filePath = join(root, relativePath);

    if (!filePath.startsWith(root) || !existsSync(filePath) || !statSync(filePath).isFile()) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
    }

    response.writeHead(200, {
        "Content-Type": types[extname(filePath).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "no-store"
    });
    createReadStream(filePath).pipe(response);
});

server.listen(port, "127.0.0.1", function () {
    console.log(`MedTrack test server listening on http://127.0.0.1:${port}`);
    idleTimer = setTimeout(shutdown, 15000);
});

function shutdown() {
    server.close(function () {
        process.exit(0);
    });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
