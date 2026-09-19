(function () {
    "use strict";

    const page = window.location.pathname.split("/").pop().toLowerCase() ||
        "index.html";
    const icons = {
        "admin-dashboard.html": "dashboard.svg",
        "staff-dashboard.html": "dashboard.svg",
        "medical-supplies.html": "medical-supplies.svg",
        "medical-equipment.html": "medical-equipment.svg",
        "mobility.html": "mobility.svg",
        "borrow-return.html": "status.svg",
        "available-items.html": "available-items.svg",
        "emergency-response.html": "emergency-response.svg",
        "manage-users.html": "manage-users.svg",
        "reports.html": "reports.svg",
        "audit-logs.html": "audit-logs.svg",
        "settings.html": "settings.svg"
    };
    const filename = icons[page] || "medtrack.svg";
    let favicon = document.querySelector("link[data-medtrack-page-favicon]");

    if (!favicon) {
        favicon = document.createElement("link");
        favicon.rel = "icon";
        favicon.type = "image/svg+xml";
        favicon.dataset.medtrackPageFavicon = "true";
        document.head.appendChild(favicon);
    }

    favicon.href = `/icons/favicons/${filename}`;
})();
