// =====================================
// MEDTRACK BORROW AND RETURN
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

    const totalTransactions =
        document.getElementById("totalTransactions");

    const borrowedTransactions =
        document.getElementById("borrowedTransactions");

    const returnedTransactions =
        document.getElementById("returnedTransactions");

    const overdueTransactions =
        document.getElementById("overdueTransactions");

    const transactionTableBody =
        document.getElementById("transactionTableBody");

    const emptyState =
        document.getElementById("emptyState");

    const transactionSearch =
        document.getElementById("transactionSearch");

    const itemTypeFilter =
        document.getElementById("itemTypeFilter");

    const statusFilter =
        document.getElementById("statusFilter");

    // Transaction modal
    const transactionModal =
        document.getElementById("transactionModal");

    const openAddModalButton =
        document.getElementById("openAddModal");

    const closeModalButton =
        document.getElementById("closeModal");

    const cancelButton =
        document.getElementById("cancelButton");

    const modalTitle =
        document.getElementById("modalTitle");

    const transactionForm =
        document.getElementById("transactionForm");

    const editingTransactionId =
        document.getElementById("editingTransactionId");

    const borrowerName =
        document.getElementById("borrowerName");

    const borrowerDepartment =
        document.getElementById("borrowerDepartment");

    const itemType =
        document.getElementById("itemType");

    const itemName =
        document.getElementById("itemName");

    const itemQuantity =
        document.getElementById("itemQuantity");

    const borrowDate =
        document.getElementById("borrowDate");

    const dueDate =
        document.getElementById("dueDate");

    const transactionStatus =
        document.getElementById("transactionStatus");

    const borrowPurpose =
        document.getElementById("borrowPurpose");

    const formMessage =
        document.getElementById("formMessage");

    // Return modal
    const returnModal =
        document.getElementById("returnModal");

    const cancelReturn =
        document.getElementById("cancelReturn");

    const confirmReturn =
        document.getElementById("confirmReturn");

    // Delete modal
    const deleteModal =
        document.getElementById("deleteModal");

    const cancelDelete =
        document.getElementById("cancelDelete");

    const confirmDelete =
        document.getElementById("confirmDelete");

    let transactionToReturn = null;
    let transactionToDelete = null;

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

        adminNavigation.style.display =
            "block";
    } else {
        portalName.textContent =
            "Staff Portal";

        dashboardLink.href =
            "staff-dashboard.html";

        adminNavigation.style.display =
            "none";
    }

    // =====================================
    // DATE HELPERS
    // =====================================

    function getTodayDate() {
        const today = new Date();

        const year =
            today.getFullYear();

        const month = String(
            today.getMonth() + 1
        ).padStart(2, "0");

        const day = String(
            today.getDate()
        ).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    function formatDate(dateValue) {
        if (!dateValue) {
            return "—";
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
    // DEFAULT TRANSACTIONS
    // =====================================

    const defaultTransactions = [
        {
            id: "TRN-001",
            borrower: "Juan Dela Cruz",
            department: "Operations Division",
            itemType: "Medical Equipment",
            itemName: "Handheld Radio",
            quantity: 2,
            borrowDate: "2026-08-20",
            dueDate: "2026-09-05",
            returnDate: "",
            status: "Borrowed",
            purpose: "Emergency response operation"
        },
        {
            id: "TRN-002",
            borrower: "Maria Santos",
            department: "Warning Division",
            itemType: "Medical Supply",
            itemName: "First Aid Kit",
            quantity: 1,
            borrowDate: "2026-08-10",
            dueDate: "2026-08-15",
            returnDate: "2026-08-14",
            status: "Returned",
            purpose: "Community emergency training"
        },
        {
            id: "TRN-003",
            borrower: "Pedro Reyes",
            department: "Rescue Team",
            itemType: "Medical Equipment",
            itemName: "Portable Oxygen Tank",
            quantity: 1,
            borrowDate: "2026-08-15",
            dueDate: "2026-08-25",
            returnDate: "",
            status: "Borrowed",
            purpose: "Rescue operation support"
        }
    ];

    // =====================================
    // LOCAL STORAGE
    // =====================================

    function getTransactions() {
        const savedTransactions =
            localStorage.getItem(
                "medtrackBorrowTransactions"
            );

        if (savedTransactions === null) {
            const initialTransactions =
                defaultTransactions.map(
                    function (transaction) {
                        return {
                            ...transaction
                        };
                    }
                );

            localStorage.setItem(
                "medtrackBorrowTransactions",
                JSON.stringify(
                    initialTransactions
                )
            );

            return initialTransactions;
        }

        try {
            const parsedTransactions =
                JSON.parse(
                    savedTransactions
                );

            return Array.isArray(
                parsedTransactions
            )
                ? parsedTransactions
                : [];
        } catch (error) {
            console.error(
                "Unable to read transactions:",
                error
            );

            return [];
        }
    }

    function saveTransactions(
        transactions
    ) {
        localStorage.setItem(
            "medtrackBorrowTransactions",
            JSON.stringify(
                transactions
            )
        );
    }

    // =====================================
    // RESTORE RETURNED INVENTORY
    // =====================================

    function restoreBorrowedInventory(
        transaction
    ) {
        /*
         * Only transactions created through
         * Available Items have these fields.
         *
         * This also prevents a double return
         * from adding the item twice.
         */
        if (
            !transaction.inventoryAdjusted ||
            transaction.inventoryReturned ||
            !transaction.inventoryItemId
        ) {
            return false;
        }

        const storageByType = {
            "Medical Supply":
                "medtrackMedicalSupplies",

            "Medical Equipment":
                "medtrackMedicalEquipment",

            "Mobility Asset":
                "medtrackMobilityAssets"
        };

        const storageKey =
            storageByType[
                transaction.itemType
            ];

        if (!storageKey) {
            return false;
        }

        let inventoryRecords;

        try {
            inventoryRecords =
                JSON.parse(
                    localStorage.getItem(
                        storageKey
                    ) || "[]"
                );
        } catch (error) {
            console.error(
                "Unable to read inventory:",
                error
            );

            return false;
        }

        if (
            !Array.isArray(
                inventoryRecords
            )
        ) {
            return false;
        }

        const inventoryItem =
            inventoryRecords.find(
                function (item) {
                    return (
                        String(item.id) ===
                        String(
                            transaction
                                .inventoryItemId
                        )
                    );
                }
            );

        if (!inventoryItem) {
            return false;
        }

        if (
            transaction.itemType ===
            "Mobility Asset"
        ) {
            inventoryItem.status =
                "Available";
        } else {
            inventoryItem.quantity =
                (
                    Number(
                        inventoryItem.quantity
                    ) || 0
                ) +
                (
                    Number(
                        transaction.quantity
                    ) || 1
                );

            if (
                transaction.itemType ===
                    "Medical Equipment" &&
                String(
                    inventoryItem.status
                ).toLowerCase() ===
                    "unavailable"
            ) {
                inventoryItem.status =
                    "Available";
            }
        }

        localStorage.setItem(
            storageKey,
            JSON.stringify(
                inventoryRecords
            )
        );

        transaction.inventoryReturned =
            true;

        return true;
    }

    // =====================================
    // TRANSACTION STATUS
    // =====================================

    function getTransactionStatus(
        transaction
    ) {
        if (
            transaction.status ===
            "Returned"
        ) {
            return "Returned";
        }

        const today = new Date();

        today.setHours(0, 0, 0, 0);

        const returnDeadline =
            new Date(
                transaction.dueDate +
                "T00:00:00"
            );

        if (
            !Number.isNaN(
                returnDeadline.getTime()
            ) &&
            returnDeadline < today
        ) {
            return "Overdue";
        }

        return "Borrowed";
    }

    function getStatusClass(status) {
        if (status === "Returned") {
            return "status-returned";
        }

        if (status === "Overdue") {
            return "status-overdue";
        }

        return "status-borrowed";
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

    // =====================================
    // GENERATE TRANSACTION ID
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
    // UPDATE STATISTICS
    // =====================================

    function updateStatistics(
        transactions
    ) {
        let borrowedCount = 0;
        let returnedCount = 0;
        let overdueCount = 0;

        transactions.forEach(
            function (transaction) {
                const status =
                    getTransactionStatus(
                        transaction
                    );

                if (status === "Borrowed") {
                    borrowedCount++;
                }

                if (status === "Returned") {
                    returnedCount++;
                }

                if (status === "Overdue") {
                    overdueCount++;
                }
            }
        );

        totalTransactions.textContent =
            transactions.length;

        borrowedTransactions.textContent =
            borrowedCount;

        returnedTransactions.textContent =
            returnedCount;

        overdueTransactions.textContent =
            overdueCount;

        notificationCount.textContent =
            overdueCount;
    }

    // =====================================
    // RENDER TRANSACTIONS
    // =====================================

    function renderTransactions() {
        const transactions =
            getTransactions();

        const searchValue =
            transactionSearch.value
                .trim()
                .toLowerCase();

        const selectedItemType =
            itemTypeFilter.value;

        const selectedStatus =
            statusFilter.value;

        const filteredTransactions =
            transactions.filter(
                function (transaction) {
                    const currentStatus =
                        getTransactionStatus(
                            transaction
                        );

                    const searchableText = `
                        ${transaction.id}
                        ${transaction.borrower}
                        ${transaction.department}
                        ${transaction.itemType}
                        ${transaction.itemName}
                        ${transaction.purpose}
                    `.toLowerCase();

                    const matchesSearch =
                        searchableText.includes(
                            searchValue
                        );

                    const matchesType =
                        selectedItemType ===
                            "all" ||
                        transaction.itemType ===
                            selectedItemType;

                    const matchesStatus =
                        selectedStatus ===
                            "all" ||
                        currentStatus ===
                            selectedStatus;

                    return (
                        matchesSearch &&
                        matchesType &&
                        matchesStatus
                    );
                }
            );

        transactionTableBody.innerHTML =
            "";

        if (
            filteredTransactions.length ===
            0
        ) {
            emptyState.classList.add(
                "show"
            );
        } else {
            emptyState.classList.remove(
                "show"
            );
        }

        filteredTransactions.forEach(
            function (transaction) {
                const currentStatus =
                    getTransactionStatus(
                        transaction
                    );

                const statusClass =
                    getStatusClass(
                        currentStatus
                    );

                const row =
                    document.createElement(
                        "tr"
                    );

                const returnButton =
                    currentStatus !==
                    "Returned"
                        ? `
                            <button
                                type="button"
                                class="return-button"
                                data-action="return"
                                data-id="${escapeHTML(
                                    transaction.id
                                )}"
                                title="Return item"
                            >
                                <i class="fa-solid fa-rotate-left"></i>
                            </button>
                        `
                        : "";

                row.innerHTML = `
                    <td>
                        <strong>
                            ${escapeHTML(
                                transaction.id
                            )}
                        </strong>
                    </td>

                    <td>
                        <strong>
                            ${escapeHTML(
                                transaction.borrower
                            )}
                        </strong>

                        <small>
                            ${escapeHTML(
                                transaction.department
                            )}
                        </small>
                    </td>

                    <td>
                        <span class="item-type">
                            ${escapeHTML(
                                transaction.itemType
                            )}
                        </span>
                    </td>

                    <td>
                        ${escapeHTML(
                            transaction.itemName
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            transaction.quantity
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            formatDate(
                                transaction.borrowDate
                            )
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            formatDate(
                                transaction.dueDate
                            )
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            formatDate(
                                transaction.returnDate
                            )
                        )}
                    </td>

                    <td>
                        <span class="status-badge ${statusClass}">
                            ${escapeHTML(
                                currentStatus
                            )}
                        </span>
                    </td>

                    <td>
                        <div class="table-actions">
                            ${returnButton}

                            <button
                                type="button"
                                class="edit-button"
                                data-action="edit"
                                data-id="${escapeHTML(
                                    transaction.id
                                )}"
                                title="Edit transaction"
                            >
                                <i class="fa-solid fa-pen"></i>
                            </button>

                            <button
                                type="button"
                                class="remove-button"
                                data-action="delete"
                                data-id="${escapeHTML(
                                    transaction.id
                                )}"
                                title="Delete transaction"
                            >
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </td>
                `;

                transactionTableBody
                    .appendChild(row);
            }
        );

        updateStatistics(
            transactions
        );
    }

    // =====================================
    // OPEN ADD MODAL
    // =====================================

    function openAddModal() {
        transactionForm.reset();

        editingTransactionId.value =
            "";

        modalTitle.textContent =
            "Add Borrowing Record";

        formMessage.textContent =
            "";

        borrowerName.value =
            displayName;

        borrowerDepartment.value =
            currentUser.role === "admin"
                ? "Administration"
                : "Staff";

        borrowDate.value =
            getTodayDate();

        transactionStatus.value =
            "Borrowed";

        transactionModal.classList.add(
            "show"
        );

        borrowerName.focus();
    }

    // =====================================
    // OPEN EDIT MODAL
    // =====================================

    function openEditModal(
        transactionId
    ) {
        const transactions =
            getTransactions();

        const transaction =
            transactions.find(
                function (item) {
                    return (
                        item.id ===
                        transactionId
                    );
                }
            );

        if (!transaction) {
            return;
        }

        editingTransactionId.value =
            transaction.id;

        borrowerName.value =
            transaction.borrower;

        borrowerDepartment.value =
            transaction.department;

        itemType.value =
            transaction.itemType;

        itemName.value =
            transaction.itemName;

        itemQuantity.value =
            transaction.quantity;

        borrowDate.value =
            transaction.borrowDate;

        dueDate.value =
            transaction.dueDate;

        transactionStatus.value =
            transaction.status;

        borrowPurpose.value =
            transaction.purpose;

        modalTitle.textContent =
            "Edit Borrowing Record";

        formMessage.textContent =
            "";

        transactionModal.classList.add(
            "show"
        );

        borrowerName.focus();
    }

    // =====================================
    // CLOSE TRANSACTION MODAL
    // =====================================

    function closeTransactionModal() {
        transactionModal.classList.remove(
            "show"
        );

        transactionForm.reset();

        editingTransactionId.value =
            "";

        formMessage.textContent =
            "";
    }

    // =====================================
    // SAVE OR UPDATE TRANSACTION
    // =====================================

    transactionForm.addEventListener(
        "submit",
        function (event) {
            event.preventDefault();

            const borrowerValue =
                borrowerName.value.trim();

            const departmentValue =
                borrowerDepartment.value
                    .trim();

            const itemTypeValue =
                itemType.value;

            const itemNameValue =
                itemName.value.trim();

            const quantityValue =
                Number(
                    itemQuantity.value
                );

            const borrowDateValue =
                borrowDate.value;

            const dueDateValue =
                dueDate.value;

            const statusValue =
                transactionStatus.value;

            const purposeValue =
                borrowPurpose.value.trim();

            if (
                !borrowerValue ||
                !departmentValue ||
                !itemTypeValue ||
                !itemNameValue ||
                !borrowDateValue ||
                !dueDateValue ||
                !statusValue ||
                !purposeValue
            ) {
                formMessage.textContent =
                    "Please complete all fields.";

                return;
            }

            if (
                !Number.isFinite(
                    quantityValue
                ) ||
                quantityValue < 1
            ) {
                formMessage.textContent =
                    "Quantity must be at least 1.";

                return;
            }

            if (
                dueDateValue <
                borrowDateValue
            ) {
                formMessage.textContent =
                    "Due date cannot be earlier than the borrow date.";

                return;
            }

            const transactions =
                getTransactions();

            const editId =
                editingTransactionId.value;

            if (editId) {
                const transactionIndex =
                    transactions.findIndex(
                        function (transaction) {
                            return (
                                transaction.id ===
                                editId
                            );
                        }
                    );

                if (
                    transactionIndex !== -1
                ) {
                    const previousTransaction =
                        transactions[
                            transactionIndex
                        ];

                    let returnDateValue =
                        previousTransaction
                            .returnDate ||
                        "";

                    /*
                     * If a borrowed item from
                     * Available Items is changed
                     * to Returned, restore it.
                     */
                    if (
                        statusValue ===
                            "Returned" &&
                        previousTransaction
                            .status !==
                            "Returned"
                    ) {
                        restoreBorrowedInventory(
                            previousTransaction
                        );

                        returnDateValue =
                            getTodayDate();
                    }

                    if (
                        statusValue ===
                        "Borrowed"
                    ) {
                        returnDateValue =
                            "";
                    }

                    transactions[
                        transactionIndex
                    ] = {
                        ...previousTransaction,

                        borrower:
                            borrowerValue,

                        department:
                            departmentValue,

                        itemType:
                            itemTypeValue,

                        itemName:
                            itemNameValue,

                        quantity:
                            quantityValue,

                        borrowDate:
                            borrowDateValue,

                        dueDate:
                            dueDateValue,

                        returnDate:
                            returnDateValue,

                        status:
                            statusValue,

                        purpose:
                            purposeValue
                    };
                }
            } else {
                const newTransaction = {
                    id:
                        generateTransactionId(
                            transactions
                        ),

                    borrower:
                        borrowerValue,

                    department:
                        departmentValue,

                    itemType:
                        itemTypeValue,

                    itemName:
                        itemNameValue,

                    quantity:
                        quantityValue,

                    borrowDate:
                        borrowDateValue,

                    dueDate:
                        dueDateValue,

                    returnDate:
                        statusValue ===
                        "Returned"
                            ? getTodayDate()
                            : "",

                    status:
                        statusValue,

                    purpose:
                        purposeValue
                };

                transactions.push(
                    newTransaction
                );
            }

            saveTransactions(
                transactions
            );

            closeTransactionModal();
            renderTransactions();
        }
    );

    // =====================================
    // TABLE ACTIONS
    // =====================================

    transactionTableBody.addEventListener(
        "click",
        function (event) {
            const button =
                event.target.closest(
                    "button"
                );

            if (!button) {
                return;
            }

            const action =
                button.dataset.action;

            const transactionId =
                button.dataset.id;

            if (action === "return") {
                transactionToReturn =
                    transactionId;

                returnModal.classList.add(
                    "show"
                );
            }

            if (action === "edit") {
                openEditModal(
                    transactionId
                );
            }

            if (action === "delete") {
                transactionToDelete =
                    transactionId;

                deleteModal.classList.add(
                    "show"
                );
            }
        }
    );

    // =====================================
    // CONFIRM RETURN
    // =====================================

    confirmReturn.addEventListener(
        "click",
        function () {
            if (!transactionToReturn) {
                return;
            }

            const transactions =
                getTransactions();

            const transactionIndex =
                transactions.findIndex(
                    function (transaction) {
                        return (
                            transaction.id ===
                            transactionToReturn
                        );
                    }
                );

            if (
                transactionIndex !== -1
            ) {
                const transaction =
                    transactions[
                        transactionIndex
                    ];

                restoreBorrowedInventory(
                    transaction
                );

                transaction.status =
                    "Returned";

                transaction.returnDate =
                    getTodayDate();
            }

            saveTransactions(
                transactions
            );

            transactionToReturn = null;

            returnModal.classList.remove(
                "show"
            );

            renderTransactions();
        }
    );

    cancelReturn.addEventListener(
        "click",
        function () {
            transactionToReturn = null;

            returnModal.classList.remove(
                "show"
            );
        }
    );

    // =====================================
    // CONFIRM DELETE
    // =====================================

    confirmDelete.addEventListener(
        "click",
        function () {
            if (!transactionToDelete) {
                return;
            }

            const transactions =
                getTransactions();

            const updatedTransactions =
                transactions.filter(
                    function (transaction) {
                        return (
                            transaction.id !==
                            transactionToDelete
                        );
                    }
                );

            saveTransactions(
                updatedTransactions
            );

            transactionToDelete = null;

            deleteModal.classList.remove(
                "show"
            );

            renderTransactions();
        }
    );

    cancelDelete.addEventListener(
        "click",
        function () {
            transactionToDelete = null;

            deleteModal.classList.remove(
                "show"
            );
        }
    );

    // =====================================
    // SEARCH AND FILTERS
    // =====================================

    transactionSearch.addEventListener(
        "input",
        renderTransactions
    );

    itemTypeFilter.addEventListener(
        "change",
        renderTransactions
    );

    statusFilter.addEventListener(
        "change",
        renderTransactions
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
        closeTransactionModal
    );

    cancelButton.addEventListener(
        "click",
        closeTransactionModal
    );

    transactionModal.addEventListener(
        "click",
        function (event) {
            if (
                event.target ===
                transactionModal
            ) {
                closeTransactionModal();
            }
        }
    );

    returnModal.addEventListener(
        "click",
        function (event) {
            if (
                event.target ===
                returnModal
            ) {
                transactionToReturn =
                    null;

                returnModal.classList.remove(
                    "show"
                );
            }
        }
    );

    deleteModal.addEventListener(
        "click",
        function (event) {
            if (
                event.target ===
                deleteModal
            ) {
                transactionToDelete =
                    null;

                deleteModal.classList.remove(
                    "show"
                );
            }
        }
    );

    // =====================================
    // ESCAPE KEY
    // =====================================

    document.addEventListener(
        "keydown",
        function (event) {
            if (event.key !== "Escape") {
                return;
            }

            closeTransactionModal();

            transactionToReturn = null;
            transactionToDelete = null;

            returnModal.classList.remove(
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
            const transactions =
                getTransactions();

            const overdueItems =
                transactions.filter(
                    function (transaction) {
                        return (
                            getTransactionStatus(
                                transaction
                            ) === "Overdue"
                        );
                    }
                );

            if (
                overdueItems.length === 0
            ) {
                window.alert(
                    "There are no overdue borrowed items."
                );

                return;
            }

            window.alert(
                `There are ${overdueItems.length} overdue borrowed items.`
            );
        }
    );

    // =====================================
    // REFRESH AFTER INVENTORY CHANGES
    // =====================================

    window.addEventListener(
        "storage",
        function (event) {
            if (
                event.key ===
                "medtrackBorrowTransactions"
            ) {
                renderTransactions();
            }
        }
    );

    window.addEventListener(
        "pageshow",
        renderTransactions
    );

    window.addEventListener(
        "focus",
        renderTransactions
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

    renderTransactions();
});