const { test, expect } = require("@playwright/test");

const staffIdentifier = process.env.MEDTRACK_E2E_STAFF_IDENTIFIER;
const staffPassword = process.env.MEDTRACK_E2E_STAFF_PASSWORD;
const adminIdentifier = process.env.MEDTRACK_E2E_ADMIN_IDENTIFIER;
const adminPassword = process.env.MEDTRACK_E2E_ADMIN_PASSWORD;

test("test staff account reaches the staff dashboard", async ({ page }) => {
    test.skip(!staffIdentifier || !staffPassword, "Dedicated staff test credentials are not configured.");
    await page.goto("/login/login.html");
    await page.locator("#email").fill(staffIdentifier);
    await page.locator("#password").fill(staffPassword);
    await page.getByRole("button", { name: /Sign In/i }).click();
    await expect(page).toHaveURL(/staff-dashboard\.html/, { timeout: 20000 });
    await expect(page.locator("#currentUserRole")).toContainText(/staff/i);
});

test("test administrator account reaches its MFA gate or dashboard", async ({ page }) => {
    test.skip(!adminIdentifier || !adminPassword, "Dedicated admin test credentials are not configured.");
    await page.goto("/login/login.html");
    await page.locator("#email").fill(adminIdentifier);
    await page.locator("#password").fill(adminPassword);
    await page.getByRole("button", { name: /Sign In/i }).click();
    await expect(
        page.locator(".mfa-gate, body:has(#currentUserRole)")
    ).toBeVisible({ timeout: 20000 });
});
