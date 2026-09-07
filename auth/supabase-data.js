(function () {
    "use strict";

    const client = window.medtrackSupabase;

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

    const uploadTimers = new Map();

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
                    lowStockLevel: item.low_stock_level
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
                    status: item.status
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
                    status: item.status
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
                    due_date: nullable(item.dueDate),
                    return_date: nullable(item.returnDate),
                    status: text(item.status, "Borrowed"),
                    purpose: text(item.purpose, "Inventory transaction"),
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
                    dueDate: item.due_date,
                    returnDate: item.return_date || "",
                    status: item.status,
                    purpose: item.purpose,
                    inventoryItemId: item.inventory_item_id || "",
                    inventoryAdjusted: item.inventory_adjusted,
                    inventoryReturned: item.inventory_returned
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
                    completedAt: item.completed_at || ""
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

        applyingCloudData = true;

        try {
            originalSetItem.call(
                localStorage,
                storageKey,
                JSON.stringify(localRecords)
            );
        } finally {
            applyingCloudData = false;
        }

        return localRecords;
    }

    async function uploadCollection(storageKey) {
        const collection = collections[storageKey];
        const localRecords = readLocalCollection(storageKey);

        const cloudRecords = localRecords
            .filter(function (item) {
                return text(item.id) !== "";
            })
            .map(collection.toCloud);

        const existingResult = await client
            .from(collection.table)
            .select("id");

        if (existingResult.error) {
            throw new Error(existingResult.error.message);
        }

        if (cloudRecords.length > 0) {
            const upsertResult = await client
                .from(collection.table)
                .upsert(cloudRecords, {
                    onConflict: "id"
                });

            if (upsertResult.error) {
                throw new Error(upsertResult.error.message);
            }
        }

        const localIds = new Set(
            cloudRecords.map(function (item) {
                return String(item.id);
            })
        );

        const idsToDelete = (existingResult.data || [])
            .map(function (item) {
                return String(item.id);
            })
            .filter(function (id) {
                return !localIds.has(id);
            });

        if (idsToDelete.length > 0) {
            const deleteResult = await client
                .from(collection.table)
                .delete()
                .in("id", idsToDelete);

            if (deleteResult.error) {
                throw new Error(deleteResult.error.message);
            }
        }
    }

    function reportError(action, error) {
        console.error(
            `MedTrack cloud ${action} failed:`,
            error
        );

        window.dispatchEvent(
            new CustomEvent("medtrack:data-error", {
                detail: {
                    action: action,
                    message: error.message
                }
            })
        );
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
                    reportError("upload", error);
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

    async function refresh() {
        if (refreshInProgress) {
            return refreshInProgress;
        }

        refreshInProgress = (async function () {
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
            reportError("download", error);
            return false;
        } finally {
            refreshInProgress = null;
        }
    }

    async function pushAll() {
        const storageKeys = Object.keys(collections);

        for (const storageKey of storageKeys) {
            await uploadCollection(storageKey);
        }

        return true;
    }

    const ready = refresh();

    window.medtrackData = {
        ready: ready,
        refresh: refresh,
        pushAll: pushAll
    };

    window.addEventListener("focus", function () {
        if (uploadTimers.size === 0) {
            refresh();
        }
    });

    document.addEventListener(
        "visibilitychange",
        function () {
            if (
                document.visibilityState === "visible" &&
                uploadTimers.size === 0
            ) {
                refresh();
            }
        }
    );
})();
