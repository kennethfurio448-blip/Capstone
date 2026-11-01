import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const certificateLink = String(process.env.WIN_CSC_LINK || "").trim();
const certificatePassword = String(
  process.env.WIN_CSC_KEY_PASSWORD || "",
).trim();
const certificateThumbprint = String(
  process.env.WINDOWS_CERTIFICATE_SHA1 || "",
).replace(/\s+/g, "").toUpperCase();
const expectedPublisher = String(
  process.env.MEDTRACK_WINDOWS_PUBLISHER || "",
).trim();

if (process.platform !== "win32") {
  throw new Error("Signed MedTrack Windows releases must be built on Windows.");
}
if (!certificateLink && !/^[A-F0-9]{40}$/.test(certificateThumbprint)) {
  throw new Error(
    "No trusted code-signing identity is configured. Set WIN_CSC_LINK for a supported signing credential or WINDOWS_CERTIFICATE_SHA1 for a certificate available in the Windows certificate store.",
  );
}
if (certificateLink && certificateThumbprint) {
  throw new Error(
    "Configure one signing identity only: WIN_CSC_LINK or WINDOWS_CERTIFICATE_SHA1, not both.",
  );
}
if (certificateLink && !certificatePassword) {
  throw new Error(
    "WIN_CSC_KEY_PASSWORD is required when WIN_CSC_LINK is configured.",
  );
}
if (!expectedPublisher) {
  throw new Error(
    "MEDTRACK_WINDOWS_PUBLISHER must match the verified certificate subject before a release can be built.",
  );
}

const cli = resolve(root, "node_modules", "electron-builder", "out", "cli", "cli.js");
if (!existsSync(cli)) {
  throw new Error("electron-builder is not installed. Run npm ci first.");
}

const args = [
  cli,
  "--win",
  "nsis",
  "--x64",
  "--publish",
  "never",
  "--config.forceCodeSigning=true",
];

if (certificateThumbprint) {
  args.push(
    `--config.win.signtoolOptions.certificateSha1=${certificateThumbprint}`,
  );
}

const build = spawnSync(process.execPath, args, {
  cwd: root,
  env: process.env,
  stdio: "inherit",
  windowsHide: true,
});
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status || 1);

const verify = spawnSync(
  process.execPath,
  [resolve(root, "scripts", "verify-windows-signature.mjs")],
  {
    cwd: root,
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  },
);
if (verify.error) throw verify.error;
if (verify.status !== 0) process.exit(verify.status || 1);
