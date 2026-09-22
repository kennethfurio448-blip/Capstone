alter table public.emergency_requests
    add column if not exists priority text not null default 'Medium';

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'emergency_requests_priority_check'
          and conrelid = 'public.emergency_requests'::regclass
    ) then
        alter table public.emergency_requests
            add constraint emergency_requests_priority_check
            check (priority in ('Low', 'Medium', 'High', 'Critical')) not valid;
    end if;
end
$$;

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
        if to_regclass('public.' || protected_table) is not null then
            execute format(
                'drop policy if exists "Admin MFA is required" on public.%I',
                protected_table
            );
        end if;
    end loop;
end
$$;

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
    select exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and status = 'active'
          and role = 'admin'
    );
$$;

revoke all on function public.medtrack_is_active_user() from public;
revoke all on function public.medtrack_is_admin() from public;
grant execute on function public.medtrack_is_active_user() to authenticated;
grant execute on function public.medtrack_is_admin() to authenticated;

drop function if exists public.medtrack_record_mfa_event(text);
drop function if exists public.medtrack_mfa_access_allowed();

do $$
begin
    if to_regprocedure('public.medtrack_restore_encrypted_backup_without_priority(jsonb)') is null
       and to_regprocedure('public.medtrack_restore_encrypted_backup(jsonb)') is not null then
        alter function public.medtrack_restore_encrypted_backup(jsonb)
            rename to medtrack_restore_encrypted_backup_without_priority;
    end if;
end
$$;

revoke all on function public.medtrack_restore_encrypted_backup_without_priority(jsonb)
from public, authenticated;

create or replace function public.medtrack_restore_encrypted_backup(p_data jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if not public.medtrack_is_admin() then
        raise exception 'Administrator access is required.'
            using errcode = '42501';
    end if;

    perform public.medtrack_restore_encrypted_backup_without_priority(p_data);

    update public.emergency_requests request
    set priority = case
        when entry.value ->> 'priority' in ('Low', 'Medium', 'High', 'Critical')
            then entry.value ->> 'priority'
        else 'Medium'
    end
    from jsonb_array_elements(p_data -> 'medtrackEmergencyRequests') entry(value)
    where entry.value ->> 'id' = request.id;
end;
$$;

revoke all on function public.medtrack_restore_encrypted_backup(jsonb)
from public;

grant execute on function public.medtrack_restore_encrypted_backup(jsonb)
to authenticated;

notify pgrst, 'reload schema';
