// =====================================
// MEDTRACK MOBILITY ASSETS
// =====================================

document.addEventListener("DOMContentLoaded", function () {

    // =====================================
    // ELEMENTS
    // =====================================

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

    const maintenanceVehicles =
        document.getElementById("maintenanceVehicles");

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

    // Vehicle modal
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

    // Delete modal
    const deleteModal =
        document.getElementById("deleteModal");

    const cancelDelete =
        document.getElementById("cancelDelete");

    const confirmDelete =
        document.getElementById("confirmDelete");

    let vehicleToDelete = null;

    // =====================================
    // LOGIN AND ROLE CHECK
    // =====================================

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

    if (!currentUser) {
        window.location.replace("login.html");
        return;
    }

    if (
        currentUser.role !== "admin" &&
        currentUser.role !== "staff"
    ) {
        localStorage.removeItem("medtrackCurrentUser");
        sessionStorage.removeItem("medtrackCurrentUser");

        window.location.replace("login.html");
        return;
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
        adminNavigation.style.display = "block";
    } else {
        portalName.textContent = "Staff Portal";
        dashboardLink.href = "staff-dashboard.html";
        adminNavigation.style.display = "none";
    }

    // =====================================
    // DEFAULT MOBILITY ASSETS
    // =====================================

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
            status: "Maintenance"
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

    // =====================================
    // LOCAL STORAGE
    // =====================================

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
                ? parsedVehicles
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

    // =====================================
    // SAFE TEXT
    // =====================================

    function escapeHTML(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    // =====================================
    // DATE FUNCTIONS
    // =====================================

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

    // =====================================
    // CSS CLASSES
    // =====================================

    function getStatusClass(status) {
        if (status === "Available") {
            return "status-available";
        }

        if (status === "Deployed") {
            return "status-deployed";
        }

        if (status === "Maintenance") {
            return "status-maintenance";
        }

        return "status-unavailable";
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

    // =====================================
    // GENERATE VEHICLE ID
    // =====================================

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

    // =====================================
    // RENDER VEHICLES
    // =====================================

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
                </td>
            `;

            vehicleTableBody.appendChild(row);
        });

        updateStatistics(vehicles);
    }

    // =====================================
    // UPDATE STATISTICS
    // =====================================

    function updateStatistics(vehicles) {
        let availableCount = 0;
        let deployedCount = 0;
        let maintenanceCount = 0;
        let alertsCount = 0;

        vehicles.forEach(function (vehicle) {
            if (vehicle.status === "Available") {
                availableCount++;
            }

            if (vehicle.status === "Deployed") {
                deployedCount++;
            }

            if (vehicle.status === "Maintenance") {
                maintenanceCount++;
                alertsCount++;
            }

            if (vehicle.status === "Unavailable") {
                alertsCount++;
            }

            if (
                isMaintenanceOverdue(vehicle.maintenanceDate) &&
                vehicle.status !== "Maintenance"
            ) {
                alertsCount++;
            }
        });

        totalVehicles.textContent = vehicles.length;
        availableVehicles.textContent = availableCount;
        deployedVehicles.textContent = deployedCount;
        maintenanceVehicles.textContent = maintenanceCount;
        notificationCount.textContent = alertsCount;
    }

    // =====================================
    // OPEN ADD MODAL
    // =====================================

    function openAddModal() {
        vehicleForm.reset();

        editingVehicleId.value = "";
        modalTitle.textContent = "Add Mobility Asset";
        formMessage.textContent = "";

        vehicleModal.classList.add("show");
        vehicleName.focus();
    }

    // =====================================
    // OPEN EDIT MODAL
    // =====================================

    function openEditModal(vehicleId) {
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

    // =====================================
    // SAVE OR UPDATE VEHICLE
    // =====================================

    vehicleForm.addEventListener("submit", function (event) {
        event.preventDefault();

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

        // Check duplicate plate number
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

    // =====================================
    // EDIT AND DELETE ACTIONS
    // =====================================

    vehicleTableBody.addEventListener("click", function (event) {
        const button = event.target.closest("button");

        if (!button) {
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

    // =====================================
    // SEARCH AND FILTERS
    // =====================================

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

    // =====================================
    // MODAL BUTTONS
    // =====================================

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

    // =====================================
    // NOTIFICATIONS
    // =====================================

    notificationButton.addEventListener("click", function () {
        const vehicles = getVehicles();

        const alerts = vehicles.filter(function (vehicle) {
            return (
                vehicle.status === "Maintenance" ||
                vehicle.status === "Unavailable" ||
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

    // =====================================
    // LOGOUT
    // =====================================

    logoutButton.addEventListener("click", function () {
        const confirmLogout = confirm(
            "Are you sure you want to log out?"
        );

        if (!confirmLogout) {
            return;
        }

        localStorage.removeItem("medtrackCurrentUser");
        sessionStorage.removeItem("medtrackCurrentUser");

        window.location.replace("login.html");
    });

    // =====================================
    // INITIAL DISPLAY
    // =====================================

    renderVehicles();
});