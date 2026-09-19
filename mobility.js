
document.addEventListener("DOMContentLoaded", async function () {


    const dashboardLink =
        document.getElementById("dashboardLink");

    const adminNavigation =
        document.getElementById("adminNavigation");

    const portalName =
        document.getElementById("portalName");

    const currentUserName =
        document.getElementById("currentUserName");

    const currentUserRole =
        document.getElementById("currentUserRole");

    const logoutButton =
        document.getElementById("logoutButton");

    const notificationButton =
        document.getElementById("notificationButton");

    const notificationCount =
        document.getElementById("notificationCount");

    const totalVehicles =
        document.getElementById("totalVehicles");

    const availableVehicles =
        document.getElementById("availableVehicles");

    const deployedVehicles =
        document.getElementById("deployedVehicles");

    const forRepairVehicles =
        document.getElementById("forRepairVehicles");

    const vehicleTableBody =
        document.getElementById("vehicleTableBody");

    const emptyState =
        document.getElementById("emptyState");

    const vehicleSearch =
        document.getElementById("vehicleSearch");

    const typeFilter =
        document.getElementById("typeFilter");

    const statusFilter =
        document.getElementById("statusFilter");

    const vehicleModal =
        document.getElementById("vehicleModal");

    const openAddModalButton =
        document.getElementById("openAddModal");

    const closeModalButton =
        document.getElementById("closeModal");

    const cancelButton =
        document.getElementById("cancelButton");

    const modalTitle =
        document.getElementById("modalTitle");

    const vehicleForm =
        document.getElementById("vehicleForm");

    const editingVehicleId =
        document.getElementById("editingVehicleId");

    const vehicleName =
        document.getElementById("vehicleName");

    const vehicleType =
        document.getElementById("vehicleType");

    const plateNumber =
        document.getElementById("plateNumber");

    const vehicleCondition =
        document.getElementById("vehicleCondition");

    const vehicleStatus =
        document.getElementById("vehicleStatus");

    const assignedDriver =
        document.getElementById("assignedDriver");

    const vehicleLocation =
        document.getElementById("vehicleLocation");

    const maintenanceDate =
        document.getElementById("maintenanceDate");

    const formMessage =
        document.getElementById("formMessage");

    const deleteModal =
        document.getElementById("deleteModal");

    const cancelDelete =
        document.getElementById("cancelDelete");

    const confirmDelete =
        document.getElementById("confirmDelete");

    let vehicleToDelete = null;


    const currentUser =
        await window.medtrackAuth.requireRoles(["admin", "staff"]);

    if (!currentUser) {
        return;
    }

    const canManageInventory =
        currentUser.role === "admin";

    if (window.medtrackData) {
        await window.medtrackData.refresh();
    }

    const displayName =
        currentUser.fullname ||
        currentUser.username ||
        "MedTrack User";

    currentUserName.textContent = displayName;
    currentUserRole.textContent = currentUser.role;

    if (currentUser.role === "admin") {
        portalName.textContent = "Admin Portal";
        dashboardLink.href = "admin-dashboard.html";
        adminNavigation.hidden = false;
    } else {
        portalName.textContent = "Staff Portal";
        dashboardLink.href = "staff-dashboard.html";
        adminNavigation.hidden = true;
    }

    openAddModalButton.hidden = !canManageInventory;


    function getVehicles() {
        const savedVehicles =
            localStorage.getItem("medtrackMobilityAssets");

        if (!savedVehicles) {
            return [];
        }

        try {
            const parsedVehicles =
                JSON.parse(savedVehicles);

            return Array.isArray(parsedVehicles)
                ? parsedVehicles.map(function (vehicle) {
                    return {
                        ...vehicle,
                        status: normalizeVehicleStatus(vehicle.status)
                    };
                })
                : [];
        } catch (error) {
            return [];
        }
    }

    function saveVehicles(vehicles) {
        localStorage.setItem(
            "medtrackMobilityAssets",
            JSON.stringify(vehicles)
        );
    }


    function escapeHTML(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function normalizeVehicleStatus(status) {
        if (["Maintenance", "Unavailable", "For Repair"].includes(status)) {
            return "For Repair";
        }

        if (["Assigned", "Deployed", "In Use"].includes(status)) {
            return "Borrowed";
        }

        return [
            "Available",
            "Borrowed",
            "Returned",
            "Missing",
            "Damaged",
            "For Repair"
        ].includes(status)
            ? status
            : "For Repair";
    }


    function formatDate(dateValue) {
        if (!dateValue) {
            return "Not scheduled";
        }

        const date = new Date(dateValue + "T00:00:00");

        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
    }

    function isMaintenanceOverdue(dateValue) {
        if (!dateValue) {
            return false;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const scheduledDate =
            new Date(dateValue + "T00:00:00");

        return scheduledDate < today;
    }


    function getStatusClass(status) {
        if (status === "Available") {
            return "status-available";
        }

        if (status === "Borrowed") {
            return "status-deployed";
        }

        if (status === "Returned") {
            return "status-available";
        }

        return "status-for-repair";
    }

    function getConditionClass(condition) {
        if (condition === "Excellent") {
            return "condition-excellent";
        }

        if (condition === "Good") {
            return "condition-good";
        }

        if (condition === "Fair") {
            return "condition-fair";
        }

        return "condition-damaged";
    }


    function generateVehicleId(vehicles) {
        let highestNumber = 0;

        vehicles.forEach(function (vehicle) {
            const number = Number(
                String(vehicle.id).replace("MOB-", "")
            );

            if (!Number.isNaN(number) && number > highestNumber) {
                highestNumber = number;
            }
        });

        return `MOB-${String(highestNumber + 1).padStart(3, "0")}`;
    }


    function renderVehicles() {
        const vehicles = getVehicles();

        const searchValue =
            vehicleSearch.value.trim().toLowerCase();

        const selectedType =
            typeFilter.value;

        const selectedStatus =
            statusFilter.value;

        const filteredVehicles = vehicles.filter(function (vehicle) {
            const matchesSearch =
                vehicle.name.toLowerCase().includes(searchValue) ||
                vehicle.type.toLowerCase().includes(searchValue) ||
                vehicle.id.toLowerCase().includes(searchValue) ||
                vehicle.plateNumber.toLowerCase().includes(searchValue) ||
                vehicle.driver.toLowerCase().includes(searchValue) ||
                vehicle.location.toLowerCase().includes(searchValue);

            const matchesType =
                selectedType === "all" ||
                vehicle.type === selectedType;

            const matchesStatus =
                selectedStatus === "all" ||
                vehicle.status === selectedStatus;

            return (
                matchesSearch &&
                matchesType &&
                matchesStatus
            );
        });

        vehicleTableBody.innerHTML = "";

        if (filteredVehicles.length === 0) {
            emptyState.classList.add("show");
        } else {
            emptyState.classList.remove("show");
        }

        filteredVehicles.forEach(function (vehicle) {
            const statusClass =
                getStatusClass(vehicle.status);

            const conditionClass =
                getConditionClass(vehicle.condition);

            const overdue =
                isMaintenanceOverdue(vehicle.maintenanceDate);

            const maintenanceDisplay = overdue
                ? `${formatDate(vehicle.maintenanceDate)} (Overdue)`
                : formatDate(vehicle.maintenanceDate);

            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${escapeHTML(vehicle.id)}</td>

                <td>
                    <strong>${escapeHTML(vehicle.name)}</strong>
                </td>

                <td>${escapeHTML(vehicle.type)}</td>

                <td>${escapeHTML(vehicle.plateNumber)}</td>

                <td>
                    <span class="condition-badge ${conditionClass}">
                        ${escapeHTML(vehicle.condition)}
                    </span>
                </td>

                <td>${escapeHTML(vehicle.driver)}</td>

                <td>${escapeHTML(vehicle.location)}</td>

                <td>
                    ${
                        overdue
                            ? `<span class="status-badge status-maintenance">
                                ${escapeHTML(maintenanceDisplay)}
                               </span>`
                            : escapeHTML(maintenanceDisplay)
                    }
                </td>

                <td>
                    <span class="status-badge ${statusClass}">
                        ${escapeHTML(vehicle.status)}
                    </span>
                </td>

                <td>
                    ${canManageInventory ? `
                    <div class="table-actions">

                        <button
                            type="button"
                            class="edit-button"
                            data-action="edit"
                            data-id="${escapeHTML(vehicle.id)}"
                            title="Edit vehicle"
                        >
                            <i class="fa-solid fa-pen"></i>
                        </button>

                        <button
                            type="button"
                            class="remove-button"
                            data-action="delete"
                            data-id="${escapeHTML(vehicle.id)}"
                            title="Delete vehicle"
                        >
                            <i class="fa-solid fa-trash"></i>
                        </button>

                    </div>
                    ` : "\u2014"}
                </td>
            `;

            vehicleTableBody.appendChild(row);
        });

        updateStatistics(vehicles);
    }


    function updateStatistics(vehicles) {
        let availableCount = 0;
        let deployedCount = 0;
        let forRepairCount = 0;
        let alertsCount = 0;

        vehicles.forEach(function (vehicle) {
            if (vehicle.status === "Available") {
                availableCount++;
            }

            if (vehicle.status === "Borrowed") {
                deployedCount++;
            }

            if (["Missing", "Damaged", "For Repair"].includes(vehicle.status)) {
                forRepairCount++;
                alertsCount++;
            }

            if (
                isMaintenanceOverdue(vehicle.maintenanceDate) &&
                vehicle.status !== "For Repair"
            ) {
                alertsCount++;
            }
        });

        totalVehicles.textContent = vehicles.length;
        availableVehicles.textContent = availableCount;
        deployedVehicles.textContent = deployedCount;
        forRepairVehicles.textContent = forRepairCount;
        notificationCount.textContent = alertsCount;
    }


    function openAddModal() {
        if (!canManageInventory) {
            return;
        }

        vehicleForm.reset();

        editingVehicleId.value = "";
        modalTitle.textContent = "Add Mobility Asset";
        formMessage.textContent = "";

        vehicleModal.classList.add("show");
        vehicleName.focus();
    }


    function openEditModal(vehicleId) {
        if (!canManageInventory) {
            return;
        }

        const vehicles = getVehicles();

        const selectedVehicle =
            vehicles.find(function (vehicle) {
                return vehicle.id === vehicleId;
            });

        if (!selectedVehicle) {
            return;
        }

        editingVehicleId.value =
            selectedVehicle.id;

        vehicleName.value =
            selectedVehicle.name;

        vehicleType.value =
            selectedVehicle.type;

        plateNumber.value =
            selectedVehicle.plateNumber;

        vehicleCondition.value =
            selectedVehicle.condition;

        vehicleStatus.value =
            selectedVehicle.status;

        assignedDriver.value =
            selectedVehicle.driver;

        vehicleLocation.value =
            selectedVehicle.location;

        maintenanceDate.value =
            selectedVehicle.maintenanceDate;

        modalTitle.textContent = "Edit Mobility Asset";
        formMessage.textContent = "";

        vehicleModal.classList.add("show");
        vehicleName.focus();
    }

    function closeVehicleModal() {
        vehicleModal.classList.remove("show");
        vehicleForm.reset();

        editingVehicleId.value = "";
        formMessage.textContent = "";
    }


    vehicleForm.addEventListener("submit", function (event) {
        event.preventDefault();

        if (!canManageInventory) {
            formMessage.textContent =
                "Administrator access is required.";
            return;
        }

        const nameValue =
            vehicleName.value.trim();

        const typeValue =
            vehicleType.value;

        const plateValue =
            plateNumber.value.trim().toUpperCase();

        const conditionValue =
            vehicleCondition.value;

        const statusValue =
            vehicleStatus.value;

        const driverValue =
            assignedDriver.value.trim();

        const locationValue =
            vehicleLocation.value.trim();

        const maintenanceValue =
            maintenanceDate.value;

        if (
            !nameValue ||
            !typeValue ||
            !plateValue ||
            !conditionValue ||
            !statusValue ||
            !driverValue ||
            !locationValue ||
            !maintenanceValue
        ) {
            formMessage.textContent =
                "Please complete all fields.";

            return;
        }

        const vehicles = getVehicles();
        const editId = editingVehicleId.value;

        const duplicatePlate = vehicles.some(function (vehicle) {
            return (
                vehicle.plateNumber.toLowerCase() ===
                    plateValue.toLowerCase() &&
                vehicle.id !== editId
            );
        });

        if (duplicatePlate) {
            formMessage.textContent =
                "That plate number is already registered.";

            return;
        }

        if (editId) {
            const vehicleIndex =
                vehicles.findIndex(function (vehicle) {
                    return vehicle.id === editId;
                });

            if (vehicleIndex !== -1) {
                vehicles[vehicleIndex] = {
                    ...vehicles[vehicleIndex],
                    name: nameValue,
                    type: typeValue,
                    plateNumber: plateValue,
                    condition: conditionValue,
                    driver: driverValue,
                    location: locationValue,
                    maintenanceDate: maintenanceValue,
                    status: statusValue
                };
            }
        } else {
            const newVehicle = {
                id: generateVehicleId(vehicles),
                name: nameValue,
                type: typeValue,
                plateNumber: plateValue,
                condition: conditionValue,
                driver: driverValue,
                location: locationValue,
                maintenanceDate: maintenanceValue,
                status: statusValue
            };

            vehicles.push(newVehicle);
        }

        saveVehicles(vehicles);
        closeVehicleModal();
        renderVehicles();
    });


    vehicleTableBody.addEventListener("click", function (event) {
        const button = event.target.closest("button");

        if (!button || !canManageInventory) {
            return;
        }

        const action = button.dataset.action;
        const vehicleId = button.dataset.id;

        if (action === "edit") {
            openEditModal(vehicleId);
        }

        if (action === "delete") {
            vehicleToDelete = vehicleId;
            deleteModal.classList.add("show");
        }
    });

    confirmDelete.addEventListener("click", async function () {
        if (!canManageInventory) {
            return;
        }

        if (!vehicleToDelete) {
            return;
        }

        if (
            !window.medtrackData ||
            typeof window.medtrackData.deleteInventoryItem !== "function"
        ) {
            alert("The secure database delete service is unavailable.");
            return;
        }

        confirmDelete.disabled = true;

        try {
            await window.medtrackData.deleteInventoryItem(
                "medtrackMobilityAssets",
                vehicleToDelete
            );
        } catch (error) {
            console.error("Unable to delete mobility asset:", error);
            alert(error.message || "Unable to delete the selected mobility asset.");
            return;
        } finally {
            confirmDelete.disabled = false;
        }

        vehicleToDelete = null;
        deleteModal.classList.remove("show");

        renderVehicles();
    });

    cancelDelete.addEventListener("click", function () {
        vehicleToDelete = null;
        deleteModal.classList.remove("show");
    });


    vehicleSearch.addEventListener(
        "input",
        renderVehicles
    );

    typeFilter.addEventListener(
        "change",
        renderVehicles
    );

    statusFilter.addEventListener(
        "change",
        renderVehicles
    );


    openAddModalButton.addEventListener(
        "click",
        openAddModal
    );

    closeModalButton.addEventListener(
        "click",
        closeVehicleModal
    );

    cancelButton.addEventListener(
        "click",
        closeVehicleModal
    );

    vehicleModal.addEventListener("click", function (event) {
        if (event.target === vehicleModal) {
            closeVehicleModal();
        }
    });

    deleteModal.addEventListener("click", function (event) {
        if (event.target === deleteModal) {
            vehicleToDelete = null;
            deleteModal.classList.remove("show");
        }
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            closeVehicleModal();

            vehicleToDelete = null;
            deleteModal.classList.remove("show");
        }
    });


    notificationButton.addEventListener("click", function () {
        const vehicles = getVehicles();

        const alerts = vehicles.filter(function (vehicle) {
            return (
                ["Missing", "Damaged", "For Repair"].includes(
                    vehicle.status
                ) ||
                isMaintenanceOverdue(vehicle.maintenanceDate)
            );
        });

        if (alerts.length === 0) {
            alert("There are no mobility alerts.");
            return;
        }

        alert(
            `There are ${alerts.length} mobility assets requiring attention.`
        );
    });

    window.addEventListener("medtrack:data-ready", renderVehicles);
    window.addEventListener("medtrack:inventory-changed", renderVehicles);
    window.addEventListener("storage", function (event) {
        if (event.key === "medtrackMobilityAssets") renderVehicles();
    });


    logoutButton.addEventListener("click", async function () {
        const confirmLogout = confirm(
            "Are you sure you want to log out?"
        );

        if (!confirmLogout) {
            return;
        }

        await window.medtrackAuth.signOutAndRedirect();
    });


    renderVehicles();
});
