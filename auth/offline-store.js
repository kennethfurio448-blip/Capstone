(function () {
    "use strict";

    const DATABASE_NAME = "medtrack-offline-v1";
    const DATABASE_VERSION = 1;
    let databasePromise = null;

    function openDatabase() {
        if (!window.indexedDB) {
            return Promise.reject(new Error("Offline storage is unavailable."));
        }

        if (databasePromise) return databasePromise;

        databasePromise = new Promise(function (resolve, reject) {
            const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

            request.onupgradeneeded = function () {
                const database = request.result;

                if (!database.objectStoreNames.contains("snapshots")) {
                    database.createObjectStore("snapshots", {
                        keyPath: "storageKey"
                    });
                }

                if (!database.objectStoreNames.contains("operations")) {
                    const operations = database.createObjectStore(
                        "operations",
                        { keyPath: "id" }
                    );
                    operations.createIndex("createdAt", "createdAt");
                    operations.createIndex("userId", "userId");
                }

                if (!database.objectStoreNames.contains("profiles")) {
                    database.createObjectStore("profiles", {
                        keyPath: "userId"
                    });
                }
            };

            request.onsuccess = function () {
                resolve(request.result);
            };
            request.onerror = function () {
                databasePromise = null;
                reject(request.error || new Error("Unable to open offline storage."));
            };
        });

        return databasePromise;
    }

    async function useStore(name, mode, action) {
        const database = await openDatabase();
        return new Promise(function (resolve, reject) {
            const transaction = database.transaction(name, mode);
            const store = transaction.objectStore(name);
            let result;

            try {
                result = action(store);
            } catch (error) {
                reject(error);
                return;
            }

            transaction.oncomplete = function () {
                resolve(result);
            };
            transaction.onerror = function () {
                reject(transaction.error || new Error("Offline storage failed."));
            };
            transaction.onabort = transaction.onerror;
        });
    }

    function requestResult(request) {
        return new Promise(function (resolve, reject) {
            request.onsuccess = function () {
                resolve(request.result);
            };
            request.onerror = function () {
                reject(request.error);
            };
        });
    }

    async function saveSnapshot(storageKey, records, userId) {
        if (!storageKey || !userId) return;
        await useStore("snapshots", "readwrite", function (store) {
            store.put({
                storageKey: storageKey,
                records: JSON.parse(JSON.stringify(records || [])),
                userId: userId,
                savedAt: new Date().toISOString()
            });
        });
    }

    async function loadSnapshot(storageKey, userId) {
        const database = await openDatabase();
        const transaction = database.transaction("snapshots", "readonly");
        const record = await requestResult(
            transaction.objectStore("snapshots").get(storageKey)
        );
        return record && record.userId === userId
            ? record.records || []
            : null;
    }

    async function removeSnapshot(storageKey) {
        await useStore("snapshots", "readwrite", function (store) {
            store.delete(storageKey);
        });
    }

    async function saveProfile(profile) {
        if (!profile || !profile.id) return;
        await useStore("profiles", "readwrite", function (store) {
            store.put({
                userId: profile.id,
                profile: JSON.parse(JSON.stringify(profile)),
                savedAt: new Date().toISOString()
            });
        });
    }

    async function loadProfile(userId, maximumAgeMs) {
        if (!userId) return null;
        const database = await openDatabase();
        const transaction = database.transaction("profiles", "readonly");
        const record = await requestResult(
            transaction.objectStore("profiles").get(userId)
        );
        if (!record) return null;

        const age = Date.now() - new Date(record.savedAt).getTime();
        if (!Number.isFinite(age) || age > maximumAgeMs) return null;
        return record.profile || null;
    }

    async function enqueue(operation) {
        if (!operation || !operation.id || !operation.userId) {
            throw new Error("Invalid offline operation.");
        }

        await useStore("operations", "readwrite", function (store) {
            store.put({
                ...JSON.parse(JSON.stringify(operation)),
                createdAt: operation.createdAt || new Date().toISOString(),
                attempts: Number(operation.attempts || 0),
                lastError: operation.lastError || ""
            });
        });
        await announce(operation.userId, navigator.onLine ? "pending" : "offline");
    }

    async function listOperations(userId) {
        const database = await openDatabase();
        const transaction = database.transaction("operations", "readonly");
        const records = await requestResult(
            transaction.objectStore("operations").getAll()
        );
        return (records || [])
            .filter(function (operation) {
                return operation.userId === userId;
            })
            .sort(function (left, right) {
                return String(left.createdAt).localeCompare(String(right.createdAt));
            });
    }

    async function removeOperation(id) {
        await useStore("operations", "readwrite", function (store) {
            store.delete(id);
        });
    }

    async function recordFailure(operation, error) {
        await enqueue({
            ...operation,
            attempts: Number(operation.attempts || 0) + 1,
            lastError: String(error && error.message || error || "Sync failed")
        });
    }

    async function countOperations(userId) {
        return (await listOperations(userId)).length;
    }

    async function announce(userId, state) {
        let pending = 0;
        try {
            pending = await countOperations(userId);
        } catch (error) {
            console.error("Unable to count offline operations:", error);
        }
        window.dispatchEvent(new CustomEvent("medtrack:sync-state", {
            detail: { state: state, pending: pending }
        }));
    }

    async function clearAll() {
        const database = await openDatabase();
        await Promise.all(
            ["snapshots", "operations", "profiles"].map(function (name) {
                return new Promise(function (resolve, reject) {
                    const transaction = database.transaction(name, "readwrite");
                    transaction.objectStore(name).clear();
                    transaction.oncomplete = resolve;
                    transaction.onerror = function () {
                        reject(transaction.error);
                    };
                });
            })
        );
    }

    window.medtrackOfflineStore = Object.freeze({
        saveSnapshot: saveSnapshot,
        loadSnapshot: loadSnapshot,
        removeSnapshot: removeSnapshot,
        saveProfile: saveProfile,
        loadProfile: loadProfile,
        enqueue: enqueue,
        listOperations: listOperations,
        removeOperation: removeOperation,
        recordFailure: recordFailure,
        countOperations: countOperations,
        announce: announce,
        clearAll: clearAll
    });
})();
