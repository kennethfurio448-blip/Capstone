# MedTrack Windows Code Signing

The current public `MedTrack-Setup-1.0.1.exe` is unsigned. Microsoft Defender found no threats in the local release artifact on November 2, 2026, but SmartScreen correctly identifies it as an unrecognized application because it has no Authenticode publisher identity.

## Required signing identity

Obtain a publicly trusted Windows code-signing certificate for the legal organization that owns and publishes MedTrack. The certificate must chain to a Certificate Authority in the Microsoft Trusted Root Program. A self-signed certificate is not suitable for public distribution.

Since June 2023, publicly trusted code-signing private keys must be protected by an approved hardware token, HSM, cloud HSM, or signing service. Choose one of these release paths:

1. A CA-provided cloud signing service that supports automated Windows Authenticode signing.
2. A CA-issued hardware token used from a secured self-hosted Windows release runner.
3. Microsoft Store distribution as MSIX, where Microsoft signs the Store package after certification.

Microsoft Azure Artifact Signing has regional eligibility restrictions. Confirm that the verified legal publisher is eligible before choosing it.

## MedTrack release safeguards

- `npm run desktop:build` remains available for local unsigned development builds only.
- `npm run desktop:build:signed` requires a signing identity and forces the build to fail if signing is skipped.
- `npm run desktop:verify-signature` verifies the Authenticode status, expected publisher, and timestamp on both `MedTrack.exe` and the NSIS installer.
- The GitHub release workflow refuses to upload an installer until signature verification passes.
- Signing keys, token PINs, client secrets, and certificate passwords must never be committed to this repository or pasted into issue logs.

## Protected release configuration

Configure the `windows-signing` GitHub environment with:

- `MEDTRACK_WINDOWS_PUBLISHER`: a distinctive part of the verified certificate subject.
- Either `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` when the selected signing service provides a compatible CI credential, or `WINDOWS_CERTIFICATE_SHA1` when the certificate is available in the Windows certificate store of a secured self-hosted runner.
- `WINDOWS_SIGNING_RUNNER` repository variable when a self-hosted signing runner is required. Its value must identify the secured Windows runner configured for the hardware token or HSM.

After signing is configured, increment the application version and create a new tag. Do not replace the existing `v1.0.1` file in place; a new signed version preserves auditability and allows SmartScreen reputation to accumulate on a consistent publisher identity.

## Verification

For every published release:

1. Confirm `Get-AuthenticodeSignature` reports `Valid` for the installer and installed executable.
2. Confirm the displayed publisher exactly matches the CA-validated organization.
3. Confirm a trusted RFC 3161 timestamp is present.
4. Scan the final installer with current Microsoft Defender definitions.
5. Install on a clean Windows test device with Defender and SmartScreen enabled.
6. Record any remaining SmartScreen prompt. A valid signature establishes publisher identity but reputation can still require time and real-world downloads.

References:

- Microsoft: <https://learn.microsoft.com/windows/apps/package-and-deploy/code-signing-options>
- Microsoft SmartScreen: <https://learn.microsoft.com/windows/security/threat-protection/microsoft-defender-smartscreen/microsoft-defender-smartscreen-overview>
- Electron Builder: <https://www.electron.build/docs/features/code-signing/code-signing-win/>
