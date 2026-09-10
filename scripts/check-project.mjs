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
const authGuardPath = join(root, "auth", "supabase-auth.js");
const settingsScriptPath = join(root, "settings.js");
const csvExportPaths = [join(root, "audit-logs.js"), join(root, "reports.js")];

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

  if (
    !authGuard.includes("SENSITIVE_CACHE_KEYS") ||
    !authGuard.includes("function clearSensitiveBrowserData()") ||
    !authGuard.includes('if (event === "SIGNED_OUT")')
  ) {
    failures.push("supabase-auth: sensitive browser data cleanup is incomplete");
  }
} catch (error) {
  failures.push(`supabase-auth: unable to inspect session cleanup controls (${error.message})`);
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
