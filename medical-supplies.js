// =====================================
// MEDTRACK MEDICAL SUPPLIES
// =====================================

document.addEventListener("DOMContentLoaded", async function () {
    "use strict";

    // =====================================
    // HTML ELEMENTS
    // =====================================

    const dashboardLink = document.getElementById("dashboardLink");
    const adminNavigation = document.getElementById("adminNavigation");
    const portalName = document.getElementById("portalName");
    const currentUserName = document.getElementById("currentUserName");
    const currentUserRole = document.getElementById("currentUserRole");
    const logoutButton = document.getElementById("logoutButton");

    const notificationButton =
        document.getElementById("notificationButton");

    const notificationCount =
        document.getElementById("notificationCount");

    const totalSupplies =
        document.getElementById("totalSupplies");

    const availableSupplies =
        document.getElementById("availableSupplies");

    const lowStockSupplies =
        document.getElementById("lowStockSupplies");

    const expiredSupplies =
        document.getElementById("expiredSupplies");

    const supplyTableBody =
        document.getElementById("supplyTableBody");

    const emptyState =
        document.getElementById("emptyState");

    const supplySearch =
        document.getElementById("supplySearch");

    const categoryFilter =
        document.getElementById("categoryFilter");

    const statusFilter =
        document.getElementById("statusFilter");

    // Supply modal
    const supplyModal =
        document.getElementById("supplyModal");

    const openAddModalButton =
        document.getElementById("openAddModal");

    const closeModalButton =
        document.getElementById("closeModal");

    const cancelButton =
        document.getElementById("cancelButton");

    const modalTitle =
        document.getElementById("modalTitle");

    const supplyForm =
        document.getElementById("supplyForm");

    const editingSupplyId =
        document.getElementById("editingSupplyId");

    const supplyName =
        document.getElementById("supplyName");

    const supplyCategory =
        document.getElementById("supplyCategory");

    const supplyQuantity =
        document.getElementById("supplyQuantity");

    const supplyUnit =
        document.getElementById("supplyUnit");

    const expirationDate =
        document.getElementById("expirationDate");

    const lowStockLevel =
        document.getElementById("lowStockLevel");

    const formMessage =
        document.getElementById("formMessage");

    // Delete modal
    const deleteModal =
        document.getElementById("deleteModal");

    const cancelDelete =
        document.getElementById("cancelDelete");

    const confirmDelete =
        document.getElementById("confirmDelete");

    let supplyToDelete = null;

    // =====================================
    // CHECK REQUIRED ELEMENTS
    // =====================================

    const requiredElements = [
        dashboardLink,
        adminNavigation,
        portalName,
        currentUserName,
        currentUserRole,
        logoutButton,
        notificationButton,
        notificationCount,
        totalSupplies,
        availableSupplies,
        lowStockSupplies,
        expiredSupplies,
        supplyTableBody,
        emptyState,
        supplySearch,
        categoryFilter,
        statusFilter,
        supplyModal,
        openAddModalButton,
        closeModalButton,
        cancelButton,
        modalTitle,
        supplyForm,
        editingSupplyId,
        supplyName,
        supplyCategory,
        supplyQuantity,
        supplyUnit,
        expirationDate,
        lowStockLevel,
        formMessage,
        deleteModal,
        cancelDelete,
        confirmDelete
    ];

    if (requiredElements.some(function (element) {
        return !element;
    })) {
        console.error(
            "Medical Supplies page is missing one or more required HTML elements."
        );

        return;
    }

    // =====================================
    // LOGIN AND ROLE CHECK
    // =====================================

    if (
        !window.medtrackAuth ||
        typeof window.medtrackAuth.requireRoles !== "function"
    ) {
        console.error("MedTrack authentication is unavailable.");
        return;
    }

    const currentUser =
        await window.medtrackAuth.requireRoles([
            "admin",
            "staff"
        ]);

    if (!currentUser) {
        return;
    }

    const displayName =
        currentUser.fullname ||
        currentUser.username ||
        "MedTrack User";

    currentUserName.textContent = displayName;
    currentUserRole.textContent =
        currentUser.role || "User";

    if (currentUser.role === "admin") {
        portalName.textContent = "Admin Portal";
        dashboardLink.href = "admin-dashboard.html";
        adminNavigation.hidden = false;
    } else {
        portalName.textContent = "Staff Portal";
        dashboardLink.href = "staff-dashboard.html";
        adminNavigation.hidden = true;
    }

    // =====================================
    // DEFAULT MEDICAL SUPPLIES
    // =====================================

    const defaultSupplies = [
        {
            id: "MED-001",
            name: "First Aid Kit",
            category: "First Aid",
            quantity: 4,
            unit: "Sets",
            expirationDate: "2027-06-15",
            lowStockLevel: 10
        },
        {
            id: "MED-002",
            name: "Medical Gloves",
            category: "Protective Equipment",
            quantity: 35,
            unit: "Boxes",
            expirationDate: "2026-07-10",
            lowStockLevel: 10
        },
        {
            id: "MED-003",
            name: "Paracetamol",
            category: "Medicine",
            quantity: 80,
            unit: "Boxes",
            expirationDate: "2027-08-20",
            lowStockLevel: 20
        },
        {
            id: "MED-004",
            name: "Face Masks",
            category: "Protective Equipment",
            quantity: 100,
            unit: "Boxes",
            expirationDate: "2028-01-12",
            lowStockLevel: 20
        }
    ];

    const storageKey = "medtrackMedicalSupplies";

    // =====================================
    // SAFE VALUE FUNCTIONS
    // =====================================

    function normalizeId(value) {
        return String(value ?? "").trim();
    }

    function normalizeText(value) {
        return String(value ?? "").trim();
    }

    function escapeHTML(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    // =====================================
    // LOCAL STORAGE
    // =====================================

    function getSupplies() {
        const savedSupplies =
            localStorage.getItem(storageKey);

        if (savedSupplies === null) {
            const initialSupplies =
                defaultSupplies.map(function (supply) {
                    return { ...supply };
                });

            saveSupplies(initialSupplies);
            return initialSupplies;
        }

        try {
            const parsedSupplies =
                JSON.parse(savedSupplies);

            if (!Array.isArray(parsedSupplies)) {
                return [];
            }

            return parsedSupplies.filter(function (supply) {
                return (
                    supply &&
                    typeof supply === "object"
                );
            });
        } catch (error) {
            console.error(
                "Unable to read medical supplies:",
                error
            );

            return [];
        }
    }

    function saveSupplies(supplies) {
        try {
            localStorage.setItem(
                storageKey,
                JSON.stringify(supplies)
            );

            return true;
        } catch (error) {
            console.error(
                "Unable to save medical supplies:",
                error
            );

            return false;
        }
    }

    // =====================================
    // STATUS CALCULATION
    // =====================================

    function getSupplyStatus(supply) {
        const quantity =
            Number(supply.quantity) || 0;

        const lowStock =
            Number(supply.lowStockLevel) || 0;

        const expirationValue =
            normalizeText(supply.expirationDate);

        if (expirationValue) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const expiration =
                new Date(
                    expirationValue + "T00:00:00"
                );

            if (
                !Number.isNaN(expiration.getTime()) &&
                expiration < today
            ) {
                return "Expired";
            }
        }

        if (quantity <= 0) {
            return "Out of Stock";
        }

        if (quantity <= lowStock) {
            return "Low Stock";
        }

        return "Available";
    }

    function getStatusClass(status) {
        const classes = {
            "Available": "status-available",
            "Low Stock": "status-low-stock",
            "Out of Stock": "status-out-of-stock",
            "Expired": "status-expired"
        };

        return classes[status] || "status-expired";
    }

    // =====================================
    // DATE FORMAT
    // =====================================

    function formatDate(dateValue) {
        const normalizedDate =
            normalizeText(dateValue);

        if (!normalizedDate) {
            return "No expiration";
        }

        const date =
            new Date(
                normalizedDate + "T00:00:00"
            );

        if (Number.isNaN(date.getTime())) {
            return normalizedDate;
        }

        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
    }

    // =====================================
    // GENERATE SUPPLY ID
    // =====================================

    function generateSupplyId(supplies) {
        let highestNumber = 0;

        supplies.forEach(function (supply) {
            const supplyId =
                normalizeId(supply.id);

            const match =
                supplyId.match(/^MED-(\d+)$/i);

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
            "MED-" +
            String(highestNumber + 1).padStart(3, "0")
        );
    }

    // =====================================
    // UPDATE STATISTICS
    // =====================================

    function updateStatistics(supplies) {
        let availableCount = 0;
        let lowStockCount = 0;
        let expiredCount = 0;
        let notificationTotal = 0;

        supplies.forEach(function (supply) {
            const status =
                getSupplyStatus(supply);

            if (status === "Available") {
                availableCount++;
            }

            if (status === "Low Stock") {
                lowStockCount++;
                notificationTotal++;
            }

            if (status === "Expired") {
                expiredCount++;
                notificationTotal++;
            }

            if (status === "Out of Stock") {
                notificationTotal++;
            }
        });

        totalSupplies.textContent =
            String(supplies.length);

        availableSupplies.textContent =
            String(availableCount);

        lowStockSupplies.textContent =
            String(lowStockCount);

        expiredSupplies.textContent =
            String(expiredCount);

        notificationCount.textContent =
            String(notificationTotal);
    }

    // =====================================
    // RENDER SUPPLIES
    // =====================================

    function renderSupplies() {
        const supplies = getSupplies();

        const searchValue =
            normalizeText(supplySearch.value)
                .toLowerCase();

        const selectedCategory =
            categoryFilter.value;

        const selectedStatus =
            statusFilter.value;

        const filteredSupplies =
            supplies.filter(function (supply) {
                const id =
                    normalizeId(supply.id);

                const name =
                    normalizeText(supply.name);

                const category =
                    normalizeText(supply.category);

                const status =
                    getSupplyStatus(supply);

                const searchableText =
                    `${id} ${name} ${category}`
                        .toLowerCase();

                const matchesSearch =
                    searchableText.includes(
                        searchValue
                    );

                const matchesCategory =
                    selectedCategory === "all" ||
                    category === selectedCategory;

                const matchesStatus =
                    selectedStatus === "all" ||
                    status === selectedStatus;

                return (
                    matchesSearch &&
                    matchesCategory &&
                    matchesStatus
                );
            });

        supplyTableBody.innerHTML = "";

        emptyState.classList.toggle(
            "show",
            filteredSupplies.length === 0
        );

        filteredSupplies.forEach(function (supply) {
            const id =
                normalizeId(supply.id);

            const status =
                getSupplyStatus(supply);

            const statusClass =
                getStatusClass(status);

            const row =
                document.createElement("tr");

            row.innerHTML = `
                <td>
                    ${escapeHTML(id)}
                </td>

                <td>
                    <strong>
                        ${escapeHTML(supply.name)}
                    </strong>
                </td>

                <td>
                    ${escapeHTML(supply.category)}
                </td>

                <td>
                    ${escapeHTML(supply.quantity)}
                </td>

                <td>
                    ${escapeHTML(supply.unit)}
                </td>

                <td>
                    ${escapeHTML(
                        formatDate(
                            supply.expirationDate
                        )
                    )}
                </td>

                <td>
                    <span class="status-badge ${statusClass}">
                        ${escapeHTML(status)}
                    </span>
                </td>

                <td>
                    <div class="table-actions">
                        <button
                            type="button"
                            class="edit-button"
                            data-action="edit"
                            data-id="${escapeHTML(id)}"
                            title="Edit supply"
                            aria-label="Edit ${escapeHTML(supply.name)}"
                        >
                            <i class="fa-solid fa-pen"></i>
                        </button>

                        <button
                            type="button"
                            class="remove-button"
                            data-action="delete"
                            data-id="${escapeHTML(id)}"
                            title="Delete supply"
                            aria-label="Delete ${escapeHTML(supply.name)}"
                        >
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;

            supplyTableBody.appendChild(row);
        });

        updateStatistics(supplies);
    }

    // =====================================
    // OPEN ADD MODAL
    // =====================================

    function openAddModal() {
        supplyForm.reset();

        editingSupplyId.value = "";
        lowStockLevel.value = "10";
        modalTitle.textContent =
            "Add Medical Supply";

        formMessage.textContent = "";

        supplyModal.classList.add("show");
        supplyName.focus();
    }

    // =====================================
    // OPEN EDIT MODAL
    // =====================================

    function openEditModal(supplyId) {
        const normalizedSupplyId =
            normalizeId(supplyId);

        const supplies = getSupplies();

        const supply =
            supplies.find(function (item) {
                return (
                    normalizeId(item.id) ===
                    normalizedSupplyId
                );
            });

        if (!supply) {
            alert("The selected supply could not be found.");
            return;
        }

        editingSupplyId.value =
            normalizeId(supply.id);

        supplyName.value =
            normalizeText(supply.name);

        supplyCategory.value =
            normalizeText(supply.category);

        supplyQuantity.value =
            Number(supply.quantity) || 0;

        supplyUnit.value =
            normalizeText(supply.unit);

        expirationDate.value =
            normalizeText(supply.expirationDate);

        lowStockLevel.value =
            Number(supply.lowStockLevel) || 1;

        modalTitle.textContent =
            "Edit Medical Supply";

        formMessage.textContent = "";

        supplyModal.classList.add("show");
        supplyName.focus();
    }

    // =====================================
    // CLOSE SUPPLY MODAL
    // =====================================

    function closeSupplyModal() {
        supplyModal.classList.remove("show");
        supplyForm.reset();

        formMessage.textContent = "";
        editingSupplyId.value = "";
    }

    // =====================================
    // SAVE OR UPDATE SUPPLY
    // =====================================

    supplyForm.addEventListener(
        "submit",
        function (event) {
            event.preventDefault();

            const nameValue =
                normalizeText(supplyName.value);

            const categoryValue =
                normalizeText(supplyCategory.value);

            const quantityValue =
                Number(supplyQuantity.value);

            const unitValue =
                normalizeText(supplyUnit.value);

            const expirationValue =
                expirationDate.value;

            const lowStockValue =
                Number(lowStockLevel.value);

            if (
                !nameValue ||
                !categoryValue ||
                !unitValue ||
                !expirationValue
            ) {
                formMessage.textContent =
                    "Please complete all fields.";

                return;
            }

            if (
                !Number.isFinite(quantityValue) ||
                quantityValue < 0
            ) {
                formMessage.textContent =
                    "Quantity must be zero or greater.";

                return;
            }

            if (
                !Number.isFinite(lowStockValue) ||
                lowStockValue < 1
            ) {
                formMessage.textContent =
                    "Low-stock level must be at least 1.";

                return;
            }

            const supplies = getSupplies();

            const editId =
                normalizeId(editingSupplyId.value);

            if (editId) {
                const supplyIndex =
                    supplies.findIndex(
                        function (item) {
                            return (
                                normalizeId(item.id) ===
                                editId
                            );
                        }
                    );

                if (supplyIndex === -1) {
                    formMessage.textContent =
                        "The selected supply could not be found.";

                    return;
                }

                supplies[supplyIndex] = {
                    ...supplies[supplyIndex],
                    id: normalizeId(
                        supplies[supplyIndex].id
                    ),
                    name: nameValue,
                    category: categoryValue,
                    quantity: quantityValue,
                    unit: unitValue,
                    expirationDate: expirationValue,
                    lowStockLevel: lowStockValue
                };
            } else {
                supplies.push({
                    id: generateSupplyId(supplies),
                    name: nameValue,
                    category: categoryValue,
                    quantity: quantityValue,
                    unit: unitValue,
                    expirationDate: expirationValue,
                    lowStockLevel: lowStockValue
                });
            }

            if (!saveSupplies(supplies)) {
                formMessage.textContent =
                    "Unable to save the supply.";

                return;
            }

            closeSupplyModal();
            renderSupplies();
        }
    );

    // =====================================
    // EDIT AND DELETE BUTTONS
    // =====================================

    supplyTableBody.addEventListener(
        "click",
        function (event) {
            const button =
                event.target.closest(
                    ".edit-button, .remove-button"
                );

            if (
                !button ||
                !supplyTableBody.contains(button)
            ) {
                return;
            }

            const action =
                button.dataset.action;

            const supplyId =
                normalizeId(button.dataset.id);

            if (!supplyId) {
                return;
            }

            if (action === "edit") {
                openEditModal(supplyId);
                return;
            }

            if (action === "delete") {
                supplyToDelete = supplyId;
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
            const deleteId =
                normalizeId(supplyToDelete);

            if (!deleteId) {
                return;
            }

            const supplies = getSupplies();

            const supplyExists =
                supplies.some(function (supply) {
                    return (
                        normalizeId(supply.id) ===
                        deleteId
                    );
                });

            if (!supplyExists) {
                supplyToDelete = null;
                deleteModal.classList.remove("show");

                alert(
                    "The selected supply could not be found."
                );

                return;
            }

            const updatedSupplies =
                supplies.filter(function (supply) {
                    return (
                        normalizeId(supply.id) !==
                        deleteId
                    );
                });

            if (!saveSupplies(updatedSupplies)) {
                alert(
                    "Unable to delete the selected supply."
                );

                return;
            }

            supplyToDelete = null;
            deleteModal.classList.remove("show");

            renderSupplies();
        }
    );

    // =====================================
    // CANCEL DELETE
    // =====================================

    cancelDelete.addEventListener(
        "click",
        function () {
            supplyToDelete = null;
            deleteModal.classList.remove("show");
        }
    );

    // =====================================
    // SEARCH AND FILTERS
    // =====================================

    supplySearch.addEventListener(
        "input",
        renderSupplies
    );

    categoryFilter.addEventListener(
        "change",
        renderSupplies
    );

    statusFilter.addEventListener(
        "change",
        renderSupplies
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
        closeSupplyModal
    );

    cancelButton.addEventListener(
        "click",
        closeSupplyModal
    );

    supplyModal.addEventListener(
        "click",
        function (event) {
            if (event.target === supplyModal) {
                closeSupplyModal();
            }
        }
    );

    deleteModal.addEventListener(
        "click",
        function (event) {
            if (event.target === deleteModal) {
                supplyToDelete = null;
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

            if (supplyModal.classList.contains("show")) {
                closeSupplyModal();
            }

            if (deleteModal.classList.contains("show")) {
                supplyToDelete = null;
                deleteModal.classList.remove("show");
            }
        }
    );

    // =====================================
    // NOTIFICATION BUTTON
    // =====================================

    notificationButton.addEventListener(
        "click",
        function () {
            const supplies = getSupplies();

            const alerts =
                supplies.filter(function (supply) {
                    return (
                        getSupplyStatus(supply) !==
                        "Available"
                    );
                });

            if (alerts.length === 0) {
                alert(
                    "There are no medical supply alerts."
                );

                return;
            }

            alert(
                `There are ${alerts.length} medical supplies requiring attention.`
            );
        }
    );

    // =====================================
    // UPDATE FROM OTHER BROWSER TABS
    // =====================================

    window.addEventListener(
        "storage",
        function (event) {
            if (event.key === storageKey) {
                renderSupplies();
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

    renderSupplies();
});