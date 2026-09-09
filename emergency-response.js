// =====================================
// MEDTRACK EMERGENCY RESPONSE
// =====================================

document.addEventListener("DOMContentLoaded", async function () {
    "use strict";

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

    const totalRequests =
        document.getElementById("totalRequests");

    const pendingRequests =
        document.getElementById("pendingRequests");

    const activeRequests =
        document.getElementById("activeRequests");

    const completedRequests =
        document.getElementById("completedRequests");

    const requestTableBody =
        document.getElementById("requestTableBody");

    const emptyState =
        document.getElementById("emptyState");

    const requestSearch =
        document.getElementById("requestSearch");

    const emergencyTypeFilter =
        document.getElementById("emergencyTypeFilter");

    const priorityFilter =
        document.getElementById("priorityFilter");

    const statusFilter =
        document.getElementById("statusFilter");

    // Request form
    const requestModal =
        document.getElementById("requestModal");

    const openAddModalButton =
        document.getElementById("openAddModal");

    const closeModalButton =
        document.getElementById("closeModal");

    const cancelButton =
        document.getElementById("cancelButton");

    const modalTitle =
        document.getElementById("modalTitle");

    const requestForm =
        document.getElementById("requestForm");

    const editingRequestId =
        document.getElementById("editingRequestId");

    const requestDate =
        document.getElementById("requestDate");

    const requestTime =
        document.getElementById("requestTime");

    const emergencyType =
        document.getElementById("emergencyType");

    const requestPriority =
        document.getElementById("requestPriority");

    const requestLocation =
        document.getElementById("requestLocation");

    const contactPerson =
        document.getElementById("contactPerson");

    const contactNumber =
        document.getElementById("contactNumber");

    const assignedTeam =
        document.getElementById("assignedTeam");

    const requestStatus =
        document.getElementById("requestStatus");

    const resourceInventoryType =
        document.getElementById("resourceInventoryType");

    const resourceItem =
        document.getElementById("resourceItem");

    const resourceQuantity =
        document.getElementById("resourceQuantity");

    const resourceAvailability =
        document.getElementById("resourceAvailability");

    const requiredResources =
        document.getElementById("requiredResources");

    const requestDescription =
        document.getElementById("requestDescription");

    const formMessage =
        document.getElementById("formMessage");

    // Complete modal
    const completeModal =
        document.getElementById("completeModal");

    const cancelComplete =
        document.getElementById("cancelComplete");

    const confirmComplete =
        document.getElementById("confirmComplete");

    // Delete modal
    const deleteModal =
        document.getElementById("deleteModal");

    const cancelDelete =
        document.getElementById("cancelDelete");

    const confirmDelete =
        document.getElementById("confirmDelete");

    let requestToComplete = null;
    let requestToDelete = null;

    // =====================================
    // SHARED INVENTORY KEYS
    // =====================================

    const inventoryKeys = {
        "Medical Supply": "medtrackMedicalSupplies",
        "Medical Equipment": "medtrackMedicalEquipment",
        "Mobility Asset": "medtrackMobilityAssets"
    };

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

    const canDeleteEmergency =
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

    // =====================================
    // DATE AND TIME
    // =====================================

    function getCurrentDate() {
        const today = new Date();

        const year = today.getFullYear();

        const month =
            String(today.getMonth() + 1)
                .padStart(2, "0");

        const day =
            String(today.getDate())
                .padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    function getCurrentTime() {
        const now = new Date();

        const hours =
            String(now.getHours())
                .padStart(2, "0");

        const minutes =
            String(now.getMinutes())
                .padStart(2, "0");

        return `${hours}:${minutes}`;
    }

    function formatDateTime(dateValue, timeValue) {
        if (!dateValue) {
            return "—";
        }

        const date = new Date(
            `${dateValue}T${timeValue || "00:00"}`
        );

        if (Number.isNaN(date.getTime())) {
            return dateValue;
        }

        return date.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit"
        });
    }

    // =====================================
    // DEFAULT REQUESTS
    // =====================================

    const defaultRequests = [
        {
            id: "RES-001",
            date: "2026-08-28",
            time: "08:30",
            type: "Medical Emergency",
            priority: "High",
            location: "Barangay Central",
            contactPerson: "Juan Dela Cruz",
            contactNumber: "09123456789",
            assignedTeam: "Response Team A",
            status: "In Progress",
            resources: "Ambulance and first aid kit",
            description: "Medical assistance requested.",
            inventoryUsage: null,
            inventoryDeducted: false,
            inventoryDeductedAt: "",
            completedAt: ""
        },
        {
            id: "RES-002",
            date: "2026-08-28",
            time: "09:15",
            type: "Flood Response",
            priority: "Critical",
            location: "Riverside Area",
            contactPerson: "Maria Santos",
            contactNumber: "09987654321",
            assignedTeam: "Rescue Team B",
            status: "Pending",
            resources: "Rescue vehicle and safety equipment",
            description: "Residents requested evacuation assistance.",
            inventoryUsage: null,
            inventoryDeducted: false,
            inventoryDeductedAt: "",
            completedAt: ""
        },
        {
            id: "RES-003",
            date: "2026-08-27",
            time: "14:00",
            type: "Road Accident",
            priority: "Medium",
            location: "National Highway",
            contactPerson: "Pedro Reyes",
            contactNumber: "09112223333",
            assignedTeam: "Response Team C",
            status: "Completed",
            resources: "Ambulance and medical equipment",
            description: "Response team provided assistance.",
            inventoryUsage: null,
            inventoryDeducted: false,
            inventoryDeductedAt: "",
            completedAt: "2026-08-27T15:20:00"
        }
    ];

    // =====================================
    // REQUEST STORAGE
    // =====================================

    function getRequests() {
        const savedRequests =
            localStorage.getItem(
                "medtrackEmergencyRequests"
            );

        if (savedRequests === null) {
            localStorage.setItem(
                "medtrackEmergencyRequests",
                JSON.stringify(defaultRequests)
            );

            return defaultRequests.map(function (request) {
                return { ...request };
            });
        }

        try {
            const parsedRequests =
                JSON.parse(savedRequests);

            return Array.isArray(parsedRequests)
                ? parsedRequests
                : [];
        } catch (error) {
            console.error(
                "Unable to read emergency requests:",
                error
            );

            return [];
        }
    }

    function saveRequests(requests) {
        try {
            localStorage.setItem(
                "medtrackEmergencyRequests",
                JSON.stringify(requests)
            );

            return true;
        } catch (error) {
            console.error(
                "Unable to save emergency requests:",
                error
            );

            return false;
        }
    }

    // =====================================
    // INVENTORY STORAGE
    // =====================================

    function getInventoryRecords(itemType) {
        const storageKey =
            inventoryKeys[itemType];

        if (!storageKey) {
            return [];
        }

        try {
            const savedInventory =
                localStorage.getItem(storageKey);

            if (!savedInventory) {
                return [];
            }

            const parsedInventory =
                JSON.parse(savedInventory);

            return Array.isArray(parsedInventory)
                ? parsedInventory
                : [];
        } catch (error) {
            console.error(
                "Unable to read emergency inventory:",
                error
            );

            return [];
        }
    }

    function saveInventoryRecords(
        itemType,
        records
    ) {
        const storageKey =
            inventoryKeys[itemType];

        if (!storageKey) {
            return false;
        }

        try {
            localStorage.setItem(
                storageKey,
                JSON.stringify(records)
            );

            return true;
        } catch (error) {
            console.error(
                "Unable to update emergency inventory:",
                error
            );

            return false;
        }
    }

    // =====================================
    // SAFE VALUES
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

    function normalizeStatus(value) {
        return normalizeText(value).toLowerCase();
    }

    // =====================================
    // CSS CLASSES
    // =====================================

    function getStatusClass(status) {
        if (status === "Pending") {
            return "status-pending";
        }

        if (status === "In Progress") {
            return "status-in-progress";
        }

        if (status === "Completed") {
            return "status-completed";
        }

        return "status-cancelled";
    }

    function getPriorityClass(priority) {
        if (priority === "Critical") {
            return "priority-critical";
        }

        if (priority === "High") {
            return "priority-high";
        }

        if (priority === "Medium") {
            return "priority-medium";
        }

        return "priority-low";
    }

    // =====================================
    // GENERATE REQUEST ID
    // =====================================

    function generateRequestId(requests) {
        let highestNumber = 0;

        requests.forEach(function (request) {
            const requestId =
                normalizeId(request.id);

            const match =
                requestId.match(/^RES-(\d+)$/i);

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
            "RES-" +
            String(highestNumber + 1)
                .padStart(3, "0")
        );
    }

    // =====================================
    // INVENTORY AVAILABILITY
    // =====================================

    function isSupplyExpired(dateValue) {
        if (!dateValue) {
            return false;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const expirationDate =
            new Date(
                dateValue + "T00:00:00"
            );

        return (
            !Number.isNaN(
                expirationDate.getTime()
            ) &&
            expirationDate < today
        );
    }

    function isInventoryItemUsable(
        itemType,
        item
    ) {
        if (itemType === "Medical Supply") {
            return (
                Number(item.quantity) > 0 &&
                !isSupplyExpired(
                    item.expirationDate
                )
            );
        }

        if (itemType === "Medical Equipment") {
            return (
                Number(item.quantity) > 0 &&
                normalizeStatus(item.status) ===
                    "available"
            );
        }

        if (itemType === "Mobility Asset") {
            return (
                normalizeStatus(item.status) ===
                "available"
            );
        }

        return false;
    }

    // =====================================
    // POPULATE INVENTORY ITEMS
    // =====================================

    function populateResourceItems(
        selectedId = ""
    ) {
        const itemType =
            resourceInventoryType.value;

        const normalizedSelectedId =
            normalizeId(selectedId);

        resourceItem.innerHTML = "";

        if (!itemType) {
            resourceItem.disabled = true;
            resourceQuantity.disabled = true;

            resourceAvailability.textContent =
                "Select an inventory type to view available items.";

            const option =
                document.createElement("option");

            option.value = "";
            option.textContent =
                "Select inventory type first";

            resourceItem.appendChild(option);
            return;
        }

        const records =
            getInventoryRecords(itemType);

        const selectableRecords =
            records.filter(function (item) {
                return (
                    isInventoryItemUsable(
                        itemType,
                        item
                    ) ||
                    normalizeId(item.id) ===
                        normalizedSelectedId
                );
            });

        const placeholder =
            document.createElement("option");

        placeholder.value = "";

        placeholder.textContent =
            selectableRecords.length > 0
                ? "Select an available item"
                : "No available items";

        resourceItem.appendChild(placeholder);

        selectableRecords.forEach(
            function (item) {
                const option =
                    document.createElement("option");

                const quantity =
                    itemType === "Mobility Asset"
                        ? 1
                        : Number(item.quantity) || 0;

                option.value =
                    normalizeId(item.id);

                option.textContent =
                    `${item.name} (${quantity} available)`;

                resourceItem.appendChild(option);
            }
        );

        resourceItem.disabled =
            selectableRecords.length === 0;

        resourceQuantity.disabled =
            selectableRecords.length === 0;

        resourceItem.value =
            normalizedSelectedId;

        updateResourceAvailability();
    }

    // =====================================
    // DISPLAY AVAILABLE QUANTITY
    // =====================================

    function updateResourceAvailability() {
        const itemType =
            resourceInventoryType.value;

        const itemId =
            normalizeId(resourceItem.value);

        if (!itemType || !itemId) {
            resourceAvailability.textContent =
                "Select an inventory item to see its available quantity.";

            return;
        }

        const item =
            getInventoryRecords(itemType)
                .find(function (record) {
                    return (
                        normalizeId(record.id) ===
                        itemId
                    );
                });

        if (!item) {
            resourceAvailability.textContent =
                "This inventory item could not be found.";

            return;
        }

        const availableQuantity =
            itemType === "Mobility Asset"
                ? 1
                : Number(item.quantity) || 0;

        resourceQuantity.max =
            String(availableQuantity);

        if (itemType === "Mobility Asset") {
            resourceQuantity.value = "1";
            resourceQuantity.disabled = true;
        } else {
            resourceQuantity.disabled = false;
        }

        resourceAvailability.textContent =
            `${availableQuantity} available for emergency use.`;

        if (!requiredResources.value.trim()) {
            requiredResources.value =
                item.name || "";
        }
    }

    // =====================================
    // READ INVENTORY USAGE
    // =====================================

    function getInventoryUsageFromForm() {
        const itemType =
            resourceInventoryType.value;

        const itemId =
            normalizeId(resourceItem.value);

        if (!itemType && !itemId) {
            return {
                ok: true,
                usage: null
            };
        }

        if (!itemType || !itemId) {
            return {
                ok: false,
                message:
                    "Select both an inventory type and item."
            };
        }

        const records =
            getInventoryRecords(itemType);

        const selectedItem =
            records.find(function (item) {
                return (
                    normalizeId(item.id) ===
                    itemId
                );
            });

        if (!selectedItem) {
            return {
                ok: false,
                message:
                    "The selected inventory item was not found."
            };
        }

        const quantity =
            itemType === "Mobility Asset"
                ? 1
                : Number(resourceQuantity.value);

        if (
            !Number.isInteger(quantity) ||
            quantity < 1
        ) {
            return {
                ok: false,
                message:
                    "Quantity used must be at least 1."
            };
        }

        return {
            ok: true,
            usage: {
                itemType: itemType,
                itemId: itemId,
                itemName:
                    selectedItem.name ||
                    "Unnamed item",
                quantity: quantity
            }
        };
    }

    // =====================================
    // DEDUCT INVENTORY
    // =====================================

    async function deductInventory(
        usage,
        operationKey,
        emergencyLabel
    ) {
        if (!usage) {
            return { ok: true };
        }

        if (
            window.medtrackData &&
            typeof window.medtrackData
                .useInventoryItem === "function"
        ) {
            try {
                await window.medtrackData
                    .useInventoryItem({
                        operationKey:
                            operationKey,
                        emergencyRequestId:
                            operationKey,
                        emergencyLabel:
                            emergencyLabel,
                        itemType:
                            usage.itemType,
                        itemId:
                            usage.itemId,
                        quantity:
                            usage.quantity
                    });

                return { ok: true };
            } catch (error) {
                return {
                    ok: false,
                    message:
                        error.message ||
                        "Unable to update the inventory."
                };
            }
        }

        const records =
            getInventoryRecords(
                usage.itemType
            );

        const itemIndex =
            records.findIndex(
                function (item) {
                    return (
                        normalizeId(item.id) ===
                        normalizeId(
                            usage.itemId
                        )
                    );
                }
            );

        if (itemIndex === -1) {
            return {
                ok: false,
                message:
                    `${usage.itemName} was not found in inventory.`
            };
        }

        const item = records[itemIndex];

        if (
            usage.itemType ===
            "Mobility Asset"
        ) {
            if (
                normalizeStatus(item.status) !==
                "available"
            ) {
                return {
                    ok: false,
                    message:
                        `${usage.itemName} is no longer available.`
                };
            }

            item.status = "Deployed";
        } else {
            const availableQuantity =
                Number(item.quantity) || 0;

            if (
                availableQuantity <
                usage.quantity
            ) {
                return {
                    ok: false,
                    message:
                        `Only ${availableQuantity} ${usage.itemName} available.`
                };
            }

            item.quantity =
                availableQuantity -
                usage.quantity;

            if (
                usage.itemType ===
                    "Medical Equipment" &&
                item.quantity === 0
            ) {
                item.status = "Unavailable";
            }
        }

        const saved =
            saveInventoryRecords(
                usage.itemType,
                records
            );

        if (!saved) {
            return {
                ok: false,
                message:
                    "Unable to update the inventory."
            };
        }

        return { ok: true };
    }

    // Prevent double deduction
    async function deductRequestInventory(request) {
        if (
            request.inventoryDeducted ||
            !request.inventoryUsage
        ) {
            return { ok: true };
        }

        const result =
            await deductInventory(
                request.inventoryUsage,
                request.id,
                `${request.id} - ${request.type} - ` +
                    request.location
            );

        if (result.ok) {
            request.inventoryDeducted = true;

            request.inventoryDeductedAt =
                new Date().toISOString();
        }

        return result;
    }

    // =====================================
    // RENDER REQUESTS
    // =====================================

    function renderRequests() {
        const requests = getRequests();

        const searchValue =
            requestSearch.value
                .trim()
                .toLowerCase();

        const selectedType =
            emergencyTypeFilter.value;

        const selectedPriority =
            priorityFilter.value;

        const selectedStatus =
            statusFilter.value;

        const filteredRequests =
            requests.filter(function (request) {
                const searchableText = `
                    ${request.id}
                    ${request.location}
                    ${request.contactPerson}
                    ${request.assignedTeam}
                    ${request.resources}
                `.toLowerCase();

                const matchesSearch =
                    searchableText.includes(
                        searchValue
                    );

                const matchesType =
                    selectedType === "all" ||
                    request.type === selectedType;

                const matchesPriority =
                    selectedPriority === "all" ||
                    request.priority ===
                        selectedPriority;

                const matchesStatus =
                    selectedStatus === "all" ||
                    request.status ===
                        selectedStatus;

                return (
                    matchesSearch &&
                    matchesType &&
                    matchesPriority &&
                    matchesStatus
                );
            });

        requestTableBody.innerHTML = "";

        emptyState.classList.toggle(
            "show",
            filteredRequests.length === 0
        );

        filteredRequests.forEach(
            function (request) {
                const statusClass =
                    getStatusClass(
                        request.status
                    );

                const priorityClass =
                    getPriorityClass(
                        request.priority
                    );

                const row =
                    document.createElement("tr");

                row.innerHTML = `
                    <td>
                        ${escapeHTML(request.id)}
                    </td>

                    <td>
                        ${escapeHTML(
                            formatDateTime(
                                request.date,
                                request.time
                            )
                        )}
                    </td>

                    <td>
                        ${escapeHTML(request.type)}
                    </td>

                    <td>
                        <strong>
                            ${escapeHTML(
                                request.location
                            )}
                        </strong>
                    </td>

                    <td>
                        ${escapeHTML(
                            request.contactPerson
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            request.contactNumber
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            request.assignedTeam
                        )}
                    </td>

                    <td>
                        <span class="priority-badge ${priorityClass}">
                            ${escapeHTML(
                                request.priority
                            )}
                        </span>
                    </td>

                    <td>
                        <span class="status-badge ${statusClass}">
                            ${escapeHTML(
                                request.status
                            )}
                        </span>
                    </td>

                    <td>
                        <div class="table-actions">

                            ${
                                request.status ===
                                "Pending"
                                    ? `
                                        <button
                                            type="button"
                                            class="start-action"
                                            data-action="start"
                                            data-id="${escapeHTML(
                                                request.id
                                            )}"
                                            title="Start response"
                                        >
                                            <i class="fa-solid fa-play"></i>
                                        </button>
                                    `
                                    : ""
                            }

                            ${
                                request.status ===
                                    "Pending" ||
                                request.status ===
                                    "In Progress"
                                    ? `
                                        <button
                                            type="button"
                                            class="complete-action"
                                            data-action="complete"
                                            data-id="${escapeHTML(
                                                request.id
                                            )}"
                                            title="Complete response"
                                        >
                                            <i class="fa-solid fa-check"></i>
                                        </button>
                                    `
                                    : ""
                            }

                            <button
                                type="button"
                                class="edit-button"
                                data-action="edit"
                                data-id="${escapeHTML(
                                    request.id
                                )}"
                                title="Edit request"
                            >
                                <i class="fa-solid fa-pen"></i>
                            </button>

                            ${canDeleteEmergency ? `
                            <button
                                type="button"
                                class="remove-button"
                                data-action="delete"
                                data-id="${escapeHTML(
                                    request.id
                                )}"
                                title="Delete request"
                            >
                                <i class="fa-solid fa-trash"></i>
                            </button>
                            ` : ""}

                        </div>
                    </td>
                `;

                requestTableBody.appendChild(
                    row
                );
            }
        );

        updateStatistics(requests);
    }

    // =====================================
    // STATISTICS
    // =====================================

    function updateStatistics(requests) {
        const pendingCount =
            requests.filter(function (request) {
                return (
                    request.status === "Pending"
                );
            }).length;

        const activeCount =
            requests.filter(function (request) {
                return (
                    request.status ===
                    "In Progress"
                );
            }).length;

        const completedCount =
            requests.filter(function (request) {
                return (
                    request.status ===
                    "Completed"
                );
            }).length;

        const urgentCount =
            requests.filter(function (request) {
                return (
                    request.status !==
                        "Completed" &&
                    request.status !==
                        "Cancelled" &&
                    (
                        request.priority ===
                            "Critical" ||
                        request.priority ===
                            "High"
                    )
                );
            }).length;

        totalRequests.textContent =
            requests.length;

        pendingRequests.textContent =
            pendingCount;

        activeRequests.textContent =
            activeCount;

        completedRequests.textContent =
            completedCount;

        notificationCount.textContent =
            urgentCount;
    }

    // =====================================
    // OPEN ADD MODAL
    // =====================================

    function openAddModal() {
        requestForm.reset();

        editingRequestId.value = "";
        requestDate.value = getCurrentDate();
        requestTime.value = getCurrentTime();
        requestStatus.value = "Pending";

        resourceInventoryType.value = "";
        resourceInventoryType.disabled = false;

        resourceQuantity.value = "1";
        resourceQuantity.disabled = true;

        resourceItem.disabled = true;

        populateResourceItems();

        modalTitle.textContent =
            "New Emergency Request";

        formMessage.textContent = "";

        requestModal.classList.add("show");
        emergencyType.focus();
    }

    // =====================================
    // OPEN EDIT MODAL
    // =====================================

    function openEditModal(requestId) {
        const requests = getRequests();

        const selectedRequest =
            requests.find(function (request) {
                return (
                    normalizeId(request.id) ===
                    normalizeId(requestId)
                );
            });

        if (!selectedRequest) {
            return;
        }

        editingRequestId.value =
            selectedRequest.id;

        requestDate.value =
            selectedRequest.date;

        requestTime.value =
            selectedRequest.time;

        emergencyType.value =
            selectedRequest.type;

        requestPriority.value =
            selectedRequest.priority;

        requestLocation.value =
            selectedRequest.location;

        contactPerson.value =
            selectedRequest.contactPerson;

        contactNumber.value =
            selectedRequest.contactNumber;

        assignedTeam.value =
            selectedRequest.assignedTeam;

        requestStatus.value =
            selectedRequest.status;

        requiredResources.value =
            selectedRequest.resources;

        requestDescription.value =
            selectedRequest.description;

        const inventoryUsage =
            selectedRequest.inventoryUsage ||
            null;

        resourceInventoryType.value =
            inventoryUsage
                ? inventoryUsage.itemType
                : "";

        populateResourceItems(
            inventoryUsage
                ? inventoryUsage.itemId
                : ""
        );

        resourceQuantity.value =
            inventoryUsage
                ? String(
                    inventoryUsage.quantity
                )
                : "1";

        const inventoryAlreadyUsed =
            Boolean(
                selectedRequest
                    .inventoryDeducted
            );

        resourceInventoryType.disabled =
            inventoryAlreadyUsed;

        resourceItem.disabled =
            inventoryAlreadyUsed;

        resourceQuantity.disabled =
            inventoryAlreadyUsed ||
            resourceInventoryType.value ===
                "Mobility Asset";

        if (inventoryAlreadyUsed) {
            resourceAvailability.textContent =
                "This item was already deducted from inventory.";
        }

        modalTitle.textContent =
            "Edit Emergency Request";

        formMessage.textContent = "";

        requestModal.classList.add("show");
    }

    // =====================================
    // CLOSE REQUEST MODAL
    // =====================================

    function closeRequestModal() {
        requestModal.classList.remove("show");
        requestForm.reset();

        editingRequestId.value = "";
        formMessage.textContent = "";

        resourceInventoryType.disabled =
            false;

        resourceItem.disabled = true;
        resourceQuantity.disabled = true;

        resourceAvailability.textContent =
            "Select an inventory item to see its available quantity.";
    }

    // =====================================
    // SAVE OR UPDATE REQUEST
    // =====================================

    requestForm.addEventListener(
        "submit",
        async function (event) {
            event.preventDefault();

            const dateValue =
                requestDate.value;

            const timeValue =
                requestTime.value;

            const typeValue =
                emergencyType.value;

            const priorityValue =
                requestPriority.value;

            const locationValue =
                requestLocation.value.trim();

            const contactPersonValue =
                contactPerson.value.trim();

            const contactNumberValue =
                contactNumber.value.trim();

            const assignedTeamValue =
                assignedTeam.value.trim();

            const statusValue =
                requestStatus.value;

            const resourcesValue =
                requiredResources.value.trim();

            const descriptionValue =
                requestDescription.value.trim();

            if (
                !dateValue ||
                !timeValue ||
                !typeValue ||
                !priorityValue ||
                !locationValue ||
                !contactPersonValue ||
                !contactNumberValue ||
                !assignedTeamValue ||
                !statusValue ||
                !resourcesValue ||
                !descriptionValue
            ) {
                formMessage.textContent =
                    "Please complete all fields.";

                return;
            }

            const validContactNumber =
                /^[0-9+\-\s]{7,15}$/.test(
                    contactNumberValue
                );

            if (!validContactNumber) {
                formMessage.textContent =
                    "Please enter a valid contact number.";

                return;
            }

            const usageResult =
                getInventoryUsageFromForm();

            if (!usageResult.ok) {
                formMessage.textContent =
                    usageResult.message;

                return;
            }

            const requests = getRequests();

            const editId =
                normalizeId(
                    editingRequestId.value
                );

            if (editId) {
                const requestIndex =
                    requests.findIndex(
                        function (request) {
                            return (
                                normalizeId(
                                    request.id
                                ) === editId
                            );
                        }
                    );

                if (requestIndex === -1) {
                    formMessage.textContent =
                        "The emergency request could not be found.";

                    return;
                }

                const previousRequest =
                    requests[requestIndex];

                const updatedRequest = {
                    ...previousRequest,
                    date: dateValue,
                    time: timeValue,
                    type: typeValue,
                    priority: priorityValue,
                    location: locationValue,
                    contactPerson:
                        contactPersonValue,
                    contactNumber:
                        contactNumberValue,
                    assignedTeam:
                        assignedTeamValue,
                    status: statusValue,
                    resources: resourcesValue,
                    description:
                        descriptionValue,

                    inventoryUsage:
                        previousRequest
                            .inventoryDeducted
                            ? previousRequest
                                  .inventoryUsage ||
                              null
                            : usageResult.usage,

                    inventoryDeducted:
                        Boolean(
                            previousRequest
                                .inventoryDeducted
                        ),

                    inventoryDeductedAt:
                        previousRequest
                            .inventoryDeductedAt ||
                        "",

                    completedAt:
                        statusValue === "Completed"
                            ? previousRequest
                                  .completedAt ||
                              new Date()
                                  .toISOString()
                            : ""
                };

                if (
                    statusValue ===
                        "In Progress" ||
                    statusValue ===
                        "Completed"
                ) {
                    const deductionResult =
                        await deductRequestInventory(
                            updatedRequest
                        );

                    if (!deductionResult.ok) {
                        formMessage.textContent =
                            deductionResult.message;

                        return;
                    }
                }

                requests[requestIndex] =
                    updatedRequest;
            } else {
                const newRequest = {
                    id:
                        generateRequestId(
                            requests
                        ),
                    date: dateValue,
                    time: timeValue,
                    type: typeValue,
                    priority: priorityValue,
                    location: locationValue,
                    contactPerson:
                        contactPersonValue,
                    contactNumber:
                        contactNumberValue,
                    assignedTeam:
                        assignedTeamValue,
                    status: statusValue,
                    resources: resourcesValue,
                    description:
                        descriptionValue,
                    inventoryUsage:
                        usageResult.usage,
                    inventoryDeducted: false,
                    inventoryDeductedAt: "",

                    completedAt:
                        statusValue === "Completed"
                            ? new Date()
                                  .toISOString()
                            : ""
                };

                if (
                    statusValue ===
                        "In Progress" ||
                    statusValue ===
                        "Completed"
                ) {
                    const deductionResult =
                        await deductRequestInventory(
                            newRequest
                        );

                    if (!deductionResult.ok) {
                        formMessage.textContent =
                            deductionResult.message;

                        return;
                    }
                }

                requests.push(newRequest);
            }

            saveRequests(requests);
            closeRequestModal();
            renderRequests();
        }
    );

    // =====================================
    // TABLE ACTIONS
    // =====================================

    requestTableBody.addEventListener(
        "click",
        async function (event) {
            const button =
                event.target.closest("button");

            if (
                !button ||
                !requestTableBody.contains(button)
            ) {
                return;
            }

            const action =
                button.dataset.action;

            const requestId =
                normalizeId(button.dataset.id);

            if (!requestId) {
                return;
            }

            if (action === "start") {
                const requests = getRequests();

                const requestIndex =
                    requests.findIndex(
                        function (request) {
                            return (
                                normalizeId(
                                    request.id
                                ) === requestId
                            );
                        }
                    );

                if (requestIndex !== -1) {
                    const deductionResult =
                        await deductRequestInventory(
                            requests[
                                requestIndex
                            ]
                        );

                    if (!deductionResult.ok) {
                        alert(
                            deductionResult.message
                        );

                        return;
                    }

                    requests[
                        requestIndex
                    ].status = "In Progress";

                    saveRequests(requests);
                    renderRequests();
                }

                return;
            }

            if (action === "complete") {
                requestToComplete =
                    requestId;

                completeModal.classList.add(
                    "show"
                );

                return;
            }

            if (action === "edit") {
                openEditModal(requestId);
                return;
            }

            if (action === "delete") {
                if (!canDeleteEmergency) {
                    return;
                }

                requestToDelete =
                    requestId;

                deleteModal.classList.add(
                    "show"
                );
            }
        }
    );

    // =====================================
    // COMPLETE REQUEST
    // =====================================

    confirmComplete.addEventListener(
        "click",
        async function () {
            if (!requestToComplete) {
                return;
            }

            const requests = getRequests();

            const requestIndex =
                requests.findIndex(
                    function (request) {
                        return (
                            normalizeId(
                                request.id
                            ) ===
                            normalizeId(
                                requestToComplete
                            )
                        );
                    }
                );

            if (requestIndex === -1) {
                requestToComplete = null;

                completeModal.classList.remove(
                    "show"
                );

                return;
            }

            const deductionResult =
                await deductRequestInventory(
                    requests[requestIndex]
                );

            if (!deductionResult.ok) {
                alert(deductionResult.message);
                return;
            }

            requests[requestIndex].status =
                "Completed";

            requests[
                requestIndex
            ].completedAt =
                new Date().toISOString();

            saveRequests(requests);

            requestToComplete = null;

            completeModal.classList.remove(
                "show"
            );

            renderRequests();
        }
    );

    cancelComplete.addEventListener(
        "click",
        function () {
            requestToComplete = null;

            completeModal.classList.remove(
                "show"
            );
        }
    );

    // =====================================
    // DELETE REQUEST
    // =====================================

    confirmDelete.addEventListener(
        "click",
        function () {
            if (!canDeleteEmergency) {
                return;
            }

            if (!requestToDelete) {
                return;
            }

            const requests = getRequests();

            const updatedRequests =
                requests.filter(
                    function (request) {
                        return (
                            normalizeId(
                                request.id
                            ) !==
                            normalizeId(
                                requestToDelete
                            )
                        );
                    }
                );

            saveRequests(updatedRequests);

            requestToDelete = null;

            deleteModal.classList.remove(
                "show"
            );

            renderRequests();
        }
    );

    cancelDelete.addEventListener(
        "click",
        function () {
            requestToDelete = null;

            deleteModal.classList.remove(
                "show"
            );
        }
    );

    // =====================================
    // SEARCH AND FILTERS
    // =====================================

    requestSearch.addEventListener(
        "input",
        renderRequests
    );

    emergencyTypeFilter.addEventListener(
        "change",
        renderRequests
    );

    priorityFilter.addEventListener(
        "change",
        renderRequests
    );

    statusFilter.addEventListener(
        "change",
        renderRequests
    );

    resourceInventoryType.addEventListener(
        "change",
        function () {
            resourceQuantity.value = "1";
            populateResourceItems();
        }
    );

    resourceItem.addEventListener(
        "change",
        updateResourceAvailability
    );

    // =====================================
    // MODAL CONTROLS
    // =====================================

    openAddModalButton.addEventListener(
        "click",
        openAddModal
    );

    closeModalButton.addEventListener(
        "click",
        closeRequestModal
    );

    cancelButton.addEventListener(
        "click",
        closeRequestModal
    );

    requestModal.addEventListener(
        "click",
        function (event) {
            if (event.target === requestModal) {
                closeRequestModal();
            }
        }
    );

    completeModal.addEventListener(
        "click",
        function (event) {
            if (
                event.target === completeModal
            ) {
                requestToComplete = null;

                completeModal.classList.remove(
                    "show"
                );
            }
        }
    );

    deleteModal.addEventListener(
        "click",
        function (event) {
            if (event.target === deleteModal) {
                requestToDelete = null;

                deleteModal.classList.remove(
                    "show"
                );
            }
        }
    );

    document.addEventListener(
        "keydown",
        function (event) {
            if (event.key !== "Escape") {
                return;
            }

            closeRequestModal();

            requestToComplete = null;
            requestToDelete = null;

            completeModal.classList.remove(
                "show"
            );

            deleteModal.classList.remove(
                "show"
            );
        }
    );

    // =====================================
    // NOTIFICATIONS
    // =====================================

    notificationButton.addEventListener(
        "click",
        function () {
            const requests = getRequests();

            const urgentRequests =
                requests.filter(
                    function (request) {
                        return (
                            request.status !==
                                "Completed" &&
                            request.status !==
                                "Cancelled" &&
                            (
                                request.priority ===
                                    "Critical" ||
                                request.priority ===
                                    "High"
                            )
                        );
                    }
                );

            if (urgentRequests.length === 0) {
                alert(
                    "There are no urgent response requests."
                );

                return;
            }

            alert(
                `There are ${urgentRequests.length} urgent response requests.`
            );
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

    renderRequests();
});
