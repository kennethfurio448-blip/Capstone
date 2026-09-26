const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
    testDir: "./tests",
    timeout: 30000,
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? "github" : "list",
    use: {
        baseURL: "http://127.0.0.1:3000",
        serviceWorkers: "block",
        trace: "on-first-retry",
        screenshot: "only-on-failure"
    },
    webServer: {
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
