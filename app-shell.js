(function () {
    "use strict";

    const collapsedStateKey = "medtrack-sidebar-collapsed";

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
            const trashLinks = Array.from(
                navigation.querySelectorAll('a[href="trash-bin.html"]')
            );
            const trashLink = trashLinks.shift() || document.createElement("a");
            trashLinks.forEach(function (duplicate) { duplicate.remove(); });
            trashLink.href = "trash-bin.html";
            trashLink.classList.add("nav-item");
            trashLink.innerHTML =
                '<i class="fa-solid fa-trash-can-arrow-up" aria-hidden="true"></i>' +
                '<span>Trash Bin</span>';
            trashLink.title = "Trash Bin";
            if (window.location.pathname.endsWith("/trash-bin.html")) {
                trashLink.classList.add("active");
                trashLink.setAttribute("aria-current", "page");
            } else {
                trashLink.classList.remove("active");
                trashLink.removeAttribute("aria-current");
            }

            const downloadLinks = Array.from(
                navigation.querySelectorAll('a[href="download-app.html"]')
            );
            const downloadLink = downloadLinks.shift() || document.createElement("a");
            downloadLinks.forEach(function (duplicate) { duplicate.remove(); });
            downloadLink.href = "download-app.html";
            downloadLink.classList.add("nav-item", "download-app-link");
            downloadLink.innerHTML =
                '<i class="fa-solid fa-download" aria-hidden="true"></i>' +
                '<span>Download App</span>';
            downloadLink.title = "Download MedTrack App";
            if (window.location.pathname.endsWith("/download-app.html")) {
                downloadLink.classList.add("active");
                downloadLink.setAttribute("aria-current", "page");
            } else {
                downloadLink.classList.remove("active");
                downloadLink.removeAttribute("aria-current");
            }

            function placeUtilityLinks() {
                const walkthrough = navigation.querySelector(".walkthrough-launch");
                if (walkthrough) {
                    if (walkthrough.nextElementSibling !== trashLink) {
                        walkthrough.insertAdjacentElement("afterend", trashLink);
                    }
                    if (trashLink.nextElementSibling !== downloadLink) {
                        trashLink.insertAdjacentElement("afterend", downloadLink);
                    }
                    return true;
                }
                if (
                    trashLink.parentElement !== navigation ||
                    downloadLink.parentElement !== navigation ||
                    trashLink.nextElementSibling !== downloadLink ||
                    downloadLink !== navigation.lastElementChild
                ) {
                    navigation.append(trashLink, downloadLink);
                }
                return false;
            }

            placeUtilityLinks();
            const navigationObserver = new MutationObserver(function () {
                if (placeUtilityLinks()) navigationObserver.disconnect();
            });
            if (!navigation.querySelector(".walkthrough-launch")) {
                navigationObserver.observe(navigation, { childList: true });
            }
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

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeSidebar, { once: true });
    } else {
        initializeSidebar();
    }
}());
