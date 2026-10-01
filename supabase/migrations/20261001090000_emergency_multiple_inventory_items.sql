begin;

create or replace function public.medtrack_record_emergency_resource_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_usage jsonb;
    v_usages jsonb;
    v_type text;
    v_position bigint;
    v_event_key text;
begin
    if new.inventory_deducted
       and new.inventory_usage is not null
       and (tg_op = 'INSERT' or not coalesce(old.inventory_deducted, false)) then

        v_usages := case
            when jsonb_typeof(new.inventory_usage -> 'items') = 'array'
                then new.inventory_usage -> 'items'
            else jsonb_build_array(new.inventory_usage)
        end;

        for v_usage, v_position in
            select item.value, item.ordinality
            from jsonb_array_elements(v_usages) with ordinality as item(value, ordinality)
        loop
            if coalesce(v_usage ->> 'itemId', '') = '' then
                continue;
            end if;

            v_type := coalesce(v_usage ->> 'itemType', 'Medical Supply');
            v_event_key := case
                when v_position = 1 then 'emergency-resource:' || new.id
                else 'emergency-resource:' || new.id || ':' || v_position::text
            end;

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
                v_event_key,
                'emergency_resource_used',
                case v_type
                    when 'Medical Equipment' then 'medical_equipment'
                    when 'Mobility Asset' then 'mobility_assets'
                    else 'medical_supplies'
                end,
                v_usage ->> 'itemId',
                greatest(coalesce((v_usage ->> 'quantity')::integer, 1), 1),
                'emergency_request',
                new.id,
                coalesce(
                    nullif(v_usage ->> 'deductedAt', '')::timestamptz,
                    new.inventory_deducted_at,
                    new.updated_at
                ),
                auth.uid(),
                jsonb_build_object(
                    'itemName', v_usage ->> 'itemName',
                    'requestType', new.type,
                    'itemPosition', v_position
                )
            ) on conflict (event_key) do nothing;
        end loop;
    end if;

    return new;
end;
$$;

drop trigger if exists record_emergency_resource_activity
on public.emergency_requests;

create trigger record_emergency_resource_activity
after insert or update of inventory_deducted
on public.emergency_requests
for each row execute function public.medtrack_record_emergency_resource_activity();

commit;
