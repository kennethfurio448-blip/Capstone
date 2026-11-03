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

    function isInstalled() {
        return window.matchMedia("(display-mode: standalone)").matches ||
            window.navigator.standalone === true;
    }

    function notifyInstallAvailability() {
        window.dispatchEvent(new CustomEvent("medtrack:pwa-install-availability", {
            detail: {
                available: Boolean(deferredInstallPrompt),
                installed: isInstalled()
            }
        }));
    }

    async function waitForAvailability(timeoutMs) {
        const timeout = Number.isFinite(timeoutMs) ? Math.max(0, timeoutMs) : 5000;
        const deadline = Date.now() + timeout;

        while (!deferredInstallPrompt && !isInstalled() && Date.now() < deadline) {
            await new Promise(function (resolve) {
                window.setTimeout(resolve, 100);
            });
        }

        return {
            available: Boolean(deferredInstallPrompt),
            installed: isInstalled()
        };
    }

    async function promptInstall() {
        if (!deferredInstallPrompt) {
            return { available: false, installed: isInstalled(), outcome: "unavailable" };
        }

        const prompt = deferredInstallPrompt;
        deferredInstallPrompt = null;
        await prompt.prompt();
        const choice = await prompt.userChoice;
        notifyInstallAvailability();
        return {
            available: true,
            installed: choice.outcome === "accepted" || isInstalled(),
            outcome: choice.outcome
        };
    }

    window.medtrackPwaInstall = Object.freeze({
        isAvailable: function () { return Boolean(deferredInstallPrompt); },
        isInstalled: isInstalled,
        waitForAvailability: waitForAvailability,
        promptInstall: promptInstall
    });

    window.addEventListener("beforeinstallprompt", function (event) {
        event.preventDefault();
        deferredInstallPrompt = event;
        const button = installButton();
        if (button) button.hidden = false;
        notifyInstallAvailability();
    });

    window.addEventListener("appinstalled", function () {
        deferredInstallPrompt = null;
        const button = installButton();
        if (button) button.hidden = true;
        notifyInstallAvailability();
    });

    window.addEventListener("DOMContentLoaded", function () {
        const button = installButton();
        if (!button) return;
        button.addEventListener("click", async function () {
            if (!window.medtrackPwaInstall.isAvailable()) return;
            button.disabled = true;
            try {
                await window.medtrackPwaInstall.promptInstall();
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
        navigator.serviceWorker.register("/service-worker.js")
            .catch(function (error) {
                console.error("MedTrack offline installation failed:", error);
            });
    }
})();
