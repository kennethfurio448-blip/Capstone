
document.addEventListener("DOMContentLoaded", function () {
    function getStoredData(key) {
        try {
            const data = JSON.parse(localStorage.getItem(key));
            return Array.isArray(data) ? data : [];
        } catch (error) {
            return [];
        }
    }

    function updateDashboardAnalytics() {
        const supplies = getStoredData("medtrackMedicalSupplies");
        const equipment = getStoredData("medtrackMedicalEquipment");
        const mobility = getStoredData("medtrackMobilityAssets");
        const emergencies = getStoredData("medtrackEmergencyRequests");
        const borrowing = getStoredData("medtrackBorrowTransactions");

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const lowStockItems = supplies.filter(function (item) {
            return Number(item.quantity) <= Number(item.lowStockLevel);
        });

        const expiredItems = supplies.filter(function (item) {
            if (!item.expirationDate) {
                return false;
            }

            const expirationDate = new Date(
                item.expirationDate + "T00:00:00"
            );

            return expirationDate < today;
        });

        const overdueItems = borrowing.filter(function (item) {
            if (!item.dueDate || item.status === "Returned") {
                return false;
            }

            const dueDate = new Date(item.dueDate + "T00:00:00");
            return dueDate < today;
        });

        const totalAlerts =
            lowStockItems.length +
            expiredItems.length +
            overdueItems.length;

        const availableMobility = mobility.filter(function (item) {
            return String(item.status || "").toLowerCase() ===
                "available";
        });

        setText("supplyTotal", supplies.length);
        setText("equipmentTotal", equipment.length);
        setText("mobilityTotal", mobility.length);
        setText("alertTotal", totalAlerts);
        setText("availableMobilityTotal", availableMobility.length);
        setText("lowStockTotal", lowStockItems.length);
        updateNotificationCount(totalAlerts);

        setText("supplyOverviewCount", supplies.length);
        setText("equipmentOverviewCount", equipment.length);
        setText("mobilityOverviewCount", mobility.length);
        setText("emergencyOverviewCount", emergencies.length);

        updateProgressBars(
            supplies.length,
            equipment.length,
            mobility.length,
            emergencies.length
        );

        displayInventoryAlerts(
            lowStockItems,
            expiredItems,
            overdueItems
        );
        displayRecentActivity(borrowing);
    }

    function setText(elementId, value) {
        const element = document.getElementById(elementId);

        if (element) {
            element.textContent = value;
        }
    }

    function updateNotificationCount(totalAlerts) {
        const badge = document.getElementById("notificationCount");
        const button = document.querySelector(".notification-button");

        if (badge) {
            badge.textContent = totalAlerts > 99 ? "99+" : totalAlerts;
            badge.hidden = totalAlerts === 0;
        }

        if (button) {
            button.dataset.alertCount = String(totalAlerts);
            button.setAttribute(
                "aria-label",
                totalAlerts === 0
                    ? "No active inventory alerts"
                    : `View ${totalAlerts} active inventory ${
                        totalAlerts === 1 ? "alert" : "alerts"
                    }`
            );
        }
    }

    function updateProgressBars(
        supplies,
        equipment,
        mobility,
        emergencies
    ) {
        const largestValue = Math.max(
            supplies,
            equipment,
            mobility,
            emergencies,
            1
        );

        setProgress("supplyProgress", supplies, largestValue);
        setProgress("equipmentProgress", equipment, largestValue);
        setProgress("mobilityProgress", mobility, largestValue);
        setProgress("emergencyProgress", emergencies, largestValue);
    }

    function setProgress(elementId, value, largestValue) {
        const progress = document.getElementById(elementId);

        if (progress) {
            const percentage = (value / largestValue) * 100;
            progress.style.width = percentage + "%";
        }
    }

    function displayInventoryAlerts(
        lowStockItems,
        expiredItems,
        overdueItems
    ) {
        const container =
            document.getElementById("inventoryAlerts");

        if (!container) {
            return;
        }

        const alerts = [];

        lowStockItems.forEach(function (item) {
            alerts.push(`
                <div class="alert-item">
                    <div class="alert-icon danger">
                        <i class="fa-solid fa-arrow-trend-down"></i>
                    </div>

                    <div>
                        <strong>Low Stock</strong>
                        <p>${escapeHTML(item.name)}</p>
                    </div>

                    <span class="alert-status danger-text">
                        ${Number(item.quantity)} left
                    </span>
                </div>
            `);
        });

        expiredItems.forEach(function (item) {
            alerts.push(`
                <div class="alert-item">
                    <div class="alert-icon danger">
                        <i class="fa-solid fa-calendar-xmark"></i>
                    </div>

                    <div>
                        <strong>Expired Item</strong>
                        <p>${escapeHTML(item.name)}</p>
                    </div>

                    <span class="alert-status danger-text">
                        Expired
                    </span>
                </div>
            `);
        });

        overdueItems.forEach(function (item) {
            alerts.push(`
                <div class="alert-item">
                    <div class="alert-icon information">
                        <i class="fa-solid fa-clock"></i>
                    </div>

                    <div>
                        <strong>Overdue Return</strong>
                        <p>${escapeHTML(item.itemName)}</p>
                    </div>

                    <span class="alert-status information-text">
                        Overdue
                    </span>
                </div>
            `);
        });

        if (alerts.length === 0) {
            container.innerHTML = `
                <div class="alert-item">
                    <div class="alert-icon information">
                        <i class="fa-solid fa-circle-check"></i>
                    </div>

                    <div>
                        <strong>No active alerts</strong>
                        <p>All inventory records are currently okay.</p>
                    </div>
                </div>
            `;

            return;
        }

        container.innerHTML = alerts.slice(0, 4).join("");
    }

    function displayRecentActivity(transactions) {
        const tableBody = document.getElementById("recentActivityBody");

        if (!tableBody) {
            return;
        }

        const recentTransactions = [...transactions]
            .sort(function (first, second) {
                return activityDate(second) - activityDate(first);
            })
            .slice(0, 5);

        if (recentTransactions.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4">No inventory activity recorded yet.</td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = recentTransactions.map(function (item) {
            const returned = item.status === "Returned";
            const needsAttention = [
                "Missing",
                "Damaged",
                "For Repair"
            ].includes(item.status);
            const statusClass = returned
                ? "updated"
                : needsAttention
                    ? "pending"
                    : "borrowed";

            return `
                <tr>
                    <td>${
                        returned
                            ? "Item returned"
                            : needsAttention
                                ? "Status updated"
                                : "Item borrowed"
                    }</td>
                    <td>${escapeHTML(item.itemName)}</td>
                    <td>
                        <span class="status ${statusClass}">
                            ${escapeHTML(item.status || "Borrowed")}
                        </span>
                    </td>
                    <td>${formatActivityDate(item)}</td>
                </tr>
            `;
        }).join("");
    }

    function activityDate(item) {
        const value = item.returnDate || item.borrowDate;
        const date = value ? new Date(value + "T00:00:00") : null;

        return date && !Number.isNaN(date.getTime())
            ? date.getTime()
            : 0;
    }

    function formatActivityDate(item) {
        const timestamp = activityDate(item);

        if (!timestamp) {
            return "\u2014";
        }

        return new Date(timestamp).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
    }

    function escapeHTML(value) {
        const element = document.createElement("div");
        element.textContent = value || "Unnamed item";
        return element.innerHTML;
    }

    updateDashboardAnalytics();

    window.addEventListener("storage", updateDashboardAnalytics);

    window.addEventListener(
        "medtrack:data-ready",
        updateDashboardAnalytics
    );
    window.addEventListener(
        "medtrack:dataChanged",
        updateDashboardAnalytics
    );
});
