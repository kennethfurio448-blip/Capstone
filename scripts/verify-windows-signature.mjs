import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(
  readFileSync(resolve(root, "package.json"), "utf8"),
);
const expectedPublisher = String(
  process.env.MEDTRACK_WINDOWS_PUBLISHER || "",
).trim();
const powershell = resolve(
  process.env.SystemRoot || "C:\\Windows",
  "System32",
  "WindowsPowerShell",
  "v1.0",
  "powershell.exe",
);
const targets = [
  resolve(root, "release", `MedTrack-Setup-${packageJson.version}.exe`),
  resolve(root, "release", "win-unpacked", "MedTrack.exe"),
];

if (process.platform !== "win32") {
  throw new Error("Authenticode verification must run on Windows.");
}
if (!expectedPublisher) {
  throw new Error(
    "MEDTRACK_WINDOWS_PUBLISHER is required to verify the signer identity.",
  );
}

const verificationScript = [
  "$signature = Get-AuthenticodeSignature -LiteralPath $env:MEDTRACK_SIGNATURE_TARGET",
  "$result = [ordered]@{",
  "  Status = [string]$signature.Status",
  "  StatusMessage = [string]$signature.StatusMessage",
  "  Subject = if ($signature.SignerCertificate) { [string]$signature.SignerCertificate.Subject } else { '' }",
  "  Thumbprint = if ($signature.SignerCertificate) { [string]$signature.SignerCertificate.Thumbprint } else { '' }",
  "  NotAfter = if ($signature.SignerCertificate) { $signature.SignerCertificate.NotAfter.ToUniversalTime().ToString('o') } else { '' }",
  "  TimestampSubject = if ($signature.TimeStamperCertificate) { [string]$signature.TimeStamperCertificate.Subject } else { '' }",
  "}",
  "$result | ConvertTo-Json -Compress",
].join("\n");

for (const target of targets) {
  if (!existsSync(target)) {
    throw new Error(`Required signed artifact is missing: ${target}`);
  }

  const raw = execFileSync(
    powershell,
    ["-NoProfile", "-NonInteractive", "-Command", verificationScript],
    {
      encoding: "utf8",
      windowsHide: true,
      env: { ...process.env, MEDTRACK_SIGNATURE_TARGET: target },
    },
  ).trim();
  const signature = JSON.parse(raw);

  if (signature.Status !== "Valid") {
    throw new Error(
      `${target} does not have a valid Authenticode signature: ${signature.Status} ${signature.StatusMessage}`,
    );
  }
  if (!signature.Subject.toLowerCase().includes(expectedPublisher.toLowerCase())) {
    throw new Error(
      `${target} was signed by an unexpected publisher: ${signature.Subject}`,
    );
  }
  if (!signature.TimestampSubject) {
    throw new Error(`${target} is signed but does not contain a trusted timestamp.`);
  }

  console.log(
    `Verified ${target}: ${signature.Subject}; thumbprint ${signature.Thumbprint}; timestamped by ${signature.TimestampSubject}.`,
  );
}
