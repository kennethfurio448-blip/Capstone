begin;

create or replace function public.medtrack_save_emergency_response(
    p_operation_key text,
    p_request jsonb,
    p_expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_request_id text := trim(coalesce(p_request ->> 'id', ''));
    v_status text := coalesce(nullif(trim(p_request ->> 'status'), ''), 'Pending');
    v_existing public.emergency_requests%rowtype;
    v_existing_operation public.medtrack_inventory_operations%rowtype;
    v_claimed_operation text;
    v_usages jsonb := coalesce(p_request -> 'inventoryUsages', '[]'::jsonb);
    v_usage jsonb;
    v_usage_payload jsonb;
    v_position bigint;
    v_item_type text;
    v_item_id text;
    v_item_name text;
    v_unit text;
    v_quantity integer;
    v_remaining integer;
    v_deducted boolean := false;
    v_deducted_at timestamptz;
    v_completed_at timestamptz;
    v_exists boolean := false;
begin
    if not public.medtrack_is_active_user() then
        raise exception 'Active emergency-response access is required.'
            using errcode = '42501';
    end if;
    if coalesce(trim(p_operation_key), '') = '' then
        raise exception 'An emergency operation key is required.';
    end if;
    if v_request_id = '' then
        raise exception 'An emergency request ID is required.';
    end if;
    if jsonb_typeof(v_usages) <> 'array' then
        raise exception 'Emergency inventory items must be an array.';
    end if;
    if v_status not in ('Pending', 'In Progress', 'Completed', 'Cancelled') then
        raise exception 'Invalid emergency response status.';
    end if;
    if coalesce(trim(p_request ->> 'date'), '') = '' or
       coalesce(trim(p_request ->> 'time'), '') = '' or
       coalesce(trim(p_request ->> 'type'), '') = '' or
       coalesce(trim(p_request ->> 'location'), '') = '' or
       coalesce(trim(p_request ->> 'contactPerson'), '') = '' or
       coalesce(trim(p_request ->> 'contactNumber'), '') = '' or
       coalesce(trim(p_request ->> 'assignedTeam'), '') = '' or
       coalesce(trim(p_request ->> 'resources'), '') = '' or
       coalesce(trim(p_request ->> 'description'), '') = '' then
        raise exception 'Complete emergency response information is required.';
    end if;

    select * into v_existing_operation
    from public.medtrack_inventory_operations
    where operation_key = p_operation_key;

    if found then
        if v_existing_operation.item_type <> 'Emergency Response Save' or
           v_existing_operation.item_id <> v_request_id then
            raise exception 'The operation key was already used.';
        end if;
        return jsonb_build_object(
            'requestId', v_request_id,
            'alreadyApplied', true
        );
    end if;

    select * into v_existing
    from public.emergency_requests
    where id = v_request_id
    for update;

    v_exists := found;

    if v_exists and p_expected_updated_at is not null and
       v_existing.updated_at <> p_expected_updated_at then
        raise exception
            'This emergency response was changed by another user. Refresh and review it before saving.'
            using errcode = '40001';
    end if;

    if v_exists and coalesce(v_existing.inventory_deducted, false) then
        v_deducted := true;
        v_deducted_at := v_existing.inventory_deducted_at;
        v_usage_payload := v_existing.inventory_usage;
        v_usages := case
            when jsonb_typeof(v_usage_payload -> 'items') = 'array'
                then v_usage_payload -> 'items'
            when v_usage_payload is not null
                then jsonb_build_array(v_usage_payload)
            else '[]'::jsonb
        end;
    elsif v_status in ('In Progress', 'Completed') and jsonb_array_length(v_usages) > 0 then
        if exists (
            select 1
            from jsonb_array_elements(v_usages) item
            group by item ->> 'itemType', item ->> 'itemId'
            having count(*) > 1
        ) then
            raise exception 'The same inventory item cannot be used more than once.';
        end if;

        for v_usage, v_position in
            select item.value, item.ordinality
            from jsonb_array_elements(v_usages) with ordinality as item(value, ordinality)
        loop
            v_item_type := trim(coalesce(v_usage ->> 'itemType', ''));
            v_item_id := trim(coalesce(v_usage ->> 'itemId', ''));
            v_quantity := coalesce((v_usage ->> 'quantity')::integer, 0);

            if v_item_id = '' or v_quantity < 1 then
                raise exception 'Every emergency item requires an item and quantity.';
            end if;

            case v_item_type
                when 'Medical Supply' then
                    update public.medical_supplies
                    set quantity = quantity - v_quantity,
                        updated_at = now()
                    where id = v_item_id
                      and quantity >= v_quantity
                    returning name, unit, quantity
                    into v_item_name, v_unit, v_remaining;

                    if not found then
                        raise exception 'The requested medical supply quantity is no longer available.';
                    end if;

                    insert into public.medical_supply_transactions (
                        operation_key, transaction_type, supply_id,
                        supply_name, unit, quantity, emergency_request_id,
                        emergency_label, occurred_at, remaining_stock, created_by
                    ) values (
                        p_operation_key || ':item:' || v_position::text,
                        'consumed', v_item_id, v_item_name, v_unit, v_quantity,
                        v_request_id,
                        v_request_id || ' - ' || (p_request ->> 'type') ||
                            ' - ' || (p_request ->> 'location'),
                        now(), v_remaining, auth.uid()
                    );

                when 'Medical Equipment' then
                    update public.medical_equipment
                    set quantity = quantity - v_quantity,
                        status = case
                            when quantity - v_quantity = 0 then 'Unavailable'
                            else status
                        end,
                        updated_at = now()
                    where id = v_item_id
                      and quantity >= v_quantity
                      and lower(status) = 'available'
                    returning name into v_item_name;

                    if not found then
                        raise exception 'The requested medical equipment is no longer available.';
                    end if;

                when 'Mobility Asset' then
                    if v_quantity <> 1 then
                        raise exception 'Mobility asset quantity must be 1.';
                    end if;

                    update public.mobility_assets
                    set status = 'Deployed', updated_at = now()
                    where id = v_item_id
                      and lower(status) = 'available'
                    returning name into v_item_name;

                    if not found then
                        raise exception 'The requested mobility asset is no longer available.';
                    end if;

                else
                    raise exception 'Unsupported emergency inventory type.';
            end case;

            v_usages := jsonb_set(
                v_usages,
                array[(v_position - 1)::text],
                v_usage || jsonb_build_object(
                    'itemName', coalesce(v_item_name, v_usage ->> 'itemName'),
                    'deducted', true,
                    'deductedAt', now()
                )
            );
        end loop;

        v_deducted := true;
        v_deducted_at := now();
    end if;

    if v_usage_payload is null then
        v_usage_payload := case
            when jsonb_array_length(v_usages) = 0 then null
            else (v_usages -> 0) || jsonb_build_object('items', v_usages)
        end;
    end if;

    v_completed_at := case
        when v_status = 'Completed' then
            coalesce(
                nullif(p_request ->> 'completedAt', '')::timestamptz,
                case when v_exists then v_existing.completed_at else null end,
                now()
            )
        else null
    end;

    insert into public.medtrack_inventory_operations (
        operation_key, item_type, item_id, quantity, created_by
    ) values (
        p_operation_key, 'Emergency Response Save', v_request_id, 1, auth.uid()
    )
    on conflict (operation_key) do nothing
    returning operation_key into v_claimed_operation;

    if v_claimed_operation is null then
        raise exception 'The operation key was already used.';
    end if;

    insert into public.emergency_requests (
        id, request_date, request_time, type, priority, location,
        contact_person, contact_number, assigned_team, status,
        resources, description, inventory_usage, inventory_deducted,
        inventory_deducted_at, completed_at, updated_at
    ) values (
        v_request_id,
        (p_request ->> 'date')::date,
        (p_request ->> 'time')::time,
        trim(p_request ->> 'type'),
        coalesce(nullif(trim(p_request ->> 'priority'), ''), 'Medium'),
        trim(p_request ->> 'location'),
        trim(p_request ->> 'contactPerson'),
        trim(p_request ->> 'contactNumber'),
        trim(p_request ->> 'assignedTeam'),
        v_status,
        trim(p_request ->> 'resources'),
        trim(p_request ->> 'description'),
        v_usage_payload,
        v_deducted,
        v_deducted_at,
        v_completed_at,
        now()
    )
    on conflict (id) do update set
        request_date = excluded.request_date,
        request_time = excluded.request_time,
        type = excluded.type,
        priority = excluded.priority,
        location = excluded.location,
        contact_person = excluded.contact_person,
        contact_number = excluded.contact_number,
        assigned_team = excluded.assigned_team,
        status = excluded.status,
        resources = excluded.resources,
        description = excluded.description,
        inventory_usage = excluded.inventory_usage,
        inventory_deducted = excluded.inventory_deducted,
        inventory_deducted_at = excluded.inventory_deducted_at,
        completed_at = excluded.completed_at,
        updated_at = now();

    return jsonb_build_object(
        'requestId', v_request_id,
        'inventoryDeducted', v_deducted,
        'alreadyApplied', false
    );
end;
$$;

revoke all on function public.medtrack_save_emergency_response(
    text, jsonb, timestamptz
) from public;

grant execute on function public.medtrack_save_emergency_response(
    text, jsonb, timestamptz
) to authenticated;

commit;
