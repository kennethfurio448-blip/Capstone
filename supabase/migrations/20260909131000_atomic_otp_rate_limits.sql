-- Atomic OTP abuse protection. Keys are HMAC hashes created by the Edge
-- Function, so raw email addresses and client network addresses are not stored.

create table if not exists public.otp_rate_limits (
    key_hash text not null,
    action text not null,
    window_started_at timestamptz not null default now(),
    request_count integer not null default 0 check (request_count >= 0),
    blocked_until timestamptz,
    updated_at timestamptz not null default now(),
    primary key (key_hash, action)
);

create index if not exists otp_rate_limits_updated_at_idx
    on public.otp_rate_limits (updated_at);

alter table public.otp_rate_limits enable row level security;
revoke all on table public.otp_rate_limits from anon, authenticated;
grant select, insert, update, delete on table public.otp_rate_limits to service_role;

create or replace function public.medtrack_check_otp_rate_limit(
    p_key_hash text,
    p_action text,
    p_limit integer,
    p_window_seconds integer,
    p_block_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_limit public.otp_rate_limits%rowtype;
    v_now timestamptz := clock_timestamp();
    v_retry_after integer;
begin
    if coalesce(length(p_key_hash), 0) < 32 or
       coalesce(trim(p_action), '') = '' or
       p_limit < 1 or
       p_window_seconds < 1 or
       p_block_seconds < 1 then
        raise exception 'Invalid rate-limit parameters.';
    end if;

    perform pg_advisory_xact_lock(hashtext(p_key_hash || ':' || p_action));

    select * into v_limit
    from public.otp_rate_limits
    where key_hash = p_key_hash
      and action = p_action
    for update;

    if not found then
        insert into public.otp_rate_limits (
            key_hash,
            action,
            window_started_at,
            request_count,
            blocked_until,
            updated_at
        ) values (
            p_key_hash,
            p_action,
            v_now,
            1,
            null,
            v_now
        );

        return jsonb_build_object(
            'allowed', true,
            'remaining', p_limit - 1,
            'retryAfter', 0
        );
    end if;

    if v_limit.blocked_until is not null and
       v_limit.blocked_until > v_now then
        v_retry_after := greatest(
            1,
            ceil(extract(epoch from (v_limit.blocked_until - v_now)))::integer
        );

        return jsonb_build_object(
            'allowed', false,
            'remaining', 0,
            'retryAfter', v_retry_after
        );
    end if;

    if v_limit.window_started_at +
       make_interval(secs => p_window_seconds) <= v_now then
        update public.otp_rate_limits
        set window_started_at = v_now,
            request_count = 1,
            blocked_until = null,
            updated_at = v_now
        where key_hash = p_key_hash
          and action = p_action;

        return jsonb_build_object(
            'allowed', true,
            'remaining', p_limit - 1,
            'retryAfter', 0
        );
    end if;

    if v_limit.request_count >= p_limit then
        update public.otp_rate_limits
        set blocked_until = v_now + make_interval(secs => p_block_seconds),
            updated_at = v_now
        where key_hash = p_key_hash
          and action = p_action;

        return jsonb_build_object(
            'allowed', false,
            'remaining', 0,
            'retryAfter', p_block_seconds
        );
    end if;

    update public.otp_rate_limits
    set request_count = request_count + 1,
        blocked_until = null,
        updated_at = v_now
    where key_hash = p_key_hash
      and action = p_action;

    return jsonb_build_object(
        'allowed', true,
        'remaining', p_limit - v_limit.request_count - 1,
        'retryAfter', 0
    );
end;
$$;

revoke all on function public.medtrack_check_otp_rate_limit(
    text, text, integer, integer, integer
) from public, anon, authenticated;

grant execute on function public.medtrack_check_otp_rate_limit(
    text, text, integer, integer, integer
) to service_role;

notify pgrst, 'reload schema';
