const { test, expect } = require("@playwright/test");

function apiResponseRecorder() {
    return {
        headers: {},
        statusCode: 200,
        body: null,
        setHeader(name, value) { this.headers[name] = value; },
        status(code) { this.statusCode = code; return this; },
        json(value) { this.body = value; return this; },
        send(value) { this.body = value; return this; },
        end() { return this; }
    };
}

test("landing page opens the MedTrack login", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "MedTrack" })).toBeVisible();
    await page.getByRole("link", { name: /Open MedTrack/i }).click();
    await expect(page).toHaveURL(/\/login\/login\.html$/);
    await expect(page.getByRole("heading", { name: "Welcome Back" })).toBeVisible();
});

test("only the public landing page is available to search engines", async ({ request }) => {
    const [landingResponse, robotsResponse, sitemapResponse, adminResponse, loginResponse] = await Promise.all([
        request.get("/"),
        request.get("/robots.txt"),
        request.get("/sitemap.xml"),
        request.get("/admin-dashboard.html"),
        request.get("/login/login.html")
    ]);
    const [landing, robots, sitemap, admin, login] = await Promise.all([
        landingResponse.text(),
        robotsResponse.text(),
        sitemapResponse.text(),
        adminResponse.text(),
        loginResponse.text()
    ]);

    expect(landingResponse.ok()).toBeTruthy();
    expect(robotsResponse.ok()).toBeTruthy();
    expect(sitemapResponse.ok()).toBeTruthy();
    expect(landing).toContain('name="robots" content="index, follow');
    expect(landing).toContain('rel="canonical"');
    expect(landing).toContain('property="og:title"');
    expect(sitemap).toContain("https://www.medtrackmanagement.com/");
    expect(sitemap).not.toContain("admin-dashboard.html");
    expect(robots).toContain("Disallow: /admin-dashboard.html");
    expect(robots).toContain("Disallow: /login/");
    expect(admin).toContain('name="robots" content="noindex, nofollow, noarchive"');
    expect(login).toContain('name="robots" content="noindex, nofollow, noarchive"');
});

test("central Trash Bin is protected and provides complete recovery controls", async ({ request }) => {
    const response = await request.get("/trash-bin.html");
    const html = await response.text();

    expect(response.ok()).toBeTruthy();
    expect(html).toContain('name="robots" content="noindex, nofollow, noarchive"');
    expect(html).toContain('id="trashSearch"');
    expect(html).toContain('id="moduleFilter"');
    expect(html).toContain('id="dateSort"');
    expect(html).toContain('id="restoreSelected"');
    expect(html).toContain('id="emptyTrash"');
    expect(html).toContain('src="trash-bin.js?v=20261029-trash-bin"');
});

test("release endpoints return current metadata and a validated installer redirect", async () => {
    const originalFetch = global.fetch;
    global.fetch = async function () {
        return {
            ok: true,
            json: async function () {
                return {
                    tag_name: "v1.0.2",
                    published_at: "2026-11-01T11:09:47Z",
                    assets: [{
                        name: "MedTrack-Setup-1.0.2.exe",
                        size: 123136248,
                        browser_download_url: "https://github.com/kennethfurio448-blip/Capstone/releases/download/v1.0.2/MedTrack-Setup-1.0.2.exe"
                    }]
                };
            }
        };
    };

    try {
        const metadataHandler = require("../api/app-release.js");
        const downloadHandler = require("../api/download-windows.js");
        const metadataResponse = apiResponseRecorder();
        const downloadResponse = apiResponseRecorder();

        await metadataHandler({ method: "GET" }, metadataResponse);
        await downloadHandler({ method: "GET" }, downloadResponse);

        expect(metadataResponse.statusCode).toBe(200);
        expect(metadataResponse.body.version).toBe("1.0.2");
        expect(metadataResponse.body.windows.available).toBe(true);
        expect(metadataResponse.body.android.apkAvailable).toBe(false);
        expect(downloadResponse.statusCode).toBe(302);
        expect(downloadResponse.headers.Location).toBe(
            "https://github.com/kennethfurio448-blip/Capstone/releases/download/v1.0.2/MedTrack-Setup-1.0.2.exe"
        );
    } finally {
        global.fetch = originalFetch;
    }
});

test("shared shell keeps walkthrough, Trash Bin, downloads, and notifications in the header", async ({ page }) => {
    await page.route("**/api/app-release", function (route) {
        return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                version: "1.0.2",
                windows: { sizeLabel: "117.43 MB" },
                android: { apkAvailable: false }
            })
        });
    });
    await page.goto("/");
    await page.setContent(
        '<aside class="sidebar"><div class="brand"><div>MedTrack</div></div>' +
        '<nav class="sidebar-nav"><a class="nav-item active" href="medical-supplies.html">' +
        '<i></i><span>Medical Supplies</span></a><a class="nav-item" href="trash-bin.html">Trash Bin</a>' +
        '<div class="admin-navigation"><a class="nav-item" href="settings.html">System Settings</a></div>' +
        '<a class="nav-item" href="trash-bin.html">Trash Bin</a>' +
        '<a class="nav-item" href="download-app.html">Download App</a></nav>' +
        '<button class="logout-button">Logout</button></aside>' +
        '<main class="main-content"><header class="topbar"><div><h2>Dashboard</h2></div>' +
        '<div class="topbar-actions"><button class="notification-button" type="button">' +
        '<i class="fa-solid fa-bell"></i><span hidden>0</span></button>' +
        '<div class="user-profile">User</div></div></header></main>'
    );
    await page.evaluate(function () {
        window.medtrackPwaInstall = {
            isInstalled: function () { return false; },
            isAvailable: function () { return false; },
            promptInstall: async function () { return { outcome: "unavailable" }; }
        };
        window.medtrackAuth = {
            getAuthenticatedProfile: async function () {
                return { id: "test-admin", role: "admin" };
            }
        };
        localStorage.setItem(
            "medtrack-walkthrough-completed:v1:test-admin",
            "true"
        );
    });
    await page.addStyleTag({ url: "/app-shell.css" });
    await page.addStyleTag({ url: "/walkthrough.css" });
    await page.addScriptTag({ url: "/app-shell.js" });
    await page.addScriptTag({ url: "/walkthrough.js" });

    await expect(page.locator('.sidebar-nav a[href="trash-bin.html"]')).toHaveCount(0);
    await expect(page.locator(".sidebar .walkthrough-launch")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Download App" })).toHaveCount(0);
    await expect(page.locator(
        ".app-trash-button + .walkthrough-launch + " +
        ".app-download-button + .notification-button"
    )).toHaveCount(1);
    await expect(page.getByRole("button", { name: "System Walkthrough" }))
        .toHaveAttribute("title", "System Walkthrough");
    await expect(page.getByRole("link", { name: "Open Trash Bin" })).toHaveAttribute(
        "href", "trash-bin.html"
    );
    await expect(page.getByRole("link", { name: "Medical Supplies" })).toHaveCount(1);

    const activeItem = page.getByRole("link", { name: "Medical Supplies" });
    const hoverItem = page.getByRole("link", { name: "System Settings" });
    await expect(activeItem).toHaveCSS("position", "relative");
    expect(await activeItem.evaluate(function (element) {
        return getComputedStyle(element, "::before").opacity;
    })).toBe("1");
    await page.waitForTimeout(300);
    const hoverBoxBefore = await hoverItem.boundingBox();
    await hoverItem.hover();
    await expect.poll(function () {
        return hoverItem.evaluate(function (element) {
            return getComputedStyle(element, "::before").opacity;
        });
    }).toBe("1");
    const hoverBoxAfter = await hoverItem.boundingBox();
    expect(Math.abs(hoverBoxAfter.x - hoverBoxBefore.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(hoverBoxAfter.width - hoverBoxBefore.width)).toBeLessThanOrEqual(1);

    await page.getByRole("button", { name: "System Walkthrough" }).click();
    await expect(page.getByRole("dialog", { name: "MedTrack system walkthrough" }))
        .toBeVisible();
    await page.getByRole("button", { name: "Skip Tour" }).click();
    await page.getByRole("button", { name: "Download or install MedTrack" }).click();
    await expect(page.getByRole("dialog", { name: "Download and install MedTrack" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Download for Windows/ })).toHaveAttribute(
        "href", "/api/download-windows"
    );
    await expect(page.getByText("Android", { exact: true })).toHaveCount(0);
    await page.getByRole("heading", { name: "Dashboard" }).click();
    await expect(page.getByRole("dialog", { name: "Download and install MedTrack" })).toBeHidden();
    await page.getByRole("button", { name: "Collapse sidebar navigation" }).click();
    await expect(page.locator('.sidebar-nav a[href="trash-bin.html"]')).toHaveCount(0);
});

test("shared PWA installer exposes the browser prompt to the download center", async ({ page }) => {
    await page.goto("/");
    await page.setContent("<main>MedTrack installation test</main>");
    await page.addScriptTag({ url: "/pwa.js" });

    const result = await page.evaluate(async function () {
        const promptEvent = new Event("beforeinstallprompt");
        Object.defineProperty(promptEvent, "prompt", {
            value: async function () { return undefined; }
        });
        Object.defineProperty(promptEvent, "userChoice", {
            value: Promise.resolve({ outcome: "accepted", platform: "web" })
        });
        window.dispatchEvent(promptEvent);
        const availableBeforePrompt = window.medtrackPwaInstall.isAvailable();
        const choice = await window.medtrackPwaInstall.promptInstall();
        return {
            availableBeforePrompt: availableBeforePrompt,
            availableAfterPrompt: window.medtrackPwaInstall.isAvailable(),
            outcome: choice.outcome
        };
    });

    expect(result).toEqual({
        availableBeforePrompt: true,
        availableAfterPrompt: false,
        outcome: "accepted"
    });
});

test("Mobility Other vehicle type saves and edits the custom value", async ({ page }) => {
    const emptyScript = {
        status: 200,
        contentType: "application/javascript",
        body: ""
    };
    for (const path of [
        "**/api/supabase-js",
        "**/auth/supabase-client.js",
        "**/auth/offline-store.js",
        "**/walkthrough.js",
        "**/pwa.js",
        "**/notification-center.js",
        "**/card-navigation.js",
        "**/table-pagination.js"
    ]) {
        await page.route(path, function (route) {
            return route.fulfill(emptyScript);
        });
    }
    await page.route("**/auth/supabase-auth.js", function (route) {
        return route.fulfill({
            ...emptyScript,
            body: `window.medtrackDialog = {
                alert: async function () {},
                confirm: async function () { return true; }
            };
            window.medtrackAuth = {
                requireRoles: async function () {
                    document.body.hidden = false;
                    return { role: "admin", fullname: "Test Administrator" };
                },
                signOutAndRedirect: async function () {}
            };`
        });
    });
    await page.route("**/auth/supabase-data.js**", function (route) {
        return route.fulfill({
            ...emptyScript,
            body: `window.medtrackData = {
                refresh: async function () {},
                saveMobilityAsset: async function (details) {
                    const records = JSON.parse(localStorage.getItem("medtrackMobilityAssets") || "[]");
                    const id = details.id || "MOB-TEST-001";
                    const record = {
                        ...details,
                        id: id,
                        displayId: "MOB-001",
                        serverUpdatedAt: ""
                    };
                    const index = records.findIndex(function (item) { return item.id === id; });
                    if (index >= 0) records[index] = record;
                    else records.push(record);
                    localStorage.setItem("medtrackMobilityAssets", JSON.stringify(records));
                    window.lastSavedMobility = { ...details };
                    return { queued: false };
                },
                deleteInventoryItem: async function () {}
            };`
        });
    });
    await page.addInitScript(function () {
        localStorage.setItem("medtrackMobilityAssets", "[]");
    });

    await page.goto("/mobility.html");
    await page.getByRole("button", { name: /Add Vehicle/i }).click();
    await page.locator("#vehicleType").selectOption("Other");
    await expect(page.locator("#customVehicleTypeGroup")).toBeVisible();
    await expect(page.locator("#customVehicleType")).toHaveAttribute("required", "");

    await page.locator("#vehicleName").fill("Response Unit 1");
    await page.locator("#plateNumber").fill("FTR-101");
    await page.locator("#vehicleStatus").selectOption("Available");
    await page.locator("#assignedDriver").fill("Driver One");
    await page.locator("#assignedCoPilot").fill("Co-Pilot One");
    await page.locator("#vehicleLocation").fill("Operations Center");
    await page.locator("#maintenanceDate").fill("2027-01-15");
    await page.getByRole("button", { name: /Save Vehicle/i }).click();
    await expect(page.locator("#customVehicleType")).toBeFocused();
    await expect(page.locator("#vehicleModal")).toHaveClass(/show/);
    const lastSavedBeforeCustomType = await page.evaluate(function () {
        return window.lastSavedMobility;
    });
    expect(lastSavedBeforeCustomType).toBeUndefined();

    await page.locator("#customVehicleType").fill("  Fire Truck  ");
    await page.getByRole("button", { name: /Save Vehicle/i }).click();

    await expect.poll(function () {
        return page.evaluate(function () { return window.lastSavedMobility.type; });
    }).toBe("Fire Truck");
    await expect.poll(function () {
        return page.evaluate(function () { return window.lastSavedMobility.coPilot; });
    }).toBe("Co-Pilot One");
    await expect(page.locator("#vehicleTableBody")).toContainText("Fire Truck");
    await expect(page.locator("#vehicleTableBody")).toContainText("Co-Pilot One");
    await expect(page.locator("#vehicleTableBody")).not.toContainText("Other");

    await page.locator('[data-action="edit"]').click();
    await expect(page.locator("#vehicleType")).toHaveValue("Other");
    await expect(page.locator("#customVehicleType")).toHaveValue("Fire Truck");
    await expect(page.locator("#assignedCoPilot")).toHaveValue("Co-Pilot One");
    await page.locator("#vehicleType").selectOption("Ambulance");
    await expect(page.locator("#customVehicleTypeGroup")).toBeHidden();
    await expect(page.locator("#customVehicleType")).not.toHaveAttribute("required", "");
    await page.locator("#vehicleType").selectOption("Other");
    await page.locator("#customVehicleType").fill("Pickup Truck");
    await page.getByRole("button", { name: /Save Vehicle/i }).click();

    await expect.poll(function () {
        return page.evaluate(function () { return window.lastSavedMobility.type; });
    }).toBe("Pickup Truck");
    await page.locator("#vehicleSearch").fill("pickup");
    await expect(page.locator("#vehicleTableBody")).toContainText("Pickup Truck");
    await page.locator("#typeFilter").selectOption("Other");
    await expect(page.locator("#vehicleTableBody")).toContainText("Pickup Truck");
});

test("Equipment dropdown placeholders stay hidden and Other saves a custom category", async ({ page }) => {
    const emptyScript = {
        status: 200,
        contentType: "application/javascript",
        body: ""
    };
    for (const path of [
        "**/api/supabase-js",
        "**/auth/supabase-client.js",
        "**/auth/offline-store.js",
        "**/walkthrough.js",
        "**/pwa.js",
        "**/notification-center.js",
        "**/card-navigation.js",
        "**/table-pagination.js"
    ]) {
        await page.route(path, function (route) {
            return route.fulfill(emptyScript);
        });
    }
    await page.route("**/auth/supabase-auth.js", function (route) {
        return route.fulfill({
            ...emptyScript,
            body: `window.medtrackDialog = {
                alert: async function () {},
                confirm: async function () { return true; }
            };
            window.medtrackAuth = {
                requireRoles: async function () {
                    document.body.hidden = false;
                    return { role: "admin", fullname: "Test Administrator" };
                },
                signOutAndRedirect: async function () {}
            };`
        });
    });
    await page.route("**/auth/supabase-data.js**", function (route) {
        return route.fulfill({
            ...emptyScript,
            body: `window.medtrackData = {
                refresh: async function () {},
                saveMedicalEquipment: async function (details) {
                    const records = JSON.parse(localStorage.getItem("medtrackMedicalEquipment") || "[]");
                    const id = details.id || "EQP-TEST-001";
                    const record = {
                        ...details,
                        id: id,
                        displayId: "EQP-001",
                        serverUpdatedAt: ""
                    };
                    const index = records.findIndex(function (item) { return item.id === id; });
                    if (index >= 0) records[index] = record;
                    else records.push(record);
                    localStorage.setItem("medtrackMedicalEquipment", JSON.stringify(records));
                    window.lastSavedEquipment = { ...details };
                    return { queued: false };
                },
                deleteInventoryItem: async function () {}
            };`
        });
    });
    await page.addInitScript(function () {
        localStorage.setItem("medtrackMedicalEquipment", "[]");
    });

    await page.goto("/medical-equipment.html");
    await expect(page.locator("#equipmentCategory option[value='']"))
        .toHaveAttribute("hidden", "");
    await expect(page.locator("#equipmentCategory option[value='']"))
        .toHaveAttribute("disabled", "");
    await expect(page.locator("#equipmentStatus option[value='']"))
        .toHaveAttribute("hidden", "");
    await expect(page.locator("#equipmentStatus option[value='']"))
        .toHaveAttribute("disabled", "");

    await page.getByRole("button", { name: /Add Equipment/i }).click();
    await page.locator("#equipmentCategory").selectOption("Other");
    await expect(page.locator("#equipmentCategory")).toBeHidden();
    await expect(page.locator("#customEquipmentCategory")).toBeVisible();
    await expect(page.locator("#customEquipmentCategory")).toBeFocused();

    await page.locator("#equipmentName").fill("Fire Response Kit");
    await page.locator("#equipmentQuantity").fill("2");
    await page.locator("#equipmentStatus").selectOption("Available");
    await page.locator("#maintenanceType").selectOption("Inspection");
    await page.getByRole("button", { name: /Save Equipment/i }).click();
    await expect(page.locator("#customEquipmentCategory")).toBeFocused();
    expect(await page.evaluate(function () { return window.lastSavedEquipment; }))
        .toBeUndefined();

    await page.locator("#customEquipmentCategory").fill("  Firefighting Equipment  ");
    await page.getByRole("button", { name: /Save Equipment/i }).click();
    await expect.poll(function () {
        return page.evaluate(function () { return window.lastSavedEquipment.category; });
    }).toBe("Firefighting Equipment");
    await expect(page.locator("#equipmentTableBody")).toContainText("Firefighting Equipment");
    await expect(page.locator("#equipmentTableBody")).not.toContainText("Other");

    await page.locator('[data-action="edit"]').click();
    await expect(page.locator("#equipmentCategory")).toBeHidden();
    await expect(page.locator("#customEquipmentCategory"))
        .toHaveValue("Firefighting Equipment");
    await page.locator("#showEquipmentCategoryList").click();
    await expect(page.locator("#equipmentCategory")).toBeVisible();
    await page.locator("#equipmentCategory").selectOption("Diagnostic");
    await expect(page.locator("#equipmentCategory")).toHaveValue("Diagnostic");
    await page.locator("#equipmentCategory").selectOption("Other");
    await page.locator("#customEquipmentCategory").fill("Urban Search Equipment");
    await page.getByRole("button", { name: /Save Equipment/i }).click();

    await expect.poll(function () {
        return page.evaluate(function () { return window.lastSavedEquipment.category; });
    }).toBe("Urban Search Equipment");
    await page.locator("#equipmentSearch").fill("urban search");
    await expect(page.locator("#equipmentTableBody")).toContainText("Urban Search Equipment");
    await page.locator("#categoryFilter").selectOption("Other");
    await expect(page.locator("#equipmentTableBody")).toContainText("Urban Search Equipment");
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

test("medical supplies clearly identify and notify near-expiry items", async ({ request }) => {
    const responses = await Promise.all([
        request.get("/medical-supplies.html"),
        request.get("/medical-supplies.js"),
        request.get("/notification-center.js"),
        request.get("/analytics.js")
    ]);
    const [html, supplies, notifications, analytics] = await Promise.all(
        responses.map(function (response) {
            expect(response.ok()).toBeTruthy();
            return response.text();
        })
    );

    expect(html).toContain('id="nearExpirySupplies"');
    expect(html).toContain('<option value="Near Expiry">Near Expiry</option>');
    expect(html).toMatch(/id="openConsumeModal"\s+hidden/);
    expect(html).toContain('<option value="Other">Other</option>');
    expect(html).toContain('id="customSupplyCategory"');
    expect(html).toContain('id="showSupplyCategoryList"');
    expect(supplies).toContain('return "Near Expiry";');
    expect(supplies).toContain('"Near Expiry": "status-near-expiry"');
    expect(supplies).toContain('selectedCategoryValue === "Other"');
    expect(supplies).toContain('? customCategoryValue');
    expect(supplies).toContain('customSupplyCategory.value = storedCategory');
    expect(notifications).toContain('type: "near-expiry"');
    expect(notifications).toContain('status: "Near Expiry"');
    expect(notifications).toContain("expirationWarningDays");
    expect(analytics).toContain("nearExpiryItems");
    expect(analytics).toContain("daysRemaining");
    expect(analytics).toContain('["expiring", "Expiring Soon", "#ef6c00"]');
    expect(analytics).toContain('["expired", "Expired", "#111111"]');
});

test("inventory tables use safe consecutive display numbers", async ({ request }) => {
    for (const module of [
        ["medical-supplies", "filteredSupplies", "supply"],
        ["medical-equipment", "filteredEquipment", "item"],
        ["mobility", "filteredVehicles", "vehicle"]
    ]) {
        const [htmlResponse, scriptResponse] = await Promise.all([
            request.get(`/${module[0]}.html`),
            request.get(`/${module[0]}.js`)
        ]);
        expect(htmlResponse.ok()).toBeTruthy();
        expect(scriptResponse.ok()).toBeTruthy();
        const html = await htmlResponse.text();
        const script = await scriptResponse.text();
        expect(html).toContain('class="record-number-column"');
        expect(html).toContain("permanent IDs remain unchanged");
        expect(script).toContain(
            `${module[1]}.forEach(function (${module[2]}, index)`
        );
        expect(script).toContain(
            '<td class="record-number">${index + 1}</td>'
        );
    }
});

test("inventory shows gap-free display IDs while preserving internal IDs", async ({ request }) => {
    const responses = await Promise.all([
        request.get("/auth/supabase-data.js"),
        request.get("/medical-supplies.js"),
        request.get("/medical-equipment.js"),
        request.get("/mobility.js"),
        request.get("/reports.js")
    ]);
    const [data, supplies, equipment, mobility, reports] = await Promise.all(
        responses.map(function (response) {
            expect(response.ok()).toBeTruthy();
            return response.text();
        })
    );
    expect(data.match(/displayId: item\.display_id \|\| item\.id/g)).toHaveLength(3);
    expect(supplies).toContain("supply.displayId || supply.id");
    expect(equipment).toContain("item.displayId || item.id");
    expect(mobility).toContain("vehicle.displayId || vehicle.id");
    expect(reports.match(/displayId \|\|/g).length).toBeGreaterThanOrEqual(3);
});

test("inventory table columns sort accessibly and keep display numbers consecutive", async ({ page }) => {
    await page.goto("/");
    await page.setContent(`
        <div class="table-wrapper">
            <table class="responsive-card-table sortable-table">
                <thead><tr><th>No.</th><th>Item Name</th><th>Quantity</th><th>Actions</th></tr></thead>
                <tbody>
                    <tr><td class="record-number">1</td><td>Zinc</td><td>2</td><td>—</td></tr>
                    <tr><td class="record-number">2</td><td>Alcohol</td><td>10</td><td>—</td></tr>
                </tbody>
            </table>
        </div>
    `);
    await page.addScriptTag({ url: "/table-pagination.js" });
    await page.evaluate(function () {
        document.dispatchEvent(new Event("DOMContentLoaded"));
    });
    await page.locator("th", { hasText: "Item Name" }).click();
    await expect(page.locator("tbody tr").nth(0).locator("td").nth(1))
        .toHaveText("Alcohol");
    await expect(page.locator(".record-number")).toHaveText(["1", "2"]);
    await expect(page.locator("th", { hasText: "Item Name" }))
        .toHaveAttribute("aria-sort", "ascending");
});

test("cloud collection downloads use bounded server pages", async ({ request }) => {
    const response = await request.get("/auth/supabase-data.js");
    const source = await response.text();
    expect(response.ok()).toBeTruthy();
    expect(source).toContain("const CLOUD_DOWNLOAD_PAGE_SIZE = 500;");
    expect(source).toContain(
        ".range(offset, offset + CLOUD_DOWNLOAD_PAGE_SIZE - 1)"
    );
});

test("persistent scheduled alerts are connected to the notification center", async ({ request }) => {
    const responses = await Promise.all([
        request.get("/notification-center.js"),
        request.get("/settings.html"),
        request.get("/settings.js")
    ]);
    const [notifications, settingsHtml, settingsScript] = await Promise.all(
        responses.map(function (response) {
            expect(response.ok()).toBeTruthy();
            return response.text();
        })
    );
    expect(notifications).toContain('.from("system_alerts")');
    expect(notifications).toContain("persistentSystemAlertNotifications");
    expect(settingsHtml).toContain('id="scheduledAlertHealth"');
    expect(settingsScript).toContain('.from("system_alert_job_runs")');
});

test("shared notification badge styles and caps large unread counts", async ({ request }) => {
    const [scriptResponse, styleResponse, trashResponse] = await Promise.all([
        request.get("/notification-center.js"),
        request.get("/app-shell.css"),
        request.get("/trash-bin.html")
    ]);
    const [script, styles, trashPage] = await Promise.all([
        scriptResponse.text(),
        styleResponse.text(),
        trashResponse.text()
    ]);

    expect(script).toContain('unread.length > 99');
    expect(script).toContain('? "99+"');
    expect(styles).toContain(".app-header-icon-button > span");
    expect(styles).toContain("background: #c91f2c");
    expect(trashPage).toContain('href="app-shell.css"');
    expect(trashPage).toContain('src="notification-center.js"');
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
    expect(dataAdapter).toContain("medtrack_save_emergency_response");
    expect(dataAdapter).toContain("medtrack_release_emergency_resources");
});

test("system exposes sync status, reusable-resource release, and pagination", async ({ request }) => {
    const responses = await Promise.all([
        request.get("/auth/supabase-data.js"),
        request.get("/emergency-response.html"),
        request.get("/emergency-response.js"),
        request.get("/table-pagination.js"),
        request.get("/reports.js"),
        request.get("/audit-logs.js")
    ]);
    const [data, html, emergency, pagination, reports, audit] =
        await Promise.all(responses.map(function (response) {
            expect(response.ok()).toBeTruthy();
            return response.text();
        }));

    expect(data).toContain("medtrackSyncButton");
    expect(data).toContain("Retry Sync");
    expect(html).toContain('id="releaseResourcesModal"');
    expect(emergency).toContain("getUnreleasedReusableResources");
    expect(emergency).toContain("releaseEmergencyResources");
    expect(pagination).toContain("const PAGE_SIZE = 25;");
    expect(reports).toContain("Resource Release Status");
    expect(reports).toContain("Response Duration");
    expect(audit).toContain("AUDIT_PAGE_SIZE = 250");
    expect(audit).toContain(".range(auditOffset");
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
                window.atomicEmergencySaves = [];
                window.medtrackData = {
                    refresh: async function () {},
                    saveEmergencyResponse: async function (details) {
                        window.atomicEmergencySaves.push(details);
                        localStorage.setItem(
                            "medtrackEmergencyRequests",
                            JSON.stringify([details.request])
                        );
                    }
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

    await page.locator("#emergencyType").selectOption("Medical Emergency");
    await page.locator("#requestPriority").selectOption("High");
    await page.locator("#requestLocation").fill("Barangay Central");
    await page.locator("#contactPerson").fill("Juan Dela Cruz");
    await page.locator("#contactNumber").fill("09123456789");
    await page.locator("#assignedTeam").fill("Response Team A");
    await page.locator("#requestStatus").selectOption("In Progress");
    await page.locator("#requestDescription").fill("Medical response test");
    await page.locator("#requestForm button[type='submit']").click();

    await expect.poll(async function () {
        return page.evaluate(function () {
            return window.atomicEmergencySaves.length;
        });
    }).toBe(1);
    const atomicRequest = await page.evaluate(function () {
        return window.atomicEmergencySaves[0].request;
    });
    expect(atomicRequest.status).toBe("In Progress");
    expect(atomicRequest.inventoryUsages).toHaveLength(1);
    expect(atomicRequest.inventoryUsages[0].itemId).toBe("EQP-TEST-001");
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

test("offline continuation remains enrolled without a 24-hour expiry", async ({ page }) => {
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
        const staffBeforeApproval = await store.loadAuthorizedProfile(staff.id);
        await store.authorizeOfflineProfile(staff, "authenticated");
        const approvedStaff = await store.loadAuthorizedProfile(staff.id);

        await store.saveProfile(admin);
        await store.authorizeOfflineProfile(admin, "authenticated");
        const adminWithoutMfa = await store.loadAuthorizedProfile(admin.id);
        await store.authorizeOfflineProfile(admin, "aal2");
        const approvedAdmin = await store.loadAuthorizedProfile(admin.id);

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
    expect(result.staffExpiresAt).toBeUndefined();
    expect(result.adminWithoutMfa).toBeNull();
    expect(result.adminRole).toBe("admin");
    expect(result.adminOffline).toBe(true);
});

test("online login accepts valid accounts from any device without approval waiting", async ({ request }) => {
    const [loginResponse, guardResponse] = await Promise.all([
        request.get("/supabase/functions/login-auth/index.ts"),
        request.get("/auth/supabase-auth.js")
    ]);
    const source = `${await loginResponse.text()}\n${await guardResponse.text()}`;

    expect(source).toContain("signInWithPassword");
    expect(source).not.toMatch(/trusted_devices|approved_sessions|login-approval/i);
    expect(source).not.toContain("OFFLINE_PROFILE_MAX_AGE_MS");
    expect(source).not.toContain("offlineSessionExpiresAt");
    expect(source).not.toContain("offlineAccessExpiresAt");
});

test("offline login verifies an enrolled password without storing plaintext credentials", async ({ page }) => {
    await page.goto("/");
    await page.addScriptTag({ url: "/auth/offline-store.js" });

    const result = await page.evaluate(async function () {
        const store = window.medtrackOfflineStore;
        await store.clearAll();

        const staff = {
            id: "offline-login-staff",
            email: "offline.staff@example.test",
            fullname: "Offline Login Staff",
            username: "offline.login.staff",
            role: "staff",
            status: "active"
        };
        const password = "Offline-Test-Password-2026!";
        await store.saveProfile(staff);
        await store.enrollOfflineCredential(
            staff,
            [staff.email, staff.username],
            password,
            "authenticated"
        );

        let wrongPasswordRejected = false;
        try {
            await store.verifyOfflineCredential(
                staff.username,
                "Incorrect-Password-2026!"
            );
        } catch (error) {
            wrongPasswordRejected = true;
        }

        const approved = await store.verifyOfflineCredential(
            staff.email,
            password
        );

        const admin = {
            id: "offline-login-admin",
            email: "offline.admin@example.test",
            fullname: "Offline Login Admin",
            username: "offline.login.admin",
            role: "admin",
            status: "active"
        };
        const adminPassword = "Offline-Admin-Password-2026!";
        await store.saveProfile(admin);
        await store.enrollOfflineCredential(
            admin,
            [admin.email, admin.username],
            adminPassword,
            "authenticated"
        );
        let adminRejectedBeforeMfa = false;
        try {
            await store.verifyOfflineCredential(
                admin.username,
                adminPassword
            );
        } catch (error) {
            adminRejectedBeforeMfa = true;
        }
        await store.upgradeOfflineCredentialAssurance(admin.id, "aal2");
        const approvedAdmin = await store.verifyOfflineCredential(
            admin.username,
            adminPassword
        );
        const permanentOfflineApproval = await store.verifyOfflineCredential(
            staff.username,
            password
        );

        const database = await new Promise(function (resolve, reject) {
            const request = indexedDB.open("medtrack-offline-v1", 2);
            request.onsuccess = function () { resolve(request.result); };
            request.onerror = function () { reject(request.error); };
        });
        const credentials = await new Promise(function (resolve, reject) {
            const request = database
                .transaction("credentials", "readonly")
                .objectStore("credentials")
                .getAll();
            request.onsuccess = function () { resolve(request.result); };
            request.onerror = function () { reject(request.error); };
        });
        database.close();
        const serialized = JSON.stringify(credentials);

        await store.clearAll();
        return {
            wrongPasswordRejected: wrongPasswordRejected,
            role: approved && approved.role,
            offlineAccess: approved && approved.offlineAccess,
            adminRejectedBeforeMfa: adminRejectedBeforeMfa,
            adminRole: approvedAdmin && approvedAdmin.role,
            adminOfflineAccess: approvedAdmin && approvedAdmin.offlineAccess,
            permanentOfflineExpiry:
                permanentOfflineApproval &&
                permanentOfflineApproval.offlineAccessExpiresAt,
            storesPlaintextPassword: serialized.includes(password),
            storesPlaintextEmail: serialized.includes(staff.email),
            hasSaltedVerifier: credentials.every(function (credential) {
                return Boolean(
                    credential.salt &&
                    credential.verifier &&
                    credential.iterations >= 300000
                );
            })
        };
    });

    expect(result.wrongPasswordRejected).toBe(true);
    expect(result.role).toBe("staff");
    expect(result.offlineAccess).toBe(true);
    expect(result.adminRejectedBeforeMfa).toBe(true);
    expect(result.adminRole).toBe("admin");
    expect(result.adminOfflineAccess).toBe(true);
    expect(result.permanentOfflineExpiry).toBeUndefined();
    expect(result.storesPlaintextPassword).toBe(false);
    expect(result.storesPlaintextEmail).toBe(false);
    expect(result.hasSaltedVerifier).toBe(true);
});

test("offline login creates a local session and restores the approved role", async ({ page, context }) => {
    await page.goto("/");
    await page.addScriptTag({ url: "/auth/offline-store.js" });
    await page.evaluate(function () {
        window.medtrackSessionStorage = {
            setPersistence: function () {},
            clearPersistence: function () {}
        };
        window.medtrackSupabase = {
            auth: {
                getSession: async function () {
                    return { data: { session: null }, error: null };
                },
                getUser: async function () {
                    return { data: { user: null }, error: null };
                },
                signOut: async function () { return { error: null }; },
                onAuthStateChange: function () {
                    return { data: { subscription: { unsubscribe: function () {} } } };
                },
                mfa: {}
            },
            rpc: async function () { return { error: null }; }
        };
    });
    await page.addScriptTag({ url: "/auth/supabase-auth.js" });

    await page.evaluate(async function () {
        const profile = {
            id: "offline-session-staff",
            email: "session.staff@example.test",
            fullname: "Session Staff",
            username: "session.staff",
            role: "staff",
            status: "active"
        };
        await window.medtrackOfflineStore.clearAll();
        await window.medtrackOfflineStore.saveProfile(profile);
        await window.medtrackOfflineStore.enrollOfflineCredential(
            profile,
            [profile.email, profile.username],
            "Offline-Session-Password-2026!",
            "authenticated"
        );
    });

    await context.setOffline(true);
    const result = await page.evaluate(async function () {
        const profile = await window.medtrackAuth.signInOffline(
            "session.staff",
            "Offline-Session-Password-2026!"
        );
        const restored = await window.medtrackAuth.getAuthenticatedProfile();
        return {
            loginRole: profile && profile.role,
            restoredRole: restored && restored.role,
            offlineAccess: restored && restored.offlineAccess,
            userId: window.medtrackAuth.getOfflineSessionUserId()
        };
    });
    await context.setOffline(false);

    expect(result.loginRole).toBe("staff");
    expect(result.restoredRole).toBe("staff");
    expect(result.offlineAccess).toBe(true);
    expect(result.userId).toBe("offline-session-staff");
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
        "Near Expiry",
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
