-- Bind registration verification to the exact Gmail address while holding the
-- challenge row lock. This prevents a valid code from being consumed for a
-- different address during concurrent or tampered requests.
drop function if exists public.medtrack_verify_otp_challenge(uuid, text, text, uuid);

create function public.medtrack_verify_otp_challenge(
    p_id uuid,
    p_purpose text,
    p_candidate_hash text,
    p_requester uuid default null,
    p_destination text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
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

    if p_purpose = 'registration' and
       (p_destination is null or lower(trim(challenge.destination)) is distinct from lower(trim(p_destination))) then
        return jsonb_build_object('status', 'destination_mismatch');
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

revoke all on function public.medtrack_verify_otp_challenge(uuid, text, text, uuid, text)
from public, anon, authenticated;
grant execute on function public.medtrack_verify_otp_challenge(uuid, text, text, uuid, text)
to service_role;

notify pgrst, 'reload schema';
