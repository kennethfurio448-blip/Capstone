# MedTrack Management System

MedTrack is a role-based PDRRMO inventory system for medical supplies, medical equipment, mobility assets, borrowing and returns, emergency responses, reporting, auditing, and administrative settings.

## Roles

- **Administrator:** Full inventory access plus user management, reports, audit logs, system settings, backups, and security controls.
- **Staff:** Daily inventory, status, borrowing, return, and emergency-response operations without administrator-only account and system controls.

## Local setup

1. Install Node.js 22 or later.
2. Run `npm install`.
3. Run `node scripts/static-server.mjs`.
4. Open `http://127.0.0.1:3000`.

The application requires its configured Supabase project for online authentication and synchronized data. Offline mode uses the service-worker application shell plus encrypted/session-scoped browser storage and queues supported changes until connectivity returns.

## Quality checks

- `npm run check` validates JavaScript syntax, local assets, content-security policies, deployment headers, authentication controls, and critical project wiring.
- `npm run test:e2e` runs the Chromium browser tests.
- `npm test` runs both static validation and browser tests.
- `npm run verify:backup` decrypts and validates a backup without restoring it. Set `MEDTRACK_BACKUP_FILE` and `MEDTRACK_BACKUP_PASSWORD`; the password and record contents are never printed.
- `npm run backup:create` exports synchronized production records and creates an AES-256-GCM encrypted backup. It requires `MEDTRACK_SUPABASE_URL`, `MEDTRACK_SUPABASE_SERVICE_ROLE_KEY`, and `MEDTRACK_BACKUP_PASSWORD`.
- `npm run test:backup-restore` performs a non-destructive restore rehearsal against an encrypted file. It verifies decryption, unique record IDs, collection reconstruction, and JSON round-trip integrity without writing to any database.
- `npm run verify:deployment` checks production entry points, security headers, Supabase authentication health, and required Edge Functions. Set `MEDTRACK_URL` and `MEDTRACK_SUPABASE_URL` to verify another environment.

The browser suite includes public workflows, responsive phone layouts, WCAG accessibility checks, notification behavior, and optional Admin/Staff authentication smoke tests. Authenticated tests remain skipped until dedicated test credentials are configured as GitHub secrets; never use personal or production operator credentials.

GitHub Actions runs the full suite on pushes and pull requests and verifies production after successful pushes to `master`.

Dependabot and the scheduled Monday workflow check development dependencies and GitHub Actions for security updates. High-severity audit findings fail the workflow.

## Deployment

The repository is configured for Vercel through `vercel.json`. Supabase migrations must be applied in timestamp order, and the `login-auth`, `otp-auth`, and `dynamic-worker` functions must be deployed with their required secrets.

Do not commit service-role keys, SMTP credentials, account passwords, OTP values, or production environment files. Public Supabase browser configuration is intentionally limited by Row Level Security; privileged operations belong in Edge Functions.

## Backups and recovery

Administrators can create encrypted backups from System Settings. Use a unique backup password, store the file and password separately, and test restoration periodically in a non-production environment. Restoring a backup replaces synchronized application records and should only be performed by an authorized administrator.

The `Encrypted MedTrack backup` GitHub Actions workflow runs daily at 18:47 UTC (02:47 Asia/Manila), verifies each encrypted backup, performs a non-destructive restore rehearsal, and retains only the encrypted artifact for 30 days. Configure these repository secrets before enabling the schedule:

- `MEDTRACK_SUPABASE_URL`
- `MEDTRACK_SUPABASE_SERVICE_ROLE_KEY` (prefer a dedicated `sb_secret_...` key; the secret name remains unchanged for workflow compatibility)
- `MEDTRACK_BACKUP_PASSWORD` (a unique value containing at least 12 characters)

Rotate the service-role key and backup password according to PDRRMO policy. Never store either value in the repository or download logs. Automated backups contain synchronized operational tables; browser-only appearance preferences remain covered by the administrator's manual encrypted backup.

Never perform a restore drill against `www.medtrackmanagement.com` or the production Supabase project. A dedicated test database and test Admin account are required before automating this destructive verification.

## Monitoring and retention

Authenticated runtime failures are sanitized, rate-limited, stored in `client_error_events`, and copied into the administrator Audit Logs. Email addresses and token-shaped values are removed before submission. Notification read/dismissed state is synchronized per user across devices when online and remains available locally while offline.

Client-error detail can be purged by a verified administrator with `medtrack_purge_client_errors`; the default retention target is 90 days. Audit records are intentionally retained because their legal retention period must be approved by PDRRMO before automatic archival or deletion is enabled.

## Release checklist

1. Run `npm test`.
2. Apply pending Supabase migrations and deploy changed Edge Functions.
3. Verify admin MFA, staff permissions, password recovery email, inventory changes, borrowing/returns, emergency deductions, notifications, offline queue synchronization, backup, and restore using dedicated test accounts and a non-production database.
4. Deploy, then run `npm run verify:deployment`.
