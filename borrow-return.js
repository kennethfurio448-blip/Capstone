document.addEventListener("DOMContentLoaded", async function () {
    "use strict";

    const byId = function (id) { return document.getElementById(id); };
    const elements = {
        dashboardLink: byId("dashboardLink"),
        adminNavigation: byId("adminNavigation"),
        portalName: byId("portalName"),
        currentUserName: byId("currentUserName"),
        currentUserRole: byId("currentUserRole"),
        logoutButton: byId("logoutButton"),
        notificationButton: byId("notificationButton"),
        notificationCount: byId("notificationCount"),
        totalTransactions: byId("totalTransactions"),
        borrowedTransactions: byId("borrowedTransactions"),
        returnedTransactions: byId("returnedTransactions"),
        attentionTransactions: byId("attentionTransactions"),
        transactionSearch: byId("transactionSearch"),
        itemTypeFilter: byId("itemTypeFilter"),
        statusFilter: byId("statusFilter"),
        transactionTableBody: byId("transactionTableBody"),
        emptyState: byId("emptyState"),
        openStatusModal: byId("openStatusModal"),
        statusModal: byId("statusModal"),
        closeStatusModal: byId("closeStatusModal"),
        cancelStatus: byId("cancelStatus"),
        statusForm: byId("statusForm"),
        transactionStatus: byId("transactionStatus"),
        borrowFields: byId("borrowFields"),
        statusDetailFields: byId("statusDetailFields"),
        borrowerName: byId("borrowerName"),
        borrowDepartment: byId("borrowDepartment"),
        borrowItemType: byId("borrowItemType"),
        borrowItemId: byId("borrowItemId"),
        borrowAvailability: byId("borrowAvailability"),
        borrowQuantity: byId("borrowQuantity"),
        borrowedAt: byId("borrowedAt"),
        expectedReturnDate: byId("expectedReturnDate"),
        borrowPurpose: byId("borrowPurpose"),
        assignedPersonnel: byId("assignedPersonnel"),
        borrowDestination: byId("borrowDestination"),
        borrowRemarks: byId("borrowRemarks"),
        statusTransaction: byId("statusTransaction"),
        statusEffectiveAt: byId("statusEffectiveAt"),
        statusEffectiveLabel: byId("statusEffectiveLabel"),
        statusQuantity: byId("statusQuantity"),
        statusReportedBy: byId("statusReportedBy"),
        statusReportedByLabel: byId("statusReportedByLabel"),
        statusCondition: byId("statusCondition"),
        statusLocation: byId("statusLocation"),
        statusLocationLabel: byId("statusLocationLabel"),
        statusRemarks: byId("statusRemarks"),
        statusRemarksLabel: byId("statusRemarksLabel"),
        statusRecordSummary: byId("statusRecordSummary"),
        formMessage: byId("formMessage")
    };

    if (Object.values(elements).some(function (element) { return !element; })) {
        console.error("The Status page is missing one or more required elements.");
        return;
    }

    const saveButton = elements.statusForm.querySelector("button[type='submit']");
    const itemTypes = ["Medical Equipment", "Mobility Asset"];
    const statuses = [
        "Available", "Borrowed", "Returned", "Missing", "Damaged", "For Repair"
    ];
    const activeStatuses = ["Borrowed", "Missing", "Damaged", "For Repair"];

    const currentUser = await window.medtrackAuth.requireRoles(["admin", "staff"]);
    if (!currentUser) return;

    if (window.medtrackData) await window.medtrackData.refresh();

    const displayName = currentUser.fullname || currentUser.username || "MedTrack User";
    elements.currentUserName.textContent = displayName;
    elements.currentUserRole.textContent = currentUser.role;
    elements.portalName.textContent = currentUser.role === "admin"
        ? "Admin Portal" : "Staff Portal";
    elements.dashboardLink.href = currentUser.role === "admin"
        ? "admin-dashboard.html" : "staff-dashboard.html";
    elements.adminNavigation.hidden = currentUser.role !== "admin";

    function text(value) { return String(value ?? "").trim(); }

    function escapeHTML(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function storedArray(key) {
        try {
            const records = JSON.parse(localStorage.getItem(key) || "[]");
            return Array.isArray(records) ? records : [];
        } catch (error) {
            console.error("Unable to read Status data:", key, error);
            return [];
        }
    }

    function localDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    function localDateTime(date) {
        return `${localDate(date)}T${String(date.getHours()).padStart(2, "0")}:` +
            String(date.getMinutes()).padStart(2, "0");
    }

    function formatDate(value, includeTime) {
        if (!value) return "\u2014";
        const date = new Date(includeTime ? value : `${value}T00:00:00`);
        if (Number.isNaN(date.getTime())) return text(value);
        return date.toLocaleString("en-US", {
            month: "short", day: "numeric", year: "numeric",
            ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {})
        });
    }

    function getTransactions() {
        return storedArray("medtrackBorrowTransactions").filter(function (record) {
            return record && itemTypes.includes(record.itemType);
        });
    }

    function getInventory() {
        const equipment = storedArray("medtrackMedicalEquipment").map(function (item) {
            return {
                ...item,
                itemType: "Medical Equipment",
                quantity: Math.max(0, Number(item.quantity) || 0),
                details: [item.category, item.location, item.condition].filter(Boolean).join(" | ")
            };
        });
        const mobility = storedArray("medtrackMobilityAssets").map(function (item) {
            return {
                ...item,
                itemType: "Mobility Asset",
                quantity: 1,
                details: [item.type, item.plateNumber, item.location, item.condition]
                    .filter(Boolean).join(" | ")
            };
        });
        return equipment.concat(mobility);
    }

    function canonicalInventoryStatus(item) {
        const status = text(item.status).toLowerCase();
        const condition = text(item.condition).toLowerCase();
        if (status === "missing" || condition === "missing") return "Missing";
        if (status === "damaged" || condition === "damaged") return "Damaged";
        if (["maintenance", "for repair", "under repair", "repair", "unavailable"]
            .includes(status)) return "For Repair";
        if (["borrowed", "in use", "assigned", "deployed"].includes(status)) {
            return "Borrowed";
        }
        return "Available";
    }

    function transactionTimestamp(record) {
        return Date.parse(record.serverUpdatedAt || record.borrowedAt ||
            record.borrowDate || 0) || 0;
    }

    function getStatusRecords() {
        const transactions = getTransactions();
        const activeByAsset = new Map();
        transactions.filter(function (record) {
            return activeStatuses.includes(text(record.status));
        }).sort(function (a, b) {
            return transactionTimestamp(b) - transactionTimestamp(a);
        }).forEach(function (record) {
            const key = `${record.itemType}:${record.inventoryItemId}`;
            if (record.inventoryItemId && !activeByAsset.has(key)) {
                activeByAsset.set(key, record);
            }
            const nameKey = `${record.itemType}:name:${text(record.itemName).toLowerCase()}`;
            if (record.itemName && !activeByAsset.has(nameKey)) {
                activeByAsset.set(nameKey, record);
            }
        });

        const current = getInventory().map(function (item) {
            const active = activeByAsset.get(`${item.itemType}:${item.id}`) ||
                activeByAsset.get(`${item.itemType}:name:${text(item.name).toLowerCase()}`);
            return active ? { ...active, recordKind: "current" } : {
                id: `ASSET-${item.itemType}-${item.id}`,
                inventoryItemId: item.id,
                itemType: item.itemType,
                itemName: item.name,
                quantity: item.quantity,
                borrower: "\u2014",
                department: "\u2014",
                borrowDate: "",
                borrowedAt: "",
                dueDate: "",
                returnDate: "",
                status: canonicalInventoryStatus(item),
                purpose: item.details,
                recordKind: "asset"
            };
        });

        const returnedHistory = transactions.filter(function (record) {
            return record.status === "Returned";
        }).map(function (record) { return { ...record, recordKind: "history" }; });
        return current.concat(returnedHistory);
    }

    function statusClass(status) {
        return {
            Available: "status-returned",
            Borrowed: "status-borrowed",
            Returned: "status-returned",
            Missing: "status-missing",
            Damaged: "status-damaged",
            "For Repair": "status-for-repair"
        }[status] || "status-borrowed";
    }

    function updateStatistics(records) {
        const current = records.filter(function (record) {
            return record.recordKind !== "history";
        });
        const count = function (wanted) {
            return current.filter(function (record) { return record.status === wanted; }).length;
        };
        const attention = current.filter(function (record) {
            return ["Missing", "Damaged", "For Repair"].includes(record.status);
        }).length;
        elements.totalTransactions.textContent = String(current.length);
        elements.borrowedTransactions.textContent = String(count("Borrowed"));
        elements.returnedTransactions.textContent = String(
            records.filter(function (record) { return record.recordKind === "history"; }).length
        );
        elements.attentionTransactions.textContent = String(attention);
        elements.notificationCount.textContent = String(attention);
        elements.notificationCount.hidden = attention === 0;
        elements.notificationButton.setAttribute("aria-label", attention
            ? `${attention} items need attention` : "No items need attention");
    }

    function renderStatus() {
        const records = getStatusRecords();
        const search = text(elements.transactionSearch.value).toLowerCase();
        const typeFilter = elements.itemTypeFilter.value;
        const statusFilter = elements.statusFilter.value;
        const selectedStatuses = statusFilter.split("|");
        const filtered = records.filter(function (record) {
            const haystack = [record.id, record.borrower, record.department,
                record.itemType, record.itemName, record.purpose, record.status]
                .join(" ").toLowerCase();
            return haystack.includes(search) &&
                (typeFilter === "all" || record.itemType === typeFilter) &&
                (statusFilter === "all" || selectedStatuses.includes(record.status));
        });

        elements.transactionTableBody.innerHTML = "";
        elements.emptyState.classList.toggle("show", filtered.length === 0);
        filtered.forEach(function (record) {
            const row = document.createElement("tr");
            const editable = record.recordKind !== "history";
            row.innerHTML = `
                <td>${escapeHTML(record.id)}</td>
                <td><strong>${escapeHTML(record.borrower || "\u2014")}</strong></td>
                <td>${escapeHTML(record.department || "\u2014")}</td>
                <td>${escapeHTML(record.itemType)}</td>
                <td>${escapeHTML(record.itemName)}</td>
                <td>${escapeHTML(record.quantity)}</td>
                <td>${escapeHTML(formatDate(record.borrowedAt || record.borrowDate,
                    Boolean(record.borrowedAt)))}</td>
                <td>${escapeHTML(formatDate(record.dueDate))}</td>
                <td>${escapeHTML(formatDate(record.returnDate))}</td>
                <td><span class="status-badge ${statusClass(record.status)}">${escapeHTML(record.status)}</span></td>
                <td>${editable ? `<button type="button" class="edit-button"
                    data-action="status" data-id="${escapeHTML(record.id)}"
                    data-transaction-id="${escapeHTML(record.recordKind === "current" ? record.id : "")}"
                    data-item-id="${escapeHTML(record.inventoryItemId)}"
                    data-item-type="${escapeHTML(record.itemType)}"
                    aria-label="Set status for ${escapeHTML(record.itemName)}" title="Set status">
                    <i class="fa-solid fa-pen"></i></button>` : "\u2014"}</td>`;
            elements.transactionTableBody.appendChild(row);
        });
        updateStatistics(records);
    }

    function borrowableItems(type) {
        return getInventory().filter(function (item) {
            return item.itemType === type && canonicalInventoryStatus(item) === "Available" &&
                item.quantity > 0;
        });
    }

    function selectedBorrowItem() {
        return borrowableItems(elements.borrowItemType.value).find(function (item) {
            return item.id === elements.borrowItemId.value;
        }) || null;
    }

    function populateBorrowItems(selectedId) {
        const items = borrowableItems(elements.borrowItemType.value);
        elements.borrowItemId.innerHTML = '<option value="">Select an available item</option>' +
            items.map(function (item) {
                return `<option value="${escapeHTML(item.id)}">${escapeHTML(item.name)} ` +
                    `(${escapeHTML(item.quantity)} available)</option>`;
            }).join("");
        elements.borrowItemId.value = selectedId || "";
        updateBorrowItem();
    }

    function updateBorrowItem() {
        const item = selectedBorrowItem();
        if (!item) {
            elements.borrowAvailability.textContent = "Select an item to view its details.";
            return;
        }
        elements.borrowQuantity.max = String(item.quantity);
        elements.borrowQuantity.disabled = item.itemType === "Mobility Asset";
        if (item.itemType === "Mobility Asset") elements.borrowQuantity.value = "1";
        elements.borrowAvailability.textContent =
            `${item.quantity} available. ${item.details || "No additional item details."}`;
        if (item.itemType === "Mobility Asset" && !text(elements.assignedPersonnel.value)) {
            elements.assignedPersonnel.value = text(item.driver);
        }
    }

    function activeTransactions() {
        return getTransactions().filter(function (record) {
            return activeStatuses.includes(record.status);
        });
    }

    function populateTransactionOptions(selectedId) {
        const records = activeTransactions();
        elements.statusTransaction.innerHTML =
            '<option value="">Select an active borrowing record</option>' +
            records.map(function (record) {
                return `<option value="${escapeHTML(record.id)}">${escapeHTML(record.id)} - ` +
                    `${escapeHTML(record.itemName)} - ${escapeHTML(record.borrower)}</option>`;
            }).join("");
        elements.statusTransaction.value = selectedId || "";
        updateStatusSummary();
    }

    function selectedTransaction() {
        return getTransactions().find(function (record) {
            return record.id === elements.statusTransaction.value;
        }) || null;
    }

    function updateStatusSummary() {
        if (elements.transactionStatus.value === "Borrowed") {
            const item = selectedBorrowItem();
            elements.statusRecordSummary.textContent = item
                ? `${item.name} (${item.itemType}); ${item.quantity} currently available.`
                : "Select an available medical equipment or mobility asset.";
            return;
        }
        const record = selectedTransaction();
        if (!record) {
            elements.statusRecordSummary.textContent =
                "Select an active borrowing record to view its item and borrower details.";
            return;
        }
        elements.statusQuantity.max = String(record.quantity || 1);
        elements.statusQuantity.value = String(record.quantity || 1);
        elements.statusQuantity.readOnly = true;
        elements.statusRecordSummary.textContent =
            `${record.itemName} (${record.itemType}) is assigned to ${record.borrower}. ` +
            `Current status: ${record.status}.`;
    }

    function setRequired(fields, required) {
        fields.forEach(function (field) { field.required = required; });
    }

    function updateConditionalForm() {
        const status = elements.transactionStatus.value;
        const borrowing = status === "Borrowed";
        elements.borrowFields.hidden = !borrowing;
        elements.statusDetailFields.hidden = borrowing;
        setRequired([
            elements.borrowerName, elements.borrowDepartment, elements.borrowItemType,
            elements.borrowItemId, elements.borrowQuantity, elements.borrowedAt,
            elements.expectedReturnDate, elements.borrowPurpose, elements.borrowDestination
        ], borrowing);
        setRequired([
            elements.statusTransaction, elements.statusEffectiveAt, elements.statusQuantity,
            elements.statusReportedBy, elements.statusCondition, elements.statusLocation,
            elements.statusRemarks
        ], !borrowing);

        const labels = {
            Available: ["Availability Date and Time", "Confirmed By", "Current Location", "Availability Details"],
            Returned: ["Return Date and Time", "Received By", "Return Location", "Return Details or Remarks"],
            Missing: ["Incident Date and Time", "Reported By", "Last Known Location", "Missing Item Details or Remarks"],
            Damaged: ["Damage Date and Time", "Reported By", "Current Location", "Damage Description or Remarks"],
            "For Repair": ["Repair Status Date and Time", "Reported By", "Repair Location / Provider", "Repair Details or Remarks"]
        }[status];
        if (labels) {
            elements.statusEffectiveLabel.textContent = labels[0];
            elements.statusReportedByLabel.textContent = labels[1];
            elements.statusLocationLabel.textContent = labels[2];
            elements.statusRemarksLabel.textContent = labels[3];
        }
        updateStatusSummary();
    }

    function resetModalDefaults() {
        elements.statusForm.reset();
        elements.formMessage.textContent = "";
        const now = new Date();
        const due = new Date();
        due.setDate(due.getDate() + 7);
        elements.borrowerName.value = displayName;
        elements.borrowDepartment.value = currentUser.role === "admin" ? "Administration" : "Staff";
        elements.borrowedAt.value = localDateTime(now);
        elements.expectedReturnDate.value = localDate(due);
        elements.expectedReturnDate.min = localDate(now);
        elements.statusEffectiveAt.value = localDateTime(now);
        elements.statusReportedBy.value = displayName;
        elements.transactionStatus.value = "Borrowed";
        populateBorrowItems("");
        populateTransactionOptions("");
        updateConditionalForm();
    }

    function openModal(options) {
        resetModalDefaults();
        const config = options || {};
        if (config.status && statuses.includes(config.status)) {
            elements.transactionStatus.value = config.status;
        }
        if (config.itemType && itemTypes.includes(config.itemType)) {
            elements.borrowItemType.value = config.itemType;
            populateBorrowItems(config.itemId || "");
        }
        if (config.transactionId) populateTransactionOptions(config.transactionId);
        updateConditionalForm();
        elements.statusModal.classList.add("show");
        elements.statusModal.setAttribute("aria-hidden", "false");
        elements.transactionStatus.focus();
    }

    function closeModal() {
        elements.statusModal.classList.remove("show");
        elements.statusModal.setAttribute("aria-hidden", "true");
        elements.statusForm.reset();
        elements.formMessage.textContent = "";
    }

    async function submitBorrowed() {
        const item = selectedBorrowItem();
        const quantity = Number(elements.borrowQuantity.value);
        const borrowed = new Date(elements.borrowedAt.value);
        const due = new Date(`${elements.expectedReturnDate.value}T23:59:59`);
        if (!item) throw new Error("The selected item is no longer available.");
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > item.quantity) {
            throw new Error(`Quantity must be between 1 and ${item.quantity}.`);
        }
        if (item.itemType === "Mobility Asset" && quantity !== 1) {
            throw new Error("Only one mobility asset can be borrowed per record.");
        }
        if (Number.isNaN(borrowed.getTime()) || Number.isNaN(due.getTime()) || due < borrowed) {
            throw new Error("The due date cannot be earlier than the borrow date.");
        }
        return window.medtrackData.borrowItem({
            itemType: item.itemType,
            itemId: item.id,
            quantity: quantity,
            borrower: text(elements.borrowerName.value),
            department: text(elements.borrowDepartment.value),
            borrowedAt: borrowed.toISOString(),
            dueDate: elements.expectedReturnDate.value,
            purpose: text(elements.borrowPurpose.value),
            assignedPersonnel: text(elements.assignedPersonnel.value),
            destination: text(elements.borrowDestination.value),
            remarks: text(elements.borrowRemarks.value)
        });
    }

    async function submitStatusChange(status) {
        const record = selectedTransaction();
        if (!record) throw new Error("Select an active borrowing record.");
        const quantity = Number(elements.statusQuantity.value);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > Number(record.quantity || 1)) {
            throw new Error(`Quantity must be between 1 and ${record.quantity || 1}.`);
        }
        return window.medtrackData.updateBorrowStatus(record.id, status, {
            effectiveAt: new Date(elements.statusEffectiveAt.value).toISOString(),
            quantity: quantity,
            reportedBy: text(elements.statusReportedBy.value),
            condition: elements.statusCondition.value,
            location: text(elements.statusLocation.value),
            remarks: text(elements.statusRemarks.value)
        });
    }

    elements.statusForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        elements.formMessage.textContent = "";
        if (!elements.statusForm.checkValidity()) {
            elements.statusForm.reportValidity();
            elements.formMessage.textContent = "Complete all required status information.";
            return;
        }
        if (!window.medtrackData) {
            elements.formMessage.textContent = "Secure status updates are unavailable.";
            return;
        }
        saveButton.disabled = true;
        elements.formMessage.textContent = "Saving status...";
        try {
            const status = elements.transactionStatus.value;
            if (status === "Borrowed") await submitBorrowed();
            else await submitStatusChange(status);
            closeModal();
            await window.medtrackData.refresh();
            renderStatus();
        } catch (error) {
            console.error("Unable to save item status:", error);
            elements.formMessage.textContent = error.message || "The status could not be saved.";
        } finally {
            saveButton.disabled = false;
        }
    });

    elements.transactionTableBody.addEventListener("click", function (event) {
        const button = event.target.closest("button[data-action='status']");
        if (!button) return;
        openModal({
            status: button.dataset.transactionId ? "Returned" : "Borrowed",
            transactionId: button.dataset.transactionId,
            itemId: button.dataset.itemId,
            itemType: button.dataset.itemType
        });
    });
    elements.transactionStatus.addEventListener("change", updateConditionalForm);
    elements.borrowItemType.addEventListener("change", function () { populateBorrowItems(""); });
    elements.borrowItemId.addEventListener("change", updateBorrowItem);
    elements.statusTransaction.addEventListener("change", updateStatusSummary);
    elements.transactionSearch.addEventListener("input", renderStatus);
    elements.itemTypeFilter.addEventListener("change", renderStatus);
    elements.statusFilter.addEventListener("change", renderStatus);
    elements.openStatusModal.addEventListener("click", function () { openModal(); });
    elements.closeStatusModal.addEventListener("click", closeModal);
    elements.cancelStatus.addEventListener("click", closeModal);
    elements.statusModal.addEventListener("click", function (event) {
        if (event.target === elements.statusModal) closeModal();
    });
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && elements.statusModal.classList.contains("show")) closeModal();
    });
    elements.logoutButton.addEventListener("click", async function () {
        if (window.confirm("Are you sure you want to log out?")) {
            await window.medtrackAuth.signOutAndRedirect();
        }
    });
    ["medtrack:data-ready", "medtrack:inventory-changed"].forEach(function (name) {
        window.addEventListener(name, renderStatus);
    });
    window.addEventListener("storage", renderStatus);
    window.addEventListener("pageshow", renderStatus);

    const query = new URLSearchParams(window.location.search);
    if (query.get("action") === "borrow") {
        openModal({
            status: "Borrowed",
            itemType: query.get("type"),
            itemId: query.get("item")
        });
    }
    renderStatus();
});
