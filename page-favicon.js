(function () {
    "use strict";

    let favicon = document.querySelector("link[data-medtrack-page-favicon]");

    if (!favicon) {
        favicon = document.createElement("link");
        favicon.rel = "icon";
        favicon.type = "image/png";
        favicon.dataset.medtrackPageFavicon = "true";
        document.head.appendChild(favicon);
    }

    favicon.href = "/assets/pdrrmo-logo.png?v=20260923-pdrrmo";
})();
