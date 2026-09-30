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
    await expect(page.getByText("Out of stock", { exact: true })).toBeVisible();
    await expect(page.getByText(/Test Gauze has no Boxes remaining/)).toBeVisible();

    await page.getByRole("button", { name: "Dismiss notification" }).click();
    await expect(page.getByText("No current notifications.")).toBeVisible();
    await page.getByRole("button", { name: "History" }).click();
    await expect(page.getByText("Out of stock", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Restore notification" }).click();
    await page.getByRole("button", { name: "Active" }).click();
    await expect(page.getByText("Out of stock", { exact: true })).toBeVisible();
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
                itemStatus: "Out of Stock",
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
    await expect(page.getByText(/Emergency Gauze.*Status: Out of Stock/)).toBeVisible();
    await expect(page.getByText(/Rescue Ambulance.*Status: Deployed/)).toBeVisible();

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

    expect(percentages.reduce(function (sum, value) {
        return sum + value;
    }, 0)).toBe(100);
});
