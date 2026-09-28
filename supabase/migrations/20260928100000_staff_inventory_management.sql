-- Give active Staff accounts the same operational inventory permissions as
-- Administrators on the six shared inventory workflow pages. Administrative
-- account, reporting, audit, and settings permissions remain unchanged.

drop policy if exists "Admins can insert supplies" on public.medical_supplies;
drop policy if exists "Admins can update supplies" on public.medical_supplies;
drop policy if exists "Admins can delete supplies" on public.medical_supplies;
drop policy if exists "Active users can insert supplies" on public.medical_supplies;
drop policy if exists "Active users can update supplies" on public.medical_supplies;
drop policy if exists "Active users can delete supplies" on public.medical_supplies;

create policy "Active users can insert supplies"
on public.medical_supplies for insert to authenticated
with check (public.medtrack_is_active_user());

create policy "Active users can update supplies"
on public.medical_supplies for update to authenticated
using (public.medtrack_is_active_user())
with check (public.medtrack_is_active_user());

create policy "Active users can delete supplies"
on public.medical_supplies for delete to authenticated
using (public.medtrack_is_active_user());

drop policy if exists "Admins can insert equipment" on public.medical_equipment;
drop policy if exists "Admins can update equipment" on public.medical_equipment;
drop policy if exists "Admins can delete equipment" on public.medical_equipment;
drop policy if exists "Active users can insert equipment" on public.medical_equipment;
drop policy if exists "Active users can update equipment" on public.medical_equipment;
drop policy if exists "Active users can delete equipment" on public.medical_equipment;

create policy "Active users can insert equipment"
on public.medical_equipment for insert to authenticated
with check (public.medtrack_is_active_user());

create policy "Active users can update equipment"
on public.medical_equipment for update to authenticated
using (public.medtrack_is_active_user())
with check (public.medtrack_is_active_user());

create policy "Active users can delete equipment"
on public.medical_equipment for delete to authenticated
using (public.medtrack_is_active_user());

drop policy if exists "Admins can insert mobility" on public.mobility_assets;
drop policy if exists "Admins can update mobility" on public.mobility_assets;
drop policy if exists "Admins can delete mobility" on public.mobility_assets;
drop policy if exists "Active users can insert mobility" on public.mobility_assets;
drop policy if exists "Active users can update mobility" on public.mobility_assets;
drop policy if exists "Active users can delete mobility" on public.mobility_assets;

create policy "Active users can insert mobility"
on public.mobility_assets for insert to authenticated
with check (public.medtrack_is_active_user());

create policy "Active users can update mobility"
on public.mobility_assets for update to authenticated
using (public.medtrack_is_active_user())
with check (public.medtrack_is_active_user());

create policy "Active users can delete mobility"
on public.mobility_assets for delete to authenticated
using (public.medtrack_is_active_user());

drop policy if exists "Admins can delete emergencies" on public.emergency_requests;
drop policy if exists "Active users can delete emergencies" on public.emergency_requests;

create policy "Active users can delete emergencies"
on public.emergency_requests for delete to authenticated
using (public.medtrack_is_active_user());

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
    v_previous_quantity integer;
    v_added_quantity integer;
    v_claimed_operation text;
begin
    if not public.medtrack_is_active_user() then
        raise exception 'Active inventory management access is required.'
            using errcode = '42501';
    end if;

    if coalesce(trim(p_operation_key), '') = '' then
        raise exception 'An inventory operation key is required.';
    end if;

    if coalesce(trim(p_supply_id), '') = '' or
       coalesce(trim(p_name), '') = '' or
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

    select quantity
    into v_previous_quantity
    from public.medical_supplies
    where id = p_supply_id
    for update;

    if found then
        if p_quantity < v_previous_quantity then
            raise exception
                'Use Consumed Supplies to reduce inventory stock.';
        end if;

        v_added_quantity := p_quantity - v_previous_quantity;
    else
        v_previous_quantity := 0;
        v_added_quantity := p_quantity;
    end if;

    if v_added_quantity > 0 then
        insert into public.medtrack_inventory_operations (
            operation_key,
            item_type,
            item_id,
            quantity,
            created_by
        ) values (
            p_operation_key,
            'Medical Supply Addition',
            p_supply_id,
            v_added_quantity,
            auth.uid()
        )
        on conflict (operation_key) do nothing
        returning operation_key into v_claimed_operation;

        if v_claimed_operation is null then
            return jsonb_build_object(
                'supplyId', p_supply_id,
                'quantityAdded', 0,
                'alreadyApplied', true
            );
        end if;
    end if;

    insert into public.medical_supplies (
        id,
        name,
        category,
        quantity,
        unit,
        expiration_date,
        low_stock_level,
        updated_at
    ) values (
        p_supply_id,
        trim(p_name),
        trim(p_category),
        p_quantity,
        trim(p_unit),
        p_expiration_date,
        p_low_stock_level,
        now()
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
            operation_key,
            transaction_type,
            supply_id,
            supply_name,
            unit,
            quantity,
            emergency_request_id,
            emergency_label,
            occurred_at,
            remaining_stock,
            created_by
        ) values (
            p_operation_key,
            'added',
            p_supply_id,
            trim(p_name),
            trim(p_unit),
            v_added_quantity,
            null,
            'Inventory addition',
            now(),
            p_quantity,
            auth.uid()
        );
    end if;

    return jsonb_build_object(
        'supplyId', p_supply_id,
        'quantityAdded', v_added_quantity,
        'remainingStock', p_quantity,
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
