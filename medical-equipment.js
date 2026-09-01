// =====================================
// MEDTRACK MEDICAL EQUIPMENT
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

    const totalEquipment =
        document.getElementById("totalEquipment");

    const availableEquipment =
        document.getElementById("availableEquipment");

    const maintenanceEquipment =
        document.getElementById("maintenanceEquipment");

    const inUseEquipment =
        document.getElementById("inUseEquipment");

    const equipmentTableBody =
        document.getElementById("equipmentTableBody");

    const emptyState =
        document.getElementById("emptyState");

    const equipmentSearch =
        document.getElementById("equipmentSearch");

    const categoryFilter =
        document.getElementById("categoryFilter");

    const statusFilter =
        document.getElementById("statusFilter");

    // Equipment modal
    const equipmentModal =
        document.getElementById("equipmentModal");

    const openAddModalButton =
        document.getElementById("openAddModal");

    const closeModalButton =
        document.getElementById("closeModal");

    const cancelButton =
        document.getElementById("cancelButton");

    const modalTitle =
        document.getElementById("modalTitle");

    const equipmentForm =
        document.getElementById("equipmentForm");

    const editingEquipmentId =
        document.getElementById("editingEquipmentId");

    const equipmentName =
        document.getElementById("equipmentName");

    const equipmentCategory =
        document.getElementById("equipmentCategory");

    const equipmentQuantity =
        document.getElementById("equipmentQuantity");

    const equipmentCondition =
        document.getElementById("equipmentCondition");

    const equipmentStatus =
        document.getElementById("equipmentStatus");

    const equipmentLocation =
        document.getElementById("equipmentLocation");

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

    let equipmentToDelete = null;

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

    // Separate role navigation
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
    // DEFAULT EQUIPMENT
    // =====================================

    const defaultEquipment = [
        {
            id: "EQP-001",
            name: "Portable Oxygen Tank",
            category: "Life Support",
            quantity: 5,
            condition: "Good",
            location: "Equipment Room A",
            maintenanceDate: "2027-01-15",
            status: "Available"
        },
        {
            id: "EQP-002",
            name: "Blood Pressure Monitor",
            category: "Monitoring",
            quantity: 8,
            condition: "Excellent",
            location: "Medical Storage Room",
            maintenanceDate: "2027-03-20",
            status: "Available"
        },
        {
            id: "EQP-003",
            name: "Portable Generator",
            category: "Emergency",
            quantity: 2,
            condition: "Fair",
            location: "Emergency Warehouse",
            maintenanceDate: "2026-07-10",
            status: "Maintenance"
        },
        {
            id: "EQP-004",
            name: "Wheelchair",
            category: "Transport",
            quantity: 4,
            condition: "Good",
            location: "Equipment Room B",
            maintenanceDate: "2027-05-12",
            status: "In Use"
        }
    ];

    // =====================================
    // LOCAL STORAGE
    // =====================================

    function getEquipment() {
        const savedEquipment =
            localStorage.getItem("medtrackMedicalEquipment");

        if (!savedEquipment) {
            localStorage.setItem(
                "medtrackMedicalEquipment",
                JSON.stringify(defaultEquipment)
            );

            return [...defaultEquipment];
        }

        try {
            const parsedEquipment =
                JSON.parse(savedEquipment);

            return Array.isArray(parsedEquipment)
                ? parsedEquipment
                : [];
        } catch (error) {
            return [];
        }
    }

    function saveEquipment(equipment) {
        localStorage.setItem(
            "medtrackMedicalEquipment",
            JSON.stringify(equipment)
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

        if (status === "In Use") {
            return "status-in-use";
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
    // GENERATE EQUIPMENT ID
    // =====================================

    function generateEquipmentId(equipment) {
        let highestNumber = 0;

        equipment.forEach(function (item) {
            const number = Number(
                String(item.id).replace("EQP-", "")
            );

            if (!Number.isNaN(number) && number > highestNumber) {
                highestNumber = number;
            }
        });

        return `EQP-${String(highestNumber + 1).padStart(3, "0")}`;
    }

    // =====================================
    // RENDER EQUIPMENT
    // =====================================

    function renderEquipment() {
        const equipment = getEquipment();

        const searchValue =
            equipmentSearch.value.trim().toLowerCase();

        const selectedCategory =
            categoryFilter.value;

        const selectedStatus =
            statusFilter.value;

        const filteredEquipment = equipment.filter(function (item) {
            const matchesSearch =
                item.name.toLowerCase().includes(searchValue) ||
                item.category.toLowerCase().includes(searchValue) ||
                item.id.toLowerCase().includes(searchValue) ||
                item.location.toLowerCase().includes(searchValue);

            const matchesCategory =
                selectedCategory === "all" ||
                item.category === selectedCategory;

            const matchesStatus =
                selectedStatus === "all" ||
                item.status === selectedStatus;

            return (
                matchesSearch &&
                matchesCategory &&
                matchesStatus
            );
        });

        equipmentTableBody.innerHTML = "";

        if (filteredEquipment.length === 0) {
            emptyState.classList.add("show");
        } else {
            emptyState.classList.remove("show");
        }

        filteredEquipment.forEach(function (item) {
            const statusClass =
                getStatusClass(item.status);

            const conditionClass =
                getConditionClass(item.condition);

            const overdue =
                isMaintenanceOverdue(item.maintenanceDate);

            const maintenanceDisplay = overdue
                ? `${formatDate(item.maintenanceDate)} (Overdue)`
                : formatDate(item.maintenanceDate);

            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${escapeHTML(item.id)}</td>

                <td>
                    <strong>${escapeHTML(item.name)}</strong>
                </td>

                <td>${escapeHTML(item.category)}</td>

                <td>${escapeHTML(item.quantity)}</td>

                <td>
                    <span class="condition-badge ${conditionClass}">
                        ${escapeHTML(item.condition)}
                    </span>
                </td>

                <td>${escapeHTML(item.location)}</td>

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
                        ${escapeHTML(item.status)}
                    </span>
                </td>

                <td>
                    <div class="table-actions">

                        <button
                            type="button"
                            class="edit-button"
                            data-action="edit"
                            data-id="${escapeHTML(item.id)}"
                            title="Edit equipment"
                        >
                            <i class="fa-solid fa-pen"></i>
                        </button>

                        <button
                            type="button"
                            class="remove-button"
                            data-action="delete"
                            data-id="${escapeHTML(item.id)}"
                            title="Delete equipment"
                        >
                            <i class="fa-solid fa-trash"></i>
                        </button>

                    </div>
                </td>
            `;

            equipmentTableBody.appendChild(row);
        });

        updateStatistics(equipment);
    }

    // =====================================
    // STATISTICS
    // =====================================

    function updateStatistics(equipment) {
        let availableCount = 0;
        let maintenanceCount = 0;
        let inUseCount = 0;
        let alertCount = 0;

        equipment.forEach(function (item) {
            if (item.status === "Available") {
                availableCount++;
            }

            if (item.status === "Maintenance") {
                maintenanceCount++;
                alertCount++;
            }

            if (item.status === "In Use") {
                inUseCount++;
            }

            if (item.status === "Unavailable") {
                alertCount++;
            }

            if (
                isMaintenanceOverdue(item.maintenanceDate) &&
                item.status !== "Maintenance"
            ) {
                alertCount++;
            }
        });

        totalEquipment.textContent = equipment.length;
        availableEquipment.textContent = availableCount;
        maintenanceEquipment.textContent = maintenanceCount;
        inUseEquipment.textContent = inUseCount;
        notificationCount.textContent = alertCount;
    }

    // =====================================
    // OPEN ADD MODAL
    // =====================================

    function openAddModal() {
        equipmentForm.reset();

        editingEquipmentId.value = "";
        modalTitle.textContent = "Add Medical Equipment";
        formMessage.textContent = "";

        equipmentModal.classList.add("show");
        equipmentName.focus();
    }

    // =====================================
    // OPEN EDIT MODAL
    // =====================================

    function openEditModal(equipmentId) {
        const equipment = getEquipment();

        const selectedEquipment =
            equipment.find(function (item) {
                return item.id === equipmentId;
            });

        if (!selectedEquipment) {
            return;
        }

        editingEquipmentId.value =
            selectedEquipment.id;

        equipmentName.value =
            selectedEquipment.name;

        equipmentCategory.value =
            selectedEquipment.category;

        equipmentQuantity.value =
            selectedEquipment.quantity;

        equipmentCondition.value =
            selectedEquipment.condition;

        equipmentStatus.value =
            selectedEquipment.status;

        equipmentLocation.value =
            selectedEquipment.location;

        maintenanceDate.value =
            selectedEquipment.maintenanceDate;

        modalTitle.textContent = "Edit Medical Equipment";
        formMessage.textContent = "";

        equipmentModal.classList.add("show");
        equipmentName.focus();
    }

    function closeEquipmentModal() {
        equipmentModal.classList.remove("show");
        equipmentForm.reset();

        editingEquipmentId.value = "";
        formMessage.textContent = "";
    }

    // =====================================
    // SAVE OR UPDATE EQUIPMENT
    // =====================================

    equipmentForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const nameValue =
            equipmentName.value.trim();

        const categoryValue =
            equipmentCategory.value;

        const quantityValue =
            Number(equipmentQuantity.value);

        const conditionValue =
            equipmentCondition.value;

        const statusValue =
            equipmentStatus.value;

        const locationValue =
            equipmentLocation.value.trim();

        const maintenanceValue =
            maintenanceDate.value;

        if (
            !nameValue ||
            !categoryValue ||
            !conditionValue ||
            !statusValue ||
            !locationValue ||
            !maintenanceValue
        ) {
            formMessage.textContent =
                "Please complete all fields.";

            return;
        }

        if (quantityValue < 1) {
            formMessage.textContent =
                "Quantity must be at least 1.";

            return;
        }

        const equipment = getEquipment();
        const editId = editingEquipmentId.value;

        if (editId) {
            const equipmentIndex =
                equipment.findIndex(function (item) {
                    return item.id === editId;
                });

            if (equipmentIndex !== -1) {
                equipment[equipmentIndex] = {
                    ...equipment[equipmentIndex],
                    name: nameValue,
                    category: categoryValue,
                    quantity: quantityValue,
                    condition: conditionValue,
                    location: locationValue,
                    maintenanceDate: maintenanceValue,
                    status: statusValue
                };
            }
        } else {
            const newEquipment = {
                id: generateEquipmentId(equipment),
                name: nameValue,
                category: categoryValue,
                quantity: quantityValue,
                condition: conditionValue,
                location: locationValue,
                maintenanceDate: maintenanceValue,
                status: statusValue
            };

            equipment.push(newEquipment);
        }

        saveEquipment(equipment);
        closeEquipmentModal();
        renderEquipment();
    });

    // =====================================
    // EDIT AND DELETE ACTIONS
    // =====================================

    equipmentTableBody.addEventListener("click", function (event) {
        const button = event.target.closest("button");

        if (!button) {
            return;
        }

        const action = button.dataset.action;
        const equipmentId = button.dataset.id;

        if (action === "edit") {
            openEditModal(equipmentId);
        }

        if (action === "delete") {
            equipmentToDelete = equipmentId;
            deleteModal.classList.add("show");
        }
    });

    confirmDelete.addEventListener("click", function () {
        if (!equipmentToDelete) {
            return;
        }

        const equipment = getEquipment();

        const updatedEquipment =
            equipment.filter(function (item) {
                return item.id !== equipmentToDelete;
            });

        saveEquipment(updatedEquipment);

        equipmentToDelete = null;
        deleteModal.classList.remove("show");

        renderEquipment();
    });

    cancelDelete.addEventListener("click", function () {
        equipmentToDelete = null;
        deleteModal.classList.remove("show");
    });

    // =====================================
    // SEARCH AND FILTERS
    // =====================================

    equipmentSearch.addEventListener(
        "input",
        renderEquipment
    );

    categoryFilter.addEventListener(
        "change",
        renderEquipment
    );

    statusFilter.addEventListener(
        "change",
        renderEquipment
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
        closeEquipmentModal
    );

    cancelButton.addEventListener(
        "click",
        closeEquipmentModal
    );

    equipmentModal.addEventListener("click", function (event) {
        if (event.target === equipmentModal) {
            closeEquipmentModal();
        }
    });

    deleteModal.addEventListener("click", function (event) {
        if (event.target === deleteModal) {
            equipmentToDelete = null;
            deleteModal.classList.remove("show");
        }
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            closeEquipmentModal();

            equipmentToDelete = null;
            deleteModal.classList.remove("show");
        }
    });

    // =====================================
    // NOTIFICATIONS
    // =====================================

    notificationButton.addEventListener("click", function () {
        const equipment = getEquipment();

        const alerts = equipment.filter(function (item) {
            return (
                item.status === "Maintenance" ||
                item.status === "Unavailable" ||
                isMaintenanceOverdue(item.maintenanceDate)
            );
        });

        if (alerts.length === 0) {
            alert("There are no equipment alerts.");
            return;
        }

        alert(
            `There are ${alerts.length} equipment items requiring attention.`
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

        // Registered accounts and inventory are kept
        localStorage.removeItem("medtrackCurrentUser");
        sessionStorage.removeItem("medtrackCurrentUser");

        window.location.replace("login.html");
    });

    // =====================================
    // INITIAL DISPLAY
    // =====================================

    renderEquipment();
});