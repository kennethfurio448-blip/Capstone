begin;

alter table public.mobility_assets
    add column if not exists co_pilot text;

create or replace function public.medtrack_save_mobility_asset(
    p_operation_key text,
    p_asset_id text,
    p_name text,
    p_asset_type text,
    p_plate_number text,
    p_condition text,
    p_driver text,
    p_co_pilot text,
    p_location text,
    p_maintenance_date date,
    p_status text,
    p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_asset_id text;
    v_existing_operation public.medtrack_inventory_operations%rowtype;
    v_existing_asset public.mobility_assets%rowtype;
    v_claimed_operation text;
    v_created boolean := false;
begin
    if not public.medtrack_is_active_user() then
        raise exception 'Active inventory management access is required.'
            using errcode = '42501';
    end if;
    if coalesce(trim(p_operation_key), '') = '' then
        raise exception 'An inventory operation key is required.';
    end if;
    if coalesce(trim(p_name), '') = '' or
       coalesce(trim(p_asset_type), '') = '' or
       coalesce(trim(p_plate_number), '') = '' or
       coalesce(trim(p_driver), '') = '' or
       coalesce(trim(p_location), '') = '' then
        raise exception 'Complete mobility information is required.';
    end if;
    if char_length(coalesce(trim(p_co_pilot), '')) > 120 then
        raise exception 'Co-pilot name must be 120 characters or fewer.';
    end if;
    if p_condition not in ('Excellent', 'Good', 'Fair', 'Damaged') then
        raise exception 'Invalid mobility condition.';
    end if;
    if p_status not in (
        'Available', 'Deployed', 'Assigned',
        'For Repair', 'Under Maintenance'
    ) then
        raise exception 'Invalid mobility status.';
    end if;

    select * into v_existing_operation
    from public.medtrack_inventory_operations
    where operation_key = p_operation_key;

    if found then
        if v_existing_operation.item_type <> 'Mobility Asset Save' then
            raise exception 'The operation key was already used.';
        end if;
        return jsonb_build_object(
            'itemId', v_existing_operation.item_id,
            'alreadyApplied', true
        );
    end if;

    if coalesce(trim(p_asset_id), '') = '' then
        v_asset_id := public.medtrack_allocate_inventory_id('mobility_assets');
        v_created := true;
    else
        v_asset_id := trim(p_asset_id);
        select * into v_existing_asset
        from public.mobility_assets
        where id = v_asset_id
        for update;

        if not found then
            raise exception 'The selected mobility asset could not be found.';
        end if;
        if p_expected_updated_at is null or
           v_existing_asset.updated_at <> p_expected_updated_at then
            raise exception
                'This mobility asset was changed by another user. Refresh and review it before saving.'
                using errcode = '40001';
        end if;
    end if;

    insert into public.medtrack_inventory_operations (
        operation_key, item_type, item_id, quantity, created_by
    ) values (
        p_operation_key, 'Mobility Asset Save', v_asset_id, 1, auth.uid()
    )
    on conflict (operation_key) do nothing
    returning operation_key into v_claimed_operation;

    if v_claimed_operation is null then
        select * into v_existing_operation
        from public.medtrack_inventory_operations
        where operation_key = p_operation_key;
        if v_existing_operation.item_type <> 'Mobility Asset Save' then
            raise exception 'The operation key was already used.';
        end if;
        return jsonb_build_object(
            'itemId', v_existing_operation.item_id,
            'alreadyApplied', true
        );
    end if;

    if v_created then
        insert into public.mobility_assets (
            id, name, type, plate_number, condition, driver, co_pilot,
            location, maintenance_date, status, updated_at
        ) values (
            v_asset_id, trim(p_name), trim(p_asset_type),
            upper(trim(p_plate_number)), p_condition, trim(p_driver),
            nullif(trim(p_co_pilot), ''), trim(p_location),
            p_maintenance_date, p_status, now()
        );
    else
        update public.mobility_assets
        set name = trim(p_name),
            type = trim(p_asset_type),
            plate_number = upper(trim(p_plate_number)),
            condition = p_condition,
            driver = trim(p_driver),
            co_pilot = nullif(trim(p_co_pilot), ''),
            location = trim(p_location),
            maintenance_date = p_maintenance_date,
            status = p_status,
            updated_at = now()
        where id = v_asset_id;
    end if;

    return jsonb_build_object(
        'itemId', v_asset_id,
        'created', v_created,
        'alreadyApplied', false
    );
end;
$$;

revoke all on function public.medtrack_save_mobility_asset(
    text, text, text, text, text, text, text, text, text, date, text, timestamptz
) from public;

grant execute on function public.medtrack_save_mobility_asset(
    text, text, text, text, text, text, text, text, text, date, text, timestamptz
) to authenticated;

notify pgrst, 'reload schema';

commit;
