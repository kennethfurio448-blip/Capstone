(function () {
    "use strict";

    let deferredInstallPrompt = null;

    function ensureMetadata() {
        if (!document.querySelector("link[data-medtrack-pwa]")) {
            const stylesheet = document.createElement("link");
            stylesheet.rel = "stylesheet";
            stylesheet.href = "/pwa.css";
            stylesheet.dataset.medtrackPwa = "true";
            document.head.appendChild(stylesheet);
        }

        if (!document.querySelector("link[rel='manifest']")) {
            const manifest = document.createElement("link");
            manifest.rel = "manifest";
            manifest.href = "/manifest.webmanifest";
            document.head.appendChild(manifest);
        }

        if (!document.querySelector("meta[name='theme-color']")) {
            const theme = document.createElement("meta");
            theme.name = "theme-color";
            theme.content = "#b91c1c";
            document.head.appendChild(theme);
        }
    }

    function createStatusBar() {
        if (document.getElementById("medtrackConnectionBar")) return;

        const bar = document.createElement("div");
        bar.id = "medtrackConnectionBar";
        bar.className = "medtrack-connection-bar";
        bar.setAttribute("role", "status");
        bar.setAttribute("aria-live", "polite");

        const status = document.createElement("span");
        status.id = "medtrackConnectionStatus";

        const install = document.createElement("button");
        install.id = "medtrackInstallButton";
        install.type = "button";
        install.hidden = true;
        install.textContent = "Install MedTrack";

        install.addEventListener("click", async function () {
            if (!deferredInstallPrompt) return;
            deferredInstallPrompt.prompt();
            await deferredInstallPrompt.userChoice;
            deferredInstallPrompt = null;
            install.hidden = true;
        });

        bar.append(status, install);
        document.body.appendChild(bar);
        updateStatus();
    }

    function updateStatus(detail = {}) {
        const status = document.getElementById("medtrackConnectionStatus");
        const bar = document.getElementById("medtrackConnectionBar");
        if (!status || !bar) return;

        const pending = Number(detail.pending || 0);
        const state = detail.state ||
            (navigator.onLine ? "online" : "offline");
        bar.dataset.state = state;

        if (state === "syncing") {
            status.textContent = pending > 0
                ? `Syncing ${pending} pending change${pending === 1 ? "" : "s"}...`
                : "Syncing...";
        } else if (!navigator.onLine || state === "offline") {
            status.textContent = pending > 0
                ? `Offline - ${pending} change${pending === 1 ? "" : "s"} waiting to sync`
                : "Offline - cached records available";
        } else if (pending > 0) {
            status.textContent = `${pending} change${pending === 1 ? "" : "s"} waiting to sync`;
        } else {
            status.textContent = "Online - all changes saved";
        }
    }

    window.addEventListener("beforeinstallprompt", function (event) {
        event.preventDefault();
        deferredInstallPrompt = event;
        const button = document.getElementById("medtrackInstallButton");
        if (button) button.hidden = false;
    });

    window.addEventListener("online", function () {
        updateStatus({ state: "syncing" });
        if (
            window.medtrackData &&
            typeof window.medtrackData.syncPending === "function"
        ) {
            window.medtrackData.syncPending();
        }
    });
    window.addEventListener("offline", function () {
        updateStatus({ state: "offline" });
    });
    window.addEventListener("medtrack:sync-state", function (event) {
        updateStatus(event.detail || {});
    });

    ensureMetadata();
    document.addEventListener("DOMContentLoaded", createStatusBar);

    window.setTimeout(function () {
        if (!document.body || !document.body.hidden) return;

        const loginUrl = new URL("/login/login.html", window.location.origin);
        loginUrl.searchParams.set("reason", "auth-unavailable");
        window.location.replace(loginUrl.href);
    }, 20 * 1000);

    if ("serviceWorker" in navigator) {
        window.addEventListener("load", function () {
            navigator.serviceWorker.register("/service-worker.js")
                .catch(function (error) {
                    console.error("MedTrack offline installation failed:", error);
                });
        });
    }
})();
