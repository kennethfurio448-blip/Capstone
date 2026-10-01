begin;

create or replace function public.medtrack_release_emergency_resources(
    p_operation_key text,
    p_request_id text,
    p_releases jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_request public.emergency_requests%rowtype;
    v_existing_operation public.medtrack_inventory_operations%rowtype;
    v_claimed_operation text;
    v_usages jsonb;
    v_usage jsonb;
    v_release jsonb;
    v_position bigint;
    v_item_type text;
    v_item_id text;
    v_disposition text;
    v_quantity integer;
    v_usage_quantity integer;
    v_usage_payload jsonb;
begin
    if not public.medtrack_is_active_user() then
        raise exception 'Active emergency-response access is required.'
            using errcode = '42501';
    end if;
    if coalesce(trim(p_operation_key), '') = '' or
       coalesce(trim(p_request_id), '') = '' then
        raise exception 'A release operation and emergency request are required.';
    end if;
    if jsonb_typeof(p_releases) <> 'array' or jsonb_array_length(p_releases) = 0 then
        raise exception 'Select at least one reusable resource to release.';
    end if;

    select * into v_existing_operation
    from public.medtrack_inventory_operations
    where operation_key = p_operation_key;

    if found then
        if v_existing_operation.item_type <> 'Emergency Resource Release' or
           v_existing_operation.item_id <> trim(p_request_id) then
            raise exception 'The operation key was already used.';
        end if;
        return jsonb_build_object(
            'requestId', trim(p_request_id),
            'alreadyApplied', true
        );
    end if;

    select * into v_request
    from public.emergency_requests
    where id = trim(p_request_id)
    for update;

    if not found then
        raise exception 'The emergency response could not be found.';
    end if;
    if not coalesce(v_request.inventory_deducted, false) then
        raise exception 'This emergency response has no deployed resources.';
    end if;

    v_usages := case
        when jsonb_typeof(v_request.inventory_usage -> 'items') = 'array'
            then v_request.inventory_usage -> 'items'
        when v_request.inventory_usage is not null
            then jsonb_build_array(v_request.inventory_usage)
        else '[]'::jsonb
    end;

    for v_release in select value from jsonb_array_elements(p_releases)
    loop
        v_item_type := trim(coalesce(v_release ->> 'itemType', ''));
        v_item_id := trim(coalesce(v_release ->> 'itemId', ''));
        v_disposition := trim(coalesce(v_release ->> 'disposition', ''));

        if v_item_type not in ('Medical Equipment', 'Mobility Asset') or
           v_disposition not in ('Returned', 'Missing', 'Damaged', 'For Repair') then
            raise exception 'Invalid reusable resource release.';
        end if;

        select item.value, item.ordinality
        into v_usage, v_position
        from jsonb_array_elements(v_usages) with ordinality as item(value, ordinality)
        where item.value ->> 'itemType' = v_item_type
          and item.value ->> 'itemId' = v_item_id
        limit 1;

        if not found then
            raise exception 'A selected resource is not part of this emergency response.';
        end if;
        if coalesce((v_usage ->> 'released')::boolean, false) then
            raise exception 'A selected resource was already released.';
        end if;

        v_usage_quantity := greatest(coalesce((v_usage ->> 'quantity')::integer, 1), 1);
        v_quantity := case
            when v_disposition = 'Missing' then 0
            else coalesce((v_release ->> 'quantity')::integer, v_usage_quantity)
        end;

        if v_disposition <> 'Missing' and
           (v_quantity < 1 or v_quantity > v_usage_quantity) then
            raise exception 'Invalid returned resource quantity.';
        end if;

        if v_item_type = 'Medical Equipment' then
            update public.medical_equipment
            set quantity = quantity + v_quantity,
                status = case v_disposition
                    when 'Returned' then 'Available'
                    when 'Damaged' then 'Damaged'
                    when 'For Repair' then 'For Repair'
                    when 'Missing' then 'Missing'
                end,
                condition = case
                    when v_disposition = 'Damaged' then 'Damaged'
                    else condition
                end,
                updated_at = now()
            where id = v_item_id;
        else
            update public.mobility_assets
            set status = case v_disposition
                    when 'Returned' then 'Available'
                    when 'Damaged' then 'Damaged'
                    when 'For Repair' then 'For Repair'
                    when 'Missing' then 'Missing'
                end,
                condition = case
                    when v_disposition = 'Damaged' then 'Damaged'
                    else condition
                end,
                updated_at = now()
            where id = v_item_id;
        end if;

        if not found then
            raise exception 'A reusable inventory resource could not be found.';
        end if;

        v_usages := jsonb_set(
            v_usages,
            array[(v_position - 1)::text],
            v_usage || jsonb_build_object(
                'released', true,
                'releaseStatus', v_disposition,
                'releasedQuantity', v_quantity,
                'releasedAt', now(),
                'releasedBy', coalesce(v_release ->> 'releasedBy', ''),
                'releaseRemarks', coalesce(v_release ->> 'remarks', '')
            )
        );
    end loop;

    insert into public.medtrack_inventory_operations (
        operation_key, item_type, item_id, quantity, created_by
    ) values (
        p_operation_key, 'Emergency Resource Release', trim(p_request_id),
        jsonb_array_length(p_releases), auth.uid()
    )
    on conflict (operation_key) do nothing
    returning operation_key into v_claimed_operation;

    if v_claimed_operation is null then
        raise exception 'The operation key was already used.';
    end if;

    v_usage_payload := case
        when jsonb_array_length(v_usages) = 0 then null
        else (v_usages -> 0) || jsonb_build_object('items', v_usages)
    end;

    update public.emergency_requests
    set inventory_usage = v_usage_payload,
        updated_at = now()
    where id = trim(p_request_id);

    return jsonb_build_object(
        'requestId', trim(p_request_id),
        'releasedCount', jsonb_array_length(p_releases),
        'alreadyApplied', false
    );
end;
$$;

revoke all on function public.medtrack_release_emergency_resources(
    text, text, jsonb
) from public;

grant execute on function public.medtrack_release_emergency_resources(
    text, text, jsonb
) to authenticated;

create or replace function public.medtrack_protect_deployed_emergency_resources()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_usages jsonb;
begin
    if not coalesce(old.inventory_deducted, false) then
        return old;
    end if;

    v_usages := case
        when jsonb_typeof(old.inventory_usage -> 'items') = 'array'
            then old.inventory_usage -> 'items'
        when old.inventory_usage is not null
            then jsonb_build_array(old.inventory_usage)
        else '[]'::jsonb
    end;

    if exists (
        select 1
        from jsonb_array_elements(v_usages) usage
        where usage ->> 'itemType' in ('Medical Equipment', 'Mobility Asset')
          and not coalesce((usage ->> 'released')::boolean, false)
    ) then
        raise exception
            'Release or record all reusable emergency resources before deleting this response.';
    end if;

    return old;
end;
$$;

drop trigger if exists protect_deployed_emergency_resources
on public.emergency_requests;

create trigger protect_deployed_emergency_resources
before delete on public.emergency_requests
for each row execute function public.medtrack_protect_deployed_emergency_resources();

commit;
