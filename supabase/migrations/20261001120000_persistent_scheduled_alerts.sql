begin;

create table if not exists public.system_alerts (
    alert_key text primary key,
    alert_type text not null check (alert_type in (
        'low_stock', 'out_of_stock', 'expiring_supply', 'expired_supply',
        'service_due', 'service_overdue', 'borrow_overdue'
    )),
    inventory_module text not null,
    inventory_item_id text not null,
    title text not null,
    message text not null,
    status text not null,
    due_date date,
    active boolean not null default true,
    first_detected_at timestamptz not null default now(),
    last_detected_at timestamptz not null default now(),
    resolved_at timestamptz,
    metadata jsonb not null default '{}'::jsonb,
    constraint system_alerts_metadata_object
        check (jsonb_typeof(metadata) = 'object'),
    constraint system_alerts_key_length
        check (char_length(alert_key) between 3 and 300)
);

create table if not exists public.system_alert_job_runs (
    id bigint generated always as identity primary key,
    job_name text not null,
    started_at timestamptz not null default now(),
    completed_at timestamptz,
    status text not null check (status in ('running', 'completed', 'failed')),
    active_alert_count integer not null default 0 check (active_alert_count >= 0),
    error_message text
);

create index if not exists system_alerts_active_detected_idx
on public.system_alerts (active, last_detected_at desc);

create index if not exists system_alerts_module_status_idx
on public.system_alerts (inventory_module, status, active);

create index if not exists system_alert_job_runs_started_idx
on public.system_alert_job_runs (started_at desc);

create index if not exists medical_supplies_expiration_idx
on public.medical_supplies (expiration_date)
where expiration_date is not null;

create index if not exists medical_supplies_stock_idx
on public.medical_supplies (quantity, low_stock_level);

create index if not exists medical_equipment_service_idx
on public.medical_equipment (maintenance_date)
where maintenance_date is not null;

alter table public.system_alerts enable row level security;
alter table public.system_alert_job_runs enable row level security;

revoke all on table public.system_alerts from anon, authenticated;
revoke all on table public.system_alert_job_runs from anon, authenticated;
grant select on table public.system_alerts to authenticated;
grant select on table public.system_alert_job_runs to authenticated;
grant select, insert, update, delete on table public.system_alerts to service_role;
grant select, insert, update, delete on table public.system_alert_job_runs to service_role;
grant usage, select on sequence public.system_alert_job_runs_id_seq to service_role;

drop policy if exists "Active users can read system alerts"
on public.system_alerts;
create policy "Active users can read system alerts"
on public.system_alerts for select to authenticated
using (public.medtrack_is_active_user());

drop policy if exists "Verified admins can read alert job runs"
on public.system_alert_job_runs;
create policy "Verified admins can read alert job runs"
on public.system_alert_job_runs for select to authenticated
using (public.medtrack_is_admin());

create or replace function public.medtrack_refresh_system_alerts()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_run_id bigint;
    v_alert_count integer := 0;
begin
    insert into public.system_alert_job_runs (job_name, status)
    values ('medtrack-system-alert-refresh', 'running')
    returning id into v_run_id;

    begin
    update public.system_alerts
    set active = false,
        resolved_at = coalesce(resolved_at, now())
    where active;

    insert into public.system_alerts (
        alert_key, alert_type, inventory_module, inventory_item_id,
        title, message, status, due_date, active, last_detected_at,
        resolved_at, metadata
    )
    select
        source.alert_key, source.alert_type, source.inventory_module,
        source.inventory_item_id, source.title, source.message,
        source.status, source.due_date, true, now(), null, source.metadata
    from (
        select
            'out-of-stock:' || supply.id as alert_key,
            'out_of_stock' as alert_type,
            'medical_supplies' as inventory_module,
            supply.id as inventory_item_id,
            'Out of stock' as title,
            supply.name || ' has no ' || supply.unit || ' remaining.' as message,
            'Out of stock' as status,
            null::date as due_date,
            jsonb_build_object('itemName', supply.name, 'quantity', supply.quantity) as metadata
        from public.medical_supplies supply
        where supply.quantity <= 0

        union all

        select
            'low-stock:' || supply.id,
            'low_stock', 'medical_supplies', supply.id, 'Low stock',
            supply.name || ' has ' || supply.quantity || ' ' || supply.unit ||
                ' remaining (minimum ' || supply.low_stock_level || ').',
            'Low stock', null::date,
            jsonb_build_object('itemName', supply.name, 'quantity', supply.quantity,
                'minimum', supply.low_stock_level)
        from public.medical_supplies supply
        where supply.quantity > 0
          and supply.quantity <= supply.low_stock_level

        union all

        select
            'near-expiry:' || supply.id || ':' || supply.expiration_date,
            'expiring_supply', 'medical_supplies', supply.id,
            'Supply near expiry',
            supply.name || ' expires on ' || to_char(supply.expiration_date, 'Mon DD, YYYY') || '.',
            'Near Expiry', supply.expiration_date,
            jsonb_build_object('itemName', supply.name,
                'expirationDate', supply.expiration_date)
        from public.medical_supplies supply
        where supply.expiration_date between current_date and current_date + 30

        union all

        select
            'expired:' || supply.id,
            'expired_supply', 'medical_supplies', supply.id,
            'Expired supply',
            supply.name || ' expired on ' || to_char(supply.expiration_date, 'Mon DD, YYYY') || '.',
            'Expired', supply.expiration_date,
            jsonb_build_object('itemName', supply.name,
                'expirationDate', supply.expiration_date)
        from public.medical_supplies supply
        where supply.expiration_date < current_date

        union all

        select
            'service-overdue:' || equipment.id || ':' || equipment.maintenance_date,
            'service_overdue', 'medical_equipment', equipment.id,
            'Inspection/service overdue',
            equipment.name || ' was scheduled for ' ||
                to_char(equipment.maintenance_date, 'Mon DD, YYYY') || '.',
            'Service overdue', equipment.maintenance_date,
            jsonb_build_object('itemName', equipment.name,
                'maintenanceType', equipment.maintenance_type)
        from public.medical_equipment equipment
        where equipment.maintenance_date < current_date
          and equipment.maintenance_type <> 'Not required'

        union all

        select
            'service-due:' || equipment.id || ':' || equipment.maintenance_date,
            'service_due', 'medical_equipment', equipment.id,
            'Inspection/service approaching',
            equipment.name || ' is scheduled for ' ||
                to_char(equipment.maintenance_date, 'Mon DD, YYYY') || '.',
            'Service due', equipment.maintenance_date,
            jsonb_build_object('itemName', equipment.name,
                'maintenanceType', equipment.maintenance_type)
        from public.medical_equipment equipment
        where equipment.maintenance_date between current_date and current_date + 14
          and equipment.maintenance_type <> 'Not required'

        union all

        select
            'overdue:' || transaction.id,
            'borrow_overdue', 'borrow_transactions', transaction.id,
            'Overdue item',
            transaction.item_name || ', borrowed by ' || transaction.borrower ||
                ', was due ' || to_char(transaction.due_date, 'Mon DD, YYYY') || '.',
            'Overdue', transaction.due_date,
            jsonb_build_object('itemName', transaction.item_name,
                'borrower', transaction.borrower)
        from public.borrow_transactions transaction
        where transaction.return_date is null
          and transaction.due_date < current_date
          and lower(transaction.status) not in ('returned', 'cancelled')
    ) source
    on conflict (alert_key) do update
    set alert_type = excluded.alert_type,
        inventory_module = excluded.inventory_module,
        inventory_item_id = excluded.inventory_item_id,
        title = excluded.title,
        message = excluded.message,
        status = excluded.status,
        due_date = excluded.due_date,
        active = true,
        last_detected_at = now(),
        resolved_at = null,
        metadata = excluded.metadata;

    select count(*) into v_alert_count
    from public.system_alerts
    where active;

    update public.system_alert_job_runs
    set completed_at = now(),
        status = 'completed',
        active_alert_count = v_alert_count
    where id = v_run_id;

    return v_alert_count;
exception when others then
    update public.system_alert_job_runs
    set completed_at = now(),
        status = 'failed',
        error_message = left(sqlerrm, 500)
    where id = v_run_id;
    return -1;
    end;
end;
$$;

revoke all on function public.medtrack_refresh_system_alerts() from public;
grant execute on function public.medtrack_refresh_system_alerts() to service_role;

do $$
declare
    existing_job bigint;
begin
    if exists (select 1 from pg_extension where extname = 'pg_cron') then
        select jobid into existing_job
        from cron.job
        where jobname = 'medtrack-system-alert-refresh';

        if existing_job is not null then
            perform cron.unschedule(existing_job);
        end if;

        perform cron.schedule(
            'medtrack-system-alert-refresh',
            '15 * * * *',
            'select public.medtrack_refresh_system_alerts();'
        );
    end if;
end
$$;

select public.medtrack_refresh_system_alerts();

commit;
