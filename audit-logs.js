// =====================================
// MEDTRACK AUDIT LOGS
// ADMIN ONLY
// =====================================

document.addEventListener("DOMContentLoaded", async function () {

    // =====================================
    // ELEMENTS
    // =====================================

    const currentUserName =
        document.getElementById("currentUserName");

    const logoutButton =
        document.getElementById("logoutButton");

    const totalLogs =
        document.getElementById("totalLogs");

    const loginLogs =
        document.getElementById("loginLogs");

    const createdLogs =
        document.getElementById("createdLogs");

    const updatedLogs =
        document.getElementById("updatedLogs");

    const logsTableBody =
        document.getElementById("logsTableBody");

    const emptyState =
        document.getElementById("emptyState");

    const logSearch =
        document.getElementById("logSearch");

    const actionFilter =
        document.getElementById("actionFilter");

    const moduleFilter =
        document.getElementById("moduleFilter");

    const dateFilter =
        document.getElementById("dateFilter");

    const refreshLogs =
        document.getElementById("refreshLogs");

    const exportLogs =
        document.getElementById("exportLogs");

    const openClearModal =
        document.getElementById("openClearModal");

    const clearModal =
        document.getElementById("clearModal");

    const cancelClear =
        document.getElementById("cancelClear");

    const confirmClear =
        document.getElementById("confirmClear");

    // =====================================
    // ADMIN ACCESS CHECK
    // =====================================

    const currentUser =
        await window.medtrackAuth.requireRoles(["admin"]);

    if (!currentUser) {
        return;
    }

    currentUserName.textContent =
        currentUser.fullname ||
        currentUser.username ||
        "Administrator";

    // =====================================
    // DEFAULT LOGS
    // =====================================

    const defaultLogs = [
        {
            id: "LOG-001",
            timestamp: "2026-08-28T08:00:00",
            userId: currentUser.id,
            userName:
                currentUser.fullname ||
                currentUser.username,
            role: "admin",
            action: "Login",
            module: "Authentication",
            details: "Administrator signed in to MedTrack."
        },
        {
            id: "LOG-002",
            timestamp: "2026-08-28T08:15:00",
            userId: currentUser.id,
            userName:
                currentUser.fullname ||
                currentUser.username,
            role: "admin",
            action: "Updated",
            module: "Medical Supplies",
            details: "Updated a medical supply record."
        },
        {
            id: "LOG-003",
            timestamp: "2026-08-28T08:30:00",
            userId: currentUser.id,
            userName:
                currentUser.fullname ||
                currentUser.username,
            role: "admin",
            action: "Created",
            module: "Medical Equipment",
            details: "Added a medical equipment record."
        }
    ];

    // =====================================
    // STORAGE
    // =====================================

    function getAuditLogs() {
        const savedLogs =
            localStorage.getItem("medtrackAuditLogs");

        if (!savedLogs) {
            localStorage.setItem(
                "medtrackAuditLogs",
                JSON.stringify(defaultLogs)
            );

            return [...defaultLogs];
        }

        try {
            const parsedLogs = JSON.parse(savedLogs);

            return Array.isArray(parsedLogs)
                ? parsedLogs
                : [];
        } catch (error) {
            return [];
        }
    }

    function saveAuditLogs(logs) {
        localStorage.setItem(
            "medtrackAuditLogs",
            JSON.stringify(logs)
        );
    }

    // =====================================
    // CREATE AUDIT LOG
    // =====================================

    function generateLogId(logs) {
        let highestNumber = 0;

        logs.forEach(function (log) {
            const number = Number(
                String(log.id).replace("LOG-", "")
            );

            if (!Number.isNaN(number) && number > highestNumber) {
                highestNumber = number;
            }
        });

        return `LOG-${String(highestNumber + 1).padStart(3, "0")}`;
    }

    function addAuditLog(action, module, details, user) {
        const logs = getAuditLogs();

        const logUser = user || currentUser;

        if (!logUser) {
            return;
        }

        logs.unshift({
            id: generateLogId(logs),
            timestamp: new Date().toISOString(),
            userId: logUser.id,
            userName:
                logUser.fullname ||
                logUser.username ||
                "Unknown User",
            role: logUser.role || "staff",
            action: action,
            module: module,
            details: details
        });

        saveAuditLogs(logs);
    }

    // Make this function available when this script is loaded
    window.addMedTrackAuditLog = addAuditLog;

    // =====================================
    // SAFE TEXT AND DATE
    // =====================================

    function escapeHTML(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function formatDateTime(timestamp) {
        if (!timestamp) {
            return "—";
        }

        const date = new Date(timestamp);

        if (Number.isNaN(date.getTime())) {
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

        const year = date.getFullYear();
        const month =
            String(date.getMonth() + 1).padStart(2, "0");
        const day =
            String(date.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    function getActionClass(action) {
        return `action-${String(action)
            .toLowerCase()
            .replaceAll(" ", "-")}`;
    }

    // =====================================
    // RENDER LOGS
    // =====================================

    function renderLogs() {
        const logs = getAuditLogs();

        const searchValue =
            logSearch.value.trim().toLowerCase();

        const selectedAction =
            actionFilter.value;

        const selectedModule =
            moduleFilter.value;

        const selectedDate =
            dateFilter.value;

        const filteredLogs = logs
            .filter(function (log) {
                const matchesSearch =
                    String(log.userName)
                        .toLowerCase()
                        .includes(searchValue) ||
                    String(log.action)
                        .toLowerCase()
                        .includes(searchValue) ||
                    String(log.module)
                        .toLowerCase()
                        .includes(searchValue) ||
                    String(log.details)
                        .toLowerCase()
                        .includes(searchValue);

                const matchesAction =
                    selectedAction === "all" ||
                    log.action === selectedAction;

                const matchesModule =
                    selectedModule === "all" ||
                    log.module === selectedModule;

                const matchesDate =
                    !selectedDate ||
                    getLogDate(log.timestamp) === selectedDate;

                return (
                    matchesSearch &&
                    matchesAction &&
                    matchesModule &&
                    matchesDate
                );
            })
            .sort(function (firstLog, secondLog) {
                return (
                    new Date(secondLog.timestamp) -
                    new Date(firstLog.timestamp)
                );
            });

        logsTableBody.innerHTML = "";

        if (filteredLogs.length === 0) {
            emptyState.classList.add("show");
        } else {
            emptyState.classList.remove("show");
        }

        filteredLogs.forEach(function (log) {
            const roleClass =
                log.role === "admin"
                    ? "role-admin"
                    : "role-staff";

            const actionClass =
                getActionClass(log.action);

            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${escapeHTML(log.id)}</td>

                <td>
                    ${escapeHTML(
                        formatDateTime(log.timestamp)
                    )}
                </td>

                <td>
                    <strong>${escapeHTML(log.userName)}</strong>
                </td>

                <td>
                    <span class="role-badge ${roleClass}">
                        ${escapeHTML(log.role)}
                    </span>
                </td>

                <td>
                    <span class="action-badge ${actionClass}">
                        ${escapeHTML(log.action)}
                    </span>
                </td>

                <td>${escapeHTML(log.module)}</td>

                <td>${escapeHTML(log.details)}</td>
            `;

            logsTableBody.appendChild(row);
        });

        updateStatistics(logs);
    }

    // =====================================
    // STATISTICS
    // =====================================

    function updateStatistics(logs) {
        const authenticationCount =
            logs.filter(function (log) {
                return (
                    log.action === "Login" ||
                    log.action === "Logout"
                );
            }).length;

        const createdCount =
            logs.filter(function (log) {
                return log.action === "Created";
            }).length;

        const updatedCount =
            logs.filter(function (log) {
                return log.action === "Updated";
            }).length;

        totalLogs.textContent = logs.length;
        loginLogs.textContent = authenticationCount;
        createdLogs.textContent = createdCount;
        updatedLogs.textContent = updatedCount;
    }

    // =====================================
    // SEARCH AND FILTERS
    // =====================================

    logSearch.addEventListener("input", renderLogs);
    actionFilter.addEventListener("change", renderLogs);
    moduleFilter.addEventListener("change", renderLogs);
    dateFilter.addEventListener("change", renderLogs);

    refreshLogs.addEventListener("click", renderLogs);

    // =====================================
    // EXPORT CSV
    // =====================================

    function escapeCSV(value) {
        return `"${String(value ?? "")
            .replaceAll('"', '""')}"`;
    }

    exportLogs.addEventListener("click", function () {
        const logs = getAuditLogs();

        if (logs.length === 0) {
            alert("There are no audit logs to export.");
            return;
        }

        const csvRows = [
            [
                "Log ID",
                "Date and Time",
                "User",
                "Role",
                "Action",
                "Module",
                "Details"
            ]
        ];

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

        const csvContent =
            "\uFEFF" +
            csvRows
                .map(function (row) {
                    return row.map(escapeCSV).join(",");
                })
                .join("\n");

        const file = new Blob(
            [csvContent],
            {
                type: "text/csv;charset=utf-8;"
            }
        );

        const link = document.createElement("a");

        link.href = URL.createObjectURL(file);
        link.download = "medtrack-audit-logs.csv";

        document.body.appendChild(link);
        link.click();

        URL.revokeObjectURL(link.href);
        link.remove();
    });

    // =====================================
    // CLEAR LOGS
    // =====================================

    openClearModal.addEventListener("click", function () {
        clearModal.classList.add("show");
    });

    cancelClear.addEventListener("click", function () {
        clearModal.classList.remove("show");
    });

    confirmClear.addEventListener("click", function () {
        saveAuditLogs([]);

        clearModal.classList.remove("show");
        renderLogs();
    });

    clearModal.addEventListener("click", function (event) {
        if (event.target === clearModal) {
            clearModal.classList.remove("show");
        }
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            clearModal.classList.remove("show");
        }
    });

    // =====================================
    // LOGOUT
    // =====================================

    logoutButton.addEventListener("click", async function () {
        const confirmLogout = confirm(
            "Are you sure you want to log out?"
        );

        if (!confirmLogout) {
            return;
        }

        addAuditLog(
            "Logout",
            "Authentication",
            "Administrator logged out of MedTrack.",
            currentUser
        );

        await window.medtrackAuth.signOutAndRedirect();
    });

    // =====================================
    // INITIAL DISPLAY
    // =====================================

    renderLogs();
});
