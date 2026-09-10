
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


    const defaultVehicles = [
        {
            id: "MOB-001",
            name: "Rescue Ambulance 1",
            type: "Ambulance",
            plateNumber: "ABC-1234",
            condition: "Excellent",
            driver: "Juan Dela Cruz",
            location: "PDRRMO Headquarters",
            maintenanceDate: "2027-02-15",
            status: "Available"
        },
        {
            id: "MOB-002",
            name: "Emergency Rescue Truck",
            type: "Rescue Vehicle",
            plateNumber: "DEF-5678",
            condition: "Good",
            driver: "Pedro Santos",
            location: "Response Station 1",
            maintenanceDate: "2027-01-10",
            status: "Deployed"
        },
        {
            id: "MOB-003",
            name: "Command Vehicle",
            type: "Command Vehicle",
            plateNumber: "GHI-9012",
            condition: "Fair",
            driver: "Mario Reyes",
            location: "Maintenance Area",
            maintenanceDate: "2026-07-20",
            status: "For Repair"
        },
        {
            id: "MOB-004",
            name: "Service Motorcycle",
            type: "Motorcycle",
            plateNumber: "JKL-3456",
            condition: "Good",
            driver: "Antonio Garcia",
            location: "PDRRMO Headquarters",
            maintenanceDate: "2027-04-08",
            status: "Available"
        }
    ];


    function getVehicles() {
        const savedVehicles =
            localStorage.getItem("medtrackMobilityAssets");

        if (!savedVehicles) {
            localStorage.setItem(
                "medtrackMobilityAssets",
                JSON.stringify(defaultVehicles)
            );

            return [...defaultVehicles];
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
        if (status === "Maintenance" || status === "Unavailable") {
            return "For Repair";
        }

        return [
            "Available",
            "Assigned",
            "Deployed",
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

        if (status === "Deployed") {
            return "status-deployed";
        }

        if (status === "Assigned") {
            return "status-assigned";
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

            if (vehicle.status === "Deployed") {
                deployedCount++;
            }

            if (vehicle.status === "For Repair") {
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

    confirmDelete.addEventListener("click", function () {
        if (!canManageInventory) {
            return;
        }

        if (!vehicleToDelete) {
            return;
        }

        const vehicles = getVehicles();

        const updatedVehicles =
            vehicles.filter(function (vehicle) {
                return vehicle.id !== vehicleToDelete;
            });

        saveVehicles(updatedVehicles);

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
                vehicle.status === "For Repair" ||
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
