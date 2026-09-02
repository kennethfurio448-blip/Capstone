// =====================================
// MEDTRACK ADMIN DASHBOARD
// =====================================

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
        await window.medtrackAuth.requireRoles(["admin"]);

    if (!currentUser) {
        return;
    }

    // Display Admin name
    const displayName =
        currentUser.fullname ||
        currentUser.username ||
        "Administrator";

    if (currentUserName) {
        currentUserName.textContent = displayName;
    }

    if (welcomeName) {
        welcomeName.textContent = displayName;
    }

    // Admin dashboard search
    if (searchInput) {
        searchInput.addEventListener("input", function () {
            const searchValue =
                searchInput.value.trim().toLowerCase();

            const searchableElements =
                document.querySelectorAll(
                    ".stat-card, .alert-item, .action-button"
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

    // Notification button
    if (notificationButton) {
        notificationButton.addEventListener("click", function () {
            alert("You have 4 inventory notifications.");
        });
    }

    // Logout Admin
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
