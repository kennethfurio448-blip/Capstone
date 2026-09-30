import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
    backupTotals,
    collectionBackupKeys,
    decryptBackup,
    maximumBackupBytes
} from "./backup-format.mjs";

const backupPath = process.env.MEDTRACK_BACKUP_FILE;
const password = process.env.MEDTRACK_BACKUP_PASSWORD;

if (!backupPath || !password) {
    throw new Error("Set MEDTRACK_BACKUP_FILE and MEDTRACK_BACKUP_PASSWORD.");
}
const bytes = await readFile(resolve(backupPath));
if (bytes.length > maximumBackupBytes) {
    throw new Error("The backup exceeds the 25 MB safety limit.");
}
const backup = await decryptBackup(JSON.parse(bytes.toString("utf8")), password);

// Build the same database-shaped payload as the browser restore flow without
// connecting to any database or mutating production.
const data = backup.data;
const restoredCollections = {
    medtrackMedicalSupplies: data.medtrackMedicalSupplies.map(function (item) {
        return { ...item, expiration_date: item.expirationDate || "",
            low_stock_level: Number(item.lowStockLevel) };
    }),
    medtrackMedicalEquipment: data.medtrackMedicalEquipment.map(function (item) {
        return { ...item, maintenance_type: item.maintenanceType || "Inspection",
            maintenance_date: item.maintenanceDate || "" };
    }),
    medtrackMobilityAssets: data.medtrackMobilityAssets.map(function (item) {
        return { ...item, asset_type: item.type,
            plate_number: item.plateNumber || "",
            maintenance_date: item.maintenanceDate || "" };
    }),
    medtrackBorrowTransactions: data.medtrackBorrowTransactions.map(function (item) {
        return { ...item, item_type: item.itemType, item_name: item.itemName,
            borrow_date: item.borrowDate, borrowed_at: item.borrowedAt || "",
            due_date: item.dueDate, return_date: item.returnDate || "",
            inventory_item_id: item.inventoryItemId || "" };
    }),
    medtrackEmergencyRequests: data.medtrackEmergencyRequests.map(function (item) {
        return { ...item, request_date: item.date, request_time: item.time,
            request_type: item.type, contact_person: item.contactPerson,
            contact_number: item.contactNumber, assigned_team: item.assignedTeam,
            inventory_usage: item.inventoryUsage || null };
    })
};
const roundTrip = JSON.parse(JSON.stringify(restoredCollections));
for (const key of collectionBackupKeys) {
    if (roundTrip[key].length !== backup.data[key].length) {
        throw new Error(`${key} failed the restore round trip.`);
    }
    if (roundTrip[key].some(function (record) { return !record.id; })) {
        throw new Error(`${key} produced an invalid restore payload.`);
    }
}

console.log("Non-destructive MedTrack restore rehearsal passed.");
console.log(JSON.stringify({
    createdAt: backup.createdAt,
    restoredRecordTotals: backupTotals(backup)
}, null, 2));
