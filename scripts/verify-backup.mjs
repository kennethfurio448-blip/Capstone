import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
    backupTotals,
    decryptBackup,
    maximumBackupBytes
} from "./backup-format.mjs";

const backupPath = process.env.MEDTRACK_BACKUP_FILE;
const password = process.env.MEDTRACK_BACKUP_PASSWORD;

if (!backupPath || !password) {
    console.error("Set MEDTRACK_BACKUP_FILE and MEDTRACK_BACKUP_PASSWORD to verify an encrypted backup.");
    process.exit(2);
}

const bytes = await readFile(resolve(backupPath));
if (bytes.length > maximumBackupBytes) {
    throw new Error("The backup exceeds the 25 MB safety limit.");
}
const backup = await decryptBackup(JSON.parse(bytes.toString("utf8")), password);

console.log("Encrypted MedTrack backup is valid.");
console.log(JSON.stringify({
    createdAt: backup.createdAt,
    recordTotals: backupTotals(backup)
}, null, 2));
