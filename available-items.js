// =====================================
// MEDTRACK AVAILABLE ITEMS
// ADMIN AND STAFF
// =====================================

document.addEventListener("DOMContentLoaded", async function () {
    "use strict";

    // =====================================
    // AUTHENTICATION
    // =====================================

    const currentUser =
        await window.medtrackAuth.requireRoles([
            "admin",
            "staff"
        ]);

    if (!currentUser) {
        return;
    }

    if (window.medtrackData) {
        await window.medtrackData.refresh();
    }

    // =====================================
    // HTML ELEMENTS
    // =====================================

    const dashboardLink =
        document.getElementById("dashboardLink");

    const portalName =
        document.getElementById("portalName");

    const adminNavigation =
        document.getElementById("adminNavigation");

    const currentUserName =
        document.getElementById("currentUserName");

    const currentUserRole =
        document.getElementById("currentUserRole");

    const logoutButton =
        document.getElementById("logoutButton");

    const availableItemSearch =
        document.getElementById("availableItemSearch");

    const availableItemType =
        document.getElementById("availableItemType");

    const availableItemsBody =
        document.getElementById("availableItemsBody");

    const availableItemsEmpty =
        document.getElementById("availableItemsEmpty");

    const availableSupplyCount =
        document.getElementById("availableSupplyCount");

    const availableEquipmentCount =
        document.getElementById("availableEquipmentCount");

    const availableMobilityCount =
        document.getElementById("availableMobilityCount");

    const totalAvailableCount =
        document.getElementById("totalAvailableCount");

    // =====================================
    // CURRENT USER
    // =====================================

    const displayName =
        currentUser.fullname ||
        currentUser.username ||
        "MedTrack User";

    currentUserName.textContent =
        displayName;

    currentUserRole.textContent =
        currentUser.role;

    if (currentUser.role === "admin") {
        portalName.textContent =
            "Admin Portal";

        dashboardLink.href =
            "admin-dashboard.html";

        adminNavigation.hidden = false;
    } else {
        portalName.textContent =
            "Staff Portal";

        dashboardLink.href =
            "staff-dashboard.html";

        adminNavigation.hidden = true;
    }

    // =====================================
    // STORAGE KEYS
    // =====================================

    const inventoryKeys = {
        supplies:
            "medtrackMedicalSupplies",

        equipment:
            "medtrackMedicalEquipment",

        mobility:
            "medtrackMobilityAssets"
    };

    const transactionStorageKey =
        "medtrackBorrowTransactions";

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
    // DEFAULT MEDICAL EQUIPMENT
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
    // DEFAULT MOBILITY ASSETS
    // =====================================

    const defaultMobility = [
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

    // =====================================
    // STORAGE FUNCTIONS
    // =====================================

    function cloneRecords(records) {
        return records.map(function (record) {
            return { ...record };
        });
    }

    function getStoredArray(
        storageKey,
        defaultRecords
    ) {
        try {
            const savedData =
                localStorage.getItem(storageKey);

            // Only add defaults when the key
            // has never existed.
            if (savedData === null) {
                const initialRecords =
                    cloneRecords(defaultRecords);

                localStorage.setItem(
                    storageKey,
                    JSON.stringify(initialRecords)
                );

                return initialRecords;
            }

            const parsedData =
                JSON.parse(savedData);

            return Array.isArray(parsedData)
                ? parsedData
                : [];
        } catch (error) {
            console.error(
                "Unable to read storage:",
                storageKey,
                error
            );

            return [];
        }
    }

    function saveStoredArray(
        storageKey,
        records
    ) {
        localStorage.setItem(
            storageKey,
            JSON.stringify(records)
        );
    }

    // =====================================
    // TEXT FUNCTIONS
    // =====================================

    function normalizeText(value) {
        return String(value ?? "").trim();
    }

    function normalizeStatus(value) {
        return normalizeText(value)
            .toLowerCase();
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
    // DATE FUNCTIONS
    // =====================================

    function getToday() {
        const today = new Date();

        today.setHours(0, 0, 0, 0);

        return today;
    }

    function getLocalDateString(date) {
        const year =
            date.getFullYear();

        const month = String(
            date.getMonth() + 1
        ).padStart(2, "0");

        const day = String(
            date.getDate()
        ).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    function getDueDate() {
        const dueDate = new Date();

        // Borrowing duration is seven days.
        dueDate.setDate(
            dueDate.getDate() + 7
        );

        return getLocalDateString(
            dueDate
        );
    }

    function isExpired(dateValue) {
        if (!dateValue) {
            return false;
        }

        const expirationDate =
            new Date(
                dateValue + "T00:00:00"
            );

        if (
            Number.isNaN(
                expirationDate.getTime()
            )
        ) {
            return false;
        }

        return expirationDate < getToday();
    }

    function formatDate(dateValue) {
        if (!dateValue) {
            return "No expiration date";
        }

        const date =
            new Date(
                dateValue + "T00:00:00"
            );

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return dateValue;
        }

        return date.toLocaleDateString(
            "en-US",
            {
                month: "short",
                day: "numeric",
                year: "numeric"
            }
        );
    }

    // =====================================
    // AVAILABLE MEDICAL SUPPLIES
    // =====================================

    function getAvailableSupplies() {
        const supplies =
            getStoredArray(
                inventoryKeys.supplies,
                defaultSupplies
            );

        return supplies
            .filter(function (supply) {
                const quantity =
                    Number(
                        supply.quantity
                    ) || 0;

                return (
                    quantity > 0 &&
                    !isExpired(
                        supply.expirationDate
                    )
                );
            })
            .map(function (supply) {
                return {
                    id:
                        normalizeText(
                            supply.id
                        ),

                    name:
                        normalizeText(
                            supply.name
                        ) ||
                        "Unnamed supply",

                    type:
                        "Medical Supply",

                    category:
                        normalizeText(
                            supply.category
                        ) ||
                        "Uncategorized",

                    quantity:
                        Number(
                            supply.quantity
                        ) || 0,

                    details:
                        "Expires: " +
                        formatDate(
                            supply.expirationDate
                        )
                };
            });
    }

    // =====================================
    // AVAILABLE MEDICAL EQUIPMENT
    // =====================================

    function getAvailableEquipment() {
        const equipment =
            getStoredArray(
                inventoryKeys.equipment,
                defaultEquipment
            );

        return equipment
            .filter(function (item) {
                const quantity =
                    Number(
                        item.quantity
                    ) || 0;

                const status =
                    normalizeStatus(
                        item.status
                    );

                return (
                    status === "available" &&
                    quantity > 0
                );
            })
            .map(function (item) {
                const location =
                    normalizeText(
                        item.location
                    );

                const condition =
                    normalizeText(
                        item.condition
                    );

                return {
                    id:
                        normalizeText(
                            item.id
                        ),

                    name:
                        normalizeText(
                            item.name
                        ) ||
                        "Unnamed equipment",

                    type:
                        "Medical Equipment",

                    category:
                        normalizeText(
                            item.category
                        ) ||
                        "Uncategorized",

                    quantity:
                        Number(
                            item.quantity
                        ) || 0,

                    details:
                        location ||
                        condition ||
                        "No location"
                };
            });
    }

    // =====================================
    // AVAILABLE MOBILITY ASSETS
    // =====================================

    function getAvailableMobility() {
        const mobilityAssets =
            getStoredArray(
                inventoryKeys.mobility,
                defaultMobility
            );

        return mobilityAssets
            .filter(function (asset) {
                return (
                    normalizeStatus(
                        asset.status
                    ) === "available"
                );
            })
            .map(function (asset) {
                const details = [];

                const plateNumber =
                    normalizeText(
                        asset.plateNumber
                    );

                const location =
                    normalizeText(
                        asset.location
                    );

                if (plateNumber) {
                    details.push(
                        "Plate: " +
                        plateNumber
                    );
                }

                if (location) {
                    details.push(
                        location
                    );
                }

                return {
                    id:
                        normalizeText(
                            asset.id
                        ),

                    name:
                        normalizeText(
                            asset.name
                        ) ||
                        "Unnamed mobility asset",

                    type:
                        "Mobility Asset",

                    category:
                        normalizeText(
                            asset.type
                        ) ||
                        "Vehicle",

                    quantity: 1,

                    details:
                        details.join(" • ") ||
                        "No location"
                };
            });
    }

    // =====================================
    // COMBINE AVAILABLE ITEMS
    // =====================================

    function getAllAvailableItems() {
        return [
            ...getAvailableSupplies(),
            ...getAvailableEquipment(),
            ...getAvailableMobility()
        ];
    }

    // =====================================
    // UPDATE SUMMARY CARDS
    // =====================================

    function updateSummaryCards() {
        const supplies =
            getAvailableSupplies();

        const equipment =
            getAvailableEquipment();

        const mobility =
            getAvailableMobility();

        availableSupplyCount.textContent =
            supplies.length;

        availableEquipmentCount.textContent =
            equipment.length;

        availableMobilityCount.textContent =
            mobility.length;

        totalAvailableCount.textContent =
            supplies.length +
            equipment.length +
            mobility.length;
    }

    // =====================================
    // DISPLAY AVAILABLE ITEMS
    // =====================================

    function displayAvailableItems() {
        const searchValue =
            availableItemSearch.value
                .trim()
                .toLowerCase();

        const selectedType =
            availableItemType.value;

        const availableItems =
            getAllAvailableItems().filter(
                function (item) {
                    const searchableText = `
                        ${item.id}
                        ${item.name}
                        ${item.type}
                        ${item.category}
                        ${item.details}
                    `.toLowerCase();

                    const matchesSearch =
                        searchableText.includes(
                            searchValue
                        );

                    const matchesType =
                        selectedType === "all" ||
                        item.type ===
                            selectedType;

                    return (
                        matchesSearch &&
                        matchesType
                    );
                }
            );

        availableItemsBody.innerHTML =
            availableItems
                .map(function (item) {
                    return `
                        <tr>
                            <td>
                                <strong>
                                    ${escapeHTML(
                                        item.id
                                    )}
                                </strong>
                            </td>

                            <td>
                                ${escapeHTML(
                                    item.name
                                )}
                            </td>

                            <td>
                                <span class="item-type">
                                    ${escapeHTML(
                                        item.type
                                    )}
                                </span>
                            </td>

                            <td>
                                ${escapeHTML(
                                    item.category
                                )}
                            </td>

                            <td>
                                <span class="available-status">
                                    <i class="fa-solid fa-circle-check"></i>

                                    ${escapeHTML(
                                        item.quantity
                                    )} Available
                                </span>
                            </td>

                            <td>
                                ${escapeHTML(
                                    item.details
                                )}
                            </td>

                            <td>
                                ${
                                    item.type === "Medical Supply"
                                        ? `
                                            <span class="consumption-only">
                                                Emergency use only
                                            </span>
                                        `
                                        : `
                                            <button
                                                type="button"
                                                class="borrow-item-button"
                                                data-id="${escapeHTML(
                                                    item.id
                                                )}"
                                                data-name="${escapeHTML(
                                                    item.name
                                                )}"
                                                data-type="${escapeHTML(
                                                    item.type
                                                )}"
                                            >
                                                Borrow
                                            </button>
                                        `
                                }
                            </td>
                        </tr>
                    `;
                })
                .join("");

        availableItemsEmpty.style.display =
            availableItems.length === 0
                ? "block"
                : "none";
    }

    function refreshAvailableItems() {
        updateSummaryCards();
        displayAvailableItems();
    }

    // =====================================
    // TRANSACTION ID
    // =====================================

    function generateTransactionId(
        transactions
    ) {
        let highestNumber = 0;

        transactions.forEach(
            function (transaction) {
                const match = String(
                    transaction.id || ""
                ).match(/^TRN-(\d+)$/i);

                if (match) {
                    highestNumber =
                        Math.max(
                            highestNumber,
                            Number(match[1])
                        );
                }
            }
        );

        return `TRN-${String(
            highestNumber + 1
        ).padStart(3, "0")}`;
    }

    // =====================================
    // DEDUCT BORROWED ITEM
    // =====================================

    function deductBorrowedItem(
        selectedItem
    ) {
        let storageKey = "";
        let defaultRecords = [];

        if (
            selectedItem.type ===
            "Medical Supply"
        ) {
            storageKey =
                inventoryKeys.supplies;

            defaultRecords =
                defaultSupplies;
        } else if (
            selectedItem.type ===
            "Medical Equipment"
        ) {
            storageKey =
                inventoryKeys.equipment;

            defaultRecords =
                defaultEquipment;
        } else if (
            selectedItem.type ===
            "Mobility Asset"
        ) {
            storageKey =
                inventoryKeys.mobility;

            defaultRecords =
                defaultMobility;
        } else {
            return false;
        }

        const records =
            getStoredArray(
                storageKey,
                defaultRecords
            );

        const recordIndex =
            records.findIndex(
                function (record) {
                    return (
                        normalizeText(
                            record.id
                        ) ===
                        selectedItem.id
                    );
                }
            );

        if (recordIndex === -1) {
            return false;
        }

        const record =
            records[recordIndex];

        if (
            selectedItem.type ===
            "Mobility Asset"
        ) {
            if (
                normalizeStatus(
                    record.status
                ) !== "available"
            ) {
                return false;
            }

            record.status =
                "Deployed";
        } else {
            const currentQuantity =
                Number(
                    record.quantity
                ) || 0;

            if (currentQuantity < 1) {
                return false;
            }

            record.quantity =
                currentQuantity - 1;

            if (
                selectedItem.type ===
                    "Medical Equipment" &&
                record.quantity === 0
            ) {
                record.status =
                    "Unavailable";
            }
        }

        saveStoredArray(
            storageKey,
            records
        );

        return true;
    }

    // =====================================
    // AUTOMATIC BORROW BUTTON
    // =====================================

    availableItemsBody.addEventListener(
        "click",
        async function (event) {
            const borrowButton =
                event.target.closest(
                    ".borrow-item-button"
                );

            if (
                !borrowButton ||
                !availableItemsBody.contains(
                    borrowButton
                )
            ) {
                return;
            }

            const selectedItem = {
                id:
                    normalizeText(
                        borrowButton.dataset.id
                    ),

                name:
                    normalizeText(
                        borrowButton.dataset.name
                    ),

                type:
                    normalizeText(
                        borrowButton.dataset.type
                    )
            };

            if (
                ![
                    "Medical Equipment",
                    "Mobility Asset"
                ].includes(selectedItem.type)
            ) {
                window.alert(
                    "Medical supplies must be recorded through " +
                    "Consumed Supplies during an emergency response."
                );
                return;
            }

            borrowButton.disabled = true;

            try {
                if (
                    window.medtrackData &&
                    typeof window.medtrackData
                        .borrowItem === "function"
                ) {
                    const newTransaction =
                        await window.medtrackData
                            .borrowItem({
                                itemType:
                                    selectedItem.type,
                                itemId:
                                    selectedItem.id,
                                borrower:
                                    displayName,
                                department:
                                    currentUser.role ===
                                    "admin"
                                        ? "Administration"
                                        : "Staff",
                                borrowDate:
                                    getLocalDateString(
                                        new Date()
                                    ),
                                dueDate:
                                    getDueDate(),
                                purpose:
                                    "Borrowed from Available Items"
                            });

                    refreshAvailableItems();

                    window.alert(
                        `${selectedItem.name} was borrowed successfully.\n` +
                        `Transaction ID: ${newTransaction.id}`
                    );

                    return;
                }

                const borrowed =
                    deductBorrowedItem(
                        selectedItem
                    );

                if (!borrowed) {
                    window.alert(
                        "This item is no longer available."
                    );

                    refreshAvailableItems();
                    return;
                }

                const transactions =
                    getStoredArray(
                        transactionStorageKey,
                        []
                    );

                const newTransaction = {
                    id:
                        generateTransactionId(
                            transactions
                        ),

                    borrower:
                        displayName,

                    department:
                        currentUser.role ===
                        "admin"
                            ? "Administration"
                            : "Staff",

                    itemType:
                        selectedItem.type,

                    itemName:
                        selectedItem.name,

                    quantity: 1,

                    borrowDate:
                        getLocalDateString(
                            new Date()
                        ),

                    dueDate:
                        getDueDate(),

                    returnDate: "",

                    status:
                        "Borrowed",

                    purpose:
                        "Borrowed from Available Items",

                    inventoryItemId:
                        selectedItem.id,

                    inventoryAdjusted:
                        true,

                    inventoryReturned:
                        false
                };

                transactions.push(
                    newTransaction
                );

                saveStoredArray(
                    transactionStorageKey,
                    transactions
                );

                refreshAvailableItems();

                window.alert(
                    `${selectedItem.name} was borrowed successfully.\n` +
                    `Transaction ID: ${newTransaction.id}`
                );
            } catch (error) {
                console.error(
                    "Unable to borrow item:",
                    error
                );

                window.alert(
                    error.message ||
                    "The item could not be borrowed. Please try again."
                );
            } finally {
                borrowButton.disabled =
                    false;
            }
        }
    );

    // =====================================
    // SEARCH AND FILTER
    // =====================================

    availableItemSearch.addEventListener(
        "input",
        displayAvailableItems
    );

    availableItemType.addEventListener(
        "change",
        displayAvailableItems
    );

    // =====================================
    // AUTOMATIC INVENTORY REFRESH
    // =====================================

    window.addEventListener(
        "storage",
        function (event) {
            const sharedInventoryKeys =
                Object.values(
                    inventoryKeys
                );

            if (
                sharedInventoryKeys.includes(
                    event.key
                )
            ) {
                refreshAvailableItems();
            }
        }
    );

    window.addEventListener(
        "pageshow",
        refreshAvailableItems
    );

    window.addEventListener(
        "focus",
        refreshAvailableItems
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

    refreshAvailableItems();
});
