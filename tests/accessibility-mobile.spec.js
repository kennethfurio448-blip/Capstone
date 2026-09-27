const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

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
