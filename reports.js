
document.addEventListener("DOMContentLoaded", async function () {


    const currentUserName =
        document.getElementById("currentUserName");

    const logoutButton =
        document.getElementById("logoutButton");

    const suppliesCount =
        document.getElementById("suppliesCount");

    const equipmentCount =
        document.getElementById("equipmentCount");

    const mobilityCount =
        document.getElementById("mobilityCount");

    const borrowingCount =
        document.getElementById("borrowingCount");

    const reportType =
        document.getElementById("reportType");

    const startDate =
        document.getElementById("startDate");

    const endDate =
        document.getElementById("endDate");

    const generateReportButton =
        document.getElementById("generateReport");

    const exportCSVButton =
        document.getElementById("exportCSV");

    const printReportButton =
        document.getElementById("printReport");

    const generatedDate =
        document.getElementById("generatedDate");

    const reportMessage =
        document.getElementById("reportMessage");

    const CSV_FORMULA_PATTERN = /^[\t\r\n ]*[=+\-@]/;

    const reportTitle =
        document.getElementById("reportTitle");

    const reportDescription =
        document.getElementById("reportDescription");

    const recordCount =
        document.getElementById("recordCount");

    const reportTableHead =
        document.getElementById("reportTableHead");

    const reportTableBody =
        document.getElementById("reportTableBody");

    const emptyState =
        document.getElementById("emptyState");

    let currentReportHeaders = [];
    let currentReportRows = [];
    let currentReportName = "medtrack-report";


    const currentUser =
        await window.medtrackAuth.requireRoles(["admin"]);

    if (!currentUser) {
        return;
    }

    if (window.medtrackData) {
        await window.medtrackData.refresh();
    }

    currentUserName.textContent =
        currentUser.fullname ||
        currentUser.username ||
        "Administrator";


    function getStoredArray(key) {
        const value = localStorage.getItem(key);

        if (!value) {
            return [];
        }

        try {
            const parsedValue = JSON.parse(value);

            return Array.isArray(parsedValue)
                ? parsedValue
                : [];
        } catch (error) {
            return [];
        }
    }

    function getSupplies() {
        return getStoredArray("medtrackMedicalSupplies");
    }

    function getEquipment() {
        return getStoredArray("medtrackMedicalEquipment");
    }

    function getMobility() {
        return getStoredArray("medtrackMobilityAssets");
    }

    function getBorrowing() {
        return getStoredArray("medtrackBorrowTransactions")
            .filter(function (transaction) {
                return [
                    "Medical Equipment",
                    "Mobility Asset"
                ].includes(transaction.itemType);
            });
    }

    function getEmergencyRequests() {
        return getStoredArray("medtrackEmergencyRequests");
    }

    function getUsers() {
        return getStoredArray("medtrackAccounts");
    }


    function updateSummaryCards() {
        suppliesCount.textContent = getSupplies().length;
        equipmentCount.textContent = getEquipment().length;
        mobilityCount.textContent = getMobility().length;
        borrowingCount.textContent = getBorrowing().length;
    }


    function formatDate(dateValue) {
        if (!dateValue) {
            return "—";
        }

        const date = new Date(
            dateValue.includes("T")
                ? dateValue
                : dateValue + "T00:00:00"
        );

        if (Number.isNaN(date.getTime())) {
            return "—";
        }

        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
    }

    function isWithinDateRange(dateValue) {
        if (!startDate.value && !endDate.value) {
            return true;
        }

        if (!dateValue) {
            return false;
        }

        const recordDate =
            new Date(
                dateValue.includes("T")
                    ? dateValue
                    : dateValue + "T00:00:00"
            );

        if (Number.isNaN(recordDate.getTime())) {
            return false;
        }

        if (startDate.value) {
            const selectedStart =
                new Date(startDate.value + "T00:00:00");

            if (recordDate < selectedStart) {
                return false;
            }
        }

        if (endDate.value) {
            const selectedEnd =
                new Date(endDate.value + "T23:59:59");

            if (recordDate > selectedEnd) {
                return false;
            }
        }

        return true;
    }


    function getSupplyStatus(supply) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const expiration = supply.expirationDate
            ? new Date(supply.expirationDate + "T00:00:00")
            : null;

        if (expiration && expiration < today) {
            return "Expired";
        }

        if (Number(supply.quantity) <= 0) {
            return "Out of Stock";
        }

        if (
            Number(supply.quantity) <=
            Number(supply.lowStockLevel)
        ) {
            return "Low Stock";
        }

        return "Available";
    }

    function getBorrowingStatus(transaction) {
        const storedStatus = String(transaction.status || "");

        if ([
            "Borrowed",
            "Returned",
            "Missing",
            "Damaged",
            "For Repair"
        ].includes(storedStatus)) {
            return storedStatus;
        }

        return "Borrowed";
    }

    function getStatusClass(status) {
        return String(status)
            .toLowerCase()
            .replaceAll(" ", "-");
    }


    function escapeHTML(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }


    function getReportInformation(type) {
        if (type === "supplies") {
            const records = getSupplies()
                .filter(function (supply) {
                    return isWithinDateRange(
                        supply.expirationDate
                    );
                });

            return {
                title: "Medical Supplies Report",
                description:
                    "Medical supply quantities, expiration dates and stock status.",
                filename: "medical-supplies-report",
                headers: [
                    "Supply ID",
                    "Supply Name",
                    "Category",
                    "Quantity",
                    "Unit",
                    "Expiration Date",
                    "Status"
                ],
                rows: records.map(function (supply) {
                    return [
                        supply.id,
                        supply.name,
                        supply.category,
                        supply.quantity,
                        supply.unit,
                        formatDate(supply.expirationDate),
                        getSupplyStatus(supply)
                    ];
                }),
                statusColumn: 6
            };
        }

        if (type === "equipment") {
            const records = getEquipment()
                .filter(function (equipment) {
                    return isWithinDateRange(
                        equipment.maintenanceDate
                    );
                });

            return {
                title: "Medical Equipment Report",
                description:
                    "Medical equipment condition, location and maintenance information.",
                filename: "medical-equipment-report",
                headers: [
                    "Equipment ID",
                    "Equipment Name",
                    "Category",
                    "Quantity",
                    "Condition",
                    "Location",
                    "Maintenance Date",
                    "Status"
                ],
                rows: records.map(function (equipment) {
                    return [
                        equipment.id,
                        equipment.name,
                        equipment.category,
                        equipment.quantity,
                        equipment.condition,
                        equipment.location,
                        formatDate(equipment.maintenanceDate),
                        equipment.status
                    ];
                }),
                statusColumn: 7
            };
        }

        if (type === "mobility") {
            const records = getMobility()
                .filter(function (vehicle) {
                    return isWithinDateRange(
                        vehicle.maintenanceDate
                    );
                });

            return {
                title: "Mobility Assets Report",
                description:
                    "Vehicle condition, assignment and maintenance information.",
                filename: "mobility-assets-report",
                headers: [
                    "Vehicle ID",
                    "Vehicle Name",
                    "Type",
                    "Plate Number",
                    "Condition",
                    "Driver",
                    "Location",
                    "Maintenance Date",
                    "Status"
                ],
                rows: records.map(function (vehicle) {
                    return [
                        vehicle.id,
                        vehicle.name,
                        vehicle.type,
                        vehicle.plateNumber,
                        vehicle.condition,
                        vehicle.driver,
                        vehicle.location,
                        formatDate(vehicle.maintenanceDate),
                        vehicle.status
                    ];
                }),
                statusColumn: 8
            };
        }

        if (type === "borrowing") {
            const records = getBorrowing()
                .filter(function (transaction) {
                    return isWithinDateRange(
                        transaction.borrowDate
                    );
                });

            return {
                title: "Borrow and Return Report",
                description:
                    "Borrowing transactions and return status.",
                filename: "borrow-return-report",
                headers: [
                    "Transaction ID",
                    "Borrower",
                    "Department",
                    "Item Type",
                    "Item Name",
                    "Quantity",
                    "Borrow Date",
                    "Due Date",
                    "Return Date",
                    "Status"
                ],
                rows: records.map(function (transaction) {
                    return [
                        transaction.id,
                        transaction.borrower,
                        transaction.department,
                        transaction.itemType,
                        transaction.itemName,
                        transaction.quantity,
                        formatDate(transaction.borrowDate),
                        formatDate(transaction.dueDate),
                        formatDate(transaction.returnDate),
                        getBorrowingStatus(transaction)
                    ];
                }),
                statusColumn: 9
            };
        }

        if (type === "emergency") {
            const records = getEmergencyRequests()
                .filter(function (request) {
                    return isWithinDateRange(request.date);
                });

            return {
                title: "Emergency Response Report",
                description:
                    "Emergency requests, priorities and response status.",
                filename: "emergency-response-report",
                headers: [
                    "Request ID",
                    "Date",
                    "Time",
                    "Emergency Type",
                    "Location",
                    "Contact Person",
                    "Assigned Team",
                    "Priority",
                    "Status"
                ],
                rows: records.map(function (request) {
                    return [
                        request.id,
                        formatDate(request.date),
                        request.time,
                        request.type,
                        request.location,
                        request.contactPerson,
                        request.assignedTeam,
                        request.priority,
                        request.status
                    ];
                }),
                statusColumn: 8
            };
        }

        const records = getUsers()
            .filter(function (user) {
                return isWithinDateRange(user.createdAt);
            });

        return {
            title: "User Accounts Report",
            description:
                "Registered Admin and Staff accounts.",
            filename: "user-accounts-report",
            headers: [
                "User ID",
                "Full Name",
                "Username",
                "Email",
                "Role",
                "Account Status",
                "Date Created"
            ],
            rows: records.map(function (user, index) {
                return [
                    user.userId ||
                        `USR-${String(index + 1).padStart(3, "0")}`,
                    user.fullname,
                    user.username,
                    user.email,
                    user.role,
                    user.status || "active",
                    formatDate(user.createdAt)
                ];
            }),
            statusColumn: 5
        };
    }


    function generateReport() {
        reportMessage.textContent = "";

        if (
            startDate.value &&
            endDate.value &&
            startDate.value > endDate.value
        ) {
            reportMessage.textContent =
                "Start date cannot be later than the end date.";

            return;
        }

        const information =
            getReportInformation(reportType.value);

        currentReportHeaders = information.headers;
        currentReportRows = information.rows;
        currentReportName = information.filename;

        reportTitle.textContent = information.title;
        reportDescription.textContent =
            information.description;

        recordCount.textContent =
            information.rows.length;

        generatedDate.textContent =
            `Generated: ${new Date().toLocaleString()}`;

        renderReportTable(
            information.headers,
            information.rows,
            information.statusColumn
        );
    }


    function renderReportTable(
        headers,
        rows,
        statusColumn
    ) {
        reportTableHead.innerHTML = "";
        reportTableBody.innerHTML = "";

        const headingRow =
            document.createElement("tr");

        headers.forEach(function (heading) {
            const tableHeading =
                document.createElement("th");

            tableHeading.textContent = heading;
            headingRow.appendChild(tableHeading);
        });

        reportTableHead.appendChild(headingRow);

        if (rows.length === 0) {
            emptyState.classList.add("show");
            return;
        }

        emptyState.classList.remove("show");

        rows.forEach(function (rowData) {
            const row = document.createElement("tr");

            rowData.forEach(function (value, columnIndex) {
                const cell = document.createElement("td");

                if (columnIndex === statusColumn) {
                    const statusClass =
                        getStatusClass(value);

                    cell.innerHTML = `
                        <span class="report-status ${escapeHTML(statusClass)}">
                            ${escapeHTML(value)}
                        </span>
                    `;
                } else {
                    cell.textContent =
                        value === undefined ||
                        value === null ||
                        value === ""
                            ? "—"
                            : value;
                }

                row.appendChild(cell);
            });

            reportTableBody.appendChild(row);
        });
    }


    function escapeCSV(value) {
        let text = String(value ?? "");

        if (CSV_FORMULA_PATTERN.test(text)) {
            text = `'${text}`;
        }

        return `"${text.replaceAll('"', '""')}"`;
    }

    function exportCSV() {
        if (currentReportRows.length === 0) {
            reportMessage.textContent =
                "Generate a report with records before exporting.";

            return;
        }

        const csvLines = [];

        csvLines.push(
            currentReportHeaders
                .map(escapeCSV)
                .join(",")
        );

        currentReportRows.forEach(function (row) {
            csvLines.push(
                row.map(escapeCSV).join(",")
            );
        });

        const csvContent =
            "\uFEFF" + csvLines.join("\n");

        const csvFile = new Blob(
            [csvContent],
            {
                type: "text/csv;charset=utf-8;"
            }
        );

        const downloadLink =
            document.createElement("a");

        downloadLink.href =
            URL.createObjectURL(csvFile);

        downloadLink.download =
            `${currentReportName}-${getFileDate()}.csv`;

        document.body.appendChild(downloadLink);
        downloadLink.click();
        downloadLink.remove();

        URL.revokeObjectURL(downloadLink.href);
    }

    function getFileDate() {
        const date = new Date();

        const year = date.getFullYear();
        const month =
            String(date.getMonth() + 1).padStart(2, "0");
        const day =
            String(date.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }


    generateReportButton.addEventListener(
        "click",
        generateReport
    );

    exportCSVButton.addEventListener(
        "click",
        exportCSV
    );

    printReportButton.addEventListener("click", function () {
        if (currentReportRows.length === 0) {
            reportMessage.textContent =
                "Generate a report with records before printing.";

            return;
        }

        window.print();
    });

    reportType.addEventListener("change", function () {
        reportMessage.textContent = "";
    });


    logoutButton.addEventListener("click", async function () {
        const confirmLogout = confirm(
            "Are you sure you want to log out?"
        );

        if (!confirmLogout) {
            return;
        }

        await window.medtrackAuth.signOutAndRedirect();
    });


    updateSummaryCards();
    generateReport();
});
