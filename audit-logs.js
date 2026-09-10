
document.addEventListener("DOMContentLoaded", async function () {
    "use strict";

    const client = window.medtrackSupabase;
    const currentUserName = document.getElementById("currentUserName");
    const logoutButton = document.getElementById("logoutButton");
    const totalLogs = document.getElementById("totalLogs");
    const loginLogs = document.getElementById("loginLogs");
    const createdLogs = document.getElementById("createdLogs");
    const updatedLogs = document.getElementById("updatedLogs");
    const logsTableBody = document.getElementById("logsTableBody");
    const emptyState = document.getElementById("emptyState");
    const emptyTitle = emptyState.querySelector("h3");
    const emptyMessage = emptyState.querySelector("p");
    const logSearch = document.getElementById("logSearch");
    const actionFilter = document.getElementById("actionFilter");
    const moduleFilter = document.getElementById("moduleFilter");
    const dateFilter = document.getElementById("dateFilter");
    const refreshLogs = document.getElementById("refreshLogs");
    const exportLogs = document.getElementById("exportLogs");

    const currentUser = await window.medtrackAuth.requireRoles(["admin"]);

    if (!currentUser) {
        return;
    }

    currentUserName.textContent =
        currentUser.fullname || currentUser.username || "Administrator";

    let auditLogs = [];
    let loadingError = "";

    function escapeHTML(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function formatDateTime(timestamp) {
        const date = new Date(timestamp);

        if (!timestamp || Number.isNaN(date.getTime())) {
            return "—";
        }

        return date.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit"
        });
    }

    function getLogDate(timestamp) {
        const date = new Date(timestamp);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    function getActionClass(action) {
        return `action-${String(action)
            .toLowerCase()
            .replaceAll(" ", "-")}`;
    }

    function normalizeAuditEvent(event) {
        return {
            id: `LOG-${String(event.id).padStart(6, "0")}`,
            timestamp: event.occurred_at,
            userId: event.actor_id || "",
            userName: event.actor_name || "System",
            role: event.actor_role || "system",
            action: event.action || "Unknown",
            module: event.module || "System",
            details: event.details || ""
        };
    }

    async function loadAuditLogs() {
        refreshLogs.disabled = true;
        refreshLogs.setAttribute("aria-busy", "true");
        loadingError = "";

        const result = await client
            .from("audit_events")
            .select(
                "id, occurred_at, actor_id, actor_name, actor_role, action, module, details"
            )
            .order("occurred_at", { ascending: false })
            .limit(5000);

        if (result.error) {
            console.error("Unable to load audit events:", result.error);
            auditLogs = [];
            loadingError =
                "Audit logs could not be loaded. Confirm that the security migration has been deployed.";
        } else {
            auditLogs = (result.data || []).map(normalizeAuditEvent);
        }

        refreshLogs.disabled = false;
        refreshLogs.removeAttribute("aria-busy");
        renderLogs();
    }

    function getFilteredLogs() {
        const searchValue = logSearch.value.trim().toLowerCase();
        const selectedAction = actionFilter.value;
        const selectedModule = moduleFilter.value;
        const selectedDate = dateFilter.value;

        return auditLogs.filter(function (log) {
            const matchesSearch = [
                log.userName,
                log.action,
                log.module,
                log.details
            ].some(function (value) {
                return String(value).toLowerCase().includes(searchValue);
            });

            return (
                matchesSearch &&
                (selectedAction === "all" || log.action === selectedAction) &&
                (selectedModule === "all" || log.module === selectedModule) &&
                (!selectedDate || getLogDate(log.timestamp) === selectedDate)
            );
        });
    }

    function updateStatistics() {
        totalLogs.textContent = auditLogs.length;
        loginLogs.textContent = auditLogs.filter(function (log) {
            return log.action === "Login" || log.action === "Logout";
        }).length;
        createdLogs.textContent = auditLogs.filter(function (log) {
            return log.action === "Created";
        }).length;
        updatedLogs.textContent = auditLogs.filter(function (log) {
            return log.action === "Updated";
        }).length;
    }

    function renderLogs() {
        const filteredLogs = getFilteredLogs();
        logsTableBody.innerHTML = "";

        if (filteredLogs.length === 0) {
            emptyState.classList.add("show");
            emptyTitle.textContent = loadingError
                ? "Unable to load audit logs"
                : "No audit logs found";
            emptyMessage.textContent = loadingError ||
                "No activities match the selected filters.";
        } else {
            emptyState.classList.remove("show");
        }

        filteredLogs.forEach(function (log) {
            const roleClass = log.role === "admin"
                ? "role-admin"
                : "role-staff";
            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${escapeHTML(log.id)}</td>
                <td>${escapeHTML(formatDateTime(log.timestamp))}</td>
                <td><strong>${escapeHTML(log.userName)}</strong></td>
                <td>
                    <span class="role-badge ${roleClass}">
                        ${escapeHTML(log.role)}
                    </span>
                </td>
                <td>
                    <span class="action-badge ${getActionClass(log.action)}">
                        ${escapeHTML(log.action)}
                    </span>
                </td>
                <td>${escapeHTML(log.module)}</td>
                <td>${escapeHTML(log.details)}</td>
            `;

            logsTableBody.appendChild(row);
        });

        updateStatistics();
    }

    function escapeCSV(value) {
        return `"${String(value ?? "").replaceAll('"', '""')}"`;
    }

    logSearch.addEventListener("input", renderLogs);
    actionFilter.addEventListener("change", renderLogs);
    moduleFilter.addEventListener("change", renderLogs);
    dateFilter.addEventListener("change", renderLogs);
    refreshLogs.addEventListener("click", loadAuditLogs);

    exportLogs.addEventListener("click", function () {
        const logs = getFilteredLogs();

        if (logs.length === 0) {
            alert("There are no audit logs to export.");
            return;
        }

        const csvRows = [[
            "Log ID",
            "Date and Time",
            "User",
            "Role",
            "Action",
            "Module",
            "Details"
        ]];

        logs.forEach(function (log) {
            csvRows.push([
                log.id,
                formatDateTime(log.timestamp),
                log.userName,
                log.role,
                log.action,
                log.module,
                log.details
            ]);
        });

        const csvContent = "\uFEFF" + csvRows
            .map(function (row) {
                return row.map(escapeCSV).join(",");
            })
            .join("\n");
        const file = new Blob([csvContent], {
            type: "text/csv;charset=utf-8;"
        });
        const link = document.createElement("a");

        link.href = URL.createObjectURL(file);
        link.download = "medtrack-audit-logs.csv";
        document.body.appendChild(link);
        link.click();
        URL.revokeObjectURL(link.href);
        link.remove();
    });

    logoutButton.addEventListener("click", async function () {
        if (!confirm("Are you sure you want to log out?")) {
            return;
        }

        await window.medtrackAuth.signOutAndRedirect();
    });

    await loadAuditLogs();
});
