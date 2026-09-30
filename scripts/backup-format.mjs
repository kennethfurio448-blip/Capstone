import { webcrypto } from "node:crypto";

export const backupKeys = [
    "medtrackMedicalSupplies",
    "medtrackMedicalEquipment",
    "medtrackMobilityAssets",
    "medtrackBorrowTransactions",
    "medtrackEmergencyRequests",
    "medtrackSettings"
];
export const collectionBackupKeys = backupKeys.slice(0, -1);
export const backupIterations = 250000;
export const maximumBackupBytes = 25 * 1024 * 1024;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function requirePassword(password) {
    if (!password || password.length < 12) {
        throw new Error("The backup password must contain at least 12 characters.");
    }
}

async function deriveKey(password, salt, usage) {
    requirePassword(password);
    const material = await webcrypto.subtle.importKey(
        "raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]
    );
    return webcrypto.subtle.deriveKey({
        name: "PBKDF2",
        hash: "SHA-256",
        salt,
        iterations: backupIterations
    }, material, { name: "AES-GCM", length: 256 }, false, [usage]);
}

export function validateBackup(backup) {
    if (
        !backup || backup.backupType !== "MedTrack" ||
        backup.version !== 2 || !backup.data ||
        typeof backup.data !== "object" || Array.isArray(backup.data)
    ) {
        throw new Error("The decrypted content is not a valid MedTrack backup.");
    }
    if (Object.keys(backup.data).some(function (key) {
        return !backupKeys.includes(key);
    })) {
        throw new Error("The backup contains an unsupported data section.");
    }
    for (const key of collectionBackupKeys) {
        const records = backup.data[key];
        if (!Array.isArray(records) || records.length > 50000) {
            throw new Error(`${key} is invalid or too large.`);
        }
        const identifiers = new Set();
        for (const record of records) {
            const id = typeof record?.id === "string" ? record.id.trim() : "";
            if (!id || id.length > 128) {
                throw new Error(`${key} contains an invalid record.`);
            }
            if (identifiers.has(id)) {
                throw new Error(`${key} contains a duplicate ID: ${id}.`);
            }
            identifiers.add(id);
        }
    }
    if (
        !backup.data.medtrackSettings ||
        typeof backup.data.medtrackSettings !== "object" ||
        Array.isArray(backup.data.medtrackSettings)
    ) {
        throw new Error("The backup settings section is invalid.");
    }
    return backup;
}

export async function encryptBackup(backup, password) {
    validateBackup(backup);
    const salt = webcrypto.getRandomValues(new Uint8Array(16));
    const iv = webcrypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt, "encrypt");
    const ciphertext = await webcrypto.subtle.encrypt({
        name: "AES-GCM",
        iv,
        additionalData: encoder.encode("MedTrackBackup:v2")
    }, key, encoder.encode(JSON.stringify(backup)));
    return {
        backupType: "MedTrackEncrypted",
        version: 2,
        createdAt: backup.createdAt,
        kdf: {
            name: "PBKDF2",
            hash: "SHA-256",
            iterations: backupIterations,
            salt: Buffer.from(salt).toString("base64")
        },
        cipher: {
            name: "AES-GCM",
            iv: Buffer.from(iv).toString("base64")
        },
        ciphertext: Buffer.from(ciphertext).toString("base64")
    };
}

export async function decryptBackup(envelope, password) {
    requirePassword(password);
    if (
        !envelope || envelope.backupType !== "MedTrackEncrypted" ||
        envelope.version !== 2 || envelope.kdf?.name !== "PBKDF2" ||
        envelope.kdf?.hash !== "SHA-256" ||
        envelope.kdf?.iterations !== backupIterations ||
        envelope.cipher?.name !== "AES-GCM"
    ) {
        throw new Error("The file is not a supported MedTrack encrypted backup.");
    }
    const salt = Buffer.from(envelope.kdf.salt || "", "base64");
    const iv = Buffer.from(envelope.cipher.iv || "", "base64");
    const ciphertext = Buffer.from(envelope.ciphertext || "", "base64");
    if (salt.length !== 16 || iv.length !== 12 || ciphertext.length === 0) {
        throw new Error("The encrypted backup header is invalid.");
    }
    const key = await deriveKey(password, salt, "decrypt");
    const plaintext = await webcrypto.subtle.decrypt({
        name: "AES-GCM",
        iv,
        additionalData: encoder.encode("MedTrackBackup:v2")
    }, key, ciphertext);
    return validateBackup(JSON.parse(decoder.decode(plaintext)));
}

export function backupTotals(backup) {
    return Object.fromEntries(collectionBackupKeys.map(function (key) {
        return [key, backup.data[key].length];
    }));
}
