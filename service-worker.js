"use strict";

const CACHE_NAME = "medtrack-shell-v6-clean-ui";
const APP_SHELL = [
    "/",
    "/index.html",
    "/landing.css",
    "/app-shell.css",
    "/manifest.webmanifest",
    "/medtrack-icon.svg",
    "/pwa.js",
    "/pwa.css",
    "/auth/offline-store.js",
    "/auth/supabase-client.js",
    "/auth/supabase-auth.js",
    "/auth/supabase-data.js",
    "/login/login.html",
    "/login/login.css",
    "/login/login-app.js",
    "/admin-dashboard.html",
    "/admin-dashboard.css",
    "/admin-dashboard.js",
    "/analytics.js",
    "/staff-dashboard.html",
    "/staff-dashboard.css",
    "/staff-dashboard.js",
    "/available-items.html",
    "/available-items.css",
    "/available-items.js",
    "/medical-supplies.html",
    "/medical-supplies.css",
    "/medical-supplies.js",
    "/medical-equipment.html",
    "/medical-equipment.css",
    "/medical-equipment.js",
    "/mobility.html",
    "/mobility.css",
    "/mobility.js",
    "/borrow-return.html",
    "/borrow-return.css",
    "/borrow-return.js",
    "/emergency-response.html",
    "/emergency-response.css",
    "/emergency-response.js",
    "/reports.html",
    "/reports.css",
    "/reports.js",
    "/audit-logs.html",
    "/audit-logs.css",
    "/audit-logs.js",
    "/manage-users.html",
    "/manage-users.css",
    "/manage-users.js",
    "/settings.html",
    "/settings.css",
    "/settings.js"
];
const SUPABASE_LIBRARY = "/api/supabase-js";

self.addEventListener("install", function (event) {
    event.waitUntil((async function () {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(APP_SHELL);

        try {
            await cache.add(SUPABASE_LIBRARY);
        } catch (error) {
            console.warn("The Supabase library could not be pre-cached.", error);
        }

        await self.skipWaiting();
    })());
});

self.addEventListener("activate", function (event) {
    event.waitUntil((async function () {
        const names = await caches.keys();
        await Promise.all(
            names
                .filter(function (name) {
                    return name.startsWith("medtrack-shell-") &&
                        name !== CACHE_NAME;
                })
                .map(function (name) {
                    return caches.delete(name);
                })
        );
        await self.clients.claim();
    })());
});

async function cacheFirst(request) {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;

    const response = await fetch(request);
    if (response && (response.ok || response.type === "opaque")) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
    }
    return response;
}

async function networkFirst(request) {
    try {
        const response = await fetch(request);
        if (response && response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        const cached = await caches.match(request, { ignoreSearch: true });
        if (cached) return cached;
        return caches.match("/login/login.html");
    }
}

self.addEventListener("fetch", function (event) {
    const request = event.request;
    if (request.method !== "GET") return;

    const url = new URL(request.url);
    if (url.origin === self.location.origin && url.pathname === SUPABASE_LIBRARY) {
        event.respondWith(cacheFirst(request));
        return;
    }

    if (url.origin !== self.location.origin) return;

    if (request.mode === "navigate") {
        event.respondWith(networkFirst(request));
        return;
    }

    if (
        url.pathname.startsWith("/auth/") ||
        url.pathname.startsWith("/login/") ||
        url.pathname === "/pwa.js"
    ) {
        event.respondWith(networkFirst(request));
        return;
    }

    event.respondWith(cacheFirst(request));
});
