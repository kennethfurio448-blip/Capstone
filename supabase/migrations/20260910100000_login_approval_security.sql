create table if not exists public.login_approval_requests (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    destination text not null,
    browser_secret_hash text not null,
    allow_token_hash text not null,
    deny_token_hash text not null,
    status text not null default 'pending',
    device_description text not null default 'Unknown browser or device',
    ip_address text,
    approximate_location text,
    remember_me boolean not null default false,
    resend_count integer not null default 0,
    resend_available_at timestamptz not null default (now() + interval '60 seconds'),
    expires_at timestamptz not null default (now() + interval '10 minutes'),
    decided_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz not null default now(),
    constraint login_approval_status_check check (
        status in ('pending', 'approved', 'denied', 'expired', 'finalizing', 'completed')
    ),
    constraint login_approval_resend_count_check check (resend_count between 0 and 5)
);

create table if not exists public.approved_sessions (
    session_id uuid primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    approval_request_id uuid references public.login_approval_requests(id) on delete set null,
    approved_at timestamptz not null default now(),
    expires_at timestamptz not null default (now() + interval '12 hours'),
    revoked_at timestamptz
);

create table if not exists public.trusted_devices (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    token_hash text not null unique,
    user_agent_hash text not null,
    device_description text not null,
    created_at timestamptz not null default now(),
    last_used_at timestamptz not null default now(),
    expires_at timestamptz not null default (now() + interval '14 days'),
    revoked_at timestamptz
);

create table if not exists public.login_security_state (
    email_hash text primary key,
    failed_count integer not null default 0,
    window_started_at timestamptz not null default now(),
    locked_until timestamptz,
    updated_at timestamptz not null default now()
);

create table if not exists public.account_recovery_codes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    code_hash text not null unique,
    created_at timestamptz not null default now(),
    used_at timestamptz
);

create index if not exists login_approval_user_created_idx
    on public.login_approval_requests (user_id, created_at desc);

create index if not exists login_approval_pending_expiry_idx
    on public.login_approval_requests (status, expires_at);

create index if not exists approved_sessions_user_idx
    on public.approved_sessions (user_id, expires_at);

create index if not exists trusted_devices_user_idx
    on public.trusted_devices (user_id, expires_at);

alter table public.login_approval_requests enable row level security;
alter table public.approved_sessions enable row level security;
alter table public.trusted_devices enable row level security;
alter table public.login_security_state enable row level security;
alter table public.account_recovery_codes enable row level security;

revoke all on table public.login_approval_requests from anon, authenticated;
revoke all on table public.approved_sessions from anon, authenticated;
revoke all on table public.trusted_devices from anon, authenticated;
revoke all on table public.login_security_state from anon, authenticated;
revoke all on table public.account_recovery_codes from anon, authenticated;

grant select, insert, update, delete on table public.login_approval_requests to service_role;
grant select, insert, update, delete on table public.approved_sessions to service_role;
grant select, insert, update, delete on table public.trusted_devices to service_role;
grant select, insert, update, delete on table public.login_security_state to service_role;
grant select, insert, update, delete on table public.account_recovery_codes to service_role;

create or replace function public.medtrack_has_approved_session()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.approved_sessions approved
        join auth.sessions active_session
          on active_session.id = approved.session_id
         and active_session.user_id = approved.user_id
        where approved.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
          and approved.user_id = auth.uid()
          and approved.revoked_at is null
          and approved.expires_at > now()
    );
$$;

create or replace function public.medtrack_is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select public.medtrack_has_approved_session()
       and exists (
            select 1
            from public.profiles
            where id = auth.uid()
              and status = 'active'
              and role in ('admin', 'staff')
       );
$$;

create or replace function public.medtrack_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select public.medtrack_has_approved_session()
       and exists (
            select 1
            from public.profiles
            where id = auth.uid()
              and status = 'active'
              and role = 'admin'
       );
$$;

revoke all on function public.medtrack_has_approved_session() from public;
revoke all on function public.medtrack_is_active_user() from public;
revoke all on function public.medtrack_is_admin() from public;
grant execute on function public.medtrack_has_approved_session() to authenticated;
grant execute on function public.medtrack_is_active_user() to authenticated;
grant execute on function public.medtrack_is_admin() to authenticated;

drop policy if exists "Users can read their own profile" on public.profiles;

create policy "Approved users can read their own profile"
on public.profiles for select to authenticated
using (id = auth.uid() and public.medtrack_has_approved_session());

create or replace function public.medtrack_require_approved_session()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if auth.role() = 'authenticated' and not public.medtrack_has_approved_session() then
        raise exception 'Email-approved login session is required.' using errcode = '42501';
    end if;

    if tg_op = 'DELETE' then
        return old;
    end if;

    return new;
end;
$$;

revoke all on function public.medtrack_require_approved_session() from public;

do $$
declare
    protected_table text;
begin
    foreach protected_table in array array[
        'profiles',
        'medical_supplies',
        'medical_equipment',
        'mobility_assets',
        'borrow_transactions',
        'emergency_requests',
        'medical_supply_transactions'
    ]
    loop
        if to_regclass('public.' || protected_table) is not null then
            execute format(
                'drop trigger if exists medtrack_require_approved_session on public.%I',
                protected_table
            );
            execute format(
                'create trigger medtrack_require_approved_session before insert or update or delete on public.%I for each row execute function public.medtrack_require_approved_session()',
                protected_table
            );
        end if;
    end loop;
end
$$;

create or replace function public.medtrack_login_security_check(p_email_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    current_state public.login_security_state%rowtype;
begin
    select * into current_state
    from public.login_security_state
    where email_hash = p_email_hash;

    if not found or current_state.locked_until is null or current_state.locked_until <= now() then
        return jsonb_build_object('allowed', true, 'retryAfter', 0);
    end if;

    return jsonb_build_object(
        'allowed', false,
        'retryAfter', greatest(1, ceil(extract(epoch from current_state.locked_until - now())))::integer
    );
end;
$$;

create or replace function public.medtrack_login_security_failure(p_email_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    current_state public.login_security_state%rowtype;
    next_count integer;
    next_window timestamptz;
    next_lock timestamptz;
begin
    insert into public.login_security_state (email_hash)
    values (p_email_hash)
    on conflict (email_hash) do nothing;

    select * into current_state
    from public.login_security_state
    where email_hash = p_email_hash
    for update;

    if current_state.window_started_at <= now() - interval '15 minutes' then
        next_count := 1;
        next_window := now();
    else
        next_count := current_state.failed_count + 1;
        next_window := current_state.window_started_at;
    end if;

    next_lock := case
        when next_count >= 10 then now() + interval '1 hour'
        when next_count >= 5 then now() + interval '15 minutes'
        else null
    end;

    update public.login_security_state
    set failed_count = next_count,
        window_started_at = next_window,
        locked_until = next_lock,
        updated_at = now()
    where email_hash = p_email_hash;

    return jsonb_build_object(
        'failedCount', next_count,
        'locked', next_lock is not null,
        'retryAfter', case
            when next_lock is null then 0
            else greatest(1, ceil(extract(epoch from next_lock - now())))::integer
        end
    );
end;
$$;

create or replace function public.medtrack_login_security_success(p_email_hash text)
returns void
language sql
security definer
set search_path = ''
as $$
    delete from public.login_security_state where email_hash = p_email_hash;
$$;

create or replace function public.medtrack_claim_login_approval(
    p_request_id uuid,
    p_browser_secret_hash text
)
returns setof public.login_approval_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    return query
    update public.login_approval_requests
    set status = 'finalizing'
    where id = p_request_id
      and browser_secret_hash = p_browser_secret_hash
      and status = 'approved'
      and expires_at > now()
    returning *;
end;
$$;

create or replace function public.medtrack_revoke_current_approved_session()
returns void
language sql
security definer
set search_path = ''
as $$
    update public.approved_sessions
    set revoked_at = now()
    where session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
      and user_id = auth.uid()
      and revoked_at is null;
$$;

revoke all on function public.medtrack_login_security_check(text) from public;
revoke all on function public.medtrack_login_security_failure(text) from public;
revoke all on function public.medtrack_login_security_success(text) from public;
revoke all on function public.medtrack_claim_login_approval(uuid, text) from public;
revoke all on function public.medtrack_revoke_current_approved_session() from public;
grant execute on function public.medtrack_login_security_check(text) to service_role;
grant execute on function public.medtrack_login_security_failure(text) to service_role;
grant execute on function public.medtrack_login_security_success(text) to service_role;
grant execute on function public.medtrack_claim_login_approval(uuid, text) to service_role;
grant execute on function public.medtrack_revoke_current_approved_session() to authenticated;

notify pgrst, 'reload schema';

grant execute on function public.medtrack_login_security_check(text) to service_role;
grant execute on function public.medtrack_login_security_failure(text) to service_role;
grant execute on function public.medtrack_login_security_success(text) to service_role;
grant execute on function public.medtrack_claim_login_approval(uuid, text) to service_role;
grant execute on function public.medtrack_revoke_current_approved_session() to authenticated, service_role;

notify pgrst, 'reload schema';
