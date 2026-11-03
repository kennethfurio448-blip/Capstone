const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

async function openEmergencyResponseWithTestSession(page) {
    const emptyScript = {
        status: 200,
        contentType: "application/javascript",
        body: ""
    };
    for (const path of [
        "**/api/supabase-js",
        "**/auth/supabase-client.js",
        "**/pwa.js",
        "**/notification-center.js"
    ]) {
        await page.route(path, function (route) {
            return route.fulfill(emptyScript);
        });
    }
    await page.route("**/auth/supabase-auth.js", function (route) {
        return route.fulfill({
            ...emptyScript,
            body: `window.medtrackAuth = {
                requireRoles: async function () {
                    document.body.hidden = false;
                    return { role: "staff", status: "active", fullname: "Tester" };
                },
                signOutAndRedirect: async function () {}
            };`
        });
    });
    await page.route("**/auth/supabase-data.js**", function (route) {
        return route.fulfill({
            ...emptyScript,
            body: "window.medtrackData = { refresh: async function () {} };"
        });
    });
    await page.addInitScript(function () {
        localStorage.setItem("medtrackEmergencyRequests", "[]");
        localStorage.setItem("medtrackMedicalSupplies", "[]");
        localStorage.setItem("medtrackMedicalEquipment", "[]");
        localStorage.setItem("medtrackMobilityAssets", "[]");
    });
    await page.goto("/emergency-response.html");
}

async function openDownloadMenuForTest(page) {
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
        '<!DOCTYPE html><html lang="en"><head><title>MedTrack Download Menu Test</title></head><body>' +
        '<main class="main-content"><header class="topbar"><div>' +
        '<h2>Dashboard</h2><p>MedTrack test</p></div><div class="topbar-actions">' +
        '<button type="button" class="notification-button" aria-label="Open notifications">' +
        '<span hidden>0</span></button><div class="user-profile">Staff User</div>' +
        '</div></header></main></body></html>'
    );
    await page.addStyleTag({ url: "/app-shell.css" });
    await page.evaluate(function () {
        window.medtrackPwaInstall = {
            isInstalled: function () { return false; },
            isAvailable: function () { return true; },
            promptInstall: async function () { return { outcome: "accepted" }; }
        };
    });
    await page.addScriptTag({ url: "/app-shell.js" });
    await page.getByRole("button", { name: "Download or install MedTrack" }).click();
}

for (const target of [
    { path: "/", name: "landing page" },
    { path: "/login/login.html", name: "login page" }
]) {
    test(`${target.name} has no serious accessibility violations`, async ({ page }) => {
        await page.goto(target.path);
        const results = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
            .analyze();
        const serious = results.violations.filter(function (violation) {
            return violation.impact === "serious" || violation.impact === "critical";
        });
        expect(serious).toEqual([]);
    });
}

test("login and password recovery remain usable on a phone viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login/login.html");
    await expect(page.getByRole("heading", { name: "Welcome Back" })).toBeVisible();
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await expect(page.getByRole("heading", { name: "Forgot Password?" })).toBeVisible();
    const overflow = await page.evaluate(function () {
        return document.documentElement.scrollWidth - document.documentElement.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(1);
});

test("Emergency Response has no serious accessibility violations", async ({ page }) => {
    await openEmergencyResponseWithTestSession(page);
    const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
    const serious = results.violations.filter(function (violation) {
        return violation.impact === "serious" || violation.impact === "critical";
    });
    expect(serious).toEqual([]);
});

test("Emergency Response remains usable on a phone viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openEmergencyResponseWithTestSession(page);
    await page.locator("#openAddModal").click();
    await expect(page.getByRole("heading", { name: "New Emergency Request" }))
        .toBeVisible();
    await expect(page.locator("#addResourceItem")).toBeVisible();
    const overflow = await page.evaluate(function () {
        return document.documentElement.scrollWidth -
            document.documentElement.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(1);
});

test("header download menu has no serious accessibility violations", async ({ page }) => {
    await openDownloadMenuForTest(page);
    const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
    const serious = results.violations.filter(function (violation) {
        return violation.impact === "serious" || violation.impact === "critical";
    });
    expect(serious).toEqual([]);
});

test("header download menu remains usable on a phone viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openDownloadMenuForTest(page);
    await expect(page.getByRole("dialog", { name: "Download and install MedTrack" }))
        .toBeVisible();
    await expect(page.getByRole("link", { name: "Download for Windows" }))
        .toBeVisible();
    await expect(page.getByRole("button", { name: "Install from Browser" }))
        .toBeVisible();
    const overflow = await page.evaluate(function () {
        return document.documentElement.scrollWidth -
            document.documentElement.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(1);
});

test("inventory tables become labeled cards on a phone viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.setContent(`
        <div class="table-wrapper">
            <table class="responsive-card-table">
                <thead><tr><th>Item ID</th><th>Item Name</th><th>Status</th></tr></thead>
                <tbody><tr><td>MED-001</td><td>Gauze</td><td>Available</td></tr></tbody>
            </table>
        </div>
    `);
    await page.addStyleTag({ url: "/app-shell.css" });
    await page.addScriptTag({ url: "/table-pagination.js" });
    await page.evaluate(function () {
        document.dispatchEvent(new Event("DOMContentLoaded"));
    });
    await expect(page.locator("tbody td").nth(1)).toHaveAttribute(
        "data-label",
        "Item Name"
    );
    expect(await page.locator("tbody tr").evaluate(function (row) {
        return getComputedStyle(row).display;
    })).toBe("block");
    const overflow = await page.evaluate(function () {
        return document.documentElement.scrollWidth -
            document.documentElement.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(1);
});
