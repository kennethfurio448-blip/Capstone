document.addEventListener("DOMContentLoaded", async function () {
    "use strict";

    const currentUser = await window.medtrackAuth.requireRoles(["admin", "staff"]);
    if (!currentUser) return;

    const elements = {
        dashboardLink: document.getElementById("dashboardLink"),
        adminNavigation: document.getElementById("adminNavigation"),
        portalName: document.getElementById("portalName"),
        currentUserName: document.getElementById("currentUserName"),
        currentUserRole: document.getElementById("currentUserRole"),
        logoutButton: document.getElementById("logoutButton"),
        trashCount: document.getElementById("trashCount"),
        trashSearch: document.getElementById("trashSearch"),
        moduleFilter: document.getElementById("moduleFilter"),
        dateSort: document.getElementById("dateSort"),
        selectAll: document.getElementById("selectAll"),
        restoreSelected: document.getElementById("restoreSelected"),
        emptyTrash: document.getElementById("emptyTrash"),
        offlineNotice: document.getElementById("offlineNotice"),
        tableBody: document.getElementById("trashTableBody"),
        emptyState: document.getElementById("emptyState")
    };
    const isAdmin = String(currentUser.role).toLowerCase() === "admin";
    let trashRecords = [];

    elements.dashboardLink.href = isAdmin
        ? "admin-dashboard.html"
        : "staff-dashboard.html";
    elements.adminNavigation.hidden = !isAdmin;
    elements.portalName.textContent = isAdmin ? "Admin Portal" : "Staff Portal";
    elements.currentUserName.textContent =
        currentUser.fullname || currentUser.username || "MedTrack User";
    elements.currentUserRole.textContent = currentUser.role;
    elements.emptyTrash.hidden = !isAdmin;

    function text(value) {
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

    function formatDate(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "—";
        return date.toLocaleString("en-PH", {
            year: "numeric", month: "short", day: "numeric",
            hour: "numeric", minute: "2-digit"
        });
    }

    function detailsText(details) {
        if (!details || typeof details !== "object") return "—";
        const labels = {
            category: "Category", quantity: "Quantity", location: "Location",
            status: "Status", date: "Date", username: "Username",
            email: "Email", role: "Role"
        };
        const parts = Object.entries(details).filter(function (entry) {
            return entry[1] !== null && entry[1] !== undefined && text(entry[1]) !== "";
        }).map(function (entry) {
            return `${labels[entry[0]] || entry[0]}: ${entry[1]}`;
        });
        return parts.join(" • ") || "—";
    }

    function filteredRecords() {
        const query = text(elements.trashSearch.value).toLowerCase();
        const moduleName = elements.moduleFilter.value;
        return trashRecords.filter(function (record) {
            const haystack = [
                record.recordName, record.recordId, record.module,
                detailsText(record.recordDetails), record.deletedBy
            ].join(" ").toLowerCase();
            return haystack.includes(query) &&
                (moduleName === "all" || record.module === moduleName);
        }).sort(function (first, second) {
            const difference = Date.parse(second.deletedAt || 0) -
                Date.parse(first.deletedAt || 0);
            return elements.dateSort.value === "oldest" ? -difference : difference;
        });
    }

    function selectedIds() {
        return Array.from(
            elements.tableBody.querySelectorAll("input[data-trash-id]:checked")
        ).map(function (checkbox) { return checkbox.dataset.trashId; });
    }

    function updateSelection() {
        const selected = selectedIds();
        elements.restoreSelected.disabled = selected.length === 0;
        const visible = elements.tableBody.querySelectorAll("input[data-trash-id]");
        elements.selectAll.checked = visible.length > 0 && selected.length === visible.length;
        elements.selectAll.indeterminate = selected.length > 0 && selected.length < visible.length;
    }

    function renderModules() {
        const selected = elements.moduleFilter.value;
        const modules = Array.from(new Set(trashRecords.map(function (record) {
            return record.module;
        }))).filter(Boolean).sort();
        elements.moduleFilter.innerHTML = '<option value="all">All modules</option>' +
            modules.map(function (moduleName) {
                return `<option value="${escapeHTML(moduleName)}">${escapeHTML(moduleName)}</option>`;
            }).join("");
        if (modules.includes(selected)) elements.moduleFilter.value = selected;
    }

    function render() {
        const records = filteredRecords();
        elements.trashCount.textContent = String(trashRecords.length);
        elements.emptyState.classList.toggle("show", records.length === 0);
        elements.tableBody.innerHTML = records.map(function (record) {
            const isAccount = record.sourceTable === "profiles";
            const restoreDisabled = isAccount && !navigator.onLine;
            return `<tr>
                <td><input type="checkbox" data-trash-id="${escapeHTML(record.id)}" aria-label="Select ${escapeHTML(record.recordName)}" ${restoreDisabled ? "disabled" : ""}></td>
                <td><strong>${escapeHTML(record.recordName)}</strong><br><small>${escapeHTML(record.recordId)}</small>${record.pendingSync ? '<br><span class="pending-badge">Pending sync</span>' : ""}</td>
                <td><span class="module-badge">${escapeHTML(record.module)}</span></td>
                <td class="record-details">${escapeHTML(detailsText(record.recordDetails))}</td>
                <td>${escapeHTML(record.deletedBy || "MedTrack User")}</td>
                <td>${escapeHTML(formatDate(record.deletedAt))}</td>
                <td><div class="row-actions">
                    <button type="button" class="restore-button" data-action="restore" data-trash-id="${escapeHTML(record.id)}" ${restoreDisabled ? "disabled" : ""}><i class="fa-solid fa-rotate-left"></i> Restore</button>
                    ${isAdmin ? `<button type="button" class="permanent-button" data-action="permanent" data-trash-id="${escapeHTML(record.id)}" ${!navigator.onLine ? "disabled" : ""}><i class="fa-solid fa-trash"></i> Delete</button>` : ""}
                </div></td>
            </tr>`;
        }).join("");
        elements.offlineNotice.hidden = navigator.onLine;
        elements.emptyTrash.disabled = !navigator.onLine || trashRecords.length === 0;
        updateSelection();
    }

    async function invokeAccountTrash(action, trashId) {
        const result = await window.medtrackSupabase.functions.invoke("dynamic-worker", {
            body: { action: action, trashId: trashId }
        });
        if (result.error) {
            let message = result.error.message;
            const response = result.error.context;
            if (response && typeof response.clone === "function") {
                try {
                    const body = await response.clone().json();
                    message = body.error || message;
                } catch (_error) {
                    // Use the SDK error when the response is not JSON.
                }
            }
            throw new Error(message);
        }
        if (result.data && result.data.error) throw new Error(result.data.error);
        return result.data || {};
    }

    async function refreshTrash() {
        trashRecords = await window.medtrackData.loadTrashRecords();
        renderModules();
        render();
    }

    async function restoreRecord(trashId, skipConfirmation) {
        const record = trashRecords.find(function (item) { return item.id === trashId; });
        if (!record) throw new Error("The selected Trash record is no longer available.");
        if (!skipConfirmation) {
            const confirmed = await window.medtrackDialog.confirm(
                `Restore “${record.recordName}” to ${record.module}?`
            );
            if (!confirmed) return false;
        }
        if (record.sourceTable === "profiles") {
            if (!navigator.onLine) throw new Error("Account restoration requires an internet connection.");
            await invokeAccountTrash("restore-trash-account", trashId);
        } else {
            await window.medtrackData.restoreTrashRecord(trashId);
        }
        await refreshTrash();
        return true;
    }

    async function permanentlyDeleteRecord(trashId, skipConfirmation) {
        const record = trashRecords.find(function (item) { return item.id === trashId; });
        if (!record) throw new Error("The selected Trash record is no longer available.");
        if (!skipConfirmation) {
            const confirmed = await window.medtrackDialog.confirm(
                `Permanently delete “${record.recordName}”? This cannot be undone.`
            );
            if (!confirmed) return false;
        }
        if (record.sourceTable === "profiles") {
            await invokeAccountTrash("permanently-delete-trash-account", trashId);
        } else {
            await window.medtrackData.permanentlyDeleteTrashRecord(trashId);
        }
        await refreshTrash();
        return true;
    }

    elements.tableBody.addEventListener("click", async function (event) {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        button.disabled = true;
        try {
            const completed = button.dataset.action === "restore"
                ? await restoreRecord(button.dataset.trashId, false)
                : await permanentlyDeleteRecord(button.dataset.trashId, false);
            if (completed) {
                await window.medtrackDialog.alert(
                    button.dataset.action === "restore"
                        ? "The record was restored successfully."
                        : "The record was permanently deleted."
                );
            }
        } catch (error) {
            console.error("Trash Bin action failed:", error);
            await window.medtrackDialog.alert(error.message || "The Trash Bin action failed.");
        } finally {
            button.disabled = false;
        }
    });

    elements.tableBody.addEventListener("change", updateSelection);
    elements.selectAll.addEventListener("change", function () {
        elements.tableBody.querySelectorAll("input[data-trash-id]:not(:disabled)")
            .forEach(function (checkbox) { checkbox.checked = elements.selectAll.checked; });
        updateSelection();
    });
    [elements.trashSearch, elements.moduleFilter, elements.dateSort].forEach(function (control) {
        control.addEventListener(control === elements.trashSearch ? "input" : "change", render);
    });

    elements.restoreSelected.addEventListener("click", async function () {
        const ids = selectedIds();
        if (!ids.length) return;
        if (!await window.medtrackDialog.confirm(`Restore ${ids.length} selected record(s)?`)) return;
        elements.restoreSelected.disabled = true;
        try {
            for (const id of ids) await restoreRecord(id, true);
            await window.medtrackDialog.alert("Selected records were restored successfully.");
        } catch (error) {
            await window.medtrackDialog.alert(error.message || "Some records could not be restored.");
        }
    });

    elements.emptyTrash.addEventListener("click", async function () {
        if (!isAdmin || !trashRecords.length) return;
        const firstConfirmation = await window.medtrackDialog.confirm(
            `Permanently delete all ${trashRecords.length} records in Trash?`
        );
        if (!firstConfirmation || !await window.medtrackDialog.confirm(
            "This action cannot be undone. Continue with Empty Trash?"
        )) return;
        elements.emptyTrash.disabled = true;
        try {
            const ids = trashRecords.map(function (record) { return record.id; });
            for (const id of ids) await permanentlyDeleteRecord(id, true);
            await window.medtrackDialog.alert("Trash was emptied successfully.");
        } catch (error) {
            await window.medtrackDialog.alert(error.message || "Trash could not be emptied completely.");
        } finally {
            elements.emptyTrash.disabled = false;
        }
    });

    elements.logoutButton.addEventListener("click", async function () {
        if (await window.medtrackDialog.confirm("Are you sure you want to log out?")) {
            await window.medtrackAuth.logout();
        }
    });
    window.addEventListener("online", refreshTrash);
    window.addEventListener("offline", render);
    window.addEventListener("medtrack:data-ready", function () { void refreshTrash(); });

    try {
        await window.medtrackData.ready;
        await refreshTrash();
    } catch (error) {
        console.error("Unable to load Trash Bin:", error);
        await window.medtrackDialog.alert(error.message || "The Trash Bin could not be loaded.");
        render();
    }
});
