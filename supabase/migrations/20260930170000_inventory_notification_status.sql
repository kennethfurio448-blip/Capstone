begin;

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
    v_item_status text;
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

    if tg_table_name = 'medical_supplies' then
        v_item_status := case
            when nullif(v_record ->> 'expiration_date', '')::date < current_date
                then 'Expired'
            when coalesce((v_record ->> 'quantity')::integer, 0) <= 0
                then 'Out of Stock'
            when coalesce((v_record ->> 'quantity')::integer, 0) <=
                 coalesce((v_record ->> 'low_stock_level')::integer, 0)
                then 'Low Stock'
            else 'Available'
        end;
    else
        v_item_status := coalesce(
            nullif(trim(v_record ->> 'status'), ''),
            'Available'
        );
    end if;

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
            'itemStatus', v_item_status,
            'actorName', v_actor_name
        )
    )
    on conflict (event_key) do nothing;

    return new;
end;
$$;

notify pgrst, 'reload schema';

commit;
