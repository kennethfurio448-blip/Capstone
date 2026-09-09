-- Phase 1: establish the canonical core schema and enforce role-based access.
-- This migration is intentionally idempotent so it can safely strengthen an
-- existing MedTrack database while also documenting the required base tables.

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text not null,
    username text not null,
    email text,
    role text not null default 'staff',
    status text not null default 'active',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.medical_supplies (
    id text primary key,
    name text not null,
    category text not null,
    quantity integer not null default 0,
    unit text not null,
    expiration_date date,
    low_stock_level integer not null default 10,
    updated_at timestamptz not null default now()
);

create table if not exists public.medical_equipment (
    id text primary key,
    name text not null,
    category text not null,
    quantity integer not null default 0,
    condition text not null default 'Good',
    location text not null default 'Not specified',
    maintenance_date date,
    status text not null default 'Available',
    updated_at timestamptz not null default now()
);

create table if not exists public.mobility_assets (
    id text primary key,
    name text not null,
    type text not null,
    plate_number text,
    condition text not null default 'Good',
    driver text,
    location text not null default 'Not specified',
    maintenance_date date,
    status text not null default 'Available',
    updated_at timestamptz not null default now()
);

create table if not exists public.borrow_transactions (
    id text primary key,
    borrower text not null,
    department text not null,
    item_type text not null,
    item_name text not null,
    quantity integer not null default 1,
    borrow_date date not null,
    due_date date not null,
    return_date date,
    status text not null default 'Borrowed',
    purpose text not null,
    inventory_item_id text,
    inventory_adjusted boolean not null default false,
    inventory_returned boolean not null default false,
    updated_at timestamptz not null default now()
);

create table if not exists public.emergency_requests (
    id text primary key,
    request_date date not null,
    request_time time not null,
    type text not null,
    priority text not null default 'Medium',
    location text not null,
    contact_person text not null,
    contact_number text not null,
    assigned_team text not null default 'Unassigned',
    status text not null default 'Pending',
    resources text not null default 'Not specified',
    description text not null default 'No description',
    inventory_usage jsonb,
    inventory_deducted boolean not null default false,
    inventory_deducted_at timestamptz,
    completed_at timestamptz,
    updated_at timestamptz not null default now()
);

-- Add fields that may be missing from older manually-created databases.
alter table public.profiles
    add column if not exists email text,
    add column if not exists created_at timestamptz not null default now(),
    add column if not exists updated_at timestamptz not null default now();

-- New writes must satisfy these checks. NOT VALID avoids silently rewriting or
-- deleting legacy data; existing rows can be cleaned and validated separately.
do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'profiles_role_check'
          and conrelid = 'public.profiles'::regclass
    ) then
        alter table public.profiles add constraint profiles_role_check
            check (role in ('admin', 'staff')) not valid;
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'profiles_status_check'
          and conrelid = 'public.profiles'::regclass
    ) then
        alter table public.profiles add constraint profiles_status_check
            check (status in ('active', 'disabled')) not valid;
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'medical_supplies_quantity_check'
          and conrelid = 'public.medical_supplies'::regclass
    ) then
        alter table public.medical_supplies
            add constraint medical_supplies_quantity_check
            check (quantity >= 0) not valid;
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'medical_supplies_low_stock_check'
          and conrelid = 'public.medical_supplies'::regclass
    ) then
        alter table public.medical_supplies
            add constraint medical_supplies_low_stock_check
            check (low_stock_level >= 1) not valid;
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'medical_equipment_quantity_check'
          and conrelid = 'public.medical_equipment'::regclass
    ) then
        alter table public.medical_equipment
            add constraint medical_equipment_quantity_check
            check (quantity >= 0) not valid;
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'borrow_transactions_quantity_check'
          and conrelid = 'public.borrow_transactions'::regclass
    ) then
        alter table public.borrow_transactions
            add constraint borrow_transactions_quantity_check
            check (quantity > 0) not valid;
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'borrow_transactions_dates_check'
          and conrelid = 'public.borrow_transactions'::regclass
    ) then
        alter table public.borrow_transactions
            add constraint borrow_transactions_dates_check
            check (due_date >= borrow_date) not valid;
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'borrow_transactions_status_check'
          and conrelid = 'public.borrow_transactions'::regclass
    ) then
        alter table public.borrow_transactions
            add constraint borrow_transactions_status_check
            check (status in ('Borrowed', 'Returned', 'Missing', 'Damaged', 'For Repair')) not valid;
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'emergency_requests_priority_check'
          and conrelid = 'public.emergency_requests'::regclass
    ) then
        alter table public.emergency_requests
            add constraint emergency_requests_priority_check
            check (priority in ('Low', 'Medium', 'High', 'Critical')) not valid;
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'emergency_requests_status_check'
          and conrelid = 'public.emergency_requests'::regclass
    ) then
        alter table public.emergency_requests
            add constraint emergency_requests_status_check
            check (status in ('Pending', 'In Progress', 'Completed', 'Cancelled')) not valid;
    end if;
end
$$;

create unique index if not exists profiles_email_unique_idx
    on public.profiles (lower(email)) where email is not null;

create unique index if not exists profiles_username_unique_idx
    on public.profiles (lower(username));

create unique index if not exists mobility_assets_plate_unique_idx
    on public.mobility_assets (lower(plate_number))
    where plate_number is not null and trim(plate_number) <> '';

create index if not exists borrow_transactions_status_due_idx
    on public.borrow_transactions (status, due_date);

create index if not exists emergency_requests_status_date_idx
    on public.emergency_requests (status, request_date desc);

create or replace function public.medtrack_is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1 from public.profiles
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
        select 1 from public.profiles
        where id = auth.uid()
          and status = 'active'
          and role = 'admin'
    );
$$;

revoke all on function public.medtrack_is_active_user() from public;
revoke all on function public.medtrack_is_admin() from public;
grant execute on function public.medtrack_is_active_user() to authenticated;
grant execute on function public.medtrack_is_admin() to authenticated;

create or replace function public.medtrack_protect_last_active_admin()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    removes_active_admin boolean;
    active_admin_count integer;
begin
    if tg_op = 'DELETE' then
        removes_active_admin :=
            old.role = 'admin' and old.status = 'active';
    else
        removes_active_admin :=
            old.role = 'admin' and
            old.status = 'active' and
            (new.role <> 'admin' or new.status <> 'active');
    end if;

    if not removes_active_admin then
        if tg_op = 'DELETE' then
            return old;
        end if;
        return new;
    end if;

    perform pg_advisory_xact_lock(hashtext('medtrack-active-admin'));

    select count(*) into active_admin_count
    from public.profiles
    where role = 'admin'
      and status = 'active';

    if active_admin_count <= 1 then
        raise exception
            'The last active Administrator cannot be disabled, demoted, or deleted.'
            using errcode = '23514';
    end if;

    if tg_op = 'DELETE' then
        return old;
    end if;
    return new;
end;
$$;

drop trigger if exists protect_last_active_admin on public.profiles;

create trigger protect_last_active_admin
before update of role, status or delete
on public.profiles
for each row
execute function public.medtrack_protect_last_active_admin();

alter table public.profiles enable row level security;
alter table public.medical_supplies enable row level security;
alter table public.medical_equipment enable row level security;
alter table public.mobility_assets enable row level security;
alter table public.borrow_transactions enable row level security;
alter table public.emergency_requests enable row level security;

-- Remove existing browser-role policies on the core tables so permissive legacy
-- policies cannot accidentally override the canonical rules below.
do $$
declare
    policy_record record;
begin
    for policy_record in
        select schemaname, tablename, policyname
        from pg_policies
        where schemaname = 'public'
          and tablename in (
              'profiles',
              'medical_supplies',
              'medical_equipment',
              'mobility_assets',
              'borrow_transactions',
              'emergency_requests'
          )
    loop
        execute format(
            'drop policy if exists %I on %I.%I',
            policy_record.policyname,
            policy_record.schemaname,
            policy_record.tablename
        );
    end loop;
end
$$;

create policy "Users can read their own profile"
on public.profiles for select to authenticated
using (id = auth.uid());

create policy "Active users can read supplies"
on public.medical_supplies for select to authenticated
using (public.medtrack_is_active_user());

create policy "Admins can insert supplies"
on public.medical_supplies for insert to authenticated
with check (public.medtrack_is_admin());

create policy "Admins can update supplies"
on public.medical_supplies for update to authenticated
using (public.medtrack_is_admin())
with check (public.medtrack_is_admin());

create policy "Admins can delete supplies"
on public.medical_supplies for delete to authenticated
using (public.medtrack_is_admin());

create policy "Active users can read equipment"
on public.medical_equipment for select to authenticated
using (public.medtrack_is_active_user());

create policy "Admins can insert equipment"
on public.medical_equipment for insert to authenticated
with check (public.medtrack_is_admin());

create policy "Admins can update equipment"
on public.medical_equipment for update to authenticated
using (public.medtrack_is_admin())
with check (public.medtrack_is_admin());

create policy "Admins can delete equipment"
on public.medical_equipment for delete to authenticated
using (public.medtrack_is_admin());

create policy "Active users can read mobility"
on public.mobility_assets for select to authenticated
using (public.medtrack_is_active_user());

create policy "Admins can insert mobility"
on public.mobility_assets for insert to authenticated
with check (public.medtrack_is_admin());

create policy "Admins can update mobility"
on public.mobility_assets for update to authenticated
using (public.medtrack_is_admin())
with check (public.medtrack_is_admin());

create policy "Admins can delete mobility"
on public.mobility_assets for delete to authenticated
using (public.medtrack_is_admin());

create policy "Active users can read borrowing"
on public.borrow_transactions for select to authenticated
using (public.medtrack_is_active_user());

create policy "Active users can read emergencies"
on public.emergency_requests for select to authenticated
using (public.medtrack_is_active_user());

create policy "Active users can create emergencies"
on public.emergency_requests for insert to authenticated
with check (public.medtrack_is_active_user());

create policy "Active users can update emergencies"
on public.emergency_requests for update to authenticated
using (public.medtrack_is_active_user())
with check (public.medtrack_is_active_user());

create policy "Admins can delete emergencies"
on public.emergency_requests for delete to authenticated
using (public.medtrack_is_admin());

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.medical_supplies from anon, authenticated;
revoke all on table public.medical_equipment from anon, authenticated;
revoke all on table public.mobility_assets from anon, authenticated;
revoke all on table public.borrow_transactions from anon, authenticated;
revoke all on table public.emergency_requests from anon, authenticated;

grant select on table public.profiles to authenticated;
grant select, insert, update, delete on table public.medical_supplies to authenticated;
grant select, insert, update, delete on table public.medical_equipment to authenticated;
grant select, insert, update, delete on table public.mobility_assets to authenticated;
grant select on table public.borrow_transactions to authenticated;
grant select, insert, update, delete on table public.emergency_requests to authenticated;

grant select, insert, update, delete on table public.profiles to service_role;
grant select, insert, update, delete on table public.medical_supplies to service_role;
grant select, insert, update, delete on table public.medical_equipment to service_role;
grant select, insert, update, delete on table public.mobility_assets to service_role;
grant select, insert, update, delete on table public.borrow_transactions to service_role;
grant select, insert, update, delete on table public.emergency_requests to service_role;

-- Adding or editing inventory master data is an Administrator operation.
-- Staff retain access to the separate consumption RPC used by emergency work.
create or replace function public.medtrack_save_medical_supply(
    p_operation_key text,
    p_supply_id text,
    p_name text,
    p_category text,
    p_quantity integer,
    p_unit text,
    p_expiration_date date,
    p_low_stock_level integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_previous_quantity integer;
    v_added_quantity integer;
    v_claimed_operation text;
begin
    if not exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and status = 'active'
          and role = 'admin'
    ) then
        raise exception 'Administrator access is required.'
            using errcode = '42501';
    end if;

    if coalesce(trim(p_operation_key), '') = '' then
        raise exception 'An inventory operation key is required.';
    end if;

    if coalesce(trim(p_supply_id), '') = '' or
       coalesce(trim(p_name), '') = '' or
       coalesce(trim(p_category), '') = '' or
       coalesce(trim(p_unit), '') = '' then
        raise exception 'Complete supply information is required.';
    end if;

    if p_quantity is null or p_quantity < 0 then
        raise exception 'Quantity must be zero or greater.';
    end if;

    if p_low_stock_level is null or p_low_stock_level < 1 then
        raise exception 'Low-stock level must be at least 1.';
    end if;

    select quantity
    into v_previous_quantity
    from public.medical_supplies
    where id = p_supply_id
    for update;

    if found then
        if p_quantity < v_previous_quantity then
            raise exception
                'Use Consumed Supplies to reduce inventory stock.';
        end if;

        v_added_quantity := p_quantity - v_previous_quantity;
    else
        v_previous_quantity := 0;
        v_added_quantity := p_quantity;
    end if;

    if v_added_quantity > 0 then
        insert into public.medtrack_inventory_operations (
            operation_key,
            item_type,
            item_id,
            quantity,
            created_by
        ) values (
            p_operation_key,
            'Medical Supply Addition',
            p_supply_id,
            v_added_quantity,
            auth.uid()
        )
        on conflict (operation_key) do nothing
        returning operation_key into v_claimed_operation;

        if v_claimed_operation is null then
            return jsonb_build_object(
                'supplyId', p_supply_id,
                'quantityAdded', 0,
                'alreadyApplied', true
            );
        end if;
    end if;

    insert into public.medical_supplies (
        id,
        name,
        category,
        quantity,
        unit,
        expiration_date,
        low_stock_level,
        updated_at
    ) values (
        p_supply_id,
        trim(p_name),
        trim(p_category),
        p_quantity,
        trim(p_unit),
        p_expiration_date,
        p_low_stock_level,
        now()
    )
    on conflict (id) do update
    set name = excluded.name,
        category = excluded.category,
        quantity = excluded.quantity,
        unit = excluded.unit,
        expiration_date = excluded.expiration_date,
        low_stock_level = excluded.low_stock_level,
        updated_at = now();

    if v_added_quantity > 0 then
        insert into public.medical_supply_transactions (
            operation_key,
            transaction_type,
            supply_id,
            supply_name,
            unit,
            quantity,
            emergency_request_id,
            emergency_label,
            occurred_at,
            remaining_stock,
            created_by
        ) values (
            p_operation_key,
            'added',
            p_supply_id,
            trim(p_name),
            trim(p_unit),
            v_added_quantity,
            null,
            'Inventory addition',
            now(),
            p_quantity,
            auth.uid()
        );
    end if;

    return jsonb_build_object(
        'supplyId', p_supply_id,
        'quantityAdded', v_added_quantity,
        'remainingStock', p_quantity,
        'alreadyApplied', false
    );
end;
$$;

revoke all on function public.medtrack_save_medical_supply(
    text, text, text, text, integer, text, date, integer
) from public;

grant execute on function public.medtrack_save_medical_supply(
    text, text, text, text, integer, text, date, integer
) to authenticated;

notify pgrst, 'reload schema';
