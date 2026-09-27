const { defineConfig, devices } = require("@playwright/test");
const externalBaseUrl = process.env.MEDTRACK_E2E_URL;

module.exports = defineConfig({
    testDir: "./tests",
    timeout: 30000,
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? "github" : "list",
    use: {
        baseURL: externalBaseUrl || "http://127.0.0.1:3000",
        serviceWorkers: "block",
        trace: "on-first-retry",
        screenshot: "only-on-failure"
    },
    webServer: externalBaseUrl ? undefined : {
        command: "node scripts/static-server.mjs",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: false
    },
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] }
        }
    ]
});
