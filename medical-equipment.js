// =====================================
// MEDTRACK MEDICAL EQUIPMENT
// =====================================

document.addEventListener("DOMContentLoaded", async function () {

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

    const currentUser =
        await window.medtrackAuth.requireRoles([
            "admin",
            "staff"
        ]);

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
            localStorage.getItem(
                "medtrackMedicalEquipment"
            );

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
            console.error(
                "Unable to read medical equipment:",
                error
            );

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
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function normalizeId(value) {
        return String(value ?? "").trim();
    }

    function normalizeText(value) {
        return String(value ?? "").trim();
    }

    // =====================================
    // DATE FUNCTIONS
    // =====================================

    function formatDate(dateValue) {
        if (!dateValue) {
            return "Not scheduled";
        }

        const date = new Date(
            dateValue + "T00:00:00"
        );

        if (Number.isNaN(date.getTime())) {
            return dateValue;
        }

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
            new Date(
                dateValue + "T00:00:00"
            );

        if (Number.isNaN(scheduledDate.getTime())) {
            return false;
        }

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
            const equipmentId =
                normalizeId(item.id);

            const match =
                equipmentId.match(
                    /^EQP-(\d+)$/i
                );

            if (!match) {
                return;
            }

            const number = Number(match[1]);

            if (
                Number.isInteger(number) &&
                number > highestNumber
            ) {
                highestNumber = number;
            }
        });

        return (
            "EQP-" +
            String(highestNumber + 1)
                .padStart(3, "0")
        );
    }

    // =====================================
    // RENDER EQUIPMENT
    // =====================================

    function renderEquipment() {
        const equipment = getEquipment();

        const searchValue =
            equipmentSearch.value
                .trim()
                .toLowerCase();

        const selectedCategory =
            categoryFilter.value;

        const selectedStatus =
            statusFilter.value;

        const filteredEquipment =
            equipment.filter(function (item) {
                const itemId =
                    normalizeId(item.id);

                const itemName =
                    normalizeText(item.name);

                const itemCategory =
                    normalizeText(item.category);

                const itemLocation =
                    normalizeText(item.location);

                const itemStatus =
                    normalizeText(item.status);

                const searchableText = `
                    ${itemId}
                    ${itemName}
                    ${itemCategory}
                    ${itemLocation}
                `.toLowerCase();

                const matchesSearch =
                    searchableText.includes(
                        searchValue
                    );

                const matchesCategory =
                    selectedCategory === "all" ||
                    itemCategory === selectedCategory;

                const matchesStatus =
                    selectedStatus === "all" ||
                    itemStatus === selectedStatus;

                return (
                    matchesSearch &&
                    matchesCategory &&
                    matchesStatus
                );
            });

        equipmentTableBody.innerHTML = "";

        emptyState.classList.toggle(
            "show",
            filteredEquipment.length === 0
        );

        filteredEquipment.forEach(function (item) {
            const itemId =
                normalizeId(item.id);

            const itemName =
                normalizeText(item.name);

            const itemCategory =
                normalizeText(item.category);

            const itemCondition =
                normalizeText(item.condition);

            const itemLocation =
                normalizeText(item.location);

            const itemStatus =
                normalizeText(item.status);

            const statusClass =
                getStatusClass(itemStatus);

            const conditionClass =
                getConditionClass(itemCondition);

            const overdue =
                isMaintenanceOverdue(
                    item.maintenanceDate
                );

            const maintenanceDisplay =
                overdue
                    ? `${formatDate(
                        item.maintenanceDate
                    )} (Overdue)`
                    : formatDate(
                        item.maintenanceDate
                    );

            const row =
                document.createElement("tr");

            row.innerHTML = `
                <td>
                    ${escapeHTML(itemId)}
                </td>

                <td>
                    <strong>
                        ${escapeHTML(itemName)}
                    </strong>
                </td>

                <td>
                    ${escapeHTML(itemCategory)}
                </td>

                <td>
                    ${escapeHTML(item.quantity)}
                </td>

                <td>
                    <span class="condition-badge ${conditionClass}">
                        ${escapeHTML(itemCondition)}
                    </span>
                </td>

                <td>
                    ${escapeHTML(itemLocation)}
                </td>

                <td>
                    ${
                        overdue
                            ? `
                                <span class="status-badge status-maintenance">
                                    ${escapeHTML(
                                        maintenanceDisplay
                                    )}
                                </span>
                            `
                            : escapeHTML(
                                maintenanceDisplay
                            )
                    }
                </td>

                <td>
                    <span class="status-badge ${statusClass}">
                        ${escapeHTML(itemStatus)}
                    </span>
                </td>

                <td>
                    ${canManageInventory ? `
                    <div class="table-actions">
                        <button
                            type="button"
                            class="edit-button"
                            data-action="edit"
                            data-id="${escapeHTML(itemId)}"
                            title="Edit equipment"
                            aria-label="Edit ${escapeHTML(itemName)}"
                        >
                            <i class="fa-solid fa-pen"></i>
                        </button>

                        <button
                            type="button"
                            class="remove-button"
                            data-action="delete"
                            data-id="${escapeHTML(itemId)}"
                            title="Delete equipment"
                            aria-label="Delete ${escapeHTML(itemName)}"
                        >
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                    ` : "\u2014"}
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
            const status =
                normalizeText(item.status);

            if (status === "Available") {
                availableCount++;
            }

            if (status === "Maintenance") {
                maintenanceCount++;
                alertCount++;
            }

            if (status === "In Use") {
                inUseCount++;
            }

            if (status === "Unavailable") {
                alertCount++;
            }

            if (
                isMaintenanceOverdue(
                    item.maintenanceDate
                ) &&
                status !== "Maintenance"
            ) {
                alertCount++;
            }
        });

        totalEquipment.textContent =
            equipment.length;

        availableEquipment.textContent =
            availableCount;

        maintenanceEquipment.textContent =
            maintenanceCount;

        inUseEquipment.textContent =
            inUseCount;

        notificationCount.textContent =
            alertCount;
    }

    // =====================================
    // OPEN ADD MODAL
    // =====================================

    function openAddModal() {
        if (!canManageInventory) {
            return;
        }

        equipmentForm.reset();

        editingEquipmentId.value = "";

        modalTitle.textContent =
            "Add Medical Equipment";

        formMessage.textContent = "";

        equipmentModal.classList.add("show");
        equipmentName.focus();
    }

    // =====================================
    // OPEN EDIT MODAL
    // =====================================

    function openEditModal(equipmentId) {
        if (!canManageInventory) {
            return;
        }

        const normalizedEquipmentId =
            normalizeId(equipmentId);

        const equipment = getEquipment();

        const selectedEquipment =
            equipment.find(function (item) {
                return (
                    normalizeId(item.id) ===
                    normalizedEquipmentId
                );
            });

        if (!selectedEquipment) {
            alert(
                "The selected equipment could not be found."
            );

            return;
        }

        editingEquipmentId.value =
            normalizeId(selectedEquipment.id);

        equipmentName.value =
            normalizeText(selectedEquipment.name);

        equipmentCategory.value =
            normalizeText(
                selectedEquipment.category
            );

        equipmentQuantity.value =
            Number(selectedEquipment.quantity) || 1;

        equipmentCondition.value =
            normalizeText(
                selectedEquipment.condition
            );

        equipmentStatus.value =
            normalizeText(
                selectedEquipment.status
            );

        equipmentLocation.value =
            normalizeText(
                selectedEquipment.location
            );

        maintenanceDate.value =
            normalizeText(
                selectedEquipment.maintenanceDate
            );

        modalTitle.textContent =
            "Edit Medical Equipment";

        formMessage.textContent = "";

        equipmentModal.classList.add("show");
        equipmentName.focus();
    }

    // =====================================
    // CLOSE EQUIPMENT MODAL
    // =====================================

    function closeEquipmentModal() {
        equipmentModal.classList.remove("show");
        equipmentForm.reset();

        editingEquipmentId.value = "";
        formMessage.textContent = "";
    }

    // =====================================
    // SAVE OR UPDATE EQUIPMENT
    // =====================================

    equipmentForm.addEventListener(
        "submit",
        function (event) {
            event.preventDefault();

            if (!canManageInventory) {
                formMessage.textContent =
                    "Administrator access is required.";
                return;
            }

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

            if (
                !Number.isFinite(quantityValue) ||
                quantityValue < 1
            ) {
                formMessage.textContent =
                    "Quantity must be at least 1.";

                return;
            }

            const equipment = getEquipment();

            const editId =
                normalizeId(
                    editingEquipmentId.value
                );

            if (editId) {
                const equipmentIndex =
                    equipment.findIndex(
                        function (item) {
                            return (
                                normalizeId(item.id) ===
                                editId
                            );
                        }
                    );

                if (equipmentIndex === -1) {
                    formMessage.textContent =
                        "The selected equipment could not be found.";

                    return;
                }

                equipment[equipmentIndex] = {
                    ...equipment[equipmentIndex],
                    id: normalizeId(
                        equipment[equipmentIndex].id
                    ),
                    name: nameValue,
                    category: categoryValue,
                    quantity: quantityValue,
                    condition: conditionValue,
                    location: locationValue,
                    maintenanceDate:
                        maintenanceValue,
                    status: statusValue
                };
            } else {
                const newEquipment = {
                    id: generateEquipmentId(
                        equipment
                    ),
                    name: nameValue,
                    category: categoryValue,
                    quantity: quantityValue,
                    condition: conditionValue,
                    location: locationValue,
                    maintenanceDate:
                        maintenanceValue,
                    status: statusValue
                };

                equipment.push(newEquipment);
            }

            saveEquipment(equipment);
            closeEquipmentModal();
            renderEquipment();
        }
    );

    // =====================================
    // EDIT AND DELETE ACTIONS
    // =====================================

    equipmentTableBody.addEventListener(
        "click",
        function (event) {
            const button =
                event.target.closest(
                    ".edit-button, .remove-button"
                );

            if (
                !button ||
                !equipmentTableBody.contains(button) ||
                !canManageInventory
            ) {
                return;
            }

            const action =
                button.dataset.action;

            const equipmentId =
                normalizeId(button.dataset.id);

            if (!equipmentId) {
                return;
            }

            if (action === "edit") {
                openEditModal(equipmentId);
                return;
            }

            if (action === "delete") {
                equipmentToDelete =
                    equipmentId;

                deleteModal.classList.add("show");
            }
        }
    );

    // =====================================
    // CONFIRM DELETE
    // =====================================

    confirmDelete.addEventListener(
        "click",
        function () {
            if (!canManageInventory) {
                return;
            }

            const deleteId =
                normalizeId(equipmentToDelete);

            if (!deleteId) {
                return;
            }

            const equipment = getEquipment();

            const equipmentExists =
                equipment.some(function (item) {
                    return (
                        normalizeId(item.id) ===
                        deleteId
                    );
                });

            if (!equipmentExists) {
                equipmentToDelete = null;
                deleteModal.classList.remove("show");

                alert(
                    "The selected equipment could not be found."
                );

                return;
            }

            const updatedEquipment =
                equipment.filter(function (item) {
                    return (
                        normalizeId(item.id) !==
                        deleteId
                    );
                });

            saveEquipment(updatedEquipment);

            equipmentToDelete = null;
            deleteModal.classList.remove("show");

            renderEquipment();
        }
    );

    // =====================================
    // CANCEL DELETE
    // =====================================

    cancelDelete.addEventListener(
        "click",
        function () {
            equipmentToDelete = null;
            deleteModal.classList.remove("show");
        }
    );

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

    equipmentModal.addEventListener(
        "click",
        function (event) {
            if (event.target === equipmentModal) {
                closeEquipmentModal();
            }
        }
    );

    deleteModal.addEventListener(
        "click",
        function (event) {
            if (event.target === deleteModal) {
                equipmentToDelete = null;
                deleteModal.classList.remove("show");
            }
        }
    );

    // =====================================
    // KEYBOARD SUPPORT
    // =====================================

    document.addEventListener(
        "keydown",
        function (event) {
            if (event.key !== "Escape") {
                return;
            }

            if (
                equipmentModal.classList.contains(
                    "show"
                )
            ) {
                closeEquipmentModal();
            }

            if (
                deleteModal.classList.contains(
                    "show"
                )
            ) {
                equipmentToDelete = null;

                deleteModal.classList.remove(
                    "show"
                );
            }
        }
    );

    // =====================================
    // NOTIFICATIONS
    // =====================================

    notificationButton.addEventListener(
        "click",
        function () {
            const equipment = getEquipment();

            const alerts =
                equipment.filter(function (item) {
                    return (
                        item.status ===
                            "Maintenance" ||
                        item.status ===
                            "Unavailable" ||
                        isMaintenanceOverdue(
                            item.maintenanceDate
                        )
                    );
                });

            if (alerts.length === 0) {
                alert(
                    "There are no equipment alerts."
                );

                return;
            }

            alert(
                `There are ${alerts.length} equipment items requiring attention.`
            );
        }
    );

    // =====================================
    // UPDATE FROM OTHER TABS
    // =====================================

    window.addEventListener(
        "storage",
        function (event) {
            if (
                event.key ===
                "medtrackMedicalEquipment"
            ) {
                renderEquipment();
            }
        }
    );

    // =====================================
    // LOGOUT
    // =====================================

    logoutButton.addEventListener(
        "click",
        async function () {
            const confirmLogout =
                window.confirm(
                    "Are you sure you want to log out?"
                );

            if (!confirmLogout) {
                return;
            }

            await window.medtrackAuth
                .signOutAndRedirect();
        }
    );

    // =====================================
    // INITIAL DISPLAY
    // =====================================

    renderEquipment();
});
