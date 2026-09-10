
document.addEventListener("DOMContentLoaded", async function () {


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

    const securitySection =
        document.getElementById("securitySection");

    const currentPassword =
        document.getElementById("currentPassword");

    const newPassword =
        document.getElementById("newPassword");

    const confirmNewPassword =
        document.getElementById("confirmNewPassword");

    const downloadBackup =
        document.getElementById("downloadBackup");

    const backupPassword =
        document.getElementById("backupPassword");

    const confirmBackupPassword =
        document.getElementById("confirmBackupPassword");

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

    const restorePassword =
        document.getElementById("restorePassword");

    let selectedBackup = null;


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

        recordAdminEvent("general_settings_updated");

        showMessage(
            "General settings saved successfully.",
            "success"
        );
    });


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

        recordAdminEvent("inventory_settings_updated");

        showMessage(
            "Inventory settings saved successfully.",
            "success"
        );
    });


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

            recordAdminEvent("notification_settings_updated");

            showMessage(
                "Notification settings saved successfully.",
                "success"
            );
        }
    );


    securitySection.addEventListener("submit", async function (event) {
        event.preventDefault();

        const currentPasswordValue =
            currentPassword.value;

        const newPasswordValue =
            newPassword.value;

        const confirmPasswordValue =
            confirmNewPassword.value;

        const passwordError =
            window.medtrackAuth.passwordPolicyError(newPasswordValue);

        if (passwordError) {
            showMessage(passwordError, "error");

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

        const reauthentication =
            await window.medtrackAuth.client.auth.signInWithPassword({
                email: currentUser.email,
                password: currentPasswordValue
            });

        if (reauthentication.error) {
            showMessage(
                "Current password is incorrect.",
                "error"
            );

            return;
        }

        const passwordUpdate =
            await window.medtrackAuth.client.auth.updateUser({
                password: newPasswordValue
            });

        if (passwordUpdate.error) {
            showMessage(
                passwordUpdate.error.message ||
                    "Unable to change the password.",
                "error"
            );

            return;
        }

        securitySection.reset();

        recordAdminEvent("password_changed");

        showMessage(
            "Password changed successfully.",
            "success"
        );
    });


    const backupKeys = [
        "medtrackMedicalSupplies",
        "medtrackMedicalEquipment",
        "medtrackMobilityAssets",
        "medtrackBorrowTransactions",
        "medtrackEmergencyRequests",
        "medtrackSettings"
    ];
    const collectionBackupKeys = backupKeys.filter(function (key) {
        return key !== "medtrackSettings";
    });
    const backupIterations = 250000;
    const maximumBackupBytes = 25 * 1024 * 1024;
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    function bytesToBase64(bytes) {
        let binary = "";
        const chunkSize = 32768;

        for (let index = 0; index < bytes.length; index += chunkSize) {
            binary += String.fromCharCode(
                ...bytes.subarray(index, index + chunkSize)
            );
        }

        return btoa(binary);
    }

    function base64ToBytes(value) {
        if (typeof value !== "string" || value.length > maximumBackupBytes * 2) {
            throw new Error("Invalid encrypted backup data.");
        }

        const binary = atob(value);
        const bytes = new Uint8Array(binary.length);

        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
        }

        return bytes;
    }

    async function deriveBackupKey(password, salt, usage) {
        const keyMaterial = await crypto.subtle.importKey(
            "raw",
            encoder.encode(password),
            "PBKDF2",
            false,
            ["deriveKey"]
        );

        return crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                hash: "SHA-256",
                salt: salt,
                iterations: backupIterations
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            [usage]
        );
    }

    function collectBackupData() {
        const data = {};

        backupKeys.forEach(function (key) {
            const fallback = key === "medtrackSettings" ? {} : [];

            try {
                data[key] = JSON.parse(
                    localStorage.getItem(key) || JSON.stringify(fallback)
                );
            } catch (error) {
                throw new Error(`Unable to read ${key}. Refresh and try again.`);
            }
        });

        return data;
    }

    function validateBackupData(backup) {
        if (
            !backup ||
            backup.backupType !== "MedTrack" ||
            backup.version !== 2 ||
            !backup.data ||
            typeof backup.data !== "object" ||
            Array.isArray(backup.data)
        ) {
            throw new Error("The decrypted file is not a valid MedTrack backup.");
        }

        const suppliedKeys = Object.keys(backup.data);

        if (suppliedKeys.some(function (key) {
            return !backupKeys.includes(key);
        })) {
            throw new Error("The backup contains an unsupported data section.");
        }

        collectionBackupKeys.forEach(function (key) {
            const records = backup.data[key];

            if (!Array.isArray(records) || records.length > 50000) {
                throw new Error(`The ${key} section is invalid or too large.`);
            }

            records.forEach(function (record) {
                if (
                    !record ||
                    typeof record !== "object" ||
                    Array.isArray(record) ||
                    typeof record.id !== "string" ||
                    !record.id.trim() ||
                    record.id.length > 128
                ) {
                    throw new Error(`The ${key} section contains an invalid record.`);
                }
            });
        });

        if (
            !backup.data.medtrackSettings ||
            typeof backup.data.medtrackSettings !== "object" ||
            Array.isArray(backup.data.medtrackSettings)
        ) {
            throw new Error("The settings section is invalid.");
        }

        return backup.data;
    }

    function toDatabaseBackupData(data) {
        return {
            medtrackMedicalSupplies: data.medtrackMedicalSupplies.map(function (item) {
                return {
                    id: item.id,
                    name: item.name,
                    category: item.category,
                    quantity: Number(item.quantity),
                    unit: item.unit,
                    expiration_date: item.expirationDate || "",
                    low_stock_level: Number(item.lowStockLevel)
                };
            }),
            medtrackMedicalEquipment: data.medtrackMedicalEquipment.map(function (item) {
                return {
                    id: item.id,
                    name: item.name,
                    category: item.category,
                    quantity: Number(item.quantity),
                    condition: item.condition,
                    location: item.location,
                    maintenance_date: item.maintenanceDate || "",
                    status: item.status
                };
            }),
            medtrackMobilityAssets: data.medtrackMobilityAssets.map(function (item) {
                return {
                    id: item.id,
                    name: item.name,
                    asset_type: item.type,
                    plate_number: item.plateNumber || "",
                    condition: item.condition,
                    driver: item.driver || "",
                    location: item.location,
                    maintenance_date: item.maintenanceDate || "",
                    status: item.status
                };
            }),
            medtrackBorrowTransactions: data.medtrackBorrowTransactions.map(function (item) {
                return {
                    id: item.id,
                    borrower: item.borrower,
                    department: item.department,
                    item_type: item.itemType,
                    item_name: item.itemName,
                    quantity: Number(item.quantity),
                    borrow_date: item.borrowDate,
                    borrowed_at: item.borrowedAt || `${item.borrowDate}T00:00:00+08:00`,
                    due_date: item.dueDate,
                    return_date: item.returnDate || "",
                    status: item.status,
                    purpose: item.purpose,
                    assigned_personnel: item.assignedPersonnel || "",
                    destination: item.destination || "",
                    remarks: item.remarks || "",
                    inventory_item_id: item.inventoryItemId || "",
                    inventory_adjusted: Boolean(item.inventoryAdjusted),
                    inventory_returned: Boolean(item.inventoryReturned)
                };
            }),
            medtrackEmergencyRequests: data.medtrackEmergencyRequests.map(function (item) {
                return {
                    id: item.id,
                    request_date: item.date,
                    request_time: item.time,
                    request_type: item.type,
                    priority: item.priority,
                    location: item.location,
                    contact_person: item.contactPerson,
                    contact_number: item.contactNumber,
                    assigned_team: item.assignedTeam,
                    status: item.status,
                    resources: item.resources,
                    description: item.description,
                    inventory_usage: item.inventoryUsage || null,
                    inventory_deducted: Boolean(item.inventoryDeducted),
                    inventory_deducted_at: item.inventoryDeductedAt || "",
                    completed_at: item.completedAt || ""
                };
            })
        };
    }

    async function encryptBackup(backup, password) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await deriveBackupKey(password, salt, "encrypt");
        const ciphertext = await crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv: iv,
                additionalData: encoder.encode("MedTrackBackup:v2")
            },
            key,
            encoder.encode(JSON.stringify(backup))
        );

        return {
            backupType: "MedTrackEncrypted",
            version: 2,
            createdAt: backup.createdAt,
            kdf: {
                name: "PBKDF2",
                hash: "SHA-256",
                iterations: backupIterations,
                salt: bytesToBase64(salt)
            },
            cipher: {
                name: "AES-GCM",
                iv: bytesToBase64(iv)
            },
            ciphertext: bytesToBase64(new Uint8Array(ciphertext))
        };
    }

    async function decryptBackup(envelope, password) {
        if (
            !envelope ||
            envelope.backupType !== "MedTrackEncrypted" ||
            envelope.version !== 2 ||
            envelope.kdf?.name !== "PBKDF2" ||
            envelope.kdf?.hash !== "SHA-256" ||
            envelope.kdf?.iterations !== backupIterations ||
            envelope.cipher?.name !== "AES-GCM"
        ) {
            throw new Error("This is not a supported encrypted MedTrack backup.");
        }

        const salt = base64ToBytes(envelope.kdf.salt);
        const iv = base64ToBytes(envelope.cipher.iv);

        if (salt.length !== 16 || iv.length !== 12) {
            throw new Error("The encrypted backup header is invalid.");
        }

        const key = await deriveBackupKey(password, salt, "decrypt");
        const plaintext = await crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: iv,
                additionalData: encoder.encode("MedTrackBackup:v2")
            },
            key,
            base64ToBytes(envelope.ciphertext)
        );

        return JSON.parse(decoder.decode(plaintext));
    }

    downloadBackup.addEventListener("click", async function () {
        const password = backupPassword.value;

        if (password.length < 12) {
            showMessage("Use a backup password containing at least 12 characters.", "error");
            backupPassword.focus();
            return;
        }

        if (password !== confirmBackupPassword.value) {
            showMessage("The backup passwords do not match.", "error");
            confirmBackupPassword.focus();
            return;
        }

        downloadBackup.disabled = true;

        try {
            if (window.medtrackData) {
                const refreshed = await window.medtrackData.refresh();

                if (!refreshed) {
                    throw new Error(
                        "Current data could not be downloaded from Supabase. Refresh and try again."
                    );
                }
            }

            const backup = {
                backupType: "MedTrack",
                version: 2,
                createdAt: new Date().toISOString(),
                data: collectBackupData()
            };
            const encryptedBackup = await encryptBackup(backup, password);
            const backupFile = new Blob(
                [JSON.stringify(encryptedBackup, null, 2)],
                { type: "application/json" }
            );
            const downloadLink = document.createElement("a");

            downloadLink.href = URL.createObjectURL(backupFile);
            downloadLink.download = `medtrack-encrypted-backup-${getFileDate()}.json`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            URL.revokeObjectURL(downloadLink.href);
            downloadLink.remove();
            backupPassword.value = "";
            confirmBackupPassword.value = "";

            recordAdminEvent("encrypted_backup_downloaded");
            showMessage("Encrypted backup downloaded successfully.", "success");
        } catch (error) {
            console.error("Encrypted backup failed:", error);
            showMessage(error.message || "Unable to create the encrypted backup.", "error");
        } finally {
            downloadBackup.disabled = false;
        }
    });

    function getFileDate() {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    selectRestoreFile.addEventListener("click", function () {
        restoreFile.click();
    });

    restoreFile.addEventListener("change", function () {
        const file = restoreFile.files[0];

        if (!file) {
            return;
        }

        if (file.size > maximumBackupBytes) {
            restoreFile.value = "";
            showMessage("The selected backup is larger than the 25 MB limit.", "error");
            return;
        }

        const reader = new FileReader();

        reader.addEventListener("load", function () {
            try {
                const envelope = JSON.parse(reader.result);

                if (
                    envelope.backupType !== "MedTrackEncrypted" ||
                    envelope.version !== 2 ||
                    !envelope.ciphertext
                ) {
                    throw new Error("Invalid encrypted backup");
                }

                selectedBackup = envelope;
                restorePassword.value = "";
                restoreModal.classList.add("show");
                restorePassword.focus();
            } catch (error) {
                selectedBackup = null;
                restoreFile.value = "";
                showMessage("Select a valid encrypted MedTrack backup file.", "error");
            }
        });

        reader.readAsText(file);
    });

    confirmRestore.addEventListener("click", async function () {
        if (!selectedBackup) {
            return;
        }

        if (restorePassword.value.length < 12) {
            showMessage("Enter the backup password.", "error");
            restorePassword.focus();
            return;
        }

        confirmRestore.disabled = true;

        try {
            const decryptedBackup = await decryptBackup(
                selectedBackup,
                restorePassword.value
            );
            const restoredData = validateBackupData(decryptedBackup);
            const restoreResult = await window.medtrackAuth.client.rpc(
                "medtrack_restore_encrypted_backup",
                { p_data: toDatabaseBackupData(restoredData) }
            );

            if (restoreResult.error) {
                throw restoreResult.error;
            }

            localStorage.setItem(
                "medtrackSettings",
                JSON.stringify(restoredData.medtrackSettings)
            );

            if (window.medtrackData) {
                await window.medtrackData.refresh();
            }

            closeRestoreModal();
            loadSettings();
            recordAdminEvent("encrypted_backup_restored");
            showMessage("Encrypted backup restored successfully.", "success");
        } catch (error) {
            console.error("Encrypted restore failed:", error);
            showMessage(
                "Restore failed. Check the password and confirm that the file is a valid MedTrack backup.",
                "error"
            );
        } finally {
            confirmRestore.disabled = false;
        }
    });

    function closeRestoreModal() {
        selectedBackup = null;
        restoreFile.value = "";
        restorePassword.value = "";
        restoreModal.classList.remove("show");
    }

    cancelRestore.addEventListener("click", closeRestoreModal);

    restoreModal.addEventListener("click", function (event) {
        if (event.target === restoreModal) {
            closeRestoreModal();
        }
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            closeRestoreModal();
        }
    });


    async function recordAdminEvent(eventName) {
        try {
            const result = await window.medtrackAuth.client.rpc(
                "medtrack_record_admin_settings_event",
                { p_event: eventName }
            );

            if (result.error) {
                console.error("Unable to record Settings audit event:", result.error);
            }
        } catch (error) {
            console.error("Unable to record Settings audit event:", error);
        }
    }


    logoutButton.addEventListener("click", async function () {
        const confirmLogout = confirm(
            "Are you sure you want to log out?"
        );

        if (!confirmLogout) {
            return;
        }

        await window.medtrackAuth.signOutAndRedirect();
    });


    loadSettings();
});
