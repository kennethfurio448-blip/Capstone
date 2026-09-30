import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { backupTotals, encryptBackup } from "./backup-format.mjs";

const supabaseUrl = String(process.env.MEDTRACK_SUPABASE_URL || "").replace(/\/$/, "");
const serviceRoleKey = process.env.MEDTRACK_SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.MEDTRACK_BACKUP_PASSWORD;
const outputPath = resolve(
    process.env.MEDTRACK_BACKUP_FILE ||
    `backup-output/medtrack-encrypted-backup-${new Date().toISOString().slice(0, 10)}.json`
);
const pageSize = 1000;
const maximumRecords = 50000;

if (!supabaseUrl || !serviceRoleKey || !password) {
    throw new Error(
        "Set MEDTRACK_SUPABASE_URL, MEDTRACK_SUPABASE_SERVICE_ROLE_KEY, " +
        "and MEDTRACK_BACKUP_PASSWORD."
    );
}
if (!/^https:\/\//i.test(supabaseUrl)) {
    throw new Error("MEDTRACK_SUPABASE_URL must use HTTPS.");
}

async function fetchTable(table) {
    const records = [];
    for (let offset = 0; offset < maximumRecords; offset += pageSize) {
        const endpoint = new URL(`${supabaseUrl}/rest/v1/${table}`);
        endpoint.searchParams.set("select", "*");
        endpoint.searchParams.set("order", "id.asc");
        endpoint.searchParams.set("offset", String(offset));
        endpoint.searchParams.set("limit", String(pageSize));
        const response = await fetch(endpoint, {
            headers: {
                apikey: serviceRoleKey,
                Authorization: `Bearer ${serviceRoleKey}`,
                Accept: "application/json"
            }
        });
        if (!response.ok) {
            throw new Error(`${table} backup failed with HTTP ${response.status}.`);
        }
        const page = await response.json();
        if (!Array.isArray(page)) throw new Error(`${table} returned invalid data.`);
        records.push(...page);
        if (page.length < pageSize) return records;
    }
    throw new Error(`${table} exceeds the ${maximumRecords}-record backup safety limit.`);
}

const [supplies, equipment, mobility, borrowing, emergencies] = await Promise.all([
    fetchTable("medical_supplies"),
    fetchTable("medical_equipment"),
    fetchTable("mobility_assets"),
    fetchTable("borrow_transactions"),
    fetchTable("emergency_requests")
]);

const backup = {
    backupType: "MedTrack",
    version: 2,
    createdAt: new Date().toISOString(),
    data: {
        medtrackMedicalSupplies: supplies.map(function (item) {
            return { id: item.id, name: item.name, category: item.category,
                quantity: item.quantity, unit: item.unit,
                expirationDate: item.expiration_date || "",
                lowStockLevel: item.low_stock_level };
        }),
        medtrackMedicalEquipment: equipment.map(function (item) {
            return { id: item.id, name: item.name, category: item.category,
                quantity: item.quantity, condition: item.condition,
                location: item.location,
                maintenanceType: item.maintenance_type || "Inspection",
                maintenanceDate: item.maintenance_date || "", status: item.status };
        }),
        medtrackMobilityAssets: mobility.map(function (item) {
            return { id: item.id, name: item.name, type: item.type,
                plateNumber: item.plate_number || "", condition: item.condition,
                driver: item.driver || "", location: item.location,
                maintenanceDate: item.maintenance_date || "", status: item.status };
        }),
        medtrackBorrowTransactions: borrowing.map(function (item) {
            return { id: item.id, borrower: item.borrower, department: item.department,
                itemType: item.item_type, itemName: item.item_name,
                quantity: item.quantity, borrowDate: item.borrow_date,
                borrowedAt: item.borrowed_at || "", dueDate: item.due_date,
                returnDate: item.return_date || "", status: item.status,
                purpose: item.purpose, assignedPersonnel: item.assigned_personnel || "",
                destination: item.destination || "", remarks: item.remarks || "",
                statusDetails: item.status_details || {},
                statusRemarks: item.status_remarks || "",
                statusUpdatedAt: item.status_updated_at || "",
                inventoryItemId: item.inventory_item_id || "",
                inventoryAdjusted: Boolean(item.inventory_adjusted),
                inventoryReturned: Boolean(item.inventory_returned) };
        }),
        medtrackEmergencyRequests: emergencies.map(function (item) {
            return { id: item.id, date: item.request_date, time: item.request_time,
                type: item.type, priority: item.priority || "Medium",
                location: item.location, contactPerson: item.contact_person,
                contactNumber: item.contact_number, assignedTeam: item.assigned_team,
                status: item.status, resources: item.resources,
                description: item.description, inventoryUsage: item.inventory_usage || null,
                inventoryDeducted: Boolean(item.inventory_deducted),
                inventoryDeductedAt: item.inventory_deducted_at || "",
                completedAt: item.completed_at || "" };
        }),
        medtrackSettings: {}
    }
};

const envelope = await encryptBackup(backup, password);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(envelope, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600
});
console.log("Encrypted MedTrack backup created.");
console.log(JSON.stringify({
    outputPath,
    createdAt: backup.createdAt,
    recordTotals: backupTotals(backup)
}, null, 2));
