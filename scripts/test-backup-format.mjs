import assert from "node:assert/strict";
import {
    backupTotals,
    collectionBackupKeys,
    decryptBackup,
    encryptBackup
} from "./backup-format.mjs";

const password = "test-only-backup-password";
const data = Object.fromEntries(collectionBackupKeys.map(function (key, index) {
    return [key, [{ id: `TEST-${index + 1}` }]];
}));
data.medtrackSettings = {};
const backup = {
    backupType: "MedTrack",
    version: 2,
    createdAt: "2026-09-30T00:00:00.000Z",
    data
};
const envelope = await encryptBackup(backup, password);
const restored = await decryptBackup(envelope, password);

assert.deepEqual(restored, backup);
assert.deepEqual(
    Object.values(backupTotals(restored)),
    collectionBackupKeys.map(function () { return 1; })
);

const tampered = structuredClone(envelope);
tampered.ciphertext = `${tampered.ciphertext.slice(0, -4)}AAAA`;
await assert.rejects(decryptBackup(tampered, password));
console.log("Encrypted backup format round trip passed.");
