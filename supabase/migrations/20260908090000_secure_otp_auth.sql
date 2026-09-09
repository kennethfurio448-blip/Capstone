-- Server-side OTP challenges and required account contact information.
-- This table is intentionally inaccessible to browser roles. Edge Functions use
-- the service-role key and only return masked destinations.

alter table public.profiles
    add column if not exists email text,
    add column if not exists phone_number text;

create unique index if not exists profiles_email_unique_idx
    on public.profiles (lower(email))
    where email is not null;

create unique index if not exists profiles_phone_number_unique_idx
    on public.profiles (phone_number)
    where phone_number is not null;

create table if not exists public.otp_challenges (
    id uuid primary key,
    purpose text not null check (purpose in ('registration', 'password_reset')),
    channel text not null check (channel in ('sms', 'email')),
    destination text not null,
    target_user_id uuid,
    requested_by uuid,
    otp_hash text not null,
    expires_at timestamptz not null,
    resend_available_at timestamptz not null,
    attempts integer not null default 0 check (attempts >= 0),
    resend_count integer not null default 0 check (resend_count >= 0),
    max_attempts integer not null default 5 check (max_attempts between 1 and 10),
    verified_at timestamptz,
    consumed_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists otp_challenges_destination_idx
    on public.otp_challenges (purpose, destination, created_at desc);

create index if not exists otp_challenges_expiry_idx
    on public.otp_challenges (expires_at);

alter table public.otp_challenges enable row level security;
revoke all on table public.otp_challenges from anon, authenticated;
grant select, insert, update, delete on table public.otp_challenges to service_role;

-- Locks one challenge row while checking it so parallel requests cannot bypass
-- the attempt limit or successfully reuse the same code.
create or replace function public.medtrack_verify_otp_challenge(
    p_id uuid,
    p_purpose text,
    p_candidate_hash text,
    p_requester uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    challenge public.otp_challenges%rowtype;
    remaining integer;
begin
    select * into challenge
    from public.otp_challenges
    where id = p_id and purpose = p_purpose
    for update;

    if not found then
        return jsonb_build_object('status', 'invalid');
    end if;

    if p_purpose = 'registration' and
       (p_requester is null or challenge.requested_by is distinct from p_requester) then
        return jsonb_build_object('status', 'forbidden');
    end if;

    if challenge.consumed_at is not null or challenge.verified_at is not null then
        return jsonb_build_object('status', 'used');
    end if;

    if challenge.expires_at <= now() then
        return jsonb_build_object('status', 'expired');
    end if;

    if challenge.attempts >= challenge.max_attempts then
        return jsonb_build_object('status', 'locked');
    end if;

    if challenge.otp_hash <> p_candidate_hash then
        update public.otp_challenges
        set attempts = attempts + 1
        where id = p_id;
        remaining := greatest(0, challenge.max_attempts - challenge.attempts - 1);
        return jsonb_build_object('status', 'incorrect', 'remaining', remaining);
    end if;

    update public.otp_challenges
    set verified_at = now()
    where id = p_id;

    return jsonb_build_object('status', 'verified', 'challenge', to_jsonb(challenge));
end;
$$;

revoke all on function public.medtrack_verify_otp_challenge(uuid, text, text, uuid)
from public, anon, authenticated;
grant execute on function public.medtrack_verify_otp_challenge(uuid, text, text, uuid)
to service_role;

grant select, insert, update on table public.profiles to service_role;
