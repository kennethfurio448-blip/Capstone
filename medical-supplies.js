
document.addEventListener("DOMContentLoaded", async function () {
    "use strict";


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

    const supplyHistoryBody =
        document.getElementById("supplyHistoryBody");

    const historyMessage =
        document.getElementById("historyMessage");

    const consumeModal =
        document.getElementById("consumeModal");

    const openConsumeModalButton =
        document.getElementById("openConsumeModal");

    const closeConsumeModalButton =
        document.getElementById("closeConsumeModal");

    const cancelConsumeButton =
        document.getElementById("cancelConsume");

    const consumeForm =
        document.getElementById("consumeForm");

    const consumeEmergency =
        document.getElementById("consumeEmergency");

    const consumeSupply =
        document.getElementById("consumeSupply");

    const consumeQuantity =
        document.getElementById("consumeQuantity");

    const consumedAt =
        document.getElementById("consumedAt");

    const consumeAvailability =
        document.getElementById("consumeAvailability");

    const consumeFormMessage =
        document.getElementById("consumeFormMessage");

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

    const saveSupplyButton =
        supplyForm.querySelector("button[type='submit']");

    const deleteModal =
        document.getElementById("deleteModal");

    const cancelDelete =
        document.getElementById("cancelDelete");

    const confirmDelete =
        document.getElementById("confirmDelete");

    let supplyToDelete = null;
    let supplyTransactions = [];


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
        supplyHistoryBody,
        historyMessage,
        consumeModal,
        openConsumeModalButton,
        closeConsumeModalButton,
        cancelConsumeButton,
        consumeForm,
        consumeEmergency,
        consumeSupply,
        consumeQuantity,
        consumedAt,
        consumeAvailability,
        consumeFormMessage,
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
        saveSupplyButton,
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

    openAddModalButton.hidden = !canManageInventory;


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

    function formatDateTime(dateValue) {
        const date = new Date(dateValue);

        if (Number.isNaN(date.getTime())) {
            return "\u2014";
        }

        return date.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit"
        });
    }

    function getLocalDateTimeValue() {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;

        return new Date(now.getTime() - offset)
            .toISOString()
            .slice(0, 16);
    }

    function generateOperationKey(prefix) {
        const uniquePart =
            window.crypto &&
            typeof window.crypto.randomUUID === "function"
                ? window.crypto.randomUUID()
                : `${Date.now()}-${Math.random()
                    .toString(16)
                    .slice(2)}`;

        return `${prefix}:${uniquePart}`;
    }

    async function loadSupplyTransactions() {
        historyMessage.textContent = "";

        if (
            !window.medtrackData ||
            typeof window.medtrackData
                .loadSupplyTransactions !== "function"
        ) {
            supplyTransactions = [];
            historyMessage.textContent =
                "Supply activity is currently unavailable.";
            renderSupplyTransactions();
            return;
        }

        try {
            supplyTransactions =
                await window.medtrackData
                    .loadSupplyTransactions();
            openAddModalButton.disabled = false;
            openConsumeModalButton.disabled = false;
            renderSupplyTransactions();
        } catch (error) {
            console.error(
                "Unable to load supply activity:",
                error
            );
            supplyTransactions = [];
            const databaseUpdateMissing =
                /schema cache|medical_supply_transactions|could not find/i
                    .test(error.message || "");

            historyMessage.textContent = databaseUpdateMissing
                ? "Database setup required: apply the latest Supabase " +
                    "migration to enable supply additions and consumption."
                : "Unable to load supply activity. Please refresh and " +
                    "try again.";

            openAddModalButton.disabled = databaseUpdateMissing;
            openConsumeModalButton.disabled = databaseUpdateMissing;
            renderSupplyTransactions();
        }
    }

    function renderSupplyTransactions() {
        if (supplyTransactions.length === 0) {
            supplyHistoryBody.innerHTML = `
                <tr>
                    <td colspan="6">No supply activity recorded yet.</td>
                </tr>
            `;
            return;
        }

        supplyHistoryBody.innerHTML = supplyTransactions
            .map(function (transaction) {
                const consumed =
                    transaction.type === "consumed";

                return `
                    <tr>
                        <td>
                            <span class="movement-badge ${
                                consumed ? "consumed" : "added"
                            }">
                                ${consumed ? "Consumed" : "Added"}
                            </span>
                        </td>
                        <td>
                            <strong>${escapeHTML(
                                transaction.supplyName
                            )}</strong>
                            <small>${escapeHTML(
                                transaction.supplyId
                            )}</small>
                        </td>
                        <td>
                            ${escapeHTML(transaction.quantity)}
                            ${escapeHTML(transaction.unit)}
                        </td>
                        <td>${escapeHTML(
                            transaction.emergencyLabel
                        )}</td>
                        <td>${escapeHTML(
                            formatDateTime(transaction.occurredAt)
                        )}</td>
                        <td>
                            <strong>${escapeHTML(
                                transaction.remainingStock
                            )}</strong>
                            ${escapeHTML(transaction.unit)}
                        </td>
                    </tr>
                `;
            })
            .join("");
    }

    function getEmergencyResponses() {
        try {
            const records = JSON.parse(
                localStorage.getItem(
                    "medtrackEmergencyRequests"
                ) || "[]"
            );

            return Array.isArray(records) ? records : [];
        } catch (error) {
            console.error(
                "Unable to read emergency responses:",
                error
            );
            return [];
        }
    }

    function populateConsumptionOptions() {
        const supplies = getSupplies()
            .filter(function (supply) {
                return Number(supply.quantity) > 0;
            });

        const emergencies = getEmergencyResponses()
            .sort(function (first, second) {
                return String(second.date || "")
                    .localeCompare(String(first.date || ""));
            });

        consumeSupply.innerHTML =
            '<option value="">Select medical supply</option>' +
            supplies.map(function (supply) {
                return `
                    <option value="${escapeHTML(supply.id)}">
                        ${escapeHTML(supply.name)}
                        (${escapeHTML(supply.quantity)}
                        ${escapeHTML(supply.unit)} available)
                    </option>
                `;
            }).join("");

        consumeEmergency.innerHTML =
            '<option value="">Select emergency response</option>' +
            emergencies.map(function (request) {
                return `
                    <option value="${escapeHTML(request.id)}">
                        ${escapeHTML(request.id)} -
                        ${escapeHTML(request.type)} -
                        ${escapeHTML(request.location)}
                    </option>
                `;
            }).join("");
    }

    function updateConsumptionAvailability() {
        const selectedId = normalizeId(consumeSupply.value);
        const supply = getSupplies().find(function (item) {
            return normalizeId(item.id) === selectedId;
        });

        if (!supply) {
            consumeAvailability.textContent =
                "Select a supply to view available stock.";
            consumeQuantity.removeAttribute("max");
            return;
        }

        const availableQuantity = Number(supply.quantity) || 0;
        consumeQuantity.max = String(availableQuantity);
        consumeAvailability.textContent =
            `${availableQuantity} ${supply.unit} currently available.`;
    }

    function openConsumeModal() {
        consumeForm.reset();
        populateConsumptionOptions();
        consumedAt.value = getLocalDateTimeValue();
        consumeQuantity.value = "1";
        consumeFormMessage.textContent = "";
        updateConsumptionAvailability();
        consumeModal.classList.add("show");
        consumeEmergency.focus();
    }

    function closeConsumeModal() {
        consumeModal.classList.remove("show");
        consumeForm.reset();
        consumeFormMessage.textContent = "";
        consumeAvailability.textContent =
            "Select a supply to view available stock.";
    }


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
                    ${canManageInventory ? `
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
                    ` : "\u2014"}
                </td>
            `;

            supplyTableBody.appendChild(row);
        });

        updateStatistics(supplies);
    }


    function openAddModal() {
        if (!canManageInventory) {
            return;
        }

        supplyForm.reset();

        editingSupplyId.value = "";
        supplyQuantity.min = "1";
        lowStockLevel.value = "10";
        modalTitle.textContent =
            "Add Medical Supply";

        formMessage.textContent = "";

        supplyModal.classList.add("show");
        supplyName.focus();
    }


    function openEditModal(supplyId) {
        if (!canManageInventory) {
            return;
        }

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

        supplyQuantity.min = String(
            Number(supply.quantity) || 0
        );

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


    function closeSupplyModal() {
        supplyModal.classList.remove("show");
        supplyForm.reset();

        formMessage.textContent = "";
        editingSupplyId.value = "";
    }


    supplyForm.addEventListener(
        "submit",
        async function (event) {
            event.preventDefault();

            if (!canManageInventory) {
                formMessage.textContent =
                    "Administrator access is required.";
                return;
            }

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

            let supplyId = editId;

            if (!editId && quantityValue < 1) {
                formMessage.textContent =
                    "A new supply must start with at least 1 item.";
                return;
            }

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

                const currentQuantity =
                    Number(supplies[supplyIndex].quantity) || 0;

                if (quantityValue < currentQuantity) {
                    formMessage.textContent =
                        "Use Record Consumed Supplies to reduce stock.";
                    return;
                }
            } else {
                supplyId = generateSupplyId(supplies);
            }

            if (
                !window.medtrackData ||
                typeof window.medtrackData
                    .saveMedicalSupply !== "function"
            ) {
                formMessage.textContent =
                    "Supply saving is unavailable. Apply the latest " +
                    "Supabase migration and refresh the page.";
                return;
            }

            saveSupplyButton.disabled = true;
            formMessage.textContent = "Saving supply...";

            try {
                await window.medtrackData.saveMedicalSupply({
                    operationKey:
                        generateOperationKey("SUPPLY-ADD"),
                    id: supplyId,
                    name: nameValue,
                    category: categoryValue,
                    quantity: quantityValue,
                    unit: unitValue,
                    expirationDate: expirationValue,
                    lowStockLevel: lowStockValue
                });

                closeSupplyModal();
                renderSupplies();
                await loadSupplyTransactions();
            } catch (error) {
                console.error("Unable to save supply:", error);
                formMessage.textContent =
                    error.message || "Unable to save the supply.";
            } finally {
                saveSupplyButton.disabled = false;
            }
        }
    );


    consumeForm.addEventListener(
        "submit",
        async function (event) {
            event.preventDefault();

            const emergencyId =
                normalizeId(consumeEmergency.value);

            const supplyId =
                normalizeId(consumeSupply.value);

            const quantity =
                Number(consumeQuantity.value);

            const consumptionDate =
                new Date(consumedAt.value);

            const supply = getSupplies().find(function (item) {
                return normalizeId(item.id) === supplyId;
            });

            const emergency =
                getEmergencyResponses().find(function (request) {
                    return normalizeId(request.id) === emergencyId;
                });

            if (!emergencyId || !supplyId || !consumedAt.value) {
                consumeFormMessage.textContent =
                    "Select an emergency, a supply, and the date and time.";
                return;
            }

            if (!Number.isInteger(quantity) || quantity < 1) {
                consumeFormMessage.textContent =
                    "Quantity consumed must be a whole number of at least 1.";
                return;
            }

            if (!supply) {
                consumeFormMessage.textContent =
                    "The selected supply could not be found.";
                return;
            }

            if (!emergency) {
                consumeFormMessage.textContent =
                    "The selected emergency response could not be found.";
                return;
            }

            if (quantity > (Number(supply.quantity) || 0)) {
                consumeFormMessage.textContent =
                    `Only ${Number(supply.quantity) || 0} ` +
                    `${supply.unit} are currently available.`;
                return;
            }

            if (Number.isNaN(consumptionDate.getTime())) {
                consumeFormMessage.textContent =
                    "Enter a valid consumption date and time.";
                return;
            }

            if (
                !window.medtrackData ||
                typeof window.medtrackData
                    .consumeMedicalSupply !== "function"
            ) {
                consumeFormMessage.textContent =
                    "Supply consumption is unavailable. Apply the latest " +
                    "Supabase migration and refresh the page.";
                return;
            }

            const submitButton =
                consumeForm.querySelector("button[type='submit']");

            submitButton.disabled = true;
            consumeFormMessage.textContent =
                "Recording consumption...";

            try {
                await window.medtrackData.consumeMedicalSupply({
                    operationKey:
                        generateOperationKey("SUPPLY-CONSUME"),
                    supplyId: supplyId,
                    emergencyRequestId: emergencyId,
                    emergencyLabel:
                        `${emergency.id} - ${emergency.type} - ` +
                        emergency.location,
                    quantity: quantity,
                    consumedAt: consumptionDate.toISOString()
                });

                closeConsumeModal();
                renderSupplies();
                await loadSupplyTransactions();
            } catch (error) {
                console.error(
                    "Unable to record consumed supplies:",
                    error
                );
                consumeFormMessage.textContent =
                    error.message ||
                    "Unable to record the consumed supplies.";
            } finally {
                submitButton.disabled = false;
            }
        }
    );


    supplyTableBody.addEventListener(
        "click",
        function (event) {
            const button =
                event.target.closest(
                    ".edit-button, .remove-button"
                );

            if (
                !button ||
                !supplyTableBody.contains(button) ||
                !canManageInventory
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


    confirmDelete.addEventListener(
        "click",
        function () {
            if (!canManageInventory) {
                return;
            }

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


    cancelDelete.addEventListener(
        "click",
        function () {
            supplyToDelete = null;
            deleteModal.classList.remove("show");
        }
    );


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

    consumeSupply.addEventListener(
        "change",
        updateConsumptionAvailability
    );


    openAddModalButton.addEventListener(
        "click",
        openAddModal
    );

    openConsumeModalButton.addEventListener(
        "click",
        openConsumeModal
    );

    closeModalButton.addEventListener(
        "click",
        closeSupplyModal
    );

    cancelButton.addEventListener(
        "click",
        closeSupplyModal
    );

    closeConsumeModalButton.addEventListener(
        "click",
        closeConsumeModal
    );

    cancelConsumeButton.addEventListener(
        "click",
        closeConsumeModal
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

    consumeModal.addEventListener(
        "click",
        function (event) {
            if (event.target === consumeModal) {
                closeConsumeModal();
            }
        }
    );


    document.addEventListener(
        "keydown",
        function (event) {
            if (event.key !== "Escape") {
                return;
            }

            if (supplyModal.classList.contains("show")) {
                closeSupplyModal();
            }

            if (consumeModal.classList.contains("show")) {
                closeConsumeModal();
            }

            if (deleteModal.classList.contains("show")) {
                supplyToDelete = null;
                deleteModal.classList.remove("show");
            }
        }
    );


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


    window.addEventListener(
        "storage",
        function (event) {
            if (event.key === storageKey) {
                renderSupplies();
            }
        }
    );

    window.addEventListener(
        "medtrack:data-ready",
        function () {
            renderSupplies();
        }
    );

    window.addEventListener(
        "focus",
        loadSupplyTransactions
    );


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


    renderSupplies();
    await loadSupplyTransactions();
});
