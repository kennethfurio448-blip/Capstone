const baseUrl = (process.env.MEDTRACK_URL || "https://www.medtrackmanagement.com").replace(/\/$/, "");
const backendUrl = (process.env.MEDTRACK_SUPABASE_URL || "https://agztgijxasjypmrndvyj.supabase.co").replace(/\/$/, "");
const requiredHeaders = [
    "content-security-policy",
    "permissions-policy",
    "referrer-policy",
    "strict-transport-security",
    "x-content-type-options",
    "x-frame-options"
];
const paths = ["/", "/login/login.html", "/service-worker.js", "/manifest.webmanifest"];
const failures = [];

for (const path of paths) {
    try {
        const response = await fetch(`${baseUrl}${path}`, { redirect: "follow" });
        if (!response.ok) failures.push(`${path} returned HTTP ${response.status}`);
        if (path === "/") {
            for (const header of requiredHeaders) {
                if (!response.headers.get(header)) failures.push(`deployment is missing ${header}`);
            }
        }
    } catch (error) {
        failures.push(`${path} could not be reached: ${error.message}`);
    }
}

for (const check of [
    { url: `${backendUrl}/auth/v1/health`, method: "GET", label: "Supabase authentication" },
    { url: `${backendUrl}/functions/v1/login-auth`, method: "OPTIONS", label: "login-auth function" },
    { url: `${backendUrl}/functions/v1/otp-auth`, method: "OPTIONS", label: "otp-auth function" },
    { url: `${backendUrl}/functions/v1/dynamic-worker`, method: "OPTIONS", label: "account administration function" }
]) {
    try {
        const response = await fetch(check.url, { method: check.method });
        if (response.status === 404 || response.status >= 500) {
            failures.push(`${check.label} returned HTTP ${response.status}`);
        }
    } catch (error) {
        failures.push(`${check.label} could not be reached: ${error.message}`);
    }
}

if (failures.length) {
    console.error("Deployment verification failed:\n- " + failures.join("\n- "));
    process.exit(1);
}

console.log(`Deployment verification passed for ${baseUrl}.`);
