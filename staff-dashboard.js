
document.addEventListener("DOMContentLoaded", async function () {
    const currentUserName =
        document.getElementById("currentUserName");

    const welcomeName =
        document.getElementById("welcomeName");

    const logoutButton =
        document.getElementById("logoutButton");

    const searchInput =
        document.querySelector(".search-box input");

    const notificationButton =
        document.querySelector(".notification-button");

    const currentUser =
        await window.medtrackAuth.requireRoles(["staff"]);

    if (!currentUser) {
        return;
    }

    if (window.medtrackData) {
        await window.medtrackData.refresh();
    }

    const displayName =
        currentUser.fullname ||
        currentUser.username ||
        "Staff Member";

    if (currentUserName) {
        currentUserName.textContent = displayName;
    }

    if (welcomeName) {
        welcomeName.textContent = displayName;
    }

    if (searchInput) {
        searchInput.addEventListener("input", function () {
            const searchValue =
                searchInput.value.trim().toLowerCase();

            const searchableElements =
                document.querySelectorAll(
                    ".stat-card, .operation-button, " +
                    ".alert-item, .activity-table tbody tr"
                );

            searchableElements.forEach(function (element) {
                const elementText =
                    element.textContent.toLowerCase();

                if (
                    searchValue === "" ||
                    elementText.includes(searchValue)
                ) {
                    element.style.display = "";
                } else {
                    element.style.display = "none";
                }
            });
        });
    }

    if (notificationButton) {
        notificationButton.addEventListener("click", function () {
            const alertsSection =
                document.getElementById("inventoryAlertsSection");

            if (alertsSection) {
                alertsSection.scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                });
                alertsSection.focus({ preventScroll: true });
            }
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener("click", async function () {
            const confirmLogout = confirm(
                "Are you sure you want to log out?"
            );

            if (!confirmLogout) {
                return;
            }

            await window.medtrackAuth.signOutAndRedirect();
        });
    }
});
