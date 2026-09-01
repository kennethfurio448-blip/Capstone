// =====================================
// MEDTRACK ADMIN DASHBOARD
// =====================================

document.addEventListener("DOMContentLoaded", function () {
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

    // Get the currently logged-in account
    function getCurrentUser() {
        const savedUser =
            localStorage.getItem("medtrackCurrentUser") ||
            sessionStorage.getItem("medtrackCurrentUser");

        if (!savedUser) {
            return null;
        }

        try {
            return JSON.parse(savedUser);
        } catch (error) {
            return null;
        }
    }

    const currentUser = getCurrentUser();

    // No logged-in account
    if (!currentUser) {
        window.location.replace("login.html");
        return;
    }

    // Staff cannot access the Admin dashboard
    if (currentUser.role !== "admin") {
        window.location.replace("staff-dashboard.html");
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
        logoutButton.addEventListener("click", function () {
            const confirmLogout = confirm(
                "Are you sure you want to log out?"
            );

            if (!confirmLogout) {
                return;
            }

            // Remove only the login session.
            // Registered accounts will not be deleted.
            localStorage.removeItem("medtrackCurrentUser");
            sessionStorage.removeItem("medtrackCurrentUser");

            window.location.replace("login.html");
        });
    }
});