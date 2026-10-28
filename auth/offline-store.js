(function () {
    "use strict";

    const DATABASE_NAME = "medtrack-offline-v1";
    const DATABASE_VERSION = 2;
    const CREDENTIAL_ITERATIONS = 310000;
    const CREDENTIAL_LOCK_THRESHOLD = 5;
    const CREDENTIAL_LOCK_MS = 15 * 60 * 1000;
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

                if (!database.objectStoreNames.contains("credentials")) {
                    const credentials = database.createObjectStore(
                        "credentials",
                        { keyPath: "lookupKey" }
                    );
                    credentials.createIndex("userId", "userId");
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

    function bytesToBase64(bytes) {
        let binary = "";
        const values = new Uint8Array(bytes);
        values.forEach(function (value) {
            binary += String.fromCharCode(value);
        });
        return btoa(binary);
    }

    function base64ToBytes(value) {
        const binary = atob(String(value || ""));
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
        }
        return bytes;
    }

    function normalizeIdentifier(value) {
        return String(value || "").trim().toLowerCase();
    }

    async function identifierLookupKey(identifier) {
        if (!window.crypto || !crypto.subtle) {
            throw new Error("Secure offline login is unavailable in this browser.");
        }
        const encoded = new TextEncoder().encode(normalizeIdentifier(identifier));
        return bytesToBase64(await crypto.subtle.digest("SHA-256", encoded));
    }

    async function derivePasswordVerifier(password, salt, iterations) {
        if (!window.crypto || !crypto.subtle) {
            throw new Error("Secure offline login is unavailable in this browser.");
        }
        const passwordKey = await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(String(password || "")),
            "PBKDF2",
            false,
            ["deriveBits"]
        );
        return bytesToBase64(await crypto.subtle.deriveBits({
            name: "PBKDF2",
            hash: "SHA-256",
            salt: base64ToBytes(salt),
            iterations: iterations
        }, passwordKey, 256));
    }

    function constantTimeEqual(leftValue, rightValue) {
        const left = base64ToBytes(leftValue);
        const right = base64ToBytes(rightValue);
        let difference = left.length ^ right.length;
        const length = Math.max(left.length, right.length);
        for (let index = 0; index < length; index += 1) {
            difference |= (left[index % left.length] || 0) ^
                (right[index % right.length] || 0);
        }
        return difference === 0;
    }

    async function getCredential(lookupKey) {
        const database = await openDatabase();
        const transaction = database.transaction("credentials", "readonly");
        return requestResult(
            transaction.objectStore("credentials").get(lookupKey)
        );
    }

    async function getAllCredentials() {
        const database = await openDatabase();
        const transaction = database.transaction("credentials", "readonly");
        return requestResult(
            transaction.objectStore("credentials").getAll()
        );
    }

    async function saveCredential(credential) {
        await useStore("credentials", "readwrite", function (store) {
            store.put(credential);
        });
    }

    async function enrollOfflineCredential(
        profile,
        identifiers,
        password,
        assurance
    ) {
        if (!profile || !profile.id || profile.status !== "active") return false;
        if (!password) return false;

        const aliases = Array.from(new Set(
            (Array.isArray(identifiers) ? identifiers : [identifiers])
                .map(normalizeIdentifier)
                .filter(Boolean)
        ));
        if (aliases.length === 0) return false;

        const saltBytes = crypto.getRandomValues(new Uint8Array(16));
        const salt = bytesToBase64(saltBytes);
        const verifier = await derivePasswordVerifier(
            password,
            salt,
            CREDENTIAL_ITERATIONS
        );
        const validatedAt = new Date().toISOString();
        const lookupKeys = await Promise.all(
            aliases.map(identifierLookupKey)
        );
        const existingCredentials = await getAllCredentials();
        const database = await openDatabase();
        const transaction = database.transaction("credentials", "readwrite");
        const store = transaction.objectStore("credentials");

        (existingCredentials || []).forEach(function (record) {
            if (record.userId === profile.id) store.delete(record.lookupKey);
        });

        for (const lookupKey of lookupKeys) {
            store.put({
                lookupKey: lookupKey,
                userId: profile.id,
                role: profile.role,
                salt: salt,
                verifier: verifier,
                iterations: CREDENTIAL_ITERATIONS,
                assurance: assurance || "authenticated",
                lastValidatedAt: validatedAt,
                failedAttempts: 0,
                lockUntil: ""
            });
        }

        return new Promise(function (resolve, reject) {
            transaction.oncomplete = function () { resolve(true); };
            transaction.onerror = function () {
                reject(transaction.error || new Error(
                    "Unable to enroll secure offline login."
                ));
            };
            transaction.onabort = transaction.onerror;
        });
    }

    async function upgradeOfflineCredentialAssurance(userId, assurance) {
        if (!userId) return;
        const records = await getAllCredentials();
        const updates = (records || []).filter(function (record) {
            return record.userId === userId;
        }).map(function (record) {
            return {
                ...record,
                assurance: assurance || record.assurance,
                lastValidatedAt: new Date().toISOString(),
                failedAttempts: 0,
                lockUntil: ""
            };
        });
        await useStore("credentials", "readwrite", function (store) {
            updates.forEach(function (record) {
                store.put(record);
            });
        });
    }

    async function verifyOfflineCredential(identifier, password, maximumAgeMs) {
        const lookupKey = await identifierLookupKey(identifier);
        const credential = await getCredential(lookupKey);
        const genericError = "The offline username or password is incorrect.";

        if (!credential) throw new Error(genericError);

        const lockUntil = new Date(credential.lockUntil || 0).getTime();
        if (Number.isFinite(lockUntil) && lockUntil > Date.now()) {
            throw new Error(
                "Offline login is temporarily locked after repeated attempts. Try again later."
            );
        }

        const validatedAt = new Date(credential.lastValidatedAt).getTime();
        if (
            !Number.isFinite(validatedAt) ||
            (
                Number.isFinite(maximumAgeMs) &&
                Date.now() - validatedAt > maximumAgeMs
            )
        ) {
            throw new Error(
                "Offline login approval expired. Reconnect and sign in online."
            );
        }

        const candidate = await derivePasswordVerifier(
            password,
            credential.salt,
            Number(credential.iterations) || CREDENTIAL_ITERATIONS
        );
        if (!constantTimeEqual(candidate, credential.verifier)) {
            const attempts = Number(credential.failedAttempts || 0) + 1;
            await saveCredential({
                ...credential,
                failedAttempts: attempts >= CREDENTIAL_LOCK_THRESHOLD ? 0 : attempts,
                lockUntil: attempts >= CREDENTIAL_LOCK_THRESHOLD
                    ? new Date(Date.now() + CREDENTIAL_LOCK_MS).toISOString()
                    : ""
            });
            throw new Error(genericError);
        }

        const profile = await loadProfile(credential.userId, maximumAgeMs);
        if (
            !profile ||
            profile.status !== "active" ||
            profile.role !== credential.role ||
            !["admin", "staff"].includes(profile.role) ||
            (profile.role === "admin" && credential.assurance !== "aal2")
        ) {
            throw new Error(
                "This account is not approved for offline login. Reconnect and sign in online."
            );
        }

        await saveCredential({
            ...credential,
            failedAttempts: 0,
            lockUntil: "",
            lastOfflineLoginAt: new Date().toISOString()
        });
        await authorizeOfflineProfile(profile, credential.assurance);
        const authorized = await loadAuthorizedProfile(profile.id, maximumAgeMs);
        return authorized ? {
            ...authorized,
            offlineAccessExpiresAt: Number.isFinite(maximumAgeMs)
                ? new Date(validatedAt + maximumAgeMs).toISOString()
                : null
        } : null;
    }

    async function removeOfflineCredentials(identifier) {
        const lookupKey = await identifierLookupKey(identifier);
        const credential = await getCredential(lookupKey);
        if (!credential) return;
        const records = await getAllCredentials();
        await useStore("credentials", "readwrite", function (store) {
            (records || []).forEach(function (record) {
                if (record.userId === credential.userId) {
                    store.delete(record.lookupKey);
                }
            });
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

    async function saveProfile(profile) {
        if (!profile || !profile.id) return;
        await useStore("profiles", "readwrite", function (store) {
            const request = store.get(profile.id);
            request.onsuccess = function () {
                const existing = request.result || {};
                store.put({
                    ...existing,
                    userId: profile.id,
                    profile: JSON.parse(JSON.stringify(profile)),
                    savedAt: new Date().toISOString()
                });
            };
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
        if (
            !Number.isFinite(age) ||
            (Number.isFinite(maximumAgeMs) && age > maximumAgeMs)
        ) return null;
        return record.profile || null;
    }

    async function authorizeOfflineProfile(profile, assurance) {
        if (!profile || !profile.id || !profile.role) return;
        await useStore("profiles", "readwrite", function (store) {
            const request = store.get(profile.id);
            request.onsuccess = function () {
                const existing = request.result || {};
                store.put({
                    ...existing,
                    userId: profile.id,
                    profile: JSON.parse(JSON.stringify(profile)),
                    savedAt: existing.savedAt || new Date().toISOString(),
                    offlineAuthorizedAt: new Date().toISOString(),
                    offlineAuthorizedRole: profile.role,
                    offlineAssurance: assurance || "authenticated"
                });
            };
        });
    }

    async function loadAuthorizedProfile(userId, maximumAgeMs) {
        if (!userId) return null;
        const database = await openDatabase();
        const transaction = database.transaction("profiles", "readonly");
        const record = await requestResult(
            transaction.objectStore("profiles").get(userId)
        );
        if (!record || !record.profile || !record.offlineAuthorizedAt) {
            return null;
        }

        const authorizedAge =
            Date.now() - new Date(record.offlineAuthorizedAt).getTime();
        const profileAge = Date.now() - new Date(record.savedAt).getTime();
        if (
            !Number.isFinite(authorizedAge) ||
            !Number.isFinite(profileAge) ||
            (
                Number.isFinite(maximumAgeMs) &&
                (
                    authorizedAge > maximumAgeMs ||
                    profileAge > maximumAgeMs
                )
            ) ||
            record.offlineAuthorizedRole !== record.profile.role
        ) {
            return null;
        }

        if (
            record.profile.role === "admin" &&
            record.offlineAssurance !== "aal2"
        ) {
            return null;
        }

        return {
            ...record.profile,
            offlineAccess: true,
            offlineAccessExpiresAt: Number.isFinite(maximumAgeMs)
                ? new Date(
                    new Date(record.offlineAuthorizedAt).getTime() + maximumAgeMs
                ).toISOString()
                : null
        };
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
            ["snapshots", "operations", "profiles", "credentials"].map(function (name) {
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
        saveProfile: saveProfile,
        loadProfile: loadProfile,
        authorizeOfflineProfile: authorizeOfflineProfile,
        loadAuthorizedProfile: loadAuthorizedProfile,
        enrollOfflineCredential: enrollOfflineCredential,
        upgradeOfflineCredentialAssurance: upgradeOfflineCredentialAssurance,
        verifyOfflineCredential: verifyOfflineCredential,
        removeOfflineCredentials: removeOfflineCredentials,
        enqueue: enqueue,
        listOperations: listOperations,
        removeOperation: removeOperation,
        recordFailure: recordFailure,
        countOperations: countOperations,
        announce: announce,
        clearAll: clearAll
    });
})();
