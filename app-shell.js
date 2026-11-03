(function () {
    "use strict";

    const collapsedStateKey = "medtrack-sidebar-collapsed";
    const downloadDropdownId = "medtrackDownloadDropdown";
    let activeDownloadButton = null;

    function setCollapsed(sidebar, toggleButton, isCollapsed) {
        sidebar.classList.toggle("is-collapsed", isCollapsed);
        toggleButton.setAttribute("aria-expanded", String(!isCollapsed));
        toggleButton.setAttribute(
            "aria-label",
            isCollapsed ? "Expand sidebar navigation" : "Collapse sidebar navigation"
        );
        toggleButton.title = isCollapsed ? "Expand sidebar" : "Collapse sidebar";

        try {
            window.localStorage.setItem(collapsedStateKey, String(isCollapsed));
        } catch (_error) {
            // The navigation remains usable even if browser storage is unavailable.
        }
    }

    function initializeSidebar() {
        const sidebar = document.querySelector(".sidebar");

        if (!sidebar || sidebar.querySelector(".sidebar-toggle")) {
            return;
        }

        const toggleButton = document.createElement("button");
        toggleButton.type = "button";
        toggleButton.className = "sidebar-toggle";
        toggleButton.innerHTML = '<i class="fa-solid fa-bars" aria-hidden="true"></i>';

        const brand = sidebar.querySelector(".brand");
        if (brand) {
            brand.insertBefore(toggleButton, brand.firstElementChild);
        } else {
            sidebar.insertBefore(toggleButton, sidebar.firstElementChild);
        }

        const navigation = sidebar.querySelector(".sidebar-nav");
        if (navigation) {
            navigation.querySelectorAll('a[href="trash-bin.html"]').forEach(
                function (trashLink) { trashLink.remove(); }
            );

            navigation.querySelectorAll('a[href="download-app.html"]').forEach(
                function (downloadLink) { downloadLink.remove(); }
            );
        }

        sidebar.querySelectorAll(".nav-item, .logout-button").forEach(function (item) {
            const label = item.textContent.replace(/\s+/g, " ").trim();
            if (label && !item.title) {
                item.title = label;
            }
        });

        let isCollapsed = false;
        try {
            isCollapsed = window.localStorage.getItem(collapsedStateKey) === "true";
        } catch (_error) {
            // Use the expanded layout when browser storage is unavailable.
        }

        setCollapsed(sidebar, toggleButton, isCollapsed);

        toggleButton.addEventListener("click", function () {
            setCollapsed(sidebar, toggleButton, !sidebar.classList.contains("is-collapsed"));
        });
    }

    function downloadDropdown() {
        let dropdown = document.getElementById(downloadDropdownId);
        if (dropdown) return dropdown;

        dropdown = document.createElement("section");
        dropdown.id = downloadDropdownId;
        dropdown.className = "app-download-dropdown";
        dropdown.hidden = true;
        dropdown.setAttribute("role", "dialog");
        dropdown.setAttribute("aria-label", "Install MedTrack safely");
        dropdown.innerHTML = [
            '<div class="app-download-header">',
            '  <div><strong>Install MedTrack</strong><span>Secure browser installation</span></div>',
            '  <button type="button" class="app-download-close" aria-label="Close download options">&times;</button>',
            '</div>',
            '<div class="app-download-message" role="status" aria-live="polite" hidden></div>',
            '<div class="app-download-options">',
            '  <button type="button" class="app-download-option app-download-pwa">',
            '    <span class="app-download-option-icon"><i class="fa-solid fa-window-restore" aria-hidden="true"></i></span>',
            '    <span><strong>Install Safe App</strong><small data-pwa-status>Use Edge or Chrome to install the verified MedTrack website.</small></span>',
            '    <i class="fa-solid fa-arrow-down-to-bracket app-download-action-icon" aria-hidden="true"></i>',
            '  </button>',
            '</div>',
            '<p class="app-download-safety"><i class="fa-solid fa-shield-halved" aria-hidden="true"></i> Installs from the official MedTrack domain and updates automatically. No unsigned Windows installer is downloaded.</p>'
        ].join("");
        document.body.appendChild(dropdown);

        dropdown.querySelector(".app-download-close").addEventListener("click", closeDownloadDropdown);
        dropdown.querySelector(".app-download-pwa").addEventListener("click", installPwaFromMenu);
        return dropdown;
    }

    function showDownloadMessage(message, isError) {
        const panel = downloadDropdown().querySelector(".app-download-message");
        panel.textContent = message;
        panel.classList.toggle("error", Boolean(isError));
        panel.hidden = false;
    }

    function updateDownloadControls() {
        const dropdown = downloadDropdown();
        const installer = window.medtrackPwaInstall;
        const status = dropdown.querySelector("[data-pwa-status]");
        if (installer && installer.isInstalled()) {
            status.textContent = "MedTrack is already installed in this browser profile.";
        } else if (installer && installer.isAvailable()) {
            status.textContent = "The browser installation prompt is ready.";
        } else {
            status.textContent = "Use the Edge or Chrome menu and select Install app or Add to Home screen.";
        }
    }

    async function installPwaFromMenu() {
        const installer = window.medtrackPwaInstall;
        if (!installer || !installer.isAvailable()) {
            showDownloadMessage(
                "The automatic prompt is unavailable. Open your Edge or Chrome menu and select Install app or Add to Home screen.",
                true
            );
            return;
        }
        try {
            const result = await installer.promptInstall();
            showDownloadMessage(
                result.outcome === "accepted"
                    ? "MedTrack installation was accepted and will appear in your applications."
                    : "Installation was not completed. You can try again from the browser menu.",
                result.outcome !== "accepted"
            );
        } catch (error) {
            console.error("PWA installation failed:", error);
            showDownloadMessage("The browser could not start installation. Use its Install app option instead.", true);
        }
        updateDownloadControls();
    }

    function positionDownloadDropdown() {
        const dropdown = document.getElementById(downloadDropdownId);
        if (!dropdown || dropdown.hidden || !activeDownloadButton) return;
        const rect = activeDownloadButton.getBoundingClientRect();
        const width = Math.min(380, window.innerWidth - 24);
        const left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12));
        const availableBelow = window.innerHeight - rect.bottom;
        dropdown.style.width = width + "px";
        dropdown.style.left = left + "px";
        if (availableBelow >= Math.min(500, dropdown.offsetHeight + 16)) {
            dropdown.style.top = (rect.bottom + 10) + "px";
            dropdown.style.bottom = "auto";
        } else {
            dropdown.style.top = "auto";
            dropdown.style.bottom = Math.max(12, window.innerHeight - rect.top + 10) + "px";
        }
    }

    function closeDownloadDropdown() {
        const dropdown = document.getElementById(downloadDropdownId);
        if (!dropdown || dropdown.hidden) return;
        dropdown.hidden = true;
        if (activeDownloadButton) activeDownloadButton.setAttribute("aria-expanded", "false");
        activeDownloadButton = null;
    }

    function toggleDownloadDropdown(button) {
        const dropdown = downloadDropdown();
        if (!dropdown.hidden && activeDownloadButton === button) {
            closeDownloadDropdown();
            return;
        }
        activeDownloadButton = button;
        button.setAttribute("aria-expanded", "true");
        dropdown.hidden = false;
        updateDownloadControls();
        positionDownloadDropdown();
    }

    function initializeDownloadMenu() {
        const actions = document.querySelector(".topbar-actions");
        if (!actions || actions.querySelector(".app-download-button")) return;

        let notificationButton = actions.querySelector(".notification-button");
        if (!notificationButton) {
            notificationButton = document.createElement("button");
            notificationButton.type = "button";
            notificationButton.className = "notification-button app-header-icon-button";
            notificationButton.setAttribute("aria-label", "Open notifications");
            notificationButton.innerHTML = '<i class="fa-solid fa-bell" aria-hidden="true"></i><span hidden>0</span>';
            const profile = actions.querySelector(".user-profile");
            actions.insertBefore(notificationButton, profile || null);
        } else {
            notificationButton.classList.add("app-header-icon-button");
        }

        const button = document.createElement("button");
        button.type = "button";
        button.className = "app-download-button app-header-icon-button";
        button.setAttribute("aria-label", "Download or install MedTrack");
        button.setAttribute("aria-haspopup", "dialog");
        button.setAttribute("aria-controls", downloadDropdownId);
        button.setAttribute("aria-expanded", "false");
        button.title = "Download MedTrack App";
        button.innerHTML = '<i class="fa-solid fa-download" aria-hidden="true"></i>';
        actions.insertBefore(button, notificationButton);

        const trashButton = document.createElement("a");
        trashButton.href = "trash-bin.html";
        trashButton.className = "app-trash-button app-header-icon-button";
        trashButton.setAttribute("aria-label", "Open Trash Bin");
        trashButton.title = "Trash Bin";
        trashButton.innerHTML = '<i class="fa-solid fa-trash-can-arrow-up" aria-hidden="true"></i>';
        if (window.location.pathname.endsWith("/trash-bin.html")) {
            trashButton.classList.add("is-active");
            trashButton.setAttribute("aria-current", "page");
        }
        actions.insertBefore(trashButton, button);

        button.addEventListener("click", function () { toggleDownloadDropdown(button); });
    }

    function initializeAppShell() {
        initializeSidebar();
        initializeDownloadMenu();
    }

    document.addEventListener("click", function (event) {
        const dropdown = document.getElementById(downloadDropdownId);
        if (!dropdown || dropdown.hidden) return;
        if (!(event.target instanceof Element) ||
            (!event.target.closest(".app-download-dropdown") &&
                !event.target.closest(".app-download-button"))) {
            closeDownloadDropdown();
        }
    }, true);
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") closeDownloadDropdown();
    });
    window.addEventListener("resize", positionDownloadDropdown);
    window.addEventListener("scroll", positionDownloadDropdown, true);
    window.addEventListener("medtrack:pwa-install-availability", updateDownloadControls);
    window.addEventListener("offline", function () {
        if (!document.getElementById(downloadDropdownId)) return;
        showDownloadMessage("Connect to the internet before installing MedTrack on this device.", true);
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeAppShell, { once: true });
    } else {
        initializeAppShell();
    }
}());
