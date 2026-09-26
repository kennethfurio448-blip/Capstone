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
