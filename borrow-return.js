// =====================================
// MEDTRACK BORROWING STATUS MANAGEMENT
// =====================================

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

    const totalTransactions =
        document.getElementById("totalTransactions");
    const borrowedTransactions =
        document.getElementById("borrowedTransactions");
    const returnedTransactions =
        document.getElementById("returnedTransactions");
    const attentionTransactions =
        document.getElementById("attentionTransactions");

    const transactionSearch =
        document.getElementById("transactionSearch");
    const itemTypeFilter =
        document.getElementById("itemTypeFilter");
    const statusFilter = document.getElementById("statusFilter");
    const transactionTableBody =
        document.getElementById("transactionTableBody");
    const emptyState = document.getElementById("emptyState");

    const openStatusModalButton =
        document.getElementById("openStatusModal");
    const statusModal = document.getElementById("statusModal");
    const closeStatusModalButton =
        document.getElementById("closeStatusModal");
    const cancelStatusButton =
        document.getElementById("cancelStatus");
    const statusForm = document.getElementById("statusForm");
    const statusTransaction =
        document.getElementById("statusTransaction");
    const transactionStatus =
        document.getElementById("transactionStatus");
    const statusRecordSummary =
        document.getElementById("statusRecordSummary");
    const formMessage = document.getElementById("formMessage");
    const saveStatusButton =
        statusForm.querySelector("button[type='submit']");

    const allowedItemTypes = [
        "Medical Equipment",
        "Mobility Asset"
    ];

    const allowedStatuses = [
        "Borrowed",
        "Returned",
        "Missing",
        "Damaged",
        "For Repair"
    ];

    const requiredElements = [
        dashboardLink,
        adminNavigation,
        portalName,
        currentUserName,
        currentUserRole,
        logoutButton,
        notificationButton,
        notificationCount,
        totalTransactions,
        borrowedTransactions,
        returnedTransactions,
        attentionTransactions,
        transactionSearch,
        itemTypeFilter,
        statusFilter,
        transactionTableBody,
        emptyState,
        openStatusModalButton,
        statusModal,
        closeStatusModalButton,
        cancelStatusButton,
        statusForm,
        statusTransaction,
        transactionStatus,
        statusRecordSummary,
        formMessage,
        saveStatusButton
    ];

    if (requiredElements.some(function (element) {
        return !element;
    })) {
        console.error(
            "Borrowing page is missing one or more required elements."
        );
        return;
    }

    const currentUser =
        await window.medtrackAuth.requireRoles(["admin", "staff"]);

    if (!currentUser) {
        return;
    }

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

    function normalizeStatus(value) {
        const status = normalizeText(value);
        return allowedStatuses.includes(status)
            ? status
            : "Borrowed";
    }

    function getTransactions() {
        try {
            const transactions = JSON.parse(
                localStorage.getItem(
                    "medtrackBorrowTransactions"
                ) || "[]"
            );

            if (!Array.isArray(transactions)) {
                return [];
            }

            return transactions
                .filter(function (transaction) {
                    return (
                        transaction &&
                        allowedItemTypes.includes(
                            transaction.itemType
                        )
                    );
                })
                .map(function (transaction) {
                    return {
                        ...transaction,
                        status: normalizeStatus(transaction.status)
                    };
                });
        } catch (error) {
            console.error("Unable to read borrowing records:", error);
            return [];
        }
    }

    function formatDate(value) {
        if (!value) {
            return "\u2014";
        }

        const date = new Date(`${value}T00:00:00`);
        if (Number.isNaN(date.getTime())) {
            return normalizeText(value);
        }

        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
    }

    function formatBorrowedDate(transaction) {
        if (!transaction.borrowedAt) {
            return formatDate(transaction.borrowDate);
        }

        const date = new Date(transaction.borrowedAt);

        if (Number.isNaN(date.getTime())) {
            return formatDate(transaction.borrowDate);
        }

        return date.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit"
        });
    }

    function statusClass(status) {
        return {
            "Borrowed": "status-borrowed",
            "Returned": "status-returned",
            "Missing": "status-missing",
            "Damaged": "status-damaged",
            "For Repair": "status-for-repair"
        }[status] || "status-borrowed";
    }

    function updateStatistics(transactions) {
        const borrowed = transactions.filter(function (transaction) {
            return transaction.status === "Borrowed";
        }).length;
        const returned = transactions.filter(function (transaction) {
            return transaction.status === "Returned";
        }).length;
        const needsAttention = transactions.filter(function (transaction) {
            return ["Missing", "Damaged", "For Repair"].includes(
                transaction.status
            );
        }).length;

        totalTransactions.textContent = String(transactions.length);
        borrowedTransactions.textContent = String(borrowed);
        returnedTransactions.textContent = String(returned);
        attentionTransactions.textContent = String(needsAttention);
        notificationCount.textContent = String(needsAttention);
        notificationCount.hidden = needsAttention === 0;

        notificationButton.setAttribute(
            "aria-label",
            needsAttention === 0
                ? "No borrowing records need attention"
                : `${needsAttention} borrowing ${
                    needsAttention === 1 ? "record needs" : "records need"
                } attention`
        );
    }

    function renderTransactions() {
        const transactions = getTransactions();
        const searchValue =
            normalizeText(transactionSearch.value).toLowerCase();
        const selectedType = itemTypeFilter.value;
        const selectedStatus = statusFilter.value;

        const filteredTransactions = transactions.filter(
            function (transaction) {
                const searchableText = `
                    ${transaction.id} ${transaction.borrower}
                    ${transaction.department} ${transaction.itemType}
                    ${transaction.itemName} ${transaction.purpose}
                    ${transaction.status}
                `.toLowerCase();

                return (
                    searchableText.includes(searchValue) &&
                    (
                        selectedType === "all" ||
                        transaction.itemType === selectedType
                    ) &&
                    (
                        selectedStatus === "all" ||
                        transaction.status === selectedStatus
                    )
                );
            }
        );

        transactionTableBody.innerHTML = "";
        emptyState.classList.toggle(
            "show",
            filteredTransactions.length === 0
        );

        filteredTransactions.forEach(function (transaction) {
            const row = document.createElement("tr");
            const status = normalizeStatus(transaction.status);

            row.innerHTML = `
                <td>${escapeHTML(transaction.id)}</td>
                <td><strong>${escapeHTML(transaction.borrower)}</strong></td>
                <td>${escapeHTML(transaction.department)}</td>
                <td>${escapeHTML(transaction.itemType)}</td>
                <td>${escapeHTML(transaction.itemName)}</td>
                <td>${escapeHTML(transaction.quantity)}</td>
                <td>${escapeHTML(formatBorrowedDate(transaction))}</td>
                <td>${escapeHTML(formatDate(transaction.dueDate))}</td>
                <td>${escapeHTML(formatDate(transaction.returnDate))}</td>
                <td>
                    <span class="status-badge ${statusClass(status)}">
                        ${escapeHTML(status)}
                    </span>
                </td>
                <td>
                    <button
                        type="button"
                        class="edit-button"
                        data-action="status"
                        data-id="${escapeHTML(transaction.id)}"
                        aria-label="Update status for ${escapeHTML(
                            transaction.itemName
                        )}"
                        title="Update status"
                    >
                        <i class="fa-solid fa-pen"></i>
                    </button>
                </td>
            `;

            transactionTableBody.appendChild(row);
        });

        updateStatistics(transactions);
    }

    function populateTransactionOptions(selectedId) {
        const transactions = getTransactions();

        statusTransaction.innerHTML =
            '<option value="">Select borrowing record</option>' +
            transactions.map(function (transaction) {
                return `
                    <option value="${escapeHTML(transaction.id)}">
                        ${escapeHTML(transaction.id)} -
                        ${escapeHTML(transaction.itemName)} -
                        ${escapeHTML(transaction.borrower)}
                    </option>
                `;
            }).join("");

        statusTransaction.value = selectedId || "";
        saveStatusButton.disabled = transactions.length === 0;
        updateStatusSummary();
    }

    function updateStatusSummary() {
        const transaction = getTransactions().find(function (item) {
            return item.id === statusTransaction.value;
        });

        if (!transaction) {
            statusRecordSummary.textContent =
                "Select a borrowing record to view its details.";
            transactionStatus.value = "Borrowed";
            return;
        }

        transactionStatus.value = normalizeStatus(transaction.status);
        statusRecordSummary.textContent =
            `${transaction.itemName} (${transaction.itemType}) was ` +
            `borrowed by ${transaction.borrower}. Current status: ` +
            `${normalizeStatus(transaction.status)}.`;
    }

    function openStatusModal(transactionId) {
        statusForm.reset();
        formMessage.textContent = "";
        populateTransactionOptions(transactionId || "");
        statusModal.classList.add("show");
        statusTransaction.focus();
    }

    function closeStatusModal() {
        statusModal.classList.remove("show");
        statusForm.reset();
        formMessage.textContent = "";
        statusRecordSummary.textContent =
            "Select a borrowing record to view its details.";
    }

    statusForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const transactionId = normalizeText(statusTransaction.value);
        const newStatus = normalizeText(transactionStatus.value);

        if (!transactionId || !allowedStatuses.includes(newStatus)) {
            formMessage.textContent =
                "Select a borrowing record and a valid status.";
            return;
        }

        if (
            !window.medtrackData ||
            typeof window.medtrackData.updateBorrowStatus !== "function"
        ) {
            formMessage.textContent =
                "Status updates are unavailable. Apply the latest " +
                "Supabase migration and refresh the page.";
            return;
        }

        saveStatusButton.disabled = true;
        formMessage.textContent = "Updating status...";

        try {
            await window.medtrackData.updateBorrowStatus(
                transactionId,
                newStatus
            );

            closeStatusModal();
            renderTransactions();
        } catch (error) {
            console.error("Unable to update borrowing status:", error);
            formMessage.textContent =
                error.message ||
                "Unable to update the borrowing status.";
        } finally {
            saveStatusButton.disabled = false;
        }
    });

    transactionTableBody.addEventListener("click", function (event) {
        const button = event.target.closest(
            "button[data-action='status']"
        );

        if (button) {
            openStatusModal(button.dataset.id);
        }
    });

    transactionSearch.addEventListener("input", renderTransactions);
    itemTypeFilter.addEventListener("change", renderTransactions);
    statusFilter.addEventListener("change", renderTransactions);
    statusTransaction.addEventListener("change", updateStatusSummary);

    openStatusModalButton.addEventListener("click", function () {
        openStatusModal("");
    });
    closeStatusModalButton.addEventListener("click", closeStatusModal);
    cancelStatusButton.addEventListener("click", closeStatusModal);

    statusModal.addEventListener("click", function (event) {
        if (event.target === statusModal) {
            closeStatusModal();
        }
    });

    document.addEventListener("keydown", function (event) {
        if (
            event.key === "Escape" &&
            statusModal.classList.contains("show")
        ) {
            closeStatusModal();
        }
    });

    notificationButton.addEventListener("click", function () {
        const needsAttention = getTransactions().filter(
            function (transaction) {
                return ["Missing", "Damaged", "For Repair"].includes(
                    transaction.status
                );
            }
        ).length;

        window.alert(
            needsAttention === 0
                ? "No borrowing records currently need attention."
                : `${needsAttention} borrowing ${
                    needsAttention === 1 ? "record needs" : "records need"
                } attention.`
        );
    });

    window.addEventListener("storage", function (event) {
        if (event.key === "medtrackBorrowTransactions") {
            renderTransactions();
        }
    });
    window.addEventListener("medtrack:data-ready", renderTransactions);
    window.addEventListener("pageshow", renderTransactions);
    window.addEventListener("focus", renderTransactions);

    logoutButton.addEventListener("click", async function () {
        if (!window.confirm("Are you sure you want to log out?")) {
            return;
        }

        await window.medtrackAuth.signOutAndRedirect();
    });

    renderTransactions();
});
