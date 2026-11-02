(function () {
    "use strict";

    const PAGE_VERSION = "1.0.2";

    function element(id) {
        return document.getElementById(id);
    }

    function showMessage(message, isError) {
        const panel = element("downloadMessage");
        panel.textContent = message;
        panel.classList.toggle("error", Boolean(isError));
        panel.hidden = false;
    }

    function clearMessage() {
        element("downloadMessage").hidden = true;
    }

    function detectPlatform() {
        const agent = navigator.userAgent.toLowerCase();
        if (/android/.test(agent)) return "android";
        if (/windows/.test(agent)) return "windows";
        return "pwa";
    }

    function recommendPlatform(platform) {
        document.querySelectorAll(".platform-card").forEach(function (card) {
            const recommended = card.dataset.platform === platform;
            card.classList.toggle("recommended", recommended);
            const badge = card.querySelector(".recommended-badge");
            if (badge) badge.hidden = !recommended;
        });

        const title = element("recommendationTitle");
        const text = element("recommendationText");
        if (platform === "windows") {
            title.textContent = "Windows application recommended";
            text.textContent = "This device can use the official 64-bit MedTrack Windows installer.";
        } else if (platform === "android") {
            title.textContent = "Browser installation recommended for Android";
            text.textContent = "Use Chrome's Install app or Add to Home screen option. A signed APK is not currently available.";
        } else {
            title.textContent = "Browser installation recommended";
            text.textContent = "Use a supported Edge or Chrome browser to install MedTrack as a PWA.";
        }
    }

    function updatePwaControls() {
        const button = element("installPwa");
        const note = element("pwaAvailability");
        const installer = window.medtrackPwaInstall;

        if (installer && installer.isInstalled()) {
            button.disabled = true;
            button.innerHTML = '<i class="fa-solid fa-circle-check" aria-hidden="true"></i> MedTrack is Installed';
            note.textContent = "This browser profile is already running MedTrack as an installed application.";
            return;
        }

        const available = Boolean(installer && installer.isAvailable());
        button.disabled = !available;
        button.innerHTML = '<i class="fa-solid fa-arrow-down-to-bracket" aria-hidden="true"></i> Install MedTrack';
        note.textContent = available
            ? "The browser installation prompt is ready for this device."
            : "If the install prompt is unavailable, open the browser menu and select Install app or Add to Home screen.";
    }

    async function installPwa() {
        const installer = window.medtrackPwaInstall;
        if (!installer || !installer.isAvailable()) {
            showMessage("The automatic installation prompt is not available. Use your browser menu and select Install app or Add to Home screen.", true);
            return;
        }

        clearMessage();
        const button = element("installPwa");
        button.disabled = true;
        try {
            const result = await installer.promptInstall();
            if (result.outcome === "accepted") {
                showMessage("MedTrack installation was accepted. The application will appear in your apps or on your home screen.", false);
            } else {
                showMessage("Installation was not completed. You can start it again from the browser menu when ready.", true);
            }
        } catch (error) {
            console.error("PWA installation failed:", error);
            showMessage("The browser could not start installation. Please use its Install app or Add to Home screen option.", true);
        }
        updatePwaControls();
    }

    async function loadRelease(showResult) {
        const button = element("checkUpdates");
        button.disabled = true;
        if (showResult) clearMessage();

        try {
            const response = await fetch("/api/app-release", {
                headers: { Accept: "application/json" },
                cache: "no-store"
            });
            if (!response.ok) throw new Error(`Release service returned ${response.status}.`);
            const release = await response.json();
            element("windowsVersion").textContent = release.version || PAGE_VERSION;
            element("windowsFileSize").textContent = release.windows && release.windows.sizeLabel
                ? release.windows.sizeLabel
                : "117.43 MB";

            if (showResult) {
                if (release.version && release.version !== PAGE_VERSION) {
                    showMessage(`MedTrack ${release.version} is available. Select Download for Windows to get the update.`, false);
                } else {
                    showMessage(`MedTrack ${PAGE_VERSION} is the latest available Windows version.`, false);
                }
            }
        } catch (error) {
            console.error("Release check failed:", error);
            if (showResult) {
                showMessage("The update service is temporarily unavailable. The verified MedTrack 1.0.2 download remains available.", true);
            }
        } finally {
            button.disabled = false;
        }
    }

    function bindControls() {
        element("installPwa").addEventListener("click", installPwa);
        element("checkUpdates").addEventListener("click", function () {
            loadRelease(true);
        });
        element("downloadWindows").addEventListener("click", function (event) {
            if (navigator.onLine) {
                clearMessage();
                return;
            }
            event.preventDefault();
            showMessage("Connect to the internet before downloading the Windows installer.", true);
        });
        window.addEventListener("medtrack:pwa-install-availability", updatePwaControls);
        window.addEventListener("online", function () {
            clearMessage();
            loadRelease(false);
        });
        window.addEventListener("offline", function () {
            showMessage("MedTrack is offline. Installation downloads and update checks require an internet connection.", true);
        });
    }

    async function initialize() {
        if (!window.medtrackAuth) return;
        const profile = await window.medtrackAuth.requireRoles(["admin", "staff"]);
        if (!profile) return;

        element("currentUserRole").textContent = profile.role;
        recommendPlatform(detectPlatform());
        bindControls();
        updatePwaControls();
        if (!navigator.onLine) {
            showMessage("MedTrack is offline. Installation downloads and update checks require an internet connection.", true);
        } else {
            loadRelease(false);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, { once: true });
    } else {
        initialize();
    }
}());
