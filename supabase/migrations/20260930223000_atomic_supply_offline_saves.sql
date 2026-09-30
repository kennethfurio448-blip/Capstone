begin;

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
    v_supply_id text;
    v_previous_quantity integer;
    v_added_quantity integer;
    v_existing_operation public.medtrack_inventory_operations%rowtype;
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

    select * into v_existing_operation
    from public.medtrack_inventory_operations
    where operation_key = p_operation_key;

    if found then
        if v_existing_operation.item_type <> 'Medical Supply Addition' then
            raise exception 'The operation key was already used.';
        end if;
        return jsonb_build_object(
            'supplyId', v_existing_operation.item_id,
            'quantityAdded', 0,
            'alreadyApplied', true
        );
    end if;

    if coalesce(trim(p_supply_id), '') = '' then
        v_supply_id := public.medtrack_allocate_inventory_id(
            'medical_supplies'
        );
        v_previous_quantity := 0;
        v_created := true;
    else
        v_supply_id := trim(p_supply_id);
        select quantity into v_previous_quantity
        from public.medical_supplies
        where id = v_supply_id
        for update;

        if not found then
            v_previous_quantity := 0;
            v_created := true;
        elsif p_quantity < v_previous_quantity then
            raise exception
                'Use Consumed Supplies to reduce inventory stock.';
        end if;
    end if;

    v_added_quantity := p_quantity - v_previous_quantity;

    if v_added_quantity > 0 then
        insert into public.medtrack_inventory_operations (
            operation_key, item_type, item_id, quantity, created_by
        ) values (
            p_operation_key, 'Medical Supply Addition', v_supply_id,
            v_added_quantity, auth.uid()
        )
        on conflict (operation_key) do nothing
        returning operation_key into v_claimed_operation;

        if v_claimed_operation is null then
            select * into v_existing_operation
            from public.medtrack_inventory_operations
            where operation_key = p_operation_key;
            if v_existing_operation.item_type <> 'Medical Supply Addition' then
                raise exception 'The operation key was already used.';
            end if;
            return jsonb_build_object(
                'supplyId', v_existing_operation.item_id,
                'quantityAdded', 0,
                'alreadyApplied', true
            );
        end if;
    end if;

    insert into public.medical_supplies (
        id, name, category, quantity, unit, expiration_date,
        low_stock_level, updated_at
    ) values (
        v_supply_id, trim(p_name), trim(p_category), p_quantity,
        trim(p_unit), p_expiration_date, p_low_stock_level, now()
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
            operation_key, transaction_type, supply_id, supply_name,
            unit, quantity, emergency_request_id, emergency_label,
            occurred_at, remaining_stock, created_by
        ) values (
            p_operation_key, 'added', v_supply_id, trim(p_name),
            trim(p_unit), v_added_quantity, null, 'Inventory addition',
            now(), p_quantity, auth.uid()
        );
    end if;

    return jsonb_build_object(
        'supplyId', v_supply_id,
        'quantityAdded', v_added_quantity,
        'remainingStock', p_quantity,
        'created', v_created,
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

commit;
