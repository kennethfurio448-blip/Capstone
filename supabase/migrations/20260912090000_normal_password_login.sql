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

drop policy if exists "Approved users can read their own profile" on public.profiles;
drop policy if exists "Users can read their own profile" on public.profiles;

create policy "Users can read their own profile"
on public.profiles for select to authenticated
using (id = auth.uid());

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
        end if;
    end loop;
end
$$;

create or replace function public.medtrack_resolve_login_email(p_identifier text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
    select lower(profile.email)
    from public.profiles profile
    where profile.email is not null
      and (
          lower(profile.email) = lower(trim(p_identifier))
          or lower(profile.username) = lower(trim(p_identifier))
      )
    limit 1;
$$;

revoke all on function public.medtrack_resolve_login_email(text) from public;
grant execute on function public.medtrack_resolve_login_email(text) to service_role;

notify pgrst, 'reload schema';
