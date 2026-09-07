// =====================================
// MEDTRACK DATA ANALYTICS
// =====================================

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

        setText("supplyTotal", supplies.length);
        setText("equipmentTotal", equipment.length);
        setText("mobilityTotal", mobility.length);
        setText("alertTotal", totalAlerts);

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
    }

    function setText(elementId, value) {
        const element = document.getElementById(elementId);

        if (element) {
            element.textContent = value;
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
