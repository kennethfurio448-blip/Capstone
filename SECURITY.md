# MedTrack security operations

## Required production configuration

1. Enable TOTP multi-factor authentication in Supabase Authentication settings. Administrator access is restricted to an `aal2` session after the accompanying migration is deployed.
2. Create a Cloudflare Turnstile widget restricted to `www.medtrackmanagement.com` and `medtrackmanagement.com`.
3. Set `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in Vercel. Set the same `TURNSTILE_SECRET_KEY` for the Supabase `otp-auth` Edge Function.
4. Keep `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `OTP_PEPPER`, `LOGIN_PROXY_SECRET`, and `LOGIN_SECURITY_PEPPER` only in provider secret stores. Never put them in browser code, Git, screenshots, or support messages.

## Secret rotation

- Rotate Resend and application secrets at least every 90 days and immediately after suspected exposure.
- Use at least 32 random bytes for peppers and proxy secrets.
- Update Vercel and Supabase secrets during the same maintenance window, redeploy the affected functions, then test login, password recovery, account creation, and email delivery.
- Revoking or changing `OTP_PEPPER` invalidates outstanding OTP challenges. Schedule this intentionally.

## Backups and recovery

- On Supabase Pro or higher, confirm daily backups under **Database > Backups**. Enable Point-in-Time Recovery when the required recovery point objective is shorter than one day.
- On projects without downloadable managed backups, schedule an encrypted `supabase db dump` to storage that is separate from the production account.
- Perform a restore drill into a separate test project every quarter. A backup is not considered verified until a restore succeeds.
- Keep the encrypted in-application backup feature as an additional logical export, not as the only database backup.

## Monitoring and response

- Review the Audit Logs security banner and authentication events regularly. Five failed logins in 15 minutes trigger an in-application warning.
- Investigate account lockouts, unusual locations, repeated OTP requests, MFA enrollment events, and unexpected administrator changes.
- Disable affected accounts, rotate secrets, revoke sessions, preserve audit evidence, and restore from a verified backup when required.

## Automated checks

- Run `npm run security:check` before release.
- Run `supabase test db` against a fresh local database after changing migrations or policies.
- GitHub Actions runs application checks, dependency auditing, migrations, and pgTAP security tests. Dependabot checks npm and GitHub Actions dependencies weekly.
