(function () {
    "use strict";

    let deferredInstallPrompt = null;

    function ensureMetadata() {
        if (!document.querySelector("link[rel='manifest']")) {
            const manifest = document.createElement("link");
            manifest.rel = "manifest";
            manifest.href = "/manifest.webmanifest";
            document.head.appendChild(manifest);
        }

        if (!document.querySelector("meta[name='theme-color']")) {
            const theme = document.createElement("meta");
            theme.name = "theme-color";
            theme.content = "#071a4f";
            document.head.appendChild(theme);
        }
    }

    function installButton() {
        return document.getElementById("installMedTrack");
    }

    window.addEventListener("beforeinstallprompt", function (event) {
        event.preventDefault();
        deferredInstallPrompt = event;
        const button = installButton();
        if (button) button.hidden = false;
    });

    window.addEventListener("appinstalled", function () {
        deferredInstallPrompt = null;
        const button = installButton();
        if (button) button.hidden = true;
    });

    window.addEventListener("DOMContentLoaded", function () {
        const button = installButton();
        if (!button) return;
        button.addEventListener("click", async function () {
            if (!deferredInstallPrompt) return;
            button.disabled = true;
            try {
                await deferredInstallPrompt.prompt();
                await deferredInstallPrompt.userChoice;
                deferredInstallPrompt = null;
                button.hidden = true;
            } finally {
                button.disabled = false;
            }
        });
    }, { once: true });

    window.addEventListener("online", function () {
        if (
            window.medtrackData &&
            typeof window.medtrackData.syncPending === "function"
        ) {
            window.medtrackData.syncPending();
        }
    });

    ensureMetadata();

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
