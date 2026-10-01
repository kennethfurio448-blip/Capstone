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
