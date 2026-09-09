# MedTrack OTP deployment

The OTP implementation runs in the `otp-auth` Supabase Edge Function. Codes are
generated with the Web Crypto API, stored only as an HMAC-SHA-256 digest, expire
after 10 minutes, allow five verification attempts, and enforce a 60-second
resend cooldown. Browser storage is not used for OTPs or passwords.

## 1. Apply the database migration

```sh
supabase db push
```

This adds required contact columns for new accounts and creates the private
`otp_challenges` table. Row-level security and explicit revokes prevent browser
roles from reading verification records.

## 2. Configure trusted delivery providers

Create a long random OTP pepper and configure Resend credentials as Edge
Function secrets. Never put these values in an HTML or JavaScript file.

```sh
supabase secrets set OTP_PEPPER="a-random-secret-of-at-least-32-characters"
supabase secrets set RESEND_API_KEY="..." OTP_FROM_EMAIL="MedTrack <verify@your-domain.example>"
```

The sender domain must be verified in Resend for production delivery.

Configure an exact comma-separated origin allowlist for deployed frontends.
Do not use `*`, paths, or trailing slashes. Localhost development origins are
allowed separately by the Edge Function.

```sh
supabase secrets set ALLOWED_ORIGINS="https://medtrack-system-ph.vercel.app,https://your-domain.example,https://www.your-domain.example"
```

Until a custom domain is purchased, keep only the stable Vercel production
origin. Add the real custom-domain origins immediately before switching DNS.

## 3. Deploy both functions

```sh
supabase functions deploy otp-auth --no-verify-jwt
supabase functions deploy dynamic-worker
```

`otp-auth` deliberately accepts unauthenticated password-recovery requests, then
does all account lookup, throttling, code hashing, verification, and password
updates on the server. Registration actions additionally validate the caller as
an active Admin. `dynamic-worker` remains authenticated and Admin-only.

## Verification channel

Registration and password recovery use the account's Gmail address exclusively.
Phone numbers and SMS provider credentials are not collected or required.
