import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { webcrypto } from "node:crypto";

const backupPath = process.env.MEDTRACK_BACKUP_FILE;
const password = process.env.MEDTRACK_BACKUP_PASSWORD;
const maximumBytes = 25 * 1024 * 1024;
const expectedKeys = [
    "medtrackMedicalSupplies",
    "medtrackMedicalEquipment",
    "medtrackMobilityAssets",
    "medtrackBorrowTransactions",
    "medtrackEmergencyRequests",
    "medtrackSettings"
];

if (!backupPath || !password) {
    console.error("Set MEDTRACK_BACKUP_FILE and MEDTRACK_BACKUP_PASSWORD to verify an encrypted backup.");
    process.exit(2);
}
if (password.length < 12) {
    console.error("The supplied backup password is too short.");
    process.exit(2);
}

const bytes = await readFile(resolve(backupPath));
if (bytes.length > maximumBytes) throw new Error("The backup exceeds the 25 MB safety limit.");
const envelope = JSON.parse(bytes.toString("utf8"));

if (
    envelope.backupType !== "MedTrackEncrypted" ||
    envelope.version !== 2 ||
    envelope.kdf?.name !== "PBKDF2" ||
    envelope.kdf?.hash !== "SHA-256" ||
    envelope.kdf?.iterations !== 250000 ||
    envelope.cipher?.name !== "AES-GCM"
) {
    throw new Error("The file is not a supported MedTrack encrypted backup.");
}

const salt = Buffer.from(envelope.kdf.salt, "base64");
const iv = Buffer.from(envelope.cipher.iv, "base64");
const ciphertext = Buffer.from(envelope.ciphertext, "base64");
if (salt.length !== 16 || iv.length !== 12 || ciphertext.length === 0) {
    throw new Error("The encrypted backup header is invalid.");
}

const encoder = new TextEncoder();
const material = await webcrypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
);
const key = await webcrypto.subtle.deriveKey({
    name: "PBKDF2",
    hash: "SHA-256",
    salt,
    iterations: 250000
}, material, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
const plaintext = await webcrypto.subtle.decrypt({
    name: "AES-GCM",
    iv,
    additionalData: encoder.encode("MedTrackBackup:v2")
}, key, ciphertext);
const backup = JSON.parse(new TextDecoder().decode(plaintext));

if (backup.backupType !== "MedTrack" || backup.version !== 2 || !backup.data) {
    throw new Error("The decrypted content is not a valid MedTrack backup.");
}
if (Object.keys(backup.data).some(function (keyName) {
    return !expectedKeys.includes(keyName);
})) {
    throw new Error("The backup contains an unsupported data section.");
}

for (const keyName of expectedKeys.slice(0, -1)) {
    const records = backup.data[keyName];
    if (!Array.isArray(records) || records.length > 50000) {
        throw new Error(`${keyName} is invalid or too large.`);
    }
    if (records.some(function (record) {
        return !record || typeof record.id !== "string" || !record.id.trim();
    })) {
        throw new Error(`${keyName} contains an invalid record.`);
    }
}
if (!backup.data.medtrackSettings || Array.isArray(backup.data.medtrackSettings)) {
    throw new Error("The backup settings section is invalid.");
}

const totals = Object.fromEntries(expectedKeys.slice(0, -1).map(function (keyName) {
    return [keyName, backup.data[keyName].length];
}));
console.log("Encrypted MedTrack backup is valid.");
console.log(JSON.stringify({ createdAt: backup.createdAt, recordTotals: totals }, null, 2));
