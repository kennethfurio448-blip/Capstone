
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

    if (window.medtrackData) {
        await window.medtrackData.refresh();
    }

    loadSystemUserTotal();

    async function loadSystemUserTotal() {
        const userTotal = document.getElementById("userTotal");

        if (!userTotal || !window.medtrackSupabase) {
            return;
        }

        try {
            const result =
                await window.medtrackSupabase.functions.invoke(
                    "dynamic-worker",
                    { body: { action: "list" } }
                );

            if (result.error || (result.data && result.data.error)) {
                throw result.error || new Error(result.data.error);
            }

            const users = Array.isArray(result.data && result.data.users)
                ? result.data.users
                : [];

            userTotal.textContent = users.length;
        } catch (error) {
            console.error("Unable to load the system user total:", error);
            userTotal.textContent = "\u2014";
            userTotal.title = "User total is currently unavailable";
        }
    }

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
