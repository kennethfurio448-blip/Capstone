-- Detailed, quantity-aware borrowing for Medical Equipment and Mobility only.

alter table public.borrow_transactions
    add column if not exists borrowed_at timestamptz,
    add column if not exists assigned_personnel text,
    add column if not exists destination text,
    add column if not exists remarks text;

update public.borrow_transactions
set borrowed_at = borrow_date::timestamp at time zone 'Asia/Manila'
where borrowed_at is null;

alter table public.borrow_transactions
    alter column borrowed_at set default now(),
    alter column borrowed_at set not null;

drop function if exists public.medtrack_borrow_item(
    text, text, text, text, date, date, text
);

create or replace function public.medtrack_borrow_item(
    p_item_type text,
    p_item_id text,
    p_quantity integer,
    p_borrower text,
    p_department text,
    p_borrowed_at timestamptz,
    p_due_date date,
    p_purpose text,
    p_assigned_personnel text default null,
    p_destination text default null,
    p_remarks text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_item_name text;
    v_remaining_quantity integer;
    v_transaction_id text;
begin
    if not exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and status = 'active'
          and role in ('admin', 'staff')
    ) then
        raise exception 'An active MedTrack account is required.'
            using errcode = '42501';
    end if;

    if p_item_type not in ('Medical Equipment', 'Mobility Asset') then
        raise exception
            'Only medical equipment and mobility assets can be borrowed.';
    end if;

    if coalesce(trim(p_item_id), '') = '' then
        raise exception 'An available inventory item is required.';
    end if;

    if coalesce(trim(p_borrower), '') = '' or
       coalesce(trim(p_department), '') = '' or
       coalesce(trim(p_purpose), '') = '' or
       coalesce(trim(p_destination), '') = '' or
       p_borrowed_at is null or
       p_due_date is null then
        raise exception 'Complete all required borrowing information.';
    end if;

    if p_quantity is null or p_quantity < 1 then
        raise exception 'Quantity must be at least 1.';
    end if;

    if p_due_date < (p_borrowed_at at time zone 'Asia/Manila')::date then
        raise exception
            'Expected return date cannot be earlier than the borrowing date.';
    end if;

    case p_item_type
        when 'Medical Equipment' then
            update public.medical_equipment
            set quantity = quantity - p_quantity,
                status = case
                    when quantity - p_quantity > 0 then 'Available'
                    else 'Unavailable'
                end,
                updated_at = now()
            where id = p_item_id
              and quantity >= p_quantity
              and lower(status) = 'available'
            returning name, quantity
            into v_item_name, v_remaining_quantity;

        when 'Mobility Asset' then
            if p_quantity <> 1 then
                raise exception
                    'Only one mobility asset can be borrowed per transaction.';
            end if;

            update public.mobility_assets
            set status = 'Deployed',
                updated_at = now()
            where id = p_item_id
              and lower(status) = 'available'
            returning name, 0
            into v_item_name, v_remaining_quantity;
    end case;

    if not found then
        raise exception
            'The selected item is no longer available in that quantity.';
    end if;

    loop
        v_transaction_id :=
            'TRN-' || upper(substr(md5(
                random()::text ||
                clock_timestamp()::text ||
                auth.uid()::text
            ), 1, 12));

        exit when not exists (
            select 1
            from public.borrow_transactions
            where id = v_transaction_id
        );
    end loop;

    insert into public.borrow_transactions (
        id,
        borrower,
        department,
        item_type,
        item_name,
        quantity,
        borrow_date,
        borrowed_at,
        due_date,
        return_date,
        status,
        purpose,
        assigned_personnel,
        destination,
        remarks,
        inventory_item_id,
        inventory_adjusted,
        inventory_returned,
        updated_at
    ) values (
        v_transaction_id,
        trim(p_borrower),
        trim(p_department),
        p_item_type,
        v_item_name,
        p_quantity,
        (p_borrowed_at at time zone 'Asia/Manila')::date,
        p_borrowed_at,
        p_due_date,
        null,
        'Borrowed',
        trim(p_purpose),
        nullif(trim(p_assigned_personnel), ''),
        trim(p_destination),
        nullif(trim(p_remarks), ''),
        p_item_id,
        true,
        false,
        now()
    );

    return jsonb_build_object(
        'id', v_transaction_id,
        'itemName', v_item_name,
        'quantity', p_quantity,
        'remainingQuantity', v_remaining_quantity,
        'status', 'Borrowed'
    );
end;
$$;

revoke all on function public.medtrack_borrow_item(
    text, text, integer, text, text, timestamptz, date,
    text, text, text, text
) from public;

grant execute on function public.medtrack_borrow_item(
    text, text, integer, text, text, timestamptz, date,
    text, text, text, text
) to authenticated;

-- Keep returns and later status changes quantity-aware as well. Equipment
-- remains borrowable while at least one unit is still available.
create or replace function public.medtrack_update_borrow_status(
    p_transaction_id text,
    p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_transaction public.borrow_transactions%rowtype;
    v_inventory_item_id text;
    v_status text;
    v_was_returned boolean;
begin
    if not exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and status = 'active'
          and role in ('admin', 'staff')
    ) then
        raise exception 'An active MedTrack account is required.'
            using errcode = '42501';
    end if;

    v_status := coalesce(trim(p_status), '');

    if v_status not in (
        'Borrowed', 'Returned', 'Missing', 'Damaged', 'For Repair'
    ) then
        raise exception 'Invalid borrowing status.';
    end if;

    select *
    into v_transaction
    from public.borrow_transactions
    where id = p_transaction_id
    for update;

    if not found then
        raise exception 'Borrowing record was not found.';
    end if;

    if v_transaction.item_type not in (
        'Medical Equipment', 'Mobility Asset'
    ) then
        raise exception
            'Medical supplies cannot be managed as borrowed items.';
    end if;

    case v_transaction.item_type
        when 'Medical Equipment' then
            select equipment.id
            into v_inventory_item_id
            from public.medical_equipment equipment
            where equipment.id = v_transaction.inventory_item_id
               or lower(trim(equipment.name)) =
                    lower(trim(v_transaction.item_name))
            order by case
                when equipment.id = v_transaction.inventory_item_id then 0
                else 1
            end,
            equipment.id
            limit 1;

        when 'Mobility Asset' then
            select asset.id
            into v_inventory_item_id
            from public.mobility_assets asset
            where asset.id = v_transaction.inventory_item_id
               or lower(trim(asset.name)) =
                    lower(trim(v_transaction.item_name))
            order by case
                when asset.id = v_transaction.inventory_item_id then 0
                else 1
            end,
            asset.id
            limit 1;
    end case;

    if v_inventory_item_id is null then
        raise exception 'The related inventory item was not found.';
    end if;

    if v_inventory_item_id is distinct from
       v_transaction.inventory_item_id then
        update public.borrow_transactions
        set inventory_item_id = v_inventory_item_id,
            updated_at = now()
        where id = p_transaction_id;
    end if;

    v_was_returned :=
        v_transaction.status = 'Returned' or
        coalesce(v_transaction.inventory_returned, false);

    if v_status = 'Returned' then
        if coalesce(v_transaction.inventory_adjusted, false)
           and not v_was_returned then
            case v_transaction.item_type
                when 'Medical Equipment' then
                    update public.medical_equipment
                    set quantity = quantity + v_transaction.quantity,
                        status = 'Available',
                        updated_at = now()
                    where id = v_inventory_item_id;

                when 'Mobility Asset' then
                    update public.mobility_assets
                    set status = 'Available',
                        updated_at = now()
                    where id = v_inventory_item_id;
            end case;

            if not found then
                raise exception 'The related inventory item was not found.';
            end if;
        end if;

        update public.borrow_transactions
        set status = 'Returned',
            return_date = coalesce(return_date, current_date),
            inventory_returned = case
                when coalesce(inventory_adjusted, false) then true
                else inventory_returned
            end,
            updated_at = now()
        where id = p_transaction_id;
    else
        if coalesce(v_transaction.inventory_adjusted, false)
           and v_was_returned then
            case v_transaction.item_type
                when 'Medical Equipment' then
                    update public.medical_equipment
                    set quantity = quantity - v_transaction.quantity,
                        status = case
                            when quantity - v_transaction.quantity > 0
                                then 'Available'
                            else 'Unavailable'
                        end,
                        updated_at = now()
                    where id = v_inventory_item_id
                      and quantity >= v_transaction.quantity
                      and lower(status) = 'available';

                when 'Mobility Asset' then
                    update public.mobility_assets
                    set status = case
                            when v_status = 'Borrowed' then 'Deployed'
                            else 'For Repair'
                        end,
                        updated_at = now()
                    where id = v_inventory_item_id
                      and lower(status) = 'available';
            end case;

            if not found then
                raise exception
                    'The item is no longer available in the required quantity.';
            end if;
        elsif coalesce(v_transaction.inventory_adjusted, false) then
            case v_transaction.item_type
                when 'Medical Equipment' then
                    update public.medical_equipment
                    set status = case
                            when quantity > 0 then 'Available'
                            else 'Unavailable'
                        end,
                        updated_at = now()
                    where id = v_inventory_item_id;

                when 'Mobility Asset' then
                    update public.mobility_assets
                    set status = case
                            when v_status = 'Borrowed' then 'Deployed'
                            else 'For Repair'
                        end,
                        updated_at = now()
                    where id = v_inventory_item_id;
            end case;
        end if;

        update public.borrow_transactions
        set status = v_status,
            return_date = null,
            inventory_returned = case
                when coalesce(inventory_adjusted, false) then false
                else inventory_returned
            end,
            updated_at = now()
        where id = p_transaction_id;
    end if;

    return jsonb_build_object(
        'id', p_transaction_id,
        'status', v_status,
        'available', v_status = 'Returned'
    );
end;
$$;

revoke all on function public.medtrack_update_borrow_status(text, text)
from public;

grant execute on function public.medtrack_update_borrow_status(text, text)
to authenticated;

notify pgrst, 'reload schema';
