const { test, expect } = require("@playwright/test");

test.use({ serviceWorkers: "allow" });

test("cached MedTrack login page reopens without internet", async ({ page, context }) => {
    await page.goto("/login/login.html");
    await page.evaluate(async function () {
        await navigator.serviceWorker.ready;
    });

    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(page.locator("#loginForm")).toBeVisible();
    await expect(page.locator("#email")).toBeEditable();
    await expect(page.locator("#password")).toBeEditable();
});
