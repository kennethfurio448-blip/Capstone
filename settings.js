// =====================================
// MEDTRACK SYSTEM SETTINGS
// ADMIN ONLY
// =====================================

document.addEventListener("DOMContentLoaded", function () {

    // =====================================
    // ELEMENTS
    // =====================================

    const currentUserName =
        document.getElementById("currentUserName");

    const logoutButton =
        document.getElementById("logoutButton");

    const settingsTabs =
        document.querySelectorAll(".settings-tab");

    const settingsSections =
        document.querySelectorAll(".settings-section");

    const settingsMessage =
        document.getElementById("settingsMessage");

    // General settings
    const generalSection =
        document.getElementById("generalSection");

    const systemName =
        document.getElementById("systemName");

    const organizationName =
        document.getElementById("organizationName");

    const divisionName =
        document.getElementById("divisionName");

    const systemEmail =
        document.getElementById("systemEmail");

    // Inventory settings
    const inventorySection =
        document.getElementById("inventorySection");

    const defaultLowStock =
        document.getElementById("defaultLowStock");

    const expirationWarningDays =
        document.getElementById("expirationWarningDays");

    const maintenanceWarningDays =
        document.getElementById("maintenanceWarningDays");

    const defaultBorrowDays =
        document.getElementById("defaultBorrowDays");

    // Notification settings
    const notificationSection =
        document.getElementById("notificationSection");

    const lowStockAlerts =
        document.getElementById("lowStockAlerts");

    const expirationAlerts =
        document.getElementById("expirationAlerts");

    const maintenanceAlerts =
        document.getElementById("maintenanceAlerts");

    const overdueAlerts =
        document.getElementById("overdueAlerts");

    const emergencyAlerts =
        document.getElementById("emergencyAlerts");

    // Security settings
    const securitySection =
        document.getElementById("securitySection");

    const currentPassword =
        document.getElementById("currentPassword");

    const newPassword =
        document.getElementById("newPassword");

    const confirmNewPassword =
        document.getElementById("confirmNewPassword");

    // Backup settings
    const downloadBackup =
        document.getElementById("downloadBackup");

    const restoreFile =
        document.getElementById("restoreFile");

    const selectRestoreFile =
        document.getElementById("selectRestoreFile");

    const restoreModal =
        document.getElementById("restoreModal");

    const cancelRestore =
        document.getElementById("cancelRestore");

    const confirmRestore =
        document.getElementById("confirmRestore");

    let selectedBackup = null;

    // =====================================
    // ADMIN ACCESS CHECK
    // =====================================

    function getCurrentUser() {
        const savedUser =
            localStorage.getItem("medtrackCurrentUser") ||
            sessionStorage.getItem("medtrackCurrentUser");

        if (!savedUser) {
            return null;
        }

        try {
            return JSON.parse(savedUser);
        } catch (error) {
            return null;
        }
    }

    const currentUser = getCurrentUser();

    if (!currentUser) {
        window.location.replace("login.html");
        return;
    }

    if (currentUser.role !== "admin") {
        window.location.replace("staff-dashboard.html");
        return;
    }

    currentUserName.textContent =
        currentUser.fullname ||
        currentUser.username ||
        "Administrator";

    // =====================================
    // DEFAULT SETTINGS
    // =====================================

    const defaultSettings = {
        general: {
            systemName: "MedTrack",
            organizationName: "PDRRMO",
            divisionName: "Operation and Warning Division",
            systemEmail: ""
        },

        inventory: {
            defaultLowStock: 10,
            expirationWarningDays: 30,
            maintenanceWarningDays: 14,
            defaultBorrowDays: 7
        },

        notifications: {
            lowStockAlerts: true,
            expirationAlerts: true,
            maintenanceAlerts: true,
            overdueAlerts: true,
            emergencyAlerts: true
        },

        updatedAt: null
    };

    // =====================================
    // SETTINGS STORAGE
    // =====================================

    function getSettings() {
        const savedSettings =
            localStorage.getItem("medtrackSettings");

        if (!savedSettings) {
            saveSettings(defaultSettings);
            return structuredClone(defaultSettings);
        }

        try {
            const parsedSettings =
                JSON.parse(savedSettings);

            return {
                general: {
                    ...defaultSettings.general,
                    ...(parsedSettings.general || {})
                },

                inventory: {
                    ...defaultSettings.inventory,
                    ...(parsedSettings.inventory || {})
                },

                notifications: {
                    ...defaultSettings.notifications,
                    ...(parsedSettings.notifications || {})
                },

                updatedAt:
                    parsedSettings.updatedAt || null
            };
        } catch (error) {
            return structuredClone(defaultSettings);
        }
    }

    function saveSettings(settings) {
        localStorage.setItem(
            "medtrackSettings",
            JSON.stringify(settings)
        );
    }

    // =====================================
    // LOAD SETTINGS
    // =====================================

    function loadSettings() {
        const settings = getSettings();

        systemName.value =
            settings.general.systemName;

        organizationName.value =
            settings.general.organizationName;

        divisionName.value =
            settings.general.divisionName;

        systemEmail.value =
            settings.general.systemEmail;

        defaultLowStock.value =
            settings.inventory.defaultLowStock;

        expirationWarningDays.value =
            settings.inventory.expirationWarningDays;

        maintenanceWarningDays.value =
            settings.inventory.maintenanceWarningDays;

        defaultBorrowDays.value =
            settings.inventory.defaultBorrowDays;

        lowStockAlerts.checked =
            settings.notifications.lowStockAlerts;

        expirationAlerts.checked =
            settings.notifications.expirationAlerts;

        maintenanceAlerts.checked =
            settings.notifications.maintenanceAlerts;

        overdueAlerts.checked =
            settings.notifications.overdueAlerts;

        emergencyAlerts.checked =
            settings.notifications.emergencyAlerts;
    }

    // =====================================
    // SETTINGS TABS
    // =====================================

    settingsTabs.forEach(function (tab) {
        tab.addEventListener("click", function () {
            const sectionId =
                tab.dataset.section;

            settingsTabs.forEach(function (item) {
                item.classList.remove("active");
            });

            settingsSections.forEach(function (section) {
                section.classList.remove("active");
            });

            tab.classList.add("active");

            document
                .getElementById(sectionId)
                .classList.add("active");

            clearMessage();
        });
    });

    // =====================================
    // MESSAGES
    // =====================================

    function showMessage(message, type) {
        settingsMessage.textContent = message;
        settingsMessage.className =
            `settings-message ${type}`;

        window.clearTimeout(showMessage.timeout);

        showMessage.timeout = window.setTimeout(function () {
            clearMessage();
        }, 4000);
    }

    function clearMessage() {
        settingsMessage.textContent = "";
        settingsMessage.className = "settings-message";
    }

    // =====================================
    // SAVE GENERAL SETTINGS
    // =====================================

    generalSection.addEventListener("submit", function (event) {
        event.preventDefault();

        const systemNameValue =
            systemName.value.trim();

        const organizationValue =
            organizationName.value.trim();

        const divisionValue =
            divisionName.value.trim();

        const emailValue =
            systemEmail.value.trim().toLowerCase();

        if (
            !systemNameValue ||
            !organizationValue ||
            !divisionValue ||
            !emailValue
        ) {
            showMessage(
                "Please complete all general settings.",
                "error"
            );

            return;
        }

        const settings = getSettings();

        settings.general = {
            systemName: systemNameValue,
            organizationName: organizationValue,
            divisionName: divisionValue,
            systemEmail: emailValue
        };

        settings.updatedAt =
            new Date().toISOString();

        saveSettings(settings);

        addAuditLog(
            "Updated",
            "System Settings",
            "Updated the general system settings."
        );

        showMessage(
            "General settings saved successfully.",
            "success"
        );
    });

    // =====================================
    // SAVE INVENTORY SETTINGS
    // =====================================

    inventorySection.addEventListener("submit", function (event) {
        event.preventDefault();

        const lowStockValue =
            Number(defaultLowStock.value);

        const expirationValue =
            Number(expirationWarningDays.value);

        const maintenanceValue =
            Number(maintenanceWarningDays.value);

        const borrowDaysValue =
            Number(defaultBorrowDays.value);

        if (
            lowStockValue < 1 ||
            expirationValue < 1 ||
            maintenanceValue < 1 ||
            borrowDaysValue < 1
        ) {
            showMessage(
                "Inventory values must be at least 1.",
                "error"
            );

            return;
        }

        const settings = getSettings();

        settings.inventory = {
            defaultLowStock: lowStockValue,
            expirationWarningDays: expirationValue,
            maintenanceWarningDays: maintenanceValue,
            defaultBorrowDays: borrowDaysValue
        };

        settings.updatedAt =
            new Date().toISOString();

        saveSettings(settings);

        addAuditLog(
            "Updated",
            "System Settings",
            "Updated the inventory settings."
        );

        showMessage(
            "Inventory settings saved successfully.",
            "success"
        );
    });

    // =====================================
    // SAVE NOTIFICATIONS
    // =====================================

    notificationSection.addEventListener(
        "submit",
        function (event) {
            event.preventDefault();

            const settings = getSettings();

            settings.notifications = {
                lowStockAlerts:
                    lowStockAlerts.checked,

                expirationAlerts:
                    expirationAlerts.checked,

                maintenanceAlerts:
                    maintenanceAlerts.checked,

                overdueAlerts:
                    overdueAlerts.checked,

                emergencyAlerts:
                    emergencyAlerts.checked
            };

            settings.updatedAt =
                new Date().toISOString();

            saveSettings(settings);

            addAuditLog(
                "Updated",
                "System Settings",
                "Updated the notification settings."
            );

            showMessage(
                "Notification settings saved successfully.",
                "success"
            );
        }
    );

    // =====================================
    // CHANGE ADMIN PASSWORD
    // =====================================

    securitySection.addEventListener("submit", function (event) {
        event.preventDefault();

        const currentPasswordValue =
            currentPassword.value;

        const newPasswordValue =
            newPassword.value;

        const confirmPasswordValue =
            confirmNewPassword.value;

        const accounts = getAccounts();

        const accountIndex =
            accounts.findIndex(function (account) {
                return String(account.id) ===
                    String(currentUser.id);
            });

        if (accountIndex === -1) {
            showMessage(
                "Admin account could not be found.",
                "error"
            );

            return;
        }

        if (
            accounts[accountIndex].password !==
            currentPasswordValue
        ) {
            showMessage(
                "Current password is incorrect.",
                "error"
            );

            return;
        }

        if (newPasswordValue.length < 6) {
            showMessage(
                "New password must contain at least 6 characters.",
                "error"
            );

            return;
        }

        if (newPasswordValue !== confirmPasswordValue) {
            showMessage(
                "New passwords do not match.",
                "error"
            );

            return;
        }

        if (newPasswordValue === currentPasswordValue) {
            showMessage(
                "New password must be different.",
                "error"
            );

            return;
        }

        accounts[accountIndex].password =
            newPasswordValue;

        localStorage.setItem(
            "medtrackAccounts",
            JSON.stringify(accounts)
        );

        securitySection.reset();

        addAuditLog(
            "Updated",
            "System Settings",
            "Changed the Administrator password."
        );

        showMessage(
            "Password changed successfully.",
            "success"
        );
    });

    function getAccounts() {
        const savedAccounts =
            localStorage.getItem("medtrackAccounts");

        if (!savedAccounts) {
            return [];
        }

        try {
            const accounts = JSON.parse(savedAccounts);

            return Array.isArray(accounts)
                ? accounts
                : [];
        } catch (error) {
            return [];
        }
    }

    // =====================================
    // DOWNLOAD BACKUP
    // =====================================

    const backupKeys = [
        "medtrackAccounts",
        "medtrackMedicalSupplies",
        "medtrackMedicalEquipment",
        "medtrackMobilityAssets",
        "medtrackBorrowTransactions",
        "medtrackEmergencyRequests",
        "medtrackAuditLogs",
        "medtrackSettings"
    ];

    downloadBackup.addEventListener("click", function () {
        const backup = {
            backupType: "MedTrack",
            version: 1,
            createdAt: new Date().toISOString(),
            data: {}
        };

        backupKeys.forEach(function (key) {
            const storedValue =
                localStorage.getItem(key);

            if (storedValue) {
                try {
                    backup.data[key] =
                        JSON.parse(storedValue);
                } catch (error) {
                    backup.data[key] = storedValue;
                }
            }
        });

        const backupFile = new Blob(
            [JSON.stringify(backup, null, 2)],
            {
                type: "application/json"
            }
        );

        const downloadLink =
            document.createElement("a");

        downloadLink.href =
            URL.createObjectURL(backupFile);

        downloadLink.download =
            `medtrack-backup-${getFileDate()}.json`;

        document.body.appendChild(downloadLink);
        downloadLink.click();

        URL.revokeObjectURL(downloadLink.href);
        downloadLink.remove();

        addAuditLog(
            "Created",
            "System Settings",
            "Downloaded a MedTrack backup."
        );

        showMessage(
            "Backup downloaded successfully.",
            "success"
        );
    });

    function getFileDate() {
        const date = new Date();

        const year = date.getFullYear();
        const month =
            String(date.getMonth() + 1).padStart(2, "0");
        const day =
            String(date.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    // =====================================
    // SELECT BACKUP FILE
    // =====================================

    selectRestoreFile.addEventListener("click", function () {
        restoreFile.click();
    });

    restoreFile.addEventListener("change", function () {
        const file = restoreFile.files[0];

        if (!file) {
            return;
        }

        const reader = new FileReader();

        reader.addEventListener("load", function () {
            try {
                const backup = JSON.parse(reader.result);

                if (
                    backup.backupType !== "MedTrack" ||
                    !backup.data ||
                    typeof backup.data !== "object"
                ) {
                    throw new Error("Invalid backup");
                }

                selectedBackup = backup;
                restoreModal.classList.add("show");
            } catch (error) {
                selectedBackup = null;
                restoreFile.value = "";

                showMessage(
                    "The selected file is not a valid MedTrack backup.",
                    "error"
                );
            }
        });

        reader.readAsText(file);
    });

    // =====================================
    // RESTORE BACKUP
    // =====================================

    confirmRestore.addEventListener("click", function () {
        if (!selectedBackup) {
            return;
        }

        backupKeys.forEach(function (key) {
            if (
                Object.prototype.hasOwnProperty.call(
                    selectedBackup.data,
                    key
                )
            ) {
                localStorage.setItem(
                    key,
                    JSON.stringify(selectedBackup.data[key])
                );
            }
        });

        restoreModal.classList.remove("show");
        restoreFile.value = "";
        selectedBackup = null;

        loadSettings();

        addAuditLog(
            "Updated",
            "System Settings",
            "Restored a MedTrack backup."
        );

        showMessage(
            "Backup restored successfully.",
            "success"
        );
    });

    cancelRestore.addEventListener("click", function () {
        selectedBackup = null;
        restoreFile.value = "";
        restoreModal.classList.remove("show");
    });

    restoreModal.addEventListener("click", function (event) {
        if (event.target === restoreModal) {
            selectedBackup = null;
            restoreFile.value = "";
            restoreModal.classList.remove("show");
        }
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            selectedBackup = null;
            restoreFile.value = "";
            restoreModal.classList.remove("show");
        }
    });

    // =====================================
    // AUDIT LOG
    // =====================================

    function addAuditLog(action, module, details) {
        const savedLogs =
            localStorage.getItem("medtrackAuditLogs");

        let logs = [];

        if (savedLogs) {
            try {
                logs = JSON.parse(savedLogs);

                if (!Array.isArray(logs)) {
                    logs = [];
                }
            } catch (error) {
                logs = [];
            }
        }

        let highestNumber = 0;

        logs.forEach(function (log) {
            const number = Number(
                String(log.id).replace("LOG-", "")
            );

            if (!Number.isNaN(number) && number > highestNumber) {
                highestNumber = number;
            }
        });

        logs.unshift({
            id:
                `LOG-${String(highestNumber + 1).padStart(3, "0")}`,

            timestamp:
                new Date().toISOString(),

            userId:
                currentUser.id,

            userName:
                currentUser.fullname ||
                currentUser.username ||
                "Administrator",

            role:
                currentUser.role,

            action:
                action,

            module:
                module,

            details:
                details
        });

        localStorage.setItem(
            "medtrackAuditLogs",
            JSON.stringify(logs)
        );
    }

    // =====================================
    // LOGOUT
    // =====================================

    logoutButton.addEventListener("click", function () {
        const confirmLogout = confirm(
            "Are you sure you want to log out?"
        );

        if (!confirmLogout) {
            return;
        }

        addAuditLog(
            "Logout",
            "Authentication",
            "Administrator logged out of MedTrack."
        );

        localStorage.removeItem("medtrackCurrentUser");
        sessionStorage.removeItem("medtrackCurrentUser");

        window.location.replace("login.html");
    });

    // =====================================
    // INITIAL DISPLAY
    // =====================================

    loadSettings();
});