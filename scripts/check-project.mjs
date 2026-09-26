import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const ignoredDirectories = new Set([".git", "node_modules", ".temp"]);

function walk(directory) {
  return readdirSync(directory).flatMap((name) => {
    if (ignoredDirectories.has(name)) return [];
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const files = walk(root);
const failures = [];
const requiredCspDirectives = [
  "default-src 'self'",
  "script-src 'self' https://cdn.jsdelivr.net",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];
const approvedExternalAssets = new Map([
  [
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/dist/umd/supabase.min.js",
    "sha384-JBR+x8blGwjDRO63aHCGiZMD4VNiTR4ZUGA+N6ZKLf3zNt1fK8IBpcgPaMrxqWBp",
  ],
  [
    "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css",
    "sha384-nRgPTkuX86pH8yjPJUAFuASXQSSl2/bBUiNV47vSYpKFxHJhbcrGnmlYpYJMeD7a",
  ],
]);
const requiredDeploymentHeaders = [
  "Content-Security-Policy",
  "X-Content-Type-Options",
  "X-Frame-Options",
  "Referrer-Policy",
  "Permissions-Policy",
];

for (const file of files.filter((path) => extname(path) === ".js")) {
  const result = spawnSync(process.execPath, ["--check", file], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    failures.push(`${relative(root, file)}: ${result.stderr.trim()}`);
  }
}

const assetPattern = /(?:href|src)\s*=\s*["']([^"']+)["']/gi;

for (const file of files.filter((path) => extname(path) === ".html")) {
  const html = readFileSync(file, "utf8");
  const displayPath = relative(root, file);
  let match;

  const cspTag = html.match(
    /<meta\s+[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/i,
  )?.[0];
  const cspMatch = cspTag?.match(/\bcontent=(?:"([^"]*)"|'([^']*)')/i);
  const cspContent = cspMatch?.[1] ?? cspMatch?.[2];
  if (!cspContent) {
    failures.push(`${displayPath}: missing Content-Security-Policy`);
  } else {
    for (const directive of requiredCspDirectives) {
      if (!cspContent.includes(directive)) {
        failures.push(`${displayPath}: CSP is missing ${directive}`);
      }
    }
  }

  if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) {
    failures.push(`${displayPath}: inline scripts are not allowed`);
  }
  if (/<style(?:\s|>)/i.test(html)) {
    failures.push(`${displayPath}: inline style blocks are not allowed`);
  }
  if (
    html.includes("notification-button") &&
    !html.includes('src="notification-center.js"')
  ) {
    failures.push(`${displayPath}: notification bell is missing the shared dropdown`);
  }

  for (const [url, integrity] of approvedExternalAssets) {
    if (!html.includes(url)) continue;

    const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const tag = html.match(new RegExp(`<[^>]+${escapedUrl}[^>]*>`, "i"))?.[0];
    if (
      !tag ||
      !tag.includes(`integrity="${integrity}"`) ||
      !tag.includes('crossorigin="anonymous"')
    ) {
      failures.push(`${displayPath}: external asset is missing valid SRI: ${url}`);
    }
  }

  if (/@supabase\/supabase-js@(?!2\.116\.0\/)/i.test(html)) {
    failures.push(`${displayPath}: Supabase dependency must use approved version 2.116.0`);
  }

  while ((match = assetPattern.exec(html))) {
    const target = match[1];
    if (/^(?:https?:|#|data:|mailto:|javascript:)/i.test(target)) continue;
    const localTarget = target.split(/[?#]/, 1)[0];
    if (!localTarget) continue;

    if (localTarget.startsWith("/api/")) {
      const functionPath = join(root, `${localTarget.slice(1)}.js`);
      if (!existsSync(functionPath)) {
        failures.push(
          `${displayPath}: missing API asset ${target}`,
        );
      }
      continue;
    }

    const resolvedTarget = resolve(dirname(file), localTarget);
    if (!existsSync(resolvedTarget)) {
      failures.push(
        `${displayPath}: missing local asset ${target}`,
      );
    }
  }
}

const vercelConfigPath = join(root, "vercel.json");
const otpFunctionPath = join(root, "supabase", "functions", "otp-auth", "index.ts");
const accountFunctionPath = join(root, "supabase", "functions", "dynamic-worker", "index.ts");
const loginFunctionPath = join(root, "supabase", "functions", "login-auth", "index.ts");
const loginScriptPath = join(root, "login", "login-app.js");
const loginProxyPath = join(root, "api", "login.js");
const supabaseClientPath = join(root, "auth", "supabase-client.js");
const authGuardPath = join(root, "auth", "supabase-auth.js");
const dataSyncPath = join(root, "auth", "supabase-data.js");
const offlineStorePath = join(root, "auth", "offline-store.js");
const serviceWorkerPath = join(root, "service-worker.js");
const notificationCenterPath = join(root, "notification-center.js");
const manifestPath = join(root, "manifest.webmanifest");
const offlineMigrationPath = join(
  root,
  "supabase",
  "migrations",
  "20260917150000_offline_borrow_idempotency.sql",
);
const mfaMigrationPath = join(
  root,
  "supabase",
  "migrations",
  "20260926090000_safe_admin_mfa_enforcement.sql",
);
const settingsScriptPath = join(root, "settings.js");
const csvExportPaths = [join(root, "audit-logs.js"), join(root, "reports.js")];

try {
  const notificationCenter = readFileSync(notificationCenterPath, "utf8");

  for (const requiredNotificationControl of [
    "medtrackMedicalSupplies",
    "medtrackBorrowTransactions",
    "low-stock",
    "expired",
    "overdue",
    "supplySearch",
    "transactionSearch",
    "notification.timestamp.toISOString()",
  ]) {
    if (!notificationCenter.includes(requiredNotificationControl)) {
      failures.push(`notification center: missing ${requiredNotificationControl}`);
    }
  }
} catch (error) {
  failures.push(`notification center: unable to inspect shared dropdown (${error.message})`);
}

try {
  const vercelConfig = JSON.parse(readFileSync(vercelConfigPath, "utf8"));
  const configuredHeaders = new Set(
    (vercelConfig.headers || []).flatMap((rule) =>
      (rule.headers || []).map((header) => header.key),
    ),
  );

  for (const header of requiredDeploymentHeaders) {
    if (!configuredHeaders.has(header)) {
      failures.push(`vercel.json: missing deployment security header ${header}`);
    }
  }
} catch (error) {
  failures.push(`vercel.json: invalid or missing deployment configuration (${error.message})`);
}

try {
  const otpFunction = readFileSync(otpFunctionPath, "utf8");
  const registrationStart = otpFunction.indexOf('if (action === "verify-registration")');
  const registrationEnd = otpFunction.indexOf('if (action === "request-password-reset")');
  const resetStart = otpFunction.indexOf('if (action === "reset-password")');
  const resetEnd = otpFunction.indexOf('if (action === "resend")');
  const registrationBlock = otpFunction.slice(registrationStart, registrationEnd);
  const resetBlock = otpFunction.slice(resetStart, resetEnd);

  if (
    registrationStart < 0 ||
    registrationEnd < 0 ||
    registrationBlock.indexOf("validateEmail(email)") > registrationBlock.indexOf("verifyChallenge(") ||
    registrationBlock.indexOf("validatePassword(password)") > registrationBlock.indexOf("verifyChallenge(")
  ) {
    failures.push("otp-auth: registration data must be validated before consuming an OTP");
  }

  if (
    resetStart < 0 ||
    resetEnd < 0 ||
    resetBlock.indexOf("validatePassword(password)") > resetBlock.indexOf("verifyChallenge(")
  ) {
    failures.push("otp-auth: reset password must be validated before consuming an OTP");
  }

  if (!otpFunction.includes("p_destination: destination")) {
    failures.push("otp-auth: registration OTP must be bound to its verified Gmail destination");
  }
} catch (error) {
  failures.push(`otp-auth: unable to inspect server verification controls (${error.message})`);
}

try {
  const loginFunction = readFileSync(loginFunctionPath, "utf8");
  const loginScript = readFileSync(loginScriptPath, "utf8");
  const loginProxy = readFileSync(loginProxyPath, "utf8");
  const supabaseClient = readFileSync(supabaseClientPath, "utf8");

  for (const requiredControl of [
    "medtrack_check_otp_rate_limit",
    "medtrack_login_security_check",
    "medtrack_login_security_failure",
    "medtrack_login_security_success",
    "medtrack_resolve_login_email",
    "signInWithPassword",
    "recordEvent",
    "LOGIN_PROXY_SECRET",
    "Content-Type must be application/json.",
  ]) {
    if (!loginFunction.includes(requiredControl)) {
      failures.push(`login-auth: missing required backend control ${requiredControl}`);
    }
  }

  if (!loginScript.includes("window.medtrackAuth.signIn")) {
    failures.push("login: credentials must use the protected login service");
  }
  if (/loginApproval|login-approval|Approve This Login/.test(loginScript)) {
    failures.push("login: obsolete email-approval logic remains in the normal login flow");
  }
  if (!loginScript.includes('functions.invoke("otp-auth"')) {
    failures.push("login: password-recovery OTP integration is missing");
  }
  if (!loginScript.includes('"request-password-reset"')) {
    failures.push("login: password-recovery OTP request is missing");
  }
  if (
    !loginScript.includes('localPreviewHosts.includes(window.location.hostname)') ||
    !loginScript.includes('window.location.replace(productionLoginUrl)')
  ) {
    failures.push("login: unsupported local previews must redirect to the secure deployed login");
  }
  if (
    !loginProxy.includes("MAX_REQUEST_BYTES") ||
    !loginProxy.includes("Content-Type must be application/json.") ||
    !loginProxy.includes("Request body is too large.")
  ) {
    failures.push("login: Vercel proxy request validation is incomplete");
  }
  if (!supabaseClient.includes("detectSessionInUrl: false")) {
    failures.push("supabase-auth: URL session detection must remain disabled");
  }

  const activeAuthenticationCode = [
    loginFunction,
    loginScript,
    loginProxy,
    supabaseClient,
    readFileSync(authGuardPath, "utf8"),
    readFileSync(accountFunctionPath, "utf8"),
  ].join("\n");
  if (/login-approval|approved_sessions|trusted_devices|LOGIN_APPROVAL/.test(activeAuthenticationCode)) {
    failures.push("authentication: obsolete login-approval code remains active");
  }
} catch (error) {
  failures.push(`login-auth: unable to inspect normal login security controls (${error.message})`);
}

try {
  const accountFunction = readFileSync(accountFunctionPath, "utf8");

  if (!accountFunction.includes('npm:@supabase/server@1.6.0')) {
    failures.push("dynamic-worker: @supabase/server must use approved version 1.6.0");
  }
  if (
    !accountFunction.includes("MAX_REQUEST_BYTES") ||
    !accountFunction.includes("USERNAME_PATTERN") ||
    !accountFunction.includes("UUID_PATTERN")
  ) {
    failures.push("dynamic-worker: server-side account request validation is incomplete");
  }
} catch (error) {
  failures.push(`dynamic-worker: unable to inspect account security controls (${error.message})`);
}

try {
  const authGuard = readFileSync(authGuardPath, "utf8");
  const mfaMigration = readFileSync(mfaMigrationPath, "utf8");

  if (
    !authGuard.includes("SENSITIVE_CACHE_KEYS") ||
    !authGuard.includes("function clearSensitiveBrowserData()") ||
    !authGuard.includes('if (event === "SIGNED_OUT")') ||
    !authGuard.includes("AUTH_REQUEST_TIMEOUT_MS") ||
    !authGuard.includes("function withTimeout(")
  ) {
    failures.push("supabase-auth: sensitive browser data cleanup is incomplete");
  }

  for (const requiredMfaControl of [
    "getAuthenticatorAssuranceLevel",
    "listFactors",
    "challengeAndVerify",
    'factorType: "totp"',
    "ensureAdminMfa",
  ]) {
    if (!authGuard.includes(requiredMfaControl)) {
      failures.push(`supabase-auth: missing administrator MFA control ${requiredMfaControl}`);
    }
  }

  for (const requiredMfaDatabaseControl of [
    "medtrack_admin_mfa_satisfied",
    "auth.mfa_factors",
    "medtrack_mfa_access_allowed",
    'policyname = \'Admin MFA is required\'',
    "medtrack_record_mfa_event",
  ]) {
    if (!mfaMigration.includes(requiredMfaDatabaseControl)) {
      failures.push(`MFA migration: missing database control ${requiredMfaDatabaseControl}`);
    }
  }
} catch (error) {
  failures.push(`supabase-auth: unable to inspect session and MFA controls (${error.message})`);
}

try {
  const offlineStore = readFileSync(offlineStorePath, "utf8");
  const dataSync = readFileSync(dataSyncPath, "utf8");
  const serviceWorker = readFileSync(serviceWorkerPath, "utf8");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const offlineMigration = readFileSync(offlineMigrationPath, "utf8");

  for (const storeName of ["snapshots", "operations", "profiles"]) {
    if (!offlineStore.includes(`\"${storeName}\"`)) {
      failures.push(`offline-store: missing IndexedDB store ${storeName}`);
    }
  }

  for (const requiredControl of [
    "restoreOfflineCollections",
    "queueOperation",
    "syncPending",
    "medtrack_borrow_item_once",
  ]) {
    if (!dataSync.includes(requiredControl)) {
      failures.push(`offline-sync: missing required control ${requiredControl}`);
    }
  }

  if (
    !serviceWorker.includes('request.mode === "navigate"') ||
    !serviceWorker.includes("cacheFirst") ||
    !serviceWorker.includes("networkFirst")
  ) {
    failures.push("service-worker: offline app-shell caching is incomplete");
  }

  const appShellBlock = serviceWorker.match(
    /const APP_SHELL = \[([\s\S]*?)\];/,
  )?.[1] || "";
  const appShellPaths = [...appShellBlock.matchAll(/["'](\/[^"]*?)["']/g)]
    .map((match) => match[1]);

  for (const assetPath of appShellPaths) {
    if (assetPath === "/" || assetPath.startsWith("/api/")) continue;
    if (!existsSync(join(root, assetPath.slice(1)))) {
      failures.push(`service-worker: missing pre-cached asset ${assetPath}`);
    }
  }

  const iconSizes = new Set(
    (manifest.icons || []).map((icon) => icon.sizes),
  );
  if (
    manifest.display !== "standalone" ||
    !iconSizes.has("192x192") ||
    !iconSizes.has("512x512")
  ) {
    failures.push("manifest: installable PWA metadata is incomplete");
  }

  for (const icon of manifest.icons || []) {
    const iconPath = String(icon.src || "").replace(/^\//, "");
    if (iconPath && !existsSync(join(root, iconPath))) {
      failures.push(`manifest: missing icon asset ${icon.src}`);
    }
  }

  if (
    !offlineMigration.includes("medtrack_offline_operation_results") ||
    !offlineMigration.includes("pg_advisory_xact_lock") ||
    !offlineMigration.includes("medtrack_borrow_item_once")
  ) {
    failures.push("offline migration: borrowing idempotency protection is incomplete");
  }
} catch (error) {
  failures.push(`offline support: unable to inspect PWA controls (${error.message})`);
}

try {
  const settingsScript = readFileSync(settingsScriptPath, "utf8");

  if (!/signOut\s*\(\s*\{\s*scope:\s*["']others["']\s*\}/s.test(settingsScript)) {
    failures.push("settings: password changes must terminate other active sessions");
  }
} catch (error) {
  failures.push(`settings: unable to inspect password session controls (${error.message})`);
}

for (const csvExportPath of csvExportPaths) {
  try {
    const csvExportScript = readFileSync(csvExportPath, "utf8");

    if (!csvExportScript.includes("CSV_FORMULA_PATTERN")) {
      failures.push(`${relative(root, csvExportPath)}: CSV formula injection protection is missing`);
    }
  } catch (error) {
    failures.push(`${relative(root, csvExportPath)}: unable to inspect CSV protection (${error.message})`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Project JavaScript, assets, and HTML security controls are valid.");
}
