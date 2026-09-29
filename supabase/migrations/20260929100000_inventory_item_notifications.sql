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
    'emergency_resource_used', 'item_created'
));

drop policy if exists "Active users can read inventory item additions"
on public.inventory_activity_events;

create policy "Active users can read inventory item additions"
on public.inventory_activity_events for select to authenticated
using (
    event_type = 'item_created'
    and public.medtrack_is_active_user()
);

create or replace function public.medtrack_record_inventory_item_created()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_actor_name text;
    v_record jsonb := to_jsonb(new);
    v_item_category text;
begin
    select coalesce(
        nullif(trim(profile.full_name), ''),
        nullif(trim(profile.username), ''),
        nullif(trim(profile.email), ''),
        'MedTrack user'
    )
    into v_actor_name
    from public.profiles profile
    where profile.id = auth.uid();

    v_actor_name := coalesce(v_actor_name, 'System');
    v_item_category := coalesce(
        nullif(trim(v_record ->> 'category'), ''),
        nullif(trim(v_record ->> 'type'), ''),
        'Uncategorized'
    );

    insert into public.inventory_activity_events (
        event_key,
        event_type,
        inventory_module,
        inventory_item_id,
        quantity,
        source_type,
        source_id,
        occurred_at,
        actor_id,
        metadata
    ) values (
        'item-created:' || tg_table_name || ':' || new.id,
        'item_created',
        tg_table_name,
        new.id,
        1,
        tg_table_name,
        new.id,
        now(),
        auth.uid(),
        jsonb_build_object(
            'itemName', coalesce(nullif(trim(new.name), ''), new.id),
            'itemCategory', v_item_category,
            'actorName', v_actor_name
        )
    )
    on conflict (event_key) do nothing;

    return new;
end;
$$;

drop trigger if exists record_medical_supply_created
on public.medical_supplies;
create trigger record_medical_supply_created
after insert on public.medical_supplies
for each row execute function public.medtrack_record_inventory_item_created();

drop trigger if exists record_medical_equipment_created
on public.medical_equipment;
create trigger record_medical_equipment_created
after insert on public.medical_equipment
for each row execute function public.medtrack_record_inventory_item_created();

drop trigger if exists record_mobility_asset_created
on public.mobility_assets;
create trigger record_mobility_asset_created
after insert on public.mobility_assets
for each row execute function public.medtrack_record_inventory_item_created();

notify pgrst, 'reload schema';

commit;
