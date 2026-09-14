begin;

create table if not exists public.inventory_cleanup_runs (
    id uuid primary key,
    reason text not null,
    status text not null default 'backed_up',
    pre_cleanup_counts jsonb not null default '{}'::jsonb,
    candidate_counts jsonb not null default '{}'::jsonb,
    deleted_counts jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    completed_at timestamptz,
    constraint inventory_cleanup_runs_status_check
        check (status in ('backed_up', 'completed', 'failed'))
);

create table if not exists public.inventory_cleanup_backup_rows (
    run_id uuid not null references public.inventory_cleanup_runs(id),
    source_table text not null,
    source_id text not null,
    row_data jsonb not null,
    backed_up_at timestamptz not null default now(),
    primary key (run_id, source_table, source_id),
    constraint inventory_cleanup_backup_table_check
        check (source_table in (
            'medical_supplies', 'medical_equipment', 'mobility_assets',
            'medical_supply_transactions', 'borrow_transactions',
            'emergency_requests', 'inventory_import_batches',
            'inventory_import_rows', 'audit_events'
        )),
    constraint inventory_cleanup_backup_json_check
        check (jsonb_typeof(row_data) = 'object')
);

create table if not exists public.inventory_cleanup_candidates (
    run_id uuid not null references public.inventory_cleanup_runs(id),
    source_table text not null,
    source_id text not null,
    reason text not null,
    row_data jsonb not null,
    deleted_at timestamptz,
    primary key (run_id, source_table, source_id)
);

alter table public.inventory_cleanup_runs enable row level security;
alter table public.inventory_cleanup_backup_rows enable row level security;
alter table public.inventory_cleanup_candidates enable row level security;

revoke all on table public.inventory_cleanup_runs from anon, authenticated;
revoke all on table public.inventory_cleanup_backup_rows from anon, authenticated;
revoke all on table public.inventory_cleanup_candidates from anon, authenticated;
grant select on table public.inventory_cleanup_runs to authenticated;
grant select on table public.inventory_cleanup_backup_rows to authenticated;
grant select on table public.inventory_cleanup_candidates to authenticated;
grant select, insert, update on table public.inventory_cleanup_runs to service_role;
grant select, insert, update on table public.inventory_cleanup_backup_rows to service_role;
grant select, insert, update on table public.inventory_cleanup_candidates to service_role;

drop policy if exists "Admins can read inventory cleanup runs"
on public.inventory_cleanup_runs;
create policy "Admins can read inventory cleanup runs"
on public.inventory_cleanup_runs for select to authenticated
using (public.medtrack_is_admin());

drop policy if exists "Admins can read inventory cleanup backups"
on public.inventory_cleanup_backup_rows;
create policy "Admins can read inventory cleanup backups"
on public.inventory_cleanup_backup_rows for select to authenticated
using (public.medtrack_is_admin());

drop policy if exists "Admins can read inventory cleanup candidates"
on public.inventory_cleanup_candidates;
create policy "Admins can read inventory cleanup candidates"
on public.inventory_cleanup_candidates for select to authenticated
using (public.medtrack_is_admin());

insert into public.inventory_cleanup_runs (
    id, reason, status, pre_cleanup_counts
) values (
    '20260914-0000-4000-8000-000000000003'::uuid,
    'Remove source-unlinked exact frontend demo inventory after full backup.',
    'backed_up',
    jsonb_build_object(
        'medical_supplies', (select count(*) from public.medical_supplies),
        'medical_equipment', (select count(*) from public.medical_equipment),
        'mobility_assets', (select count(*) from public.mobility_assets)
    )
) on conflict (id) do nothing;

insert into public.inventory_cleanup_backup_rows (
    run_id, source_table, source_id, row_data
)
select '20260914-0000-4000-8000-000000000003'::uuid,
       'medical_supplies', id, to_jsonb(item)
from public.medical_supplies item
on conflict do nothing;

insert into public.inventory_cleanup_backup_rows (
    run_id, source_table, source_id, row_data
)
select '20260914-0000-4000-8000-000000000003'::uuid,
       'medical_equipment', id, to_jsonb(item)
from public.medical_equipment item
on conflict do nothing;

insert into public.inventory_cleanup_backup_rows (
    run_id, source_table, source_id, row_data
)
select '20260914-0000-4000-8000-000000000003'::uuid,
       'mobility_assets', id, to_jsonb(item)
from public.mobility_assets item
on conflict do nothing;

insert into public.inventory_cleanup_backup_rows (
    run_id, source_table, source_id, row_data
)
select '20260914-0000-4000-8000-000000000003'::uuid,
       'medical_supply_transactions', id::text, to_jsonb(item)
from public.medical_supply_transactions item
on conflict do nothing;

insert into public.inventory_cleanup_backup_rows (
    run_id, source_table, source_id, row_data
)
select '20260914-0000-4000-8000-000000000003'::uuid,
       'borrow_transactions', id, to_jsonb(item)
from public.borrow_transactions item
on conflict do nothing;

insert into public.inventory_cleanup_backup_rows (
    run_id, source_table, source_id, row_data
)
select '20260914-0000-4000-8000-000000000003'::uuid,
       'emergency_requests', id, to_jsonb(item)
from public.emergency_requests item
on conflict do nothing;

insert into public.inventory_cleanup_backup_rows (
    run_id, source_table, source_id, row_data
)
select '20260914-0000-4000-8000-000000000003'::uuid,
       'inventory_import_batches', id::text, to_jsonb(item)
from public.inventory_import_batches item
on conflict do nothing;

insert into public.inventory_cleanup_backup_rows (
    run_id, source_table, source_id, row_data
)
select '20260914-0000-4000-8000-000000000003'::uuid,
       'inventory_import_rows', id::text, to_jsonb(item)
from public.inventory_import_rows item
on conflict do nothing;

insert into public.inventory_cleanup_backup_rows (
    run_id, source_table, source_id, row_data
)
select '20260914-0000-4000-8000-000000000003'::uuid,
       'audit_events', id::text, to_jsonb(item)
from public.audit_events item
on conflict do nothing;

insert into public.inventory_cleanup_candidates (
    run_id, source_table, source_id, reason, row_data
)
select
    '20260914-0000-4000-8000-000000000003'::uuid,
    'medical_supplies', item.id,
    'Exact frontend demo signature; not source-linked or transaction-referenced.',
    to_jsonb(item)
from public.medical_supplies item
join (values
    ('MED-001', 'First Aid Kit', 'First Aid', 4, 'Sets', '2027-06-15'::date, 10),
    ('MED-002', 'Medical Gloves', 'Protective Equipment', 35, 'Boxes', '2026-07-10'::date, 10),
    ('MED-003', 'Paracetamol', 'Medicine', 80, 'Boxes', '2027-08-20'::date, 20),
    ('MED-004', 'Face Masks', 'Protective Equipment', 100, 'Boxes', '2028-01-12'::date, 20)
) demo(id, name, category, quantity, unit, expiration_date, low_stock_level)
  on item.id = demo.id
 and item.name = demo.name
 and item.category = demo.category
 and item.quantity = demo.quantity
 and item.unit = demo.unit
 and item.expiration_date = demo.expiration_date
 and item.low_stock_level = demo.low_stock_level
where not exists (
        select 1 from public.inventory_import_rows imported
        where imported.target_table = 'medical_supplies'
          and imported.target_id = item.id
    )
  and not exists (
        select 1 from public.medical_supply_transactions transaction
        where transaction.supply_id = item.id
          and transaction.operation_key <> 'OPENING:' || item.id
    )
  and not exists (
        select 1 from public.emergency_requests request
        where coalesce(request.inventory_usage, '{}'::jsonb)::text ilike
              '%' || item.id || '%'
    )
on conflict do nothing;

insert into public.inventory_cleanup_candidates (
    run_id, source_table, source_id, reason, row_data
)
select
    '20260914-0000-4000-8000-000000000003'::uuid,
    'medical_equipment', item.id,
    'Exact frontend demo signature; not source-linked or transaction-referenced.',
    to_jsonb(item)
from public.medical_equipment item
join (values
    ('EQP-001', 'Portable Oxygen Tank', 'Life Support', 5, 'Good', 'Equipment Room A', '2027-01-15'::date, 'Available'),
    ('EQP-002', 'Blood Pressure Monitor', 'Monitoring', 8, 'Excellent', 'Medical Storage Room', '2027-03-20'::date, 'Available'),
    ('EQP-003', 'Portable Generator', 'Emergency', 2, 'Fair', 'Emergency Warehouse', '2026-07-10'::date, 'Maintenance'),
    ('EQP-004', 'Wheelchair', 'Transport', 4, 'Good', 'Equipment Room B', '2027-05-12'::date, 'In Use')
) demo(id, name, category, quantity, condition, location, maintenance_date, status)
  on item.id = demo.id
 and item.name = demo.name
 and item.category = demo.category
 and item.quantity = demo.quantity
 and item.condition = demo.condition
 and item.location = demo.location
 and item.maintenance_date = demo.maintenance_date
 and item.status = demo.status
where not exists (
        select 1 from public.inventory_import_rows imported
        where imported.target_table = 'medical_equipment'
          and imported.target_id = item.id
    )
  and not exists (
        select 1 from public.borrow_transactions transaction
        where transaction.inventory_item_id = item.id
           or lower(trim(transaction.item_name)) = lower(trim(item.name))
    )
  and not exists (
        select 1 from public.emergency_requests request
        where coalesce(request.inventory_usage, '{}'::jsonb)::text ilike
              '%' || item.id || '%'
    )
on conflict do nothing;

insert into public.inventory_cleanup_candidates (
    run_id, source_table, source_id, reason, row_data
)
select
    '20260914-0000-4000-8000-000000000003'::uuid,
    'mobility_assets', item.id,
    'Exact frontend demo signature; not source-linked or transaction-referenced.',
    to_jsonb(item)
from public.mobility_assets item
join (values
    ('MOB-001', 'Rescue Ambulance 1', 'Ambulance', 'ABC-1234', 'Excellent', 'Juan Dela Cruz', 'PDRRMO Headquarters', '2027-02-15'::date, 'Available'),
    ('MOB-002', 'Emergency Rescue Truck', 'Rescue Vehicle', 'DEF-5678', 'Good', 'Pedro Santos', 'Response Station 1', '2027-01-10'::date, 'Deployed'),
    ('MOB-003', 'Command Vehicle', 'Command Vehicle', 'GHI-9012', 'Fair', 'Mario Reyes', 'Maintenance Area', '2026-07-20'::date, 'For Repair'),
    ('MOB-004', 'Service Motorcycle', 'Motorcycle', 'JKL-3456', 'Good', 'Antonio Garcia', 'PDRRMO Headquarters', '2027-04-08'::date, 'Available')
) demo(id, name, type, plate_number, condition, driver, location, maintenance_date, status)
  on item.id = demo.id
 and item.name = demo.name
 and item.type = demo.type
 and item.plate_number = demo.plate_number
 and item.condition = demo.condition
 and item.driver = demo.driver
 and item.location = demo.location
 and item.maintenance_date = demo.maintenance_date
 and item.status = demo.status
where not exists (
        select 1 from public.inventory_import_rows imported
        where imported.target_table = 'mobility_assets'
          and imported.target_id = item.id
    )
  and not exists (
        select 1 from public.borrow_transactions transaction
        where transaction.inventory_item_id = item.id
           or lower(trim(transaction.item_name)) = lower(trim(item.name))
    )
  and not exists (
        select 1 from public.emergency_requests request
        where coalesce(request.inventory_usage, '{}'::jsonb)::text ilike
              '%' || item.id || '%'
    )
on conflict do nothing;

update public.inventory_cleanup_runs run
set candidate_counts = jsonb_build_object(
    'medical_supplies', (
        select count(*) from public.inventory_cleanup_candidates candidate
        where candidate.run_id = run.id
          and candidate.source_table = 'medical_supplies'
    ),
    'medical_equipment', (
        select count(*) from public.inventory_cleanup_candidates candidate
        where candidate.run_id = run.id
          and candidate.source_table = 'medical_equipment'
    ),
    'mobility_assets', (
        select count(*) from public.inventory_cleanup_candidates candidate
        where candidate.run_id = run.id
          and candidate.source_table = 'mobility_assets'
    )
)
where run.id = '20260914-0000-4000-8000-000000000003'::uuid;

delete from public.medical_supply_transactions transaction
using public.inventory_cleanup_candidates candidate
where candidate.run_id = '20260914-0000-4000-8000-000000000003'::uuid
  and candidate.source_table = 'medical_supplies'
  and candidate.source_id = transaction.supply_id
  and transaction.operation_key = 'OPENING:' || candidate.source_id;

delete from public.medical_supplies item
using public.inventory_cleanup_candidates candidate
where candidate.run_id = '20260914-0000-4000-8000-000000000003'::uuid
  and candidate.source_table = 'medical_supplies'
  and candidate.source_id = item.id;

delete from public.medical_equipment item
using public.inventory_cleanup_candidates candidate
where candidate.run_id = '20260914-0000-4000-8000-000000000003'::uuid
  and candidate.source_table = 'medical_equipment'
  and candidate.source_id = item.id;

delete from public.mobility_assets item
using public.inventory_cleanup_candidates candidate
where candidate.run_id = '20260914-0000-4000-8000-000000000003'::uuid
  and candidate.source_table = 'mobility_assets'
  and candidate.source_id = item.id;

update public.inventory_cleanup_candidates
set deleted_at = now()
where run_id = '20260914-0000-4000-8000-000000000003'::uuid;

create table if not exists public.inventory_activity_events (
    id bigint generated always as identity primary key,
    event_key text not null unique,
    event_type text not null,
    inventory_module text not null,
    inventory_item_id text,
    quantity integer not null default 1 check (quantity > 0),
    previous_status text,
    new_status text,
    source_type text not null,
    source_id text,
    occurred_at timestamptz not null default now(),
    actor_id uuid,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    constraint inventory_activity_event_type_check check (event_type in (
        'supply_added', 'supply_consumed',
        'equipment_borrowed', 'equipment_returned',
        'mobility_assigned', 'mobility_deployed', 'mobility_returned',
        'item_missing', 'item_damaged', 'item_for_repair',
        'low_stock', 'expiring_supply'
    )),
    constraint inventory_activity_module_check check (inventory_module in (
        'medical_supplies', 'medical_equipment', 'mobility_assets'
    )),
    constraint inventory_activity_metadata_check
        check (jsonb_typeof(metadata) = 'object')
);

create index if not exists inventory_activity_occurred_type_idx
on public.inventory_activity_events (occurred_at desc, event_type);

create index if not exists inventory_activity_item_idx
on public.inventory_activity_events (inventory_module, inventory_item_id);

alter table public.inventory_activity_events enable row level security;
revoke all on table public.inventory_activity_events from anon, authenticated;
grant select on table public.inventory_activity_events to authenticated;
grant select, insert on table public.inventory_activity_events to service_role;

drop policy if exists "Admins can read inventory activity"
on public.inventory_activity_events;
create policy "Admins can read inventory activity"
on public.inventory_activity_events for select to authenticated
using (public.medtrack_is_admin());

create or replace function public.medtrack_record_supply_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    insert into public.inventory_activity_events (
        event_key, event_type, inventory_module, inventory_item_id,
        quantity, source_type, source_id, occurred_at, actor_id, metadata
    ) values (
        'supply-transaction:' || new.id,
        case new.transaction_type
            when 'added' then 'supply_added'
            else 'supply_consumed'
        end,
        'medical_supplies', new.supply_id, new.quantity,
        'medical_supply_transaction', new.id::text,
        new.occurred_at, new.created_by,
        jsonb_build_object(
            'supplyName', new.supply_name,
            'remainingStock', new.remaining_stock,
            'emergencyRequestId', new.emergency_request_id
        )
    ) on conflict (event_key) do nothing;
    return new;
end;
$$;

drop trigger if exists record_supply_activity
on public.medical_supply_transactions;
create trigger record_supply_activity
after insert on public.medical_supply_transactions
for each row execute function public.medtrack_record_supply_activity();

create or replace function public.medtrack_record_supply_alert_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_old_low boolean := false;
    v_old_expiring boolean := false;
    v_new_expiring boolean;
begin
    if tg_op = 'UPDATE' then
        v_old_low := old.quantity <= old.low_stock_level;
        v_old_expiring := old.expiration_date is not null
            and old.expiration_date >= current_date
            and old.expiration_date <= current_date + 30;
    end if;

    if new.quantity <= new.low_stock_level and not v_old_low then
        insert into public.inventory_activity_events (
            event_key, event_type, inventory_module, inventory_item_id,
            quantity, source_type, source_id, occurred_at, actor_id, metadata
        ) values (
            'supply-low:' || new.id || ':' || extract(epoch from new.updated_at)::text,
            'low_stock', 'medical_supplies', new.id, 1,
            'medical_supply', new.id, new.updated_at, auth.uid(),
            jsonb_build_object(
                'name', new.name,
                'quantity', new.quantity,
                'lowStockLevel', new.low_stock_level
            )
        ) on conflict (event_key) do nothing;
    end if;

    v_new_expiring := new.expiration_date is not null
        and new.expiration_date >= current_date
        and new.expiration_date <= current_date + 30;

    if v_new_expiring and not v_old_expiring then
        insert into public.inventory_activity_events (
            event_key, event_type, inventory_module, inventory_item_id,
            quantity, source_type, source_id, occurred_at, actor_id, metadata
        ) values (
            'supply-expiring:' || new.id || ':' || extract(epoch from new.updated_at)::text,
            'expiring_supply', 'medical_supplies', new.id, 1,
            'medical_supply', new.id, new.updated_at, auth.uid(),
            jsonb_build_object(
                'name', new.name,
                'expirationDate', new.expiration_date
            )
        ) on conflict (event_key) do nothing;
    end if;

    return new;
end;
$$;

drop trigger if exists record_supply_alert_activity on public.medical_supplies;
create trigger record_supply_alert_activity
after insert or update of quantity, low_stock_level, expiration_date
on public.medical_supplies
for each row execute function public.medtrack_record_supply_alert_activity();

create or replace function public.medtrack_record_equipment_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if lower(new.condition) = 'damaged'
       and (tg_op = 'INSERT' or lower(old.condition) <> 'damaged') then
        insert into public.inventory_activity_events (
            event_key, event_type, inventory_module, inventory_item_id,
            quantity, previous_status, new_status, source_type,
            source_id, occurred_at, actor_id, metadata
        ) values (
            'equipment-damaged:' || new.id || ':' || extract(epoch from new.updated_at)::text,
            'item_damaged', 'medical_equipment', new.id,
            greatest(new.quantity, 1),
            case when tg_op = 'UPDATE' then old.condition end,
            new.condition, 'medical_equipment', new.id, new.updated_at,
            auth.uid(), jsonb_build_object('name', new.name)
        ) on conflict (event_key) do nothing;
    end if;

    if lower(new.status) in ('maintenance', 'for repair')
       and (tg_op = 'INSERT' or lower(old.status) not in ('maintenance', 'for repair')) then
        insert into public.inventory_activity_events (
            event_key, event_type, inventory_module, inventory_item_id,
            quantity, previous_status, new_status, source_type,
            source_id, occurred_at, actor_id, metadata
        ) values (
            'equipment-repair:' || new.id || ':' || extract(epoch from new.updated_at)::text,
            'item_for_repair', 'medical_equipment', new.id,
            greatest(new.quantity, 1),
            case when tg_op = 'UPDATE' then old.status end,
            new.status, 'medical_equipment', new.id, new.updated_at,
            auth.uid(), jsonb_build_object('name', new.name)
        ) on conflict (event_key) do nothing;
    end if;
    return new;
end;
$$;

drop trigger if exists record_equipment_activity on public.medical_equipment;
create trigger record_equipment_activity
after insert or update of condition, status on public.medical_equipment
for each row execute function public.medtrack_record_equipment_activity();

create or replace function public.medtrack_record_mobility_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_event_type text;
begin
    if tg_op = 'INSERT' or new.status is distinct from old.status then
        v_event_type := case lower(new.status)
            when 'assigned' then 'mobility_assigned'
            when 'deployed' then 'mobility_deployed'
            when 'for repair' then 'item_for_repair'
            when 'available' then case
                when tg_op = 'UPDATE'
                 and lower(old.status) in ('assigned', 'deployed')
                then 'mobility_returned'
            end
        end;

        if v_event_type is not null then
            insert into public.inventory_activity_events (
                event_key, event_type, inventory_module, inventory_item_id,
                quantity, previous_status, new_status, source_type,
                source_id, occurred_at, actor_id, metadata
            ) values (
                'mobility-status:' || new.id || ':' ||
                    extract(epoch from new.updated_at)::text || ':' || v_event_type,
                v_event_type, 'mobility_assets', new.id, 1,
                case when tg_op = 'UPDATE' then old.status end,
                new.status, 'mobility_asset', new.id, new.updated_at,
                auth.uid(), jsonb_build_object('name', new.name)
            ) on conflict (event_key) do nothing;
        end if;
    end if;

    if lower(new.condition) = 'damaged'
       and (tg_op = 'INSERT' or lower(old.condition) <> 'damaged') then
        insert into public.inventory_activity_events (
            event_key, event_type, inventory_module, inventory_item_id,
            quantity, previous_status, new_status, source_type,
            source_id, occurred_at, actor_id, metadata
        ) values (
            'mobility-damaged:' || new.id || ':' || extract(epoch from new.updated_at)::text,
            'item_damaged', 'mobility_assets', new.id, 1,
            case when tg_op = 'UPDATE' then old.condition end,
            new.condition, 'mobility_asset', new.id, new.updated_at,
            auth.uid(), jsonb_build_object('name', new.name)
        ) on conflict (event_key) do nothing;
    end if;
    return new;
end;
$$;

drop trigger if exists record_mobility_activity on public.mobility_assets;
create trigger record_mobility_activity
after insert or update of condition, status on public.mobility_assets
for each row execute function public.medtrack_record_mobility_activity();

create or replace function public.medtrack_record_borrow_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_event_type text;
begin
    if tg_op = 'INSERT' and new.item_type = 'Medical Equipment' then
        v_event_type := 'equipment_borrowed';
    elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
        v_event_type := case
            when new.item_type = 'Medical Equipment' and new.status = 'Returned'
                then 'equipment_returned'
            when new.item_type = 'Medical Equipment' and new.status = 'Borrowed'
                 and old.status = 'Returned' then 'equipment_borrowed'
            when new.status = 'Missing' then 'item_missing'
            when new.status = 'Damaged' then 'item_damaged'
            when new.status = 'For Repair' and new.item_type = 'Medical Equipment'
                then 'item_for_repair'
        end;
    end if;

    if v_event_type is not null then
        insert into public.inventory_activity_events (
            event_key, event_type, inventory_module, inventory_item_id,
            quantity, previous_status, new_status, source_type,
            source_id, occurred_at, actor_id, metadata
        ) values (
            'borrow-status:' || new.id || ':' || v_event_type || ':' ||
                extract(epoch from coalesce(new.updated_at, now()))::text,
            v_event_type,
            case new.item_type
                when 'Medical Equipment' then 'medical_equipment'
                else 'mobility_assets'
            end,
            new.inventory_item_id, greatest(new.quantity, 1),
            case when tg_op = 'UPDATE' then old.status end,
            new.status, 'borrow_transaction', new.id,
            case
                when tg_op = 'INSERT' then new.borrowed_at
                else coalesce(new.updated_at, now())
            end,
            auth.uid(),
            jsonb_build_object('itemName', new.item_name)
        ) on conflict (event_key) do nothing;
    end if;
    return new;
end;
$$;

drop trigger if exists record_borrow_activity on public.borrow_transactions;
create trigger record_borrow_activity
after insert or update of status on public.borrow_transactions
for each row execute function public.medtrack_record_borrow_activity();

insert into public.inventory_activity_events (
    event_key, event_type, inventory_module, inventory_item_id,
    quantity, source_type, source_id, occurred_at, actor_id, metadata
)
select
    'supply-transaction:' || transaction.id,
    case transaction.transaction_type
        when 'added' then 'supply_added'
        else 'supply_consumed'
    end,
    'medical_supplies', transaction.supply_id, transaction.quantity,
    'medical_supply_transaction', transaction.id::text,
    transaction.occurred_at, transaction.created_by,
    jsonb_build_object(
        'supplyName', transaction.supply_name,
        'remainingStock', transaction.remaining_stock,
        'backfilled', true
    )
from public.medical_supply_transactions transaction
on conflict (event_key) do nothing;

insert into public.inventory_activity_events (
    event_key, event_type, inventory_module, inventory_item_id,
    quantity, source_type, source_id, occurred_at, metadata
)
select
    'inventory-import-supply:' || imported.id,
    'supply_added', 'medical_supplies', imported.target_id,
    greatest((imported.normalized_record ->> 'quantity')::integer, 1),
    'inventory_import_row', imported.id::text,
    coalesce(batch.completed_at, imported.updated_at),
    jsonb_build_object(
        'sourceFile', batch.source_file,
        'sourceLocator', imported.source_locator,
        'backfilled', true
    )
from public.inventory_import_rows imported
join public.inventory_import_batches batch on batch.id = imported.batch_id
where imported.target_table = 'medical_supplies'
  and imported.validation_status = 'imported'
  and imported.target_id is not null
on conflict (event_key) do nothing;

insert into public.inventory_activity_events (
    event_key, event_type, inventory_module, inventory_item_id,
    quantity, previous_status, new_status, source_type,
    source_id, occurred_at, metadata
)
select
    'borrow-opening:' || transaction.id,
    case transaction.item_type
        when 'Medical Equipment' then 'equipment_borrowed'
        else 'mobility_deployed'
    end,
    case transaction.item_type
        when 'Medical Equipment' then 'medical_equipment'
        else 'mobility_assets'
    end,
    transaction.inventory_item_id, greatest(transaction.quantity, 1),
    null, 'Borrowed', 'borrow_transaction', transaction.id,
    transaction.borrowed_at,
    jsonb_build_object('itemName', transaction.item_name, 'backfilled', true)
from public.borrow_transactions transaction
where transaction.item_type in ('Medical Equipment', 'Mobility Asset')
on conflict (event_key) do nothing;

insert into public.inventory_activity_events (
    event_key, event_type, inventory_module, inventory_item_id,
    quantity, previous_status, new_status, source_type,
    source_id, occurred_at, metadata
)
select
    'borrow-return-opening:' || transaction.id,
    case transaction.item_type
        when 'Medical Equipment' then 'equipment_returned'
        else 'mobility_returned'
    end,
    case transaction.item_type
        when 'Medical Equipment' then 'medical_equipment'
        else 'mobility_assets'
    end,
    transaction.inventory_item_id, greatest(transaction.quantity, 1),
    'Borrowed', 'Returned', 'borrow_transaction', transaction.id,
    coalesce(transaction.updated_at,
        transaction.return_date::timestamp at time zone 'Asia/Manila'),
    jsonb_build_object(
        'itemName', transaction.item_name,
        'timestampPrecision', 'best_available',
        'backfilled', true
    )
from public.borrow_transactions transaction
where transaction.status = 'Returned'
on conflict (event_key) do nothing;

insert into public.inventory_activity_events (
    event_key, event_type, inventory_module, inventory_item_id,
    quantity, previous_status, new_status, source_type,
    source_id, occurred_at, metadata
)
select
    'borrow-issue-opening:' || transaction.id || ':' || lower(replace(transaction.status, ' ', '-')),
    case transaction.status
        when 'Missing' then 'item_missing'
        when 'Damaged' then 'item_damaged'
        else 'item_for_repair'
    end,
    case transaction.item_type
        when 'Medical Equipment' then 'medical_equipment'
        else 'mobility_assets'
    end,
    transaction.inventory_item_id, greatest(transaction.quantity, 1),
    'Borrowed', transaction.status, 'borrow_transaction', transaction.id,
    transaction.updated_at,
    jsonb_build_object('itemName', transaction.item_name, 'backfilled', true)
from public.borrow_transactions transaction
where transaction.status in ('Missing', 'Damaged', 'For Repair')
on conflict (event_key) do nothing;

insert into public.inventory_activity_events (
    event_key, event_type, inventory_module, inventory_item_id,
    quantity, previous_status, new_status, source_type,
    source_id, occurred_at, metadata
)
select
    'mobility-opening-status:' || asset.id || ':' || lower(replace(asset.status, ' ', '-')),
    case asset.status
        when 'Assigned' then 'mobility_assigned'
        when 'Deployed' then 'mobility_deployed'
        else 'item_for_repair'
    end,
    'mobility_assets', asset.id, 1, null, asset.status,
    'mobility_asset', asset.id, asset.updated_at,
    jsonb_build_object('name', asset.name, 'backfilled', true)
from public.mobility_assets asset
where asset.status in ('Assigned', 'Deployed', 'For Repair')
  and not exists (
      select 1 from public.inventory_activity_events existing
      where existing.inventory_module = 'mobility_assets'
        and existing.inventory_item_id = asset.id
        and existing.event_type = case asset.status
            when 'Assigned' then 'mobility_assigned'
            when 'Deployed' then 'mobility_deployed'
            else 'item_for_repair'
        end
  )
on conflict (event_key) do nothing;

insert into public.inventory_activity_events (
    event_key, event_type, inventory_module, inventory_item_id,
    quantity, source_type, source_id, occurred_at, metadata
)
select
    'supply-opening-low:' || supply.id,
    'low_stock', 'medical_supplies', supply.id, 1,
    'medical_supply', supply.id, supply.updated_at,
    jsonb_build_object(
        'name', supply.name,
        'quantity', supply.quantity,
        'lowStockLevel', supply.low_stock_level,
        'backfilled', true
    )
from public.medical_supplies supply
where supply.quantity <= supply.low_stock_level
on conflict (event_key) do nothing;

insert into public.inventory_activity_events (
    event_key, event_type, inventory_module, inventory_item_id,
    quantity, source_type, source_id, occurred_at, metadata
)
select
    'supply-opening-expiring:' || supply.id,
    'expiring_supply', 'medical_supplies', supply.id, 1,
    'medical_supply', supply.id, now(),
    jsonb_build_object(
        'name', supply.name,
        'expirationDate', supply.expiration_date,
        'windowDays', 30,
        'backfilled', true
    )
from public.medical_supplies supply
where supply.expiration_date between current_date and current_date + 30
on conflict (event_key) do nothing;

create or replace function public.medtrack_inventory_activity_trends(
    p_period text default 'week'
)
returns table (
    bucket_start date,
    bucket_label text,
    event_type text,
    metric_value bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_period text := lower(trim(coalesce(p_period, 'week')));
    v_today date := (now() at time zone 'Asia/Manila')::date;
    v_start date;
    v_count integer;
    v_step interval;
    v_format text;
begin
    if not public.medtrack_is_admin() then
        raise exception 'Administrator access is required.'
            using errcode = '42501';
    end if;

    case v_period
        when 'week' then
            v_start := v_today - 6;
            v_count := 7;
            v_step := interval '1 day';
            v_format := 'Mon DD';
        when 'month' then
            v_start := date_trunc('month', v_today)::date;
            v_count := extract(day from (
                date_trunc('month', v_today) + interval '1 month - 1 day'
            ))::integer;
            v_step := interval '1 day';
            v_format := 'DD';
        when 'year' then
            v_start := date_trunc('year', v_today)::date;
            v_count := 12;
            v_step := interval '1 month';
            v_format := 'Mon';
        else
            raise exception 'Period must be week, month, or year.';
    end case;

    return query
    with buckets as (
        select (v_start::timestamp + series.number * v_step)::date as starts_at
        from generate_series(0, v_count - 1) as series(number)
    ),
    event_types(event_name) as (values
        ('supply_added'), ('supply_consumed'),
        ('equipment_borrowed'), ('equipment_returned'),
        ('mobility_assigned'), ('mobility_deployed'),
        ('item_missing'), ('item_damaged'), ('item_for_repair'),
        ('low_stock'), ('expiring_supply')
    )
    select
        bucket.starts_at,
        to_char(bucket.starts_at, v_format),
        type.event_name,
        coalesce(sum(activity.quantity), 0)::bigint
    from buckets bucket
    cross join event_types type
    left join public.inventory_activity_events activity
      on activity.event_type = type.event_name
     and activity.occurred_at >=
         (bucket.starts_at::timestamp at time zone 'Asia/Manila')
     and activity.occurred_at <
         ((bucket.starts_at::timestamp + v_step) at time zone 'Asia/Manila')
    group by bucket.starts_at, type.event_name
    order by bucket.starts_at, type.event_name;
end;
$$;

revoke all on function public.medtrack_inventory_activity_trends(text)
from public;
grant execute on function public.medtrack_inventory_activity_trends(text)
to authenticated;

do $$
begin
    if exists (
        select 1 from pg_publication where pubname = 'supabase_realtime'
    ) and not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'inventory_activity_events'
    ) then
        alter publication supabase_realtime
            add table public.inventory_activity_events;
    end if;
end
$$;

update public.inventory_cleanup_runs run
set status = 'completed',
    deleted_counts = jsonb_build_object(
        'medical_supplies', (
            select count(*) from public.inventory_cleanup_candidates candidate
            where candidate.run_id = run.id
              and candidate.source_table = 'medical_supplies'
              and candidate.deleted_at is not null
        ),
        'medical_equipment', (
            select count(*) from public.inventory_cleanup_candidates candidate
            where candidate.run_id = run.id
              and candidate.source_table = 'medical_equipment'
              and candidate.deleted_at is not null
        ),
        'mobility_assets', (
            select count(*) from public.inventory_cleanup_candidates candidate
            where candidate.run_id = run.id
              and candidate.source_table = 'mobility_assets'
              and candidate.deleted_at is not null
        )
    ),
    completed_at = now()
where run.id = '20260914-0000-4000-8000-000000000003'::uuid;

insert into public.audit_events (
    actor_name, actor_role, action, module, entity_type,
    entity_id, details, metadata
)
select
    'System', 'system', 'Cleaned', 'Inventory Cleanup',
    'inventory_cleanup_run', run.id::text,
    'Backed up inventory and removed only verified source-unlinked frontend demo records.',
    jsonb_build_object(
        'preCleanupCounts', run.pre_cleanup_counts,
        'candidateCounts', run.candidate_counts,
        'deletedCounts', run.deleted_counts,
        'backupTable', 'inventory_cleanup_backup_rows'
    )
from public.inventory_cleanup_runs run
where run.id = '20260914-0000-4000-8000-000000000003'::uuid
  and not exists (
      select 1 from public.audit_events event
      where event.module = 'Inventory Cleanup'
        and event.entity_id = run.id::text
  );

notify pgrst, 'reload schema';

commit;
