(function () {
    "use strict";

    const client = window.medtrackSupabase;
    const offlineStore = window.medtrackOfflineStore;

    if (!client) {
        console.error(
            "MedTrack data sync could not find the Supabase client."
        );
        return;
    }

    const originalSetItem =
        Storage.prototype.setItem;

    const originalRemoveItem =
        Storage.prototype.removeItem;

    let applyingCloudData = false;
    let refreshInProgress = null;
    let syncInProgress = null;
    let logoutInProgress = false;

    const uploadTimers = new Map();
    const collectionSnapshots = new Map();

    function createOperationId(prefix) {
        const suffix = window.crypto && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        return `${prefix}-${suffix}`;
    }

    function isNetworkError(error) {
        return !navigator.onLine || /fetch|network|load failed|offline/i.test(
            String(error && error.message || error || "")
        );
    }

    async function getSessionUserId() {
        const result = await client.auth.getSession();
        const session = result.data && result.data.session;
        return session && session.user ? session.user.id : "";
    }

    function text(value, fallback = "") {
        const normalized =
            String(value ?? "").trim();

        return normalized || fallback;
    }

    function number(value, fallback = 0) {
        const normalized = Number(value);

        return Number.isFinite(normalized)
            ? normalized
            : fallback;
    }

    function nullable(value) {
        const normalized = text(value);
        return normalized || null;
    }

    const collections = {
        medtrackMedicalSupplies: {
            table: "medical_supplies",

            toCloud: function (item) {
                return {
                    id: text(item.id),
                    name: text(item.name, "Unnamed supply"),
                    category: text(item.category, "Uncategorized"),
                    quantity: Math.max(0, number(item.quantity)),
                    unit: text(item.unit, "Units"),
                    expiration_date: nullable(item.expirationDate),
                    low_stock_level: Math.max(
                        1,
                        number(item.lowStockLevel, 10)
                    ),
                    updated_at: new Date().toISOString()
                };
            },

            fromCloud: function (item) {
                return {
                    id: item.id,
                    name: item.name,
                    category: item.category,
                    quantity: item.quantity,
                    unit: item.unit,
                    expirationDate: item.expiration_date || "",
                    lowStockLevel: item.low_stock_level,
                    serverUpdatedAt: item.updated_at || ""
                };
            }
        },

        medtrackMedicalEquipment: {
            table: "medical_equipment",

            toCloud: function (item) {
                return {
                    id: text(item.id),
                    name: text(item.name, "Unnamed equipment"),
                    category: text(item.category, "Uncategorized"),
                    quantity: Math.max(0, number(item.quantity)),
                    condition: text(item.condition, "Good"),
                    location: text(item.location, "Not specified"),
                    maintenance_date: nullable(item.maintenanceDate),
                    status: text(item.status, "Available"),
                    updated_at: new Date().toISOString()
                };
            },

            fromCloud: function (item) {
                return {
                    id: item.id,
                    name: item.name,
                    category: item.category,
                    quantity: item.quantity,
                    condition: item.condition,
                    location: item.location,
                    maintenanceDate: item.maintenance_date || "",
                    status: item.status,
                    serverUpdatedAt: item.updated_at || ""
                };
            }
        },

        medtrackMobilityAssets: {
            table: "mobility_assets",

            toCloud: function (item) {
                return {
                    id: text(item.id),
                    name: text(item.name, "Unnamed mobility asset"),
                    type: text(
                        item.type || item.category || item.vehicleType,
                        "Vehicle"
                    ),
                    plate_number: nullable(item.plateNumber),
                    condition: text(item.condition, "Good"),
                    driver: nullable(item.driver),
                    location: text(item.location, "Not specified"),
                    maintenance_date: nullable(item.maintenanceDate),
                    status: text(item.status, "Available"),
                    updated_at: new Date().toISOString()
                };
            },

            fromCloud: function (item) {
                return {
                    id: item.id,
                    name: item.name,
                    type: item.type,
                    plateNumber: item.plate_number || "",
                    condition: item.condition,
                    driver: item.driver || "",
                    location: item.location,
                    maintenanceDate: item.maintenance_date || "",
                    status: item.status,
                    serverUpdatedAt: item.updated_at || ""
                };
            }
        },

        medtrackBorrowTransactions: {
            table: "borrow_transactions",

            toCloud: function (item) {
                return {
                    id: text(item.id),
                    borrower: text(item.borrower, "MedTrack User"),
                    department: text(item.department, "Staff"),
                    item_type: text(item.itemType, "Medical Supply"),
                    item_name: text(item.itemName, "Unnamed item"),
                    quantity: Math.max(1, number(item.quantity, 1)),
                    borrow_date: nullable(item.borrowDate),
                    borrowed_at: nullable(item.borrowedAt),
                    due_date: nullable(item.dueDate),
                    return_date: nullable(item.returnDate),
                    status: text(item.status, "Borrowed"),
                    purpose: text(item.purpose, "Inventory transaction"),
                    assigned_personnel: nullable(item.assignedPersonnel),
                    destination: nullable(item.destination),
                    remarks: nullable(item.remarks),
                    status_details: item.statusDetails || {},
                    status_remarks: nullable(item.statusRemarks),
                    status_updated_at: nullable(item.statusUpdatedAt),
                    inventory_item_id: nullable(item.inventoryItemId),
                    inventory_adjusted: Boolean(item.inventoryAdjusted),
                    inventory_returned: Boolean(item.inventoryReturned),
                    updated_at: new Date().toISOString()
                };
            },

            fromCloud: function (item) {
                return {
                    id: item.id,
                    borrower: item.borrower,
                    department: item.department,
                    itemType: item.item_type,
                    itemName: item.item_name,
                    quantity: item.quantity,
                    borrowDate: item.borrow_date,
                    borrowedAt: item.borrowed_at || "",
                    dueDate: item.due_date,
                    returnDate: item.return_date || "",
                    status: item.status,
                    purpose: item.purpose,
                    assignedPersonnel: item.assigned_personnel || "",
                    destination: item.destination || "",
                    remarks: item.remarks || "",
                    statusDetails: item.status_details || {},
                    statusRemarks: item.status_remarks || "",
                    statusUpdatedAt: item.status_updated_at || "",
                    inventoryItemId: item.inventory_item_id || "",
                    inventoryAdjusted: item.inventory_adjusted,
                    inventoryReturned: item.inventory_returned,
                    serverUpdatedAt: item.updated_at || ""
                };
            }
        },

        medtrackEmergencyRequests: {
            table: "emergency_requests",

            toCloud: function (item) {
                return {
                    id: text(item.id),
                    request_date: nullable(item.date),
                    request_time: text(item.time, "00:00"),
                    type: text(item.type, "Emergency"),
                    priority: text(item.priority, "Medium"),
                    location: text(item.location, "Not specified"),
                    contact_person: text(
                        item.contactPerson,
                        "Not specified"
                    ),
                    contact_number: text(
                        item.contactNumber,
                        "Not specified"
                    ),
                    assigned_team: text(item.assignedTeam, "Unassigned"),
                    status: text(item.status, "Pending"),
                    resources: text(item.resources, "Not specified"),
                    description: text(item.description, "No description"),
                    inventory_usage: item.inventoryUsage || null,
                    inventory_deducted: Boolean(item.inventoryDeducted),
                    inventory_deducted_at: nullable(
                        item.inventoryDeductedAt
                    ),
                    completed_at: nullable(item.completedAt),
                    updated_at: new Date().toISOString()
                };
            },

            fromCloud: function (item) {
                return {
                    id: item.id,
                    date: item.request_date,
                    time: item.request_time,
                    type: item.type,
                    priority: item.priority,
                    location: item.location,
                    contactPerson: item.contact_person,
                    contactNumber: item.contact_number,
                    assignedTeam: item.assigned_team,
                    status: item.status,
                    resources: item.resources,
                    description: item.description,
                    inventoryUsage: item.inventory_usage,
                    inventoryDeducted: item.inventory_deducted,
                    inventoryDeductedAt:
                        item.inventory_deducted_at || "",
                    completedAt: item.completed_at || "",
                    serverUpdatedAt: item.updated_at || ""
                };
            }
        }
    };

    function readLocalCollection(storageKey) {
        try {
            const records = JSON.parse(
                localStorage.getItem(storageKey) || "[]"
            );

            return Array.isArray(records)
                ? records
                : [];
        } catch (error) {
            console.error(
                `Unable to read ${storageKey}:`,
                error
            );
            return [];
        }
    }

    function createSnapshot(records) {
        const snapshot = new Map();

        records.forEach(function (record) {
            const id = text(record && record.id);

            if (id) {
                snapshot.set(id, JSON.stringify(record));
            }
        });

        return snapshot;
    }

    function rememberSnapshot(storageKey, records) {
        collectionSnapshots.set(
            storageKey,
            createSnapshot(records)
        );
    }

    function writeLocalCollection(storageKey, records, remember = true) {
        applyingCloudData = true;

        try {
            originalSetItem.call(
                localStorage,
                storageKey,
                JSON.stringify(records)
            );
            if (remember) rememberSnapshot(storageKey, records);
        } finally {
            applyingCloudData = false;
        }

        if (offlineStore) {
            getSessionUserId().then(function (userId) {
                if (userId) {
                    return offlineStore.saveSnapshot(
                        storageKey,
                        records,
                        userId
                    );
                }
                return null;
            }).catch(function (error) {
                console.error("Unable to cache MedTrack records:", error);
            });
        }
    }

    async function downloadCollection(storageKey) {
        const collection = collections[storageKey];

        const result = await client
            .from(collection.table)
            .select("*")
            .order("id", { ascending: true });

        if (result.error) {
            throw new Error(
                `${collection.table}: ${result.error.message}`
            );
        }

        const localRecords = (result.data || []).map(
            collection.fromCloud
        );

        writeLocalCollection(storageKey, localRecords);

        return localRecords;
    }

    async function uploadCollection(
        storageKey,
        forceUpload = false
    ) {
        const collection = collections[storageKey];
        const localRecords = readLocalCollection(storageKey);
        const previousSnapshot =
            collectionSnapshots.get(storageKey) ||
            new Map();

        const validLocalRecords = localRecords
            .filter(function (item) {
                return text(item.id) !== "";
            });

        const currentSnapshot =
            createSnapshot(validLocalRecords);

        const changedLocalRecords = validLocalRecords
            .filter(function (item) {
                const id = text(item.id);

                return (
                    forceUpload ||
                    previousSnapshot.get(id) !==
                        currentSnapshot.get(id)
                );
            });

        if (changedLocalRecords.length > 0 && navigator.onLine) {
            const ids = changedLocalRecords.map(function (item) {
                return text(item.id);
            });
            const versionResult = await client
                .from(collection.table)
                .select("id, updated_at")
                .in("id", ids);

            if (versionResult.error) {
                throw new Error(versionResult.error.message);
            }

            const cloudVersions = new Map(
                (versionResult.data || []).map(function (record) {
                    return [text(record.id), text(record.updated_at)];
                })
            );

            for (const item of changedLocalRecords) {
                const id = text(item.id);
                const cloudVersion = cloudVersions.get(id);
                if (!cloudVersion) continue;

                let localVersion = text(item.serverUpdatedAt);
                if (!localVersion && previousSnapshot.has(id)) {
                    try {
                        localVersion = text(
                            JSON.parse(previousSnapshot.get(id)).serverUpdatedAt
                        );
                    } catch (error) {
                        localVersion = "";
                    }
                }

                if (!localVersion || localVersion !== cloudVersion) {
                    throw new Error(
                        `Sync conflict for ${collection.table} record ${id}. ` +
                        "A newer database version is available; refresh and " +
                        "review the record before saving again."
                    );
                }
            }
        }

        const changedRecords = changedLocalRecords.map(collection.toCloud);

        if (changedRecords.length > 0) {
            const upsertResult = await client
                .from(collection.table)
                .upsert(changedRecords, {
                    onConflict: "id"
                })
                .select("id, updated_at");

            if (upsertResult.error) {
                throw new Error(upsertResult.error.message);
            }

            const savedVersions = new Map(
                (upsertResult.data || []).map(function (record) {
                    return [text(record.id), text(record.updated_at)];
                })
            );
            const savedRecords = validLocalRecords.map(function (record) {
                const serverUpdatedAt = savedVersions.get(text(record.id));
                return serverUpdatedAt
                    ? { ...record, serverUpdatedAt: serverUpdatedAt }
                    : record;
            });
            writeLocalCollection(storageKey, savedRecords);
            return;
        }

        rememberSnapshot(
            storageKey,
            validLocalRecords
        );
    }

    async function deleteInventoryItem(storageKey, itemId) {
        const allowedStorageKeys = new Set([
            "medtrackMedicalSupplies",
            "medtrackMedicalEquipment",
            "medtrackMobilityAssets"
        ]);
        const normalizedId = text(itemId);

        if (!allowedStorageKeys.has(storageKey) || !normalizedId) {
            throw new Error("Invalid inventory delete request.");
        }

        const collection = collections[storageKey];
        const operation = {
            id: createOperationId("delete"),
            kind: "delete",
            storageKey: storageKey,
            itemId: normalizedId
        };

        function applyLocalDelete() {
            const records = readLocalCollection(storageKey).filter(function (record) {
                return text(record && record.id) !== normalizedId;
            });
            writeLocalCollection(storageKey, records, false);
            window.dispatchEvent(new CustomEvent("medtrack:data-ready"));
        }

        if (!navigator.onLine) {
            await queueOperation(operation);
            applyLocalDelete();
            return { queued: true };
        }

        let result;
        try {
            result = await client
                .from(collection.table)
                .delete()
                .eq("id", normalizedId)
                .select("id");
        } catch (error) {
            if (!isNetworkError(error)) throw error;
            await queueOperation(operation);
            applyLocalDelete();
            return { queued: true };
        }

        if (result.error) {
            if (isNetworkError(result.error)) {
                await queueOperation(operation);
                applyLocalDelete();
                return { queued: true };
            }
            throw new Error(result.error.message);
        }

        if (!result.data || result.data.length !== 1) {
            throw new Error(
                "The record was not deleted. It may no longer exist, " +
                "or your account may not have Administrator permission."
            );
        }

        await downloadCollection(storageKey);

        window.dispatchEvent(
            new CustomEvent("medtrack:data-ready")
        );

        return true;
    }

    function reportError(action, error) {
        console.error(
            `MedTrack cloud ${action} failed:`,
            error
        );

        let notice = document.getElementById(
            "medtrackDataErrorNotice"
        );

        if (!notice) {
            notice = document.createElement("div");
            notice.id = "medtrackDataErrorNotice";
            notice.setAttribute("role", "alert");
            notice.style.cssText = [
                "position:fixed",
                "top:16px",
                "left:50%",
                "transform:translateX(-50%)",
                "z-index:10000",
                "max-width:min(560px,calc(100% - 32px))",
                "padding:12px 16px",
                "border-radius:10px",
                "background:#991b1b",
                "color:#fff",
                "box-shadow:0 8px 24px rgba(0,0,0,.22)",
                "font:600 14px/1.4 system-ui,sans-serif"
            ].join(";");
            document.body.appendChild(notice);
        }

        notice.textContent =
            "Some changes could not be saved to the database. " +
            "Refresh the page and try again. If the problem continues, " +
            "contact an Administrator.";

        window.dispatchEvent(
            new CustomEvent("medtrack:data-error", {
                detail: {
                    action: action,
                    message: error.message
                }
            })
        );
    }

    async function queueOperation(operation) {
        if (!offlineStore) {
            throw new Error(
                "Offline storage is unavailable. Reconnect and try again."
            );
        }

        const userId = await getSessionUserId();
        if (!userId) {
            throw new Error("Your session is unavailable. Reconnect and sign in.");
        }

        await offlineStore.enqueue({
            ...operation,
            userId: userId,
            createdAt: operation.createdAt || new Date().toISOString()
        });
    }

    async function queueCollectionUpload(storageKey) {
        await queueOperation({
            id: `collection:${storageKey}`,
            kind: "collection",
            storageKey: storageKey
        });
    }

    function scheduleUpload(storageKey) {
        if (!collections[storageKey]) {
            return;
        }

        if (uploadTimers.has(storageKey)) {
            clearTimeout(
                uploadTimers.get(storageKey)
            );
        }

        const timer = setTimeout(
            async function () {
                uploadTimers.delete(storageKey);

                try {
                    if (!navigator.onLine) {
                        await queueCollectionUpload(storageKey);
                        return;
                    }

                    await uploadCollection(storageKey);

                    window.dispatchEvent(
                        new CustomEvent(
                            "medtrack:data-saved",
                            {
                                detail: {
                                    storageKey: storageKey
                                }
                            }
                        )
                    );
                } catch (error) {
                    if (isNetworkError(error)) {
                        try {
                            await queueCollectionUpload(storageKey);
                        } catch (queueError) {
                            reportError("offline queue", queueError);
                        }
                    } else {
                        reportError("upload", error);
                    }
                }
            },
            200
        );

        uploadTimers.set(storageKey, timer);
    }

    Storage.prototype.setItem = function (key, value) {
        originalSetItem.call(this, key, value);

        if (
            this === localStorage &&
            !applyingCloudData &&
            collections[key]
        ) {
            scheduleUpload(key);
        }
    };

    Storage.prototype.removeItem = function (key) {
        originalRemoveItem.call(this, key);

        if (
            this === localStorage &&
            !applyingCloudData &&
            collections[key]
        ) {
            scheduleUpload(key);
        }
    };

    async function restoreOfflineCollections() {
        if (!offlineStore) return false;
        const userId = await getSessionUserId();
        if (!userId) return false;

        let restored = false;
        for (const storageKey of Object.keys(collections)) {
            const records = await offlineStore.loadSnapshot(storageKey, userId);
            if (Array.isArray(records)) {
                writeLocalCollection(storageKey, records);
                restored = true;
            }
        }

        if (restored) {
            window.dispatchEvent(new CustomEvent("medtrack:data-ready"));
        }
        await offlineStore.announce(userId, "offline");
        return restored;
    }

    async function refresh() {
        if (logoutInProgress) {
            return false;
        }

        if (refreshInProgress) {
            return refreshInProgress;
        }

        refreshInProgress = (async function () {
            if (!navigator.onLine) {
                return restoreOfflineCollections();
            }

            const userResult = await client.auth.getUser();
            const user = userResult.data && userResult.data.user;

            if (userResult.error || !user) {
                return false;
            }

            const storageKeys = Object.keys(collections);

            await Promise.all(
                storageKeys.map(downloadCollection)
            );

            window.dispatchEvent(
                new CustomEvent("medtrack:data-ready")
            );

            return true;
        })();

        try {
            return await refreshInProgress;
        } catch (error) {
            if (isNetworkError(error)) {
                return restoreOfflineCollections();
            }
            reportError("download", error);
            return false;
        } finally {
            refreshInProgress = null;
        }
    }

    async function pushAll() {
        const storageKeys = Object.keys(collections);

        for (const storageKey of storageKeys) {
            await uploadCollection(storageKey, true);
        }

        return true;
    }


    async function runInventoryOperation(
        functionName,
        parameters,
        storageKeys = Object.keys(collections),
        options = {}
    ) {
        const operation = {
            id: options.queueId || createOperationId("rpc"),
            kind: "rpc",
            functionName: functionName,
            parameters: parameters,
            storageKeys: storageKeys
        };

        if (!navigator.onLine) {
            await queueOperation(operation);
            if (options.optimistic) options.optimistic();
            return {
                queued: true,
                id: options.pendingId || operation.id
            };
        }

        let result;
        try {
            result = await client.rpc(functionName, parameters);
        } catch (error) {
            if (isNetworkError(error)) {
                await queueOperation(operation);
                if (options.optimistic) options.optimistic();
                return {
                    queued: true,
                    id: options.pendingId || operation.id
                };
            }
            throw error;
        }

        if (result.error) {
            if (isNetworkError(result.error)) {
                await queueOperation(operation);
                if (options.optimistic) options.optimistic();
                return {
                    queued: true,
                    id: options.pendingId || operation.id
                };
            }

            const missingDatabaseFeature =
                [
                    "medtrack_save_medical_supply",
                    "medtrack_consume_medical_supply",
                    "medtrack_update_borrow_status"
                ].includes(functionName) &&
                (
                    result.error.code === "PGRST202" ||
                    /schema cache|could not find the function/i.test(
                        result.error.message || ""
                    )
                );

            throw new Error(
                missingDatabaseFeature
                    ? "The required database update has not " +
                        "been installed yet. Ask an administrator to " +
                        "apply the latest Supabase migration."
                    : result.error.message
            );
        }

        await Promise.all(
            storageKeys.map(downloadCollection)
        );

        window.dispatchEvent(
            new CustomEvent("medtrack:data-ready")
        );

        return result.data;
    }

    function updateLocalRecord(storageKey, recordId, update) {
        const records = readLocalCollection(storageKey);
        const index = records.findIndex(function (record) {
            return text(record && record.id) === text(recordId);
        });
        if (index < 0) return null;

        records[index] = typeof update === "function"
            ? update({ ...records[index] })
            : { ...records[index], ...update };
        writeLocalCollection(storageKey, records, false);
        window.dispatchEvent(new CustomEvent("medtrack:data-ready"));
        return records[index];
    }

    function optimisticallyBorrow(details, pendingId) {
        const isEquipment = details.itemType === "Medical Equipment";
        const storageKey = isEquipment
            ? "medtrackMedicalEquipment"
            : "medtrackMobilityAssets";
        const item = updateLocalRecord(storageKey, details.itemId, function (record) {
            if (isEquipment) {
                const remaining = Math.max(
                    0,
                    number(record.quantity) - number(details.quantity, 1)
                );
                record.quantity = remaining;
                record.status = "Borrowed";
            } else {
                record.status = "Borrowed";
            }
            return record;
        });

        const transactions = readLocalCollection("medtrackBorrowTransactions");
        transactions.push({
            id: pendingId,
            borrower: details.borrower,
            department: details.department,
            itemType: details.itemType,
            itemName: item ? item.name : "Pending item",
            quantity: details.quantity,
            borrowDate: String(details.borrowedAt || "").slice(0, 10),
            borrowedAt: details.borrowedAt,
            dueDate: details.dueDate,
            returnDate: "",
            status: "Borrowed",
            purpose: details.purpose,
            assignedPersonnel: details.assignedPersonnel || "",
            destination: details.destination || "",
            remarks: details.remarks || "",
            inventoryItemId: details.itemId,
            inventoryAdjusted: true,
            inventoryReturned: false,
            pendingSync: true
        });
        writeLocalCollection("medtrackBorrowTransactions", transactions, false);
        window.dispatchEvent(new CustomEvent("medtrack:data-ready"));
    }

    function optimisticallyUpdateBorrowStatus(transactionId, status, details) {
        const transactions = readLocalCollection("medtrackBorrowTransactions");
        const index = transactions.findIndex(function (record) {
            return text(record.id) === text(transactionId);
        });
        if (index < 0) return;

        const transaction = { ...transactions[index] };
        const wasReturned = transaction.status === "Returned" ||
            Boolean(transaction.inventoryReturned);
        const isEquipment = transaction.itemType === "Medical Equipment";
        const storageKey = isEquipment
            ? "medtrackMedicalEquipment"
            : "medtrackMobilityAssets";

        updateLocalRecord(
            storageKey,
            transaction.inventoryItemId,
            function (record) {
                if (["Available", "Returned"].includes(status) && !wasReturned) {
                    if (isEquipment) {
                        record.quantity = number(record.quantity) +
                            number(transaction.quantity, 1);
                        record.status = "Available";
                    } else {
                        record.status = "Available";
                    }
                } else if (!["Available", "Returned"].includes(status) && wasReturned) {
                    if (isEquipment) {
                        record.quantity = Math.max(
                            0,
                            number(record.quantity) - number(transaction.quantity, 1)
                        );
                        record.status = status;
                    } else {
                        record.status = status;
                    }
                } else if (!["Available", "Returned"].includes(status)) {
                    record.status = status;
                }
                if (details && details.condition) record.condition = details.condition;
                if (details && details.location) record.location = details.location;
                return record;
            }
        );

        transaction.status = ["Available", "Returned"].includes(status)
            ? "Returned" : status;
        transaction.returnDate = ["Available", "Returned"].includes(status)
            ? (transaction.returnDate || new Date().toISOString().slice(0, 10))
            : "";
        transaction.inventoryReturned = ["Available", "Returned"].includes(status);
        transaction.statusDetails = details || {};
        transaction.statusRemarks = details && details.remarks || "";
        transaction.statusUpdatedAt = details && details.effectiveAt ||
            new Date().toISOString();
        transaction.pendingSync = true;
        transactions[index] = transaction;
        writeLocalCollection("medtrackBorrowTransactions", transactions, false);
        window.dispatchEvent(new CustomEvent("medtrack:data-ready"));
    }

    async function borrowItem(details) {
        const operationKey = details.operationKey ||
            createOperationId("BORROW");
        const pendingId = `PENDING-${operationKey.slice(-12).toUpperCase()}`;

        return runInventoryOperation(
            "medtrack_borrow_item_once",
            {
                p_operation_key: operationKey,
                p_item_type: details.itemType,
                p_item_id: details.itemId,
                p_quantity: details.quantity,
                p_borrower: details.borrower,
                p_department: details.department,
                p_borrowed_at: details.borrowedAt,
                p_due_date: details.dueDate,
                p_purpose: details.purpose,
                p_assigned_personnel: details.assignedPersonnel || null,
                p_destination: details.destination,
                p_remarks: details.remarks || null
            },
            Object.keys(collections),
            {
                queueId: `rpc:${operationKey}`,
                pendingId: pendingId,
                optimistic: function () {
                    optimisticallyBorrow(details, pendingId);
                }
            }
        );
    }

    async function returnBorrowedItem(transactionId) {
        return runInventoryOperation(
            "medtrack_return_item",
            {
                p_transaction_id: transactionId
            }
        );
    }

    async function updateBorrowStatus(transactionId, status, details) {
        return runInventoryOperation(
            "medtrack_update_borrow_status",
            {
                p_transaction_id: transactionId,
                p_status: status,
                p_details: details || {}
            },
            [
                "medtrackBorrowTransactions",
                "medtrackMedicalEquipment",
                "medtrackMobilityAssets"
            ],
            {
                optimistic: function () {
                    optimisticallyUpdateBorrowStatus(transactionId, status, details);
                }
            }
        );
    }

    async function useInventoryItem(details) {
        if (details.itemType === "Medical Supply") {
            return consumeMedicalSupply({
                operationKey: details.operationKey,
                supplyId: details.itemId,
                emergencyRequestId:
                    details.emergencyRequestId ||
                    details.operationKey,
                emergencyLabel: details.emergencyLabel,
                quantity: details.quantity,
                consumedAt: new Date().toISOString()
            });
        }

        const storageByType = {
            "Medical Equipment":
                "medtrackMedicalEquipment",
            "Mobility Asset":
                "medtrackMobilityAssets"
        };

        const storageKey =
            storageByType[details.itemType];

        return runInventoryOperation(
            "medtrack_use_inventory",
            {
                p_operation_key:
                    details.operationKey,
                p_item_type: details.itemType,
                p_item_id: details.itemId,
                p_quantity: details.quantity
            },
            storageKey ? [storageKey] : [],
            {
                queueId: `rpc:${details.operationKey}`,
                optimistic: function () {
                    if (!storageKey) return;
                    updateLocalRecord(storageKey, details.itemId, function (record) {
                        if (details.itemType === "Mobility Asset") {
                            record.status = "Deployed";
                        } else {
                            record.quantity = Math.max(
                                0,
                                number(record.quantity) - number(details.quantity, 1)
                            );
                            if (record.quantity === 0) record.status = "Unavailable";
                        }
                        return record;
                    });
                }
            }
        );
    }

    async function saveMedicalSupply(details) {
        return runInventoryOperation(
            "medtrack_save_medical_supply",
            {
                p_operation_key: details.operationKey,
                p_supply_id: details.id,
                p_name: details.name,
                p_category: details.category,
                p_quantity: details.quantity,
                p_unit: details.unit,
                p_expiration_date: details.expirationDate,
                p_low_stock_level: details.lowStockLevel
            },
            ["medtrackMedicalSupplies"],
            {
                queueId: `rpc:${details.operationKey}`,
                optimistic: function () {
                    const records = readLocalCollection("medtrackMedicalSupplies");
                    const supply = {
                        id: details.id,
                        name: details.name,
                        category: details.category,
                        quantity: details.quantity,
                        unit: details.unit,
                        expirationDate: details.expirationDate || "",
                        lowStockLevel: details.lowStockLevel,
                        pendingSync: true
                    };
                    const index = records.findIndex(function (record) {
                        return text(record.id) === text(details.id);
                    });
                    if (index >= 0) records[index] = supply;
                    else records.push(supply);
                    writeLocalCollection("medtrackMedicalSupplies", records, false);
                    window.dispatchEvent(new CustomEvent("medtrack:data-ready"));
                }
            }
        );
    }

    async function consumeMedicalSupply(details) {
        return runInventoryOperation(
            "medtrack_consume_medical_supply",
            {
                p_operation_key: details.operationKey,
                p_supply_id: details.supplyId,
                p_emergency_request_id:
                    details.emergencyRequestId,
                p_quantity: details.quantity,
                p_consumed_at:
                    details.consumedAt ||
                    new Date().toISOString(),
                p_emergency_label:
                    details.emergencyLabel || null
            },
            ["medtrackMedicalSupplies"],
            {
                queueId: `rpc:${details.operationKey}`,
                optimistic: function () {
                    updateLocalRecord(
                        "medtrackMedicalSupplies",
                        details.supplyId,
                        function (record) {
                            record.quantity = Math.max(
                                0,
                                number(record.quantity) - number(details.quantity, 1)
                            );
                            record.pendingSync = true;
                            return record;
                        }
                    );
                }
            }
        );
    }

    async function loadSupplyTransactions() {
        const result = await client
            .from("medical_supply_transactions")
            .select(
                "id, transaction_type, supply_id, supply_name, " +
                "unit, quantity, emergency_request_id, " +
                "emergency_label, occurred_at, remaining_stock"
            )
            .order("occurred_at", { ascending: false });

        if (result.error) {
            throw new Error(result.error.message);
        }

        return (result.data || []).map(function (record) {
            return {
                id: record.id,
                type: record.transaction_type,
                supplyId: record.supply_id,
                supplyName: record.supply_name,
                unit: record.unit,
                quantity: record.quantity,
                emergencyRequestId:
                    record.emergency_request_id || "",
                emergencyLabel:
                    record.emergency_label || "Inventory addition",
                occurredAt: record.occurred_at,
                remainingStock: record.remaining_stock
            };
        });
    }

    async function loadInventoryTrends(period = "week") {
        const normalizedPeriod = ["week", "month", "year"].includes(period)
            ? period
            : "week";
        const result = await client.rpc(
            "medtrack_inventory_activity_trends",
            { p_period: normalizedPeriod }
        );

        if (result.error) {
            throw new Error(result.error.message);
        }

        return (result.data || []).map(function (record) {
            return {
                bucketStart: record.bucket_start,
                bucketLabel: record.bucket_label,
                eventType: record.event_type,
                metricValue: Number(record.metric_value || 0)
            };
        });
    }

    async function loadInventoryDistribution() {
        const result = await client.rpc("medtrack_inventory_distribution");
        if (result.error) throw new Error(result.error.message);
        const data = result.data || {};
        return {
            medicalSupplies: Number(data.medical_supplies || 0),
            medicalEquipment: Number(data.medical_equipment || 0),
            mobilityAssets: Number(data.mobility_assets || 0)
        };
    }

    async function loadAssetStatusHistory() {
        const result = await client
            .from("asset_status_history")
            .select(
                "id, item_type, inventory_item_id, transaction_id, " +
                "previous_status, new_status, quantity, remarks, details, " +
                "changed_by, changed_at"
            )
            .order("changed_at", { ascending: false })
            .limit(5000);

        if (result.error) throw new Error(result.error.message);
        return (result.data || []).map(function (record) {
            return {
                id: record.id,
                itemType: record.item_type,
                inventoryItemId: record.inventory_item_id,
                transactionId: record.transaction_id || "",
                previousStatus: record.previous_status || "",
                newStatus: record.new_status,
                quantity: record.quantity,
                remarks: record.remarks || "",
                details: record.details || {},
                changedBy: record.changed_by || "",
                changedAt: record.changed_at
            };
        });
    }

    async function executeQueuedOperation(operation) {
        if (operation.kind === "rpc") {
            const result = await client.rpc(
                operation.functionName,
                operation.parameters
            );
            if (result.error) throw new Error(result.error.message);
            return;
        }

        if (operation.kind === "collection") {
            await uploadCollection(operation.storageKey);
            return;
        }

        if (operation.kind === "delete") {
            const collection = collections[operation.storageKey];
            if (!collection) throw new Error("Invalid queued delete request.");
            const result = await client
                .from(collection.table)
                .delete()
                .eq("id", operation.itemId)
                .select("id");
            if (result.error) throw new Error(result.error.message);
            return;
        }

        throw new Error("Unsupported offline operation.");
    }

    async function syncPending() {
        if (logoutInProgress || !navigator.onLine || !offlineStore) {
            return false;
        }

        if (syncInProgress) return syncInProgress;

        syncInProgress = (async function () {
            const userId = await getSessionUserId();
            if (!userId) return false;

            const operations = await offlineStore.listOperations(userId);
            await offlineStore.announce(userId, "syncing");
            let completed = 0;

            for (const operation of operations) {
                try {
                    await executeQueuedOperation(operation);
                    await offlineStore.removeOperation(operation.id);
                    completed += 1;
                } catch (error) {
                    await offlineStore.recordFailure(operation, error);
                    if (isNetworkError(error)) break;
                    reportError("offline sync", error);
                }
            }

            if (completed > 0 && navigator.onLine) {
                await refresh();
            }

            const remaining = await offlineStore.countOperations(userId);
            await offlineStore.announce(
                userId,
                remaining > 0
                    ? (navigator.onLine ? "pending" : "offline")
                    : "online"
            );
            return remaining === 0;
        })();

        try {
            return await syncInProgress;
        } finally {
            syncInProgress = null;
        }
    }

    async function clearSensitiveCache() {
        logoutInProgress = true;

        uploadTimers.forEach(function (timer) {
            clearTimeout(timer);
        });
        uploadTimers.clear();
        collectionSnapshots.clear();

        const sensitiveKeys = [
            ...Object.keys(collections),
            "medtrackAccounts",
            "medtrackAuditLogs"
        ];

        applyingCloudData = true;

        try {
            sensitiveKeys.forEach(function (key) {
                originalRemoveItem.call(localStorage, key);
                originalRemoveItem.call(sessionStorage, key);
            });
        } finally {
            applyingCloudData = false;
        }

        if (offlineStore) {
            await offlineStore.clearAll();
        }
    }

    const ready = refresh();

    window.medtrackData = {
        ready: ready,
        refresh: refresh,
        pushAll: pushAll,
        borrowItem: borrowItem,
        returnBorrowedItem: returnBorrowedItem,
        updateBorrowStatus: updateBorrowStatus,
        useInventoryItem: useInventoryItem,
        deleteInventoryItem: deleteInventoryItem,
        saveMedicalSupply: saveMedicalSupply,
        consumeMedicalSupply: consumeMedicalSupply,
        loadSupplyTransactions: loadSupplyTransactions,
        loadInventoryTrends: loadInventoryTrends,
        loadInventoryDistribution: loadInventoryDistribution,
        loadAssetStatusHistory: loadAssetStatusHistory,
        syncPending: syncPending,
        clearSensitiveCache: clearSensitiveCache
    };

    ready.then(function () {
        if (navigator.onLine) syncPending();
    });

    client.channel("medtrack-inventory-activity")
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "inventory_activity_events"
            },
            function () {
                window.dispatchEvent(
                    new CustomEvent("medtrack:inventory-activity")
                );
            }
        )
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "medical_equipment"
            },
            function () {
                window.dispatchEvent(
                    new CustomEvent("medtrack:inventory-changed")
                );
            }
        )
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "mobility_assets"
            },
            function () {
                window.dispatchEvent(
                    new CustomEvent("medtrack:inventory-changed")
                );
            }
        )
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "borrow_transactions"
            },
            function () {
                void refresh();
                window.dispatchEvent(
                    new CustomEvent("medtrack:inventory-changed")
                );
            }
        )
        .subscribe();

    window.addEventListener("focus", function () {
        if (!logoutInProgress && uploadTimers.size === 0) {
            if (navigator.onLine) syncPending();
            else refresh();
        }
    });

    document.addEventListener(
        "visibilitychange",
        function () {
            if (
                document.visibilityState === "visible" &&
                !logoutInProgress &&
                uploadTimers.size === 0
            ) {
                if (navigator.onLine) syncPending();
                else refresh();
            }
        }
    );
})();
