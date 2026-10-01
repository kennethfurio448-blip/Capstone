const { test, expect } = require("@playwright/test");

test("landing page opens the MedTrack login", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "MedTrack" })).toBeVisible();
    await page.getByRole("link", { name: /Open MedTrack/i }).click();
    await expect(page).toHaveURL(/\/login\/login\.html$/);
    await expect(page.getByRole("heading", { name: "Welcome Back" })).toBeVisible();
});

test("forgot password slides in and returns to login", async ({ page }) => {
    await page.goto("/login/login.html");
    const card = page.locator("#authCard");
    const recovery = page.locator("#recoveryModal");

    await expect(recovery).toHaveAttribute("aria-hidden", "true");
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await expect(card).toHaveClass(/recovery-active/);
    await expect(recovery).toHaveAttribute("aria-hidden", "false");
    await expect(page.locator("#recoveryEmail")).toBeFocused();

    await page.getByRole("button", { name: /Back to Login/i }).click();
    await expect(card).not.toHaveClass(/recovery-active/);
    await expect(recovery).toHaveAttribute("aria-hidden", "true");
});

test("all public pages load without missing local assets", async ({ page }) => {
    const failed = [];
    page.on("response", function (response) {
        if (
            response.url().startsWith("http://127.0.0.1:3000") &&
            !response.url().includes("/api/") &&
            response.status() >= 400
        ) {
            failed.push(`${response.status()} ${response.url()}`);
        }
    });
    await page.goto("/");
    await page.goto("/login/login.html");
    expect(failed).toEqual([]);
});

test("medical equipment uses flexible inspection and service fields", async ({ request }) => {
    const response = await request.get("/medical-equipment.html");
    const html = await response.text();

    expect(response.ok()).toBeTruthy();
    expect(html).toContain("Maintenance Type");
    expect(html).toContain("Next Inspection / Service Date (Optional)");
    for (const type of [
        "Inspection",
        "Calibration",
        "Cleaning",
        "Repair",
        "Replacement",
        "Not required"
    ]) {
        expect(html).toContain(`<option value="${type}">${type}</option>`);
    }
    expect(html).toMatch(/id="maintenanceDate"\s*>/);
    expect(html).not.toContain("Next Maintenance Date");
});

test("mobility shows a dash when no driver was imported", async ({ request }) => {
    const response = await request.get("/mobility.js");
    const source = await response.text();

    expect(response.ok()).toBeTruthy();
    expect(source).toContain('vehicle.driver || "—"');
});

test("mobility uses destination labels while preserving stored location data", async ({ request }) => {
    const response = await request.get("/mobility.html");
    const html = await response.text();

    expect(response.ok()).toBeTruthy();
    expect(html).toContain("<th>Destination</th>");
    expect(html).toContain("Enter destination");
    expect(html).not.toContain("Current Location");
    expect(html).not.toContain("Enter current location");
});

test("reports omit user accounts and status history", async ({ request }) => {
    const responses = await Promise.all([
        request.get("/reports.html"),
        request.get("/reports.js")
    ]);
    const [html, script] = await Promise.all(
        responses.map(function (response) {
            expect(response.ok()).toBeTruthy();
            return response.text();
        })
    );

    expect(html).not.toContain('<option value="users">');
    expect(html).not.toContain('<option value="borrowing">');
    expect(html).not.toContain("User Accounts");
    expect(html).not.toContain("Status History");
    expect(script).not.toContain("User Accounts Report");
    expect(script).not.toContain("Status History Report");
    expect(script).not.toContain('getStoredArray("medtrackAccounts")');
});

test("reports show the emergency response summary", async ({ request }) => {
    const responses = await Promise.all([
        request.get("/reports.html"),
        request.get("/reports.js")
    ]);
    const [html, script] = await Promise.all(
        responses.map(function (response) {
            expect(response.ok()).toBeTruthy();
            return response.text();
        })
    );

    expect(html).toContain("Emergency Responses");
    expect(html).toContain('id="emergencyCount"');
    expect(html).toContain('data-filter-value="emergency"');
    expect(html).toContain("Total requests");
    expect(html).not.toContain("Status Records");
    expect(html).not.toContain('id="borrowingCount"');
    expect(script).toContain(
        "emergencyCount.textContent = getEmergencyRequests().length;"
    );
});

test("emergency responses support multiple inventory items", async ({ request }) => {
    const responses = await Promise.all([
        request.get("/emergency-response.html"),
        request.get("/emergency-response.js"),
        request.get("/auth/supabase-data.js")
    ]);
    const [html, script, dataAdapter] = await Promise.all(
        responses.map(function (response) {
            expect(response.ok()).toBeTruthy();
            return response.text();
        })
    );

    expect(html).not.toContain("No inventory item");
    expect(html).toContain("Items Used");
    expect(html).toContain("Items List");
    expect(html).toContain('id="addResourceItem"');
    expect(html).toContain('id="resourceItemsList"');
    expect(html).toContain('id="resourceInventoryType"');
    expect(html).toContain('id="resourceQuantity"');
    expect(html).toContain("Add Item");
    expect(script).toContain("function addSelectedResourceToList(");
    expect(script).toContain("function resetResourceInputs(");
    expect(script).toContain("function renderResourceList(");
    expect(script).toContain("function getInventoryUsagesFromForm(");
    expect(script).toContain('class="remove-resource-button"');
    expect(script).toContain("formInventoryUsages.push({");
    expect(script).toContain("request.inventoryUsages = usages;");
    expect(dataAdapter).toContain("items: inventoryUsages");
    expect(dataAdapter).toContain("inventoryUsages: inventoryUsages");
});

test("emergency Add Item moves selections into the Items List", async ({ page }) => {
    const emptyScript = {
        status: 200,
        contentType: "application/javascript",
        body: ""
    };
    await page.route("**/api/supabase-js", function (route) {
        return route.fulfill(emptyScript);
    });
    await page.route("**/auth/supabase-client.js", function (route) {
        return route.fulfill(emptyScript);
    });
    await page.route("**/auth/supabase-auth.js", function (route) {
        return route.fulfill({
            ...emptyScript,
            body: `
                window.medtrackAuth = {
                    requireRoles: async function () {
                        document.body.hidden = false;
                        return {
                            role: "staff",
                            status: "active",
                            fullname: "Workflow Tester"
                        };
                    },
                    logout: async function () {}
                };
            `
        });
    });
    await page.route("**/auth/supabase-data.js**", function (route) {
        return route.fulfill({
            ...emptyScript,
            body: `
                window.medtrackData = {
                    refresh: async function () {}
                };
            `
        });
    });
    await page.route("**/pwa.js", function (route) {
        return route.fulfill(emptyScript);
    });
    await page.route("**/notification-center.js", function (route) {
        return route.fulfill(emptyScript);
    });
    await page.addInitScript(function () {
        localStorage.setItem("medtrackEmergencyRequests", "[]");
        localStorage.setItem("medtrackMedicalSupplies", JSON.stringify([
            {
                id: "MED-TEST-001",
                name: "Emergency Gauze",
                quantity: 20,
                expirationDate: "2027-12-31"
            }
        ]));
        localStorage.setItem("medtrackMedicalEquipment", JSON.stringify([
            {
                id: "EQP-TEST-001",
                name: "Pulse Oximeter",
                quantity: 3,
                status: "Available"
            }
        ]));
        localStorage.setItem("medtrackMobilityAssets", "[]");
    });

    await page.goto("/emergency-response.html");
    await page.locator("#openAddModal").click();
    await page.locator("#resourceInventoryType").selectOption("Medical Supply");
    await page.locator("#resourceItem").selectOption("MED-TEST-001");
    await page.locator("#resourceQuantity").fill("4");
    await page.locator("#addResourceItem").click();

    await expect(page.locator(".resource-list-item")).toHaveCount(1);
    await expect(page.locator(".resource-list-item")).toContainText(
        "Emergency Gauze"
    );
    await expect(page.locator(".resource-list-item")).toContainText("Qty: 4");
    await expect(page.locator("#resourceInventoryType")).toHaveValue("");
    await expect(page.locator("#resourceItem")).toBeDisabled();
    await expect(page.locator("#resourceQuantity")).toHaveValue("1");

    await page.locator("#resourceInventoryType").selectOption("Medical Equipment");
    await page.locator("#resourceItem").selectOption("EQP-TEST-001");
    await page.locator("#resourceQuantity").fill("1");
    await page.locator("#addResourceItem").click();

    await expect(page.locator(".resource-list-item")).toHaveCount(2);
    await expect(page.locator("#resourceItemCount")).toHaveText("2 items");
    await page.locator(".remove-resource-button").first().click();
    await expect(page.locator(".resource-list-item")).toHaveCount(1);
    await expect(page.locator(".resource-list-item")).toContainText(
        "Pulse Oximeter"
    );
});

test("inventory creation uses database-issued IDs and atomic saves", async ({ request }) => {
    const responses = await Promise.all([
        request.get("/medical-supplies.js"),
        request.get("/medical-equipment.js"),
        request.get("/mobility.js"),
        request.get("/auth/supabase-data.js")
    ]);
    const sources = await Promise.all(
        responses.map(function (response) {
            expect(response.ok()).toBeTruthy();
            return response.text();
        })
    );

    expect(sources[0]).not.toContain(
        'allocateInventoryId("medical_supplies")'
    );
    expect(sources[1]).toContain(
        ".saveMedicalEquipment({"
    );
    expect(sources[2]).toContain(
        ".saveMobilityAsset({"
    );
    expect(sources[3]).toContain(
        '"medtrack_allocate_inventory_id"'
    );
    expect(sources[3]).toContain(
        '"medtrack_save_medical_supply"'
    );
    expect(sources[3]).toContain(
        '"medtrack_save_medical_equipment"'
    );
    expect(sources[3]).toContain(
        '"medtrack_save_mobility_asset"'
    );

    expect(sources[0]).not.toContain("generateSupplyId");
    expect(sources[1]).not.toContain("generateEquipmentId");
    expect(sources[2]).not.toContain("generateVehicleId");
    expect(sources[1]).not.toContain(
        'allocateInventoryId("medical_equipment")'
    );
    expect(sources[2]).not.toContain(
        'allocateInventoryId("mobility_assets")'
    );
});

test("offline continuation requires a recent approved staff or admin session", async ({ page }) => {
    await page.goto("/");
    await page.addScriptTag({ url: "/auth/offline-store.js" });

    const result = await page.evaluate(async function () {
        const store = window.medtrackOfflineStore;
        await store.clearAll();

        const staff = {
            id: "offline-staff-test",
            email: "staff@example.test",
            fullname: "Offline Staff",
            username: "offline.staff",
            role: "staff",
            status: "active"
        };
        const admin = {
            id: "offline-admin-test",
            email: "admin@example.test",
            fullname: "Offline Admin",
            username: "offline.admin",
            role: "admin",
            status: "active"
        };

        await store.saveProfile(staff);
        const staffBeforeApproval = await store.loadAuthorizedProfile(
            staff.id,
            24 * 60 * 60 * 1000
        );
        await store.authorizeOfflineProfile(staff, "authenticated");
        const approvedStaff = await store.loadAuthorizedProfile(
            staff.id,
            24 * 60 * 60 * 1000
        );

        await store.saveProfile(admin);
        await store.authorizeOfflineProfile(admin, "authenticated");
        const adminWithoutMfa = await store.loadAuthorizedProfile(
            admin.id,
            24 * 60 * 60 * 1000
        );
        await store.authorizeOfflineProfile(admin, "aal2");
        const approvedAdmin = await store.loadAuthorizedProfile(
            admin.id,
            24 * 60 * 60 * 1000
        );

        await store.clearAll();
        return {
            staffBeforeApproval: staffBeforeApproval,
            staffRole: approvedStaff && approvedStaff.role,
            staffOffline: approvedStaff && approvedStaff.offlineAccess,
            staffExpiresAt: approvedStaff && approvedStaff.offlineAccessExpiresAt,
            adminWithoutMfa: adminWithoutMfa,
            adminRole: approvedAdmin && approvedAdmin.role,
            adminOffline: approvedAdmin && approvedAdmin.offlineAccess
        };
    });

    expect(result.staffBeforeApproval).toBeNull();
    expect(result.staffRole).toBe("staff");
    expect(result.staffOffline).toBe(true);
    expect(new Date(result.staffExpiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(result.adminWithoutMfa).toBeNull();
    expect(result.adminRole).toBe("admin");
    expect(result.adminOffline).toBe(true);
});

test("notification center supports out-of-stock, dismiss, history, and restore", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(function () {
        localStorage.setItem("medtrackMedicalSupplies", JSON.stringify([{
            id: "MED-TEST-001",
            name: "Test Gauze",
            quantity: 0,
            unit: "Boxes",
            lowStockLevel: 5,
            updatedAt: new Date().toISOString()
        }]));
        localStorage.removeItem("medtrackNotificationState");
    });
    await page.setContent(
        '<button type="button" class="notification-button" aria-label="Notifications">' +
        '<i class="fa-solid fa-bell"></i><span></span></button>'
    );
    await page.addStyleTag({ url: "/app-shell.css" });
    await page.addScriptTag({ url: "/notification-center.js" });

    await page.locator(".notification-button").click();
    await expect(page.locator(
        '[data-notification-filter="category"] option'
    )).toHaveText([
        "All categories",
        "Medical Supplies",
        "Medical Equipment",
        "Mobility"
    ]);
    await expect(page.locator(
        '[data-notification-filter="status"] option[value="Available"]'
    )).toHaveText("Available");
    await expect(page.locator(
        ".notification-item-content strong",
        { hasText: "Out of stock" }
    )).toBeVisible();
    await expect(page.getByText(/Test Gauze has no Boxes remaining/)).toBeVisible();

    await expect(page.getByRole("button", { name: "Mark all read" })).toHaveCount(0);

    await page.locator(
        ".notification-row:has(.notification-out-of-stock) " +
        '[data-notification-action="dismiss"]'
    ).click();
    await expect(page.locator(".notification-out-of-stock")).toHaveCount(0);
    await expect(page.getByText(
        /Test Gauze is currently Out of stock with 0 Boxes on hand/
    )).toBeVisible();
    await page.getByRole("button", { name: "History" }).click();
    await expect(page.locator(
        ".notification-item-content strong",
        { hasText: "Out of stock" }
    )).toBeVisible();

    await page.getByRole("button", { name: "Restore all" }).click();
    await expect(page.locator(
        ".notification-item-content strong",
        { hasText: "Out of stock" }
    )).toBeVisible();
    await expect(page.locator("#notificationDropdownSummary")).toContainText(
        "2 active, 2 unread"
    );
});

test("equipment service notifications show due and overdue schedules", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(function () {
        const dateValue = function (offset) {
            const date = new Date();
            date.setHours(12, 0, 0, 0);
            date.setDate(date.getDate() + offset);
            return [
                date.getFullYear(),
                String(date.getMonth() + 1).padStart(2, "0"),
                String(date.getDate()).padStart(2, "0")
            ].join("-");
        };

        localStorage.setItem("medtrackMedicalEquipment", JSON.stringify([
            {
                id: "EQP-SERVICE-001",
                name: "BP Apparatus",
                maintenanceType: "Calibration",
                maintenanceDate: dateValue(-1)
            },
            {
                id: "EQP-SERVICE-002",
                name: "Hydraulic Rescue Tool",
                maintenanceType: "Inspection",
                maintenanceDate: dateValue(10)
            },
            {
                id: "EQP-SERVICE-003",
                name: "Bandage Scissors",
                maintenanceType: "Not required",
                maintenanceDate: dateValue(5)
            }
        ]));
        localStorage.removeItem("medtrackNotificationState");
    });
    await page.setContent(
        '<button type="button" class="notification-button" aria-label="Notifications">' +
        '<i class="fa-solid fa-bell"></i><span></span></button>'
    );
    await page.addStyleTag({ url: "/app-shell.css" });
    await page.addScriptTag({ url: "/notification-center.js" });

    await page.locator(".notification-button").click();
    await expect(page.getByText("Inspection/service overdue", { exact: true })).toBeVisible();
    await expect(page.getByText("Inspection/service due soon", { exact: true })).toBeVisible();
    await expect(page.getByText(/BP Apparatus requires calibration/)).toBeVisible();
    await expect(page.getByText(/Hydraulic Rescue Tool has inspection scheduled/)).toBeVisible();
    await expect(page.locator(
        ".notification-service-due, .notification-service-overdue",
        { hasText: "Bandage Scissors" }
    )).toHaveCount(0);

    const dueLink = page.locator(".notification-service-due");
    await expect(dueLink).toHaveAttribute(
        "href",
        /medical-equipment\.html\?.*action=details.*item=EQP-SERVICE-002/
    );
});

test("notification center shows every unique new inventory item with details", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(function () {
        const equipmentEvent = {
            id: 102,
            eventKey: "item-created:medical_equipment:EQP-TEST-001",
            inventoryModule: "medical_equipment",
            inventoryItemId: "EQP-TEST-001",
            itemName: "Portable Oxygen Concentrator",
            itemCategory: "Respiratory Equipment",
            itemStatus: "For Repair",
            actorName: "Test Administrator",
            occurredAt: "2026-09-29T08:31:00+08:00"
        };
        localStorage.setItem("medtrackInventoryItemAdditions", JSON.stringify([
            {
                id: 101,
                eventKey: "item-created:medical_supplies:MED-TEST-001",
                inventoryModule: "medical_supplies",
                inventoryItemId: "MED-TEST-001",
                itemName: "Emergency Gauze",
                itemCategory: "First Aid",
                itemStatus: "Available",
                actorName: "Test Administrator",
                occurredAt: "2026-09-29T08:30:00+08:00"
            },
            equipmentEvent,
            { ...equipmentEvent, id: 999 },
            {
                id: 103,
                eventKey: "item-created:mobility_assets:MOB-TEST-001",
                inventoryModule: "mobility_assets",
                inventoryItemId: "MOB-TEST-001",
                itemName: "Rescue Ambulance",
                itemCategory: "Ambulance",
                itemStatus: "Deployed",
                actorName: "Test Administrator",
                occurredAt: "2026-09-29T08:32:00+08:00"
            }
        ]));
        localStorage.removeItem("medtrackNotificationState");
    });
    await page.setContent(
        '<button type="button" class="notification-button" aria-label="Notifications">' +
        '<i class="fa-solid fa-bell"></i><span></span></button>'
    );
    await page.addStyleTag({ url: "/app-shell.css" });
    await page.addScriptTag({ url: "/notification-center.js" });

    await page.locator(".notification-button").click();
    await expect(page.locator(".notification-item-added")).toHaveCount(3);
    await expect(page.getByText(
        "Portable Oxygen Concentrator was added by Test Administrator. " +
        "Category: Medical Equipment / Respiratory Equipment. Status: For Repair."
    )).toBeVisible();
    await expect(page.getByText(/Emergency Gauze.*Status: Available/)).toBeVisible();
    await expect(page.getByText(/Rescue Ambulance.*Status: Borrowed/)).toBeVisible();

    const notificationLink = page.locator(
        ".notification-item-added",
        { hasText: "Portable Oxygen Concentrator" }
    );
    await expect(notificationLink).toHaveAttribute(
        "href",
        /medical-equipment\.html\?.*action=details.*item=EQP-TEST-001/
    );
    await expect(page.locator("#notificationDropdownSummary")).toContainText(
        "3 active, 3 unread"
    );
    await page.locator('[data-notification-filter="status"]').selectOption(
        "Available"
    );
    await expect(page.locator(".notification-item-added")).toHaveCount(1);
    await expect(page.getByText(/Emergency Gauze.*Status: Available/)).toBeVisible();

    await page.locator('[data-notification-filter="category"]').selectOption(
        "Mobility"
    );
    await expect(page.locator(
        '[data-notification-filter="status"] option'
    )).toHaveText([
        "All statuses",
        "Available",
        "Borrowed",
        "Returned",
        "Missing",
        "Damaged",
        "For Repair"
    ]);
    await page.locator('[data-notification-filter="status"]').selectOption(
        "Borrowed"
    );
    await expect(page.locator(".notification-item-added")).toHaveCount(1);
    await expect(page.getByText(/Rescue Ambulance.*Status: Borrowed/)).toBeVisible();

    await page.locator('[data-notification-filter="category"]').selectOption(
        "Medical Equipment"
    );
    await expect(page.locator(
        '[data-notification-filter="status"] option'
    )).toHaveText([
        "All statuses",
        "Available",
        "Borrowed",
        "Returned",
        "Missing",
        "Damaged",
        "For Repair"
    ]);
    await page.locator('[data-notification-filter="status"]').selectOption(
        "For Repair"
    );
    await expect(page.locator(".notification-item-added")).toHaveCount(1);
    await expect(page.getByText(
        /Portable Oxygen Concentrator.*Status: For Repair/
    )).toBeVisible();

    await page.locator('[data-notification-filter="category"]').selectOption(
        "Medical Supplies"
    );
    await expect(page.locator(
        '[data-notification-filter="status"] option'
    )).toHaveText([
        "All statuses",
        "Available",
        "Low stock",
        "Out of stock",
        "Expired"
    ]);
    await page.locator('[data-notification-filter="status"]').selectOption(
        "Available"
    );
    await expect(page.locator(".notification-item-added")).toHaveCount(1);
    await expect(page.getByText(/Emergency Gauze.*Status: Available/)).toBeVisible();
});

test("all inventory filters show actual current item statuses", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(function () {
        localStorage.setItem("medtrackMedicalSupplies", JSON.stringify([{
            id: "MED-STATUS-001",
            name: "Trauma Dressing",
            category: "First Aid",
            quantity: 25,
            lowStockLevel: 5,
            unit: "Pieces",
            expirationDate: "2027-10-01",
            serverUpdatedAt: "2026-10-01T07:55:00+08:00"
        }]));
        localStorage.setItem("medtrackMedicalEquipment", JSON.stringify([{
            id: "EQP-STATUS-001",
            name: "Portable Ventilator",
            category: "Respiratory Equipment",
            status: "Borrowed",
            condition: "Good",
            serverUpdatedAt: "2026-10-01T08:00:00+08:00"
        }]));
        localStorage.setItem("medtrackMobilityAssets", JSON.stringify([{
            id: "MOB-STATUS-001",
            name: "Rescue Ambulance 2",
            type: "Ambulance",
            status: "Deployed",
            condition: "Good",
            serverUpdatedAt: "2026-10-01T08:05:00+08:00"
        }, {
            id: "MOB-STATUS-002",
            name: "Rescue Truck",
            type: "Rescue Vehicle",
            status: "Available",
            condition: "Damaged",
            serverUpdatedAt: "2026-10-01T08:06:00+08:00"
        }]));
        localStorage.removeItem("medtrackInventoryItemAdditions");
        localStorage.removeItem("medtrackNotificationState");
    });
    await page.setContent(
        '<button type="button" class="notification-button" aria-label="Notifications">' +
        '<i class="fa-solid fa-bell"></i><span></span></button>'
    );
    await page.addStyleTag({ url: "/app-shell.css" });
    await page.addScriptTag({ url: "/notification-center.js" });

    await page.locator(".notification-button").click();
    await page.locator('[data-notification-filter="category"]').selectOption(
        "Medical Supplies"
    );
    await page.locator('[data-notification-filter="status"]').selectOption(
        "Available"
    );
    await expect(page.getByText(
        "Trauma Dressing is currently Available with 25 Pieces on hand."
    )).toBeVisible();
    await expect(page.locator(".notification-inventory-status")).toHaveAttribute(
        "href",
        /medical-supplies\.html\?.*action=details.*item=MED-STATUS-001/
    );

    await page.locator('[data-notification-filter="category"]').selectOption(
        "Medical Equipment"
    );
    await page.locator('[data-notification-filter="status"]').selectOption(
        "Borrowed"
    );
    await expect(page.getByText(
        "Portable Ventilator is currently Borrowed."
    )).toBeVisible();
    await expect(page.locator(".notification-inventory-status")).toHaveCount(1);

    await page.locator('[data-notification-filter="category"]').selectOption(
        "Mobility"
    );
    await page.locator('[data-notification-filter="status"]').selectOption(
        "Borrowed"
    );
    await expect(page.getByText(
        "Rescue Ambulance 2 is currently Borrowed."
    )).toBeVisible();

    await page.locator('[data-notification-filter="status"]').selectOption(
        "Damaged"
    );
    await expect(page.getByText(
        "Rescue Truck is currently Damaged."
    )).toBeVisible();
    await expect(page.locator(".notification-inventory-status")).toHaveAttribute(
        "href",
        /mobility\.html\?.*action=details.*item=MOB-STATUS-002/
    );
});

test("notification history supports filters and load more", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(function () {
        const dismissed = Array.from({ length: 25 }, function (_, index) {
            const timestamp = new Date();
            timestamp.setMinutes(timestamp.getMinutes() - index);
            return {
                id: `history-test-${index}`,
                type: "item-added",
                icon: "fa-pills",
                label: "New inventory item",
                message: `History item ${index}`,
                category: index % 2 === 0
                    ? "Medical Supplies"
                    : "Medical Equipment",
                status: index % 3 === 0 ? "Available" : "Low Stock",
                timestamp: timestamp.toISOString(),
                href: "medical-supplies.html",
                dismissedAt: timestamp.toISOString()
            };
        });
        localStorage.setItem("medtrackNotificationState", JSON.stringify({
            readIds: [],
            dismissed
        }));
    });
    await page.setContent(
        '<button type="button" class="notification-button" aria-label="Notifications">' +
        '<i class="fa-solid fa-bell"></i><span></span></button>'
    );
    await page.addStyleTag({ url: "/app-shell.css" });
    await page.addScriptTag({ url: "/notification-center.js" });

    await page.locator(".notification-button").click();
    await page.getByRole("button", { name: "History" }).click();
    await expect(page.locator(".notification-row")).toHaveCount(20);
    await page.getByRole("button", { name: "Load more" }).click();
    await expect(page.locator(".notification-row")).toHaveCount(25);

    await page.locator('[data-notification-filter="category"]').selectOption(
        "Medical Equipment"
    );
    await expect(page.locator(".notification-row")).toHaveCount(12);
    await page.locator('[data-notification-filter="status"]').selectOption(
        "Available"
    );
    await expect(page.locator(".notification-row")).toHaveCount(4);
    await expect(page.locator('[data-notification-filter="date"]')).toBeVisible();
    await expect(page.locator('[data-notification-filter="unread"]')).toBeVisible();
});

test("inventory distribution percentages total exactly 100 percent", async ({ page }) => {
    await page.goto("/");
    await page.setContent(
        '<div id="inventoryDistributionChart"></div>' +
        '<div id="inventoryDistributionLegend"></div>' +
        '<div id="inventoryDistributionStatus"></div>' +
        '<div id="inventoryDistributionTotal"></div>'
    );
    await page.evaluate(function () {
        window.medtrackData = {
            loadInventoryDistribution: async function () {
                return {
                    medicalSupplies: 30,
                    medicalEquipment: 30,
                    mobilityAssets: 11
                };
            }
        };
    });
    await page.addScriptTag({ url: "/analytics.js" });
    await page.evaluate(function () {
        document.dispatchEvent(new Event("DOMContentLoaded"));
    });

    const labels = page.locator("#inventoryDistributionLegend small");
    await expect(labels).toHaveCount(3);
    const percentages = (await labels.allTextContents()).map(function (label) {
        return Number(label.replace("%", ""));
    });

    expect(percentages).toEqual([42.3, 42.3, 15.4]);
    expect(percentages.reduce(function (sum, value) {
        return sum + value;
    }, 0)).toBe(100);
});
