// =====================================
// MEDTRACK MEDICAL SUPPLIES
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

    // ID of the supply waiting to be deleted
    let supplyToDelete = null;

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

    // Redirect if not logged in
    if (!currentUser) {
        window.location.replace("login.html");
        return;
    }

    // Only Admin and Staff can access this page
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

    // Change sidebar based on role
    if (currentUser.role === "admin") {
        portalName.textContent = "Admin Portal";
        dashboardLink.href = "admin-dashboard.html";
        adminNavigation.style.display = "block";
    } else {
        portalName.textContent = "Staff Portal";
        dashboardLink.href = "staff-dashboard.html";

        // Staff cannot see Admin navigation
        adminNavigation.style.display = "none";
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

    // =====================================
    // LOCAL STORAGE
    // =====================================

    function getSupplies() {
        const savedSupplies =
            localStorage.getItem("medtrackMedicalSupplies");

        if (!savedSupplies) {
            localStorage.setItem(
                "medtrackMedicalSupplies",
                JSON.stringify(defaultSupplies)
            );

            return [...defaultSupplies];
        }

        try {
            const parsedSupplies = JSON.parse(savedSupplies);

            return Array.isArray(parsedSupplies)
                ? parsedSupplies
                : [];
        } catch (error) {
            return [];
        }
    }

    function saveSupplies(supplies) {
        localStorage.setItem(
            "medtrackMedicalSupplies",
            JSON.stringify(supplies)
        );
    }

    // =====================================
    // STATUS CALCULATION
    // =====================================

    function getSupplyStatus(supply) {
        const quantity = Number(supply.quantity);
        const lowStock = Number(supply.lowStockLevel);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const expiry = new Date(
            supply.expirationDate + "T00:00:00"
        );

        if (
            supply.expirationDate &&
            expiry < today
        ) {
            return "Expired";
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
        if (status === "Available") {
            return "status-available";
        }

        if (status === "Low Stock") {
            return "status-low-stock";
        }

        if (status === "Out of Stock") {
            return "status-out-of-stock";
        }

        return "status-expired";
    }

    // =====================================
    // SAFELY DISPLAY TEXT
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
    // DATE FORMAT
    // =====================================

    function formatDate(dateValue) {
        if (!dateValue) {
            return "No expiration";
        }

        const date = new Date(dateValue + "T00:00:00");

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
            const number = Number(
                String(supply.id).replace("MED-", "")
            );

            if (!Number.isNaN(number) && number > highestNumber) {
                highestNumber = number;
            }
        });

        return `MED-${String(highestNumber + 1).padStart(3, "0")}`;
    }

    // =====================================
    // RENDER SUPPLIES
    // =====================================

    function renderSupplies() {
        const supplies = getSupplies();

        const searchValue =
            supplySearch.value.trim().toLowerCase();

        const selectedCategory =
            categoryFilter.value;

        const selectedStatus =
            statusFilter.value;

        const filteredSupplies = supplies.filter(function (supply) {
            const status = getSupplyStatus(supply);

            const matchesSearch =
                supply.name.toLowerCase().includes(searchValue) ||
                supply.category.toLowerCase().includes(searchValue) ||
                supply.id.toLowerCase().includes(searchValue);

            const matchesCategory =
                selectedCategory === "all" ||
                supply.category === selectedCategory;

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

        if (filteredSupplies.length === 0) {
            emptyState.classList.add("show");
        } else {
            emptyState.classList.remove("show");
        }

        filteredSupplies.forEach(function (supply) {
            const status = getSupplyStatus(supply);
            const statusClass = getStatusClass(status);

            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${escapeHTML(supply.id)}</td>

                <td>
                    <strong>${escapeHTML(supply.name)}</strong>
                </td>

                <td>${escapeHTML(supply.category)}</td>

                <td>${escapeHTML(supply.quantity)}</td>

                <td>${escapeHTML(supply.unit)}</td>

                <td>${escapeHTML(
                    formatDate(supply.expirationDate)
                )}</td>

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
                            data-id="${escapeHTML(supply.id)}"
                            title="Edit supply"
                        >
                            <i class="fa-solid fa-pen"></i>
                        </button>

                        <button
                            type="button"
                            class="remove-button"
                            data-action="delete"
                            data-id="${escapeHTML(supply.id)}"
                            title="Delete supply"
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
    // UPDATE STATISTICS
    // =====================================

    function updateStatistics(supplies) {
        let availableCount = 0;
        let lowStockCount = 0;
        let expiredCount = 0;
        let notificationTotal = 0;

        supplies.forEach(function (supply) {
            const status = getSupplyStatus(supply);

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

        totalSupplies.textContent = supplies.length;
        availableSupplies.textContent = availableCount;
        lowStockSupplies.textContent = lowStockCount;
        expiredSupplies.textContent = expiredCount;
        notificationCount.textContent = notificationTotal;
    }

    // =====================================
    // OPEN ADD MODAL
    // =====================================

    function openAddModal() {
        supplyForm.reset();

        editingSupplyId.value = "";
        lowStockLevel.value = "10";
        modalTitle.textContent = "Add Medical Supply";
        formMessage.textContent = "";

        supplyModal.classList.add("show");
        supplyName.focus();
    }

    // =====================================
    // OPEN EDIT MODAL
    // =====================================

    function openEditModal(supplyId) {
        const supplies = getSupplies();

        const supply = supplies.find(function (item) {
            return item.id === supplyId;
        });

        if (!supply) {
            return;
        }

        editingSupplyId.value = supply.id;
        supplyName.value = supply.name;
        supplyCategory.value = supply.category;
        supplyQuantity.value = supply.quantity;
        supplyUnit.value = supply.unit;
        expirationDate.value = supply.expirationDate;
        lowStockLevel.value = supply.lowStockLevel;

        modalTitle.textContent = "Edit Medical Supply";
        formMessage.textContent = "";

        supplyModal.classList.add("show");
        supplyName.focus();
    }

    function closeSupplyModal() {
        supplyModal.classList.remove("show");
        supplyForm.reset();
        formMessage.textContent = "";
        editingSupplyId.value = "";
    }

    // =====================================
    // SAVE OR UPDATE SUPPLY
    // =====================================

    supplyForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const nameValue = supplyName.value.trim();
        const categoryValue = supplyCategory.value;
        const quantityValue = Number(supplyQuantity.value);
        const unitValue = supplyUnit.value;
        const expirationValue = expirationDate.value;
        const lowStockValue = Number(lowStockLevel.value);

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

        if (quantityValue < 0) {
            formMessage.textContent =
                "Quantity cannot be less than zero.";

            return;
        }

        if (lowStockValue < 1) {
            formMessage.textContent =
                "Low-stock level must be at least 1.";

            return;
        }

        const supplies = getSupplies();
        const editId = editingSupplyId.value;

        if (editId) {
            const supplyIndex = supplies.findIndex(function (item) {
                return item.id === editId;
            });

            if (supplyIndex !== -1) {
                supplies[supplyIndex] = {
                    ...supplies[supplyIndex],
                    name: nameValue,
                    category: categoryValue,
                    quantity: quantityValue,
                    unit: unitValue,
                    expirationDate: expirationValue,
                    lowStockLevel: lowStockValue
                };
            }
        } else {
            const newSupply = {
                id: generateSupplyId(supplies),
                name: nameValue,
                category: categoryValue,
                quantity: quantityValue,
                unit: unitValue,
                expirationDate: expirationValue,
                lowStockLevel: lowStockValue
            };

            supplies.push(newSupply);
        }

        saveSupplies(supplies);
        closeSupplyModal();
        renderSupplies();
    });

    // =====================================
    // EDIT AND DELETE BUTTONS
    // =====================================

    supplyTableBody.addEventListener("click", function (event) {
        const button = event.target.closest("button");

        if (!button) {
            return;
        }

        const action = button.dataset.action;
        const supplyId = button.dataset.id;

        if (action === "edit") {
            openEditModal(supplyId);
        }

        if (action === "delete") {
            supplyToDelete = supplyId;
            deleteModal.classList.add("show");
        }
    });

    // Confirm delete
    confirmDelete.addEventListener("click", function () {
        if (!supplyToDelete) {
            return;
        }

        const supplies = getSupplies();

        const updatedSupplies = supplies.filter(function (supply) {
            return supply.id !== supplyToDelete;
        });

        saveSupplies(updatedSupplies);

        supplyToDelete = null;
        deleteModal.classList.remove("show");

        renderSupplies();
    });

    // Cancel delete
    cancelDelete.addEventListener("click", function () {
        supplyToDelete = null;
        deleteModal.classList.remove("show");
    });

    // =====================================
    // SEARCH AND FILTERS
    // =====================================

    supplySearch.addEventListener("input", renderSupplies);
    categoryFilter.addEventListener("change", renderSupplies);
    statusFilter.addEventListener("change", renderSupplies);

    // =====================================
    // MODAL BUTTONS
    // =====================================

    openAddModalButton.addEventListener("click", openAddModal);
    closeModalButton.addEventListener("click", closeSupplyModal);
    cancelButton.addEventListener("click", closeSupplyModal);

    // Close modal by clicking outside
    supplyModal.addEventListener("click", function (event) {
        if (event.target === supplyModal) {
            closeSupplyModal();
        }
    });

    deleteModal.addEventListener("click", function (event) {
        if (event.target === deleteModal) {
            supplyToDelete = null;
            deleteModal.classList.remove("show");
        }
    });

    // Close modal using Escape
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            closeSupplyModal();

            supplyToDelete = null;
            deleteModal.classList.remove("show");
        }
    });

    // =====================================
    // NOTIFICATION
    // =====================================

    notificationButton.addEventListener("click", function () {
        const supplies = getSupplies();

        const alerts = supplies.filter(function (supply) {
            return getSupplyStatus(supply) !== "Available";
        });

        if (alerts.length === 0) {
            alert("There are no supply alerts.");
            return;
        }

        alert(
            `There are ${alerts.length} medical supplies requiring attention.`
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

        // Remove only the login session
        localStorage.removeItem("medtrackCurrentUser");
        sessionStorage.removeItem("medtrackCurrentUser");

        window.location.replace("login.html");
    });

    // =====================================
    // INITIAL DISPLAY
    // =====================================

    renderSupplies();
});