create or replace function public.medtrack_is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and status = 'active'
          and (
              role = 'staff'
              or (
                  role = 'admin'
                  and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
              )
          )
    );
$$;

create or replace function public.medtrack_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and status = 'active'
          and role = 'admin'
    ) and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

create or replace function public.medtrack_mfa_access_allowed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and status = 'active'
          and (
              role = 'staff'
              or (
                  role = 'admin'
                  and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
              )
          )
    );
$$;

revoke all on function public.medtrack_mfa_access_allowed() from public;
grant execute on function public.medtrack_mfa_access_allowed() to authenticated;

do $$
declare
    protected_table text;
begin
    foreach protected_table in array array[
        'medical_supplies',
        'medical_equipment',
        'mobility_assets',
        'borrow_transactions',
        'emergency_requests',
        'medical_supply_transactions',
        'asset_status_history',
        'inventory_activity_events',
        'audit_events'
    ]
    loop
        execute format(
            'drop policy if exists "Admin MFA is required" on public.%I',
            protected_table
        );
        execute format(
            'create policy "Admin MFA is required" on public.%I as restrictive for all to authenticated using (public.medtrack_mfa_access_allowed()) with check (public.medtrack_mfa_access_allowed())',
            protected_table
        );
    end loop;
end
$$;

create or replace function public.medtrack_record_mfa_event(p_action text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    normalized_action text := trim(coalesce(p_action, ''));
begin
    if not exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and role = 'admin'
          and status = 'active'
          and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    ) then
        raise exception 'Administrator access is required.'
            using errcode = '42501';
    end if;

    if normalized_action not in ('MFA Enrolled', 'MFA Verified') then
        raise exception 'Unsupported MFA audit action.';
    end if;

    insert into public.audit_events (
        actor_id,
        action,
        module,
        entity_type,
        entity_id,
        details,
        metadata
    ) values (
        auth.uid(),
        normalized_action,
        'Authentication',
        'mfa_factor',
        auth.uid()::text,
        case normalized_action
            when 'MFA Enrolled' then 'Enabled an authenticator for the Administrator account.'
            else 'Completed Administrator multi-factor authentication.'
        end,
        jsonb_build_object(
            'authenticatorLevel', coalesce(auth.jwt() ->> 'aal', 'aal1')
        )
    );
end;
$$;

revoke all on function public.medtrack_record_mfa_event(text) from public;
grant execute on function public.medtrack_record_mfa_event(text) to authenticated;

notify pgrst, 'reload schema';
