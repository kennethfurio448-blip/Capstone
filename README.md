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
- `npm run verify:deployment` checks production entry points, security headers, Supabase authentication health, and required Edge Functions. Set `MEDTRACK_URL` and `MEDTRACK_SUPABASE_URL` to verify another environment.

GitHub Actions runs the full suite on pushes and pull requests and verifies production after successful pushes to `master`.

## Deployment

The repository is configured for Vercel through `vercel.json`. Supabase migrations must be applied in timestamp order, and the `login-auth`, `otp-auth`, and `dynamic-worker` functions must be deployed with their required secrets.

Do not commit service-role keys, SMTP credentials, account passwords, OTP values, or production environment files. Public Supabase browser configuration is intentionally limited by Row Level Security; privileged operations belong in Edge Functions.

## Backups and recovery

Administrators can create encrypted backups from System Settings. Use a unique backup password, store the file and password separately, and test restoration periodically in a non-production environment. Restoring a backup replaces synchronized application records and should only be performed by an authorized administrator.

## Release checklist

1. Run `npm test`.
2. Apply pending Supabase migrations and deploy changed Edge Functions.
3. Verify admin MFA, staff permissions, password recovery email, inventory changes, borrowing/returns, emergency deductions, notifications, offline queue synchronization, backup, and restore.
4. Deploy, then run `npm run verify:deployment`.
