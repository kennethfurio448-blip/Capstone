begin;

alter table public.inventory_activity_events
    drop constraint if exists inventory_activity_event_type_check;
alter table public.inventory_activity_events
    add constraint inventory_activity_event_type_check check (event_type in (
        'supply_added', 'supply_consumed',
        'equipment_borrowed', 'equipment_returned',
        'mobility_assigned', 'mobility_deployed', 'mobility_returned',
        'item_missing', 'item_damaged', 'item_overdue', 'item_for_repair',
        'low_stock', 'expiring_supply', 'expired_supply',
        'emergency_resource_used'
    ));

create or replace function public.medtrack_inventory_distribution()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if not public.medtrack_is_admin() then
        raise exception 'Administrator access is required.' using errcode = '42501';
    end if;
    return jsonb_build_object(
        'medical_supplies', (select count(*) from public.medical_supplies),
        'medical_equipment', (select count(*) from public.medical_equipment),
        'mobility_assets', (select count(*) from public.mobility_assets)
    );
end;
$$;
revoke all on function public.medtrack_inventory_distribution() from public;
grant execute on function public.medtrack_inventory_distribution() to authenticated;

create or replace function public.medtrack_record_emergency_resource_activity()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_usage jsonb; v_type text;
begin
    if new.inventory_deducted and new.inventory_usage is not null
       and (tg_op = 'INSERT' or not coalesce(old.inventory_deducted, false)) then
        v_usage := new.inventory_usage;
        v_type := coalesce(v_usage ->> 'itemType', 'Medical Supply');
        insert into public.inventory_activity_events (
            event_key, event_type, inventory_module, inventory_item_id,
            quantity, source_type, source_id, occurred_at, actor_id, metadata
        ) values (
            'emergency-resource:' || new.id,
            'emergency_resource_used',
            case v_type when 'Medical Equipment' then 'medical_equipment'
                        when 'Mobility Asset' then 'mobility_assets'
                        else 'medical_supplies' end,
            v_usage ->> 'itemId', greatest(coalesce((v_usage ->> 'quantity')::integer, 1), 1),
            'emergency_request', new.id,
            coalesce(new.inventory_deducted_at, new.updated_at), auth.uid(),
            jsonb_build_object('itemName', v_usage ->> 'itemName', 'requestType', new.type)
        ) on conflict (event_key) do nothing;
    end if;
    return new;
end;
$$;

drop trigger if exists record_emergency_resource_activity on public.emergency_requests;
create trigger record_emergency_resource_activity
after insert or update of inventory_deducted on public.emergency_requests
for each row execute function public.medtrack_record_emergency_resource_activity();

insert into public.inventory_activity_events (
    event_key, event_type, inventory_module, inventory_item_id,
    quantity, source_type, source_id, occurred_at, metadata
)
select 'emergency-resource:' || request.id, 'emergency_resource_used',
       case request.inventory_usage ->> 'itemType'
           when 'Medical Equipment' then 'medical_equipment'
           when 'Mobility Asset' then 'mobility_assets'
           else 'medical_supplies' end,
       request.inventory_usage ->> 'itemId',
       greatest(coalesce((request.inventory_usage ->> 'quantity')::integer, 1), 1),
       'emergency_request', request.id,
       coalesce(request.inventory_deducted_at, request.updated_at),
       jsonb_build_object('itemName', request.inventory_usage ->> 'itemName', 'backfilled', true)
from public.emergency_requests request
where request.inventory_deducted and request.inventory_usage is not null
on conflict (event_key) do nothing;

create or replace function public.medtrack_inventory_activity_trends(p_period text default 'week')
returns table (bucket_start date, bucket_label text, event_type text, metric_value bigint)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
    v_period text := lower(trim(coalesce(p_period, 'week')));
    v_today date := (now() at time zone 'Asia/Manila')::date;
    v_start date; v_count integer; v_step interval; v_format text;
begin
    if not public.medtrack_is_admin() then
        raise exception 'Administrator access is required.' using errcode = '42501';
    end if;
    case v_period
        when 'week' then v_start := v_today - 6; v_count := 7; v_step := interval '1 day'; v_format := 'Mon DD';
        when 'month' then v_start := date_trunc('month', v_today)::date; v_count := extract(day from (date_trunc('month', v_today) + interval '1 month - 1 day'))::integer; v_step := interval '1 day'; v_format := 'DD';
        when 'year' then v_start := date_trunc('year', v_today)::date; v_count := 12; v_step := interval '1 month'; v_format := 'Mon';
        else raise exception 'Period must be week, month, or year.';
    end case;

    return query
    with buckets as (
        select (v_start::timestamp + value * v_step)::date starts_at
        from generate_series(0, v_count - 1) value
    ), types(name) as (values
        ('supply_added'), ('supply_consumed'), ('equipment_borrowed'), ('equipment_returned'),
        ('mobility_assigned'), ('mobility_deployed'), ('item_missing'), ('item_damaged'),
        ('item_overdue'), ('item_for_repair'), ('low_stock'), ('expiring_supply'),
        ('expired_supply'), ('emergency_resource_used')
    ), facts as (
        select activity.event_type name, activity.quantity,
               (activity.occurred_at at time zone 'Asia/Manila')::date occurred
        from public.inventory_activity_events activity
        where activity.event_type not in ('expiring_supply', 'expired_supply', 'item_overdue')
        union all
        select 'item_overdue', greatest(transaction.quantity, 1), transaction.due_date + 1
        from public.borrow_transactions transaction
        where transaction.return_date is null
           or transaction.return_date > transaction.due_date
        union all
        select 'expiring_supply', 1, supply.expiration_date - 30
        from public.medical_supplies supply where supply.expiration_date is not null
        union all
        select 'expired_supply', 1, supply.expiration_date + 1
        from public.medical_supplies supply where supply.expiration_date is not null
    )
    select bucket.starts_at, to_char(bucket.starts_at, v_format), type.name,
           coalesce(sum(fact.quantity), 0)::bigint
    from buckets bucket cross join types type
    left join facts fact on fact.name = type.name
      and fact.occurred >= bucket.starts_at
      and fact.occurred < (bucket.starts_at::timestamp + v_step)::date
    group by bucket.starts_at, type.name
    order by bucket.starts_at, type.name;
end;
$$;
revoke all on function public.medtrack_inventory_activity_trends(text) from public;
grant execute on function public.medtrack_inventory_activity_trends(text) to authenticated;

notify pgrst, 'reload schema';
commit;
