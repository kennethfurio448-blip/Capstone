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
        if (navigation && !navigation.querySelector('a[href="trash-bin.html"]')) {
            const trashLink = document.createElement("a");
            trashLink.href = "trash-bin.html";
            trashLink.className = "nav-item";
            trashLink.innerHTML =
                '<i class="fa-solid fa-trash-can-arrow-up" aria-hidden="true"></i>' +
                '<span>Trash Bin</span>';
            if (window.location.pathname.endsWith("/trash-bin.html")) {
                trashLink.classList.add("active");
                trashLink.setAttribute("aria-current", "page");
            }
            const adminNavigation = navigation.querySelector(".admin-navigation");
            navigation.insertBefore(trashLink, adminNavigation || null);
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
