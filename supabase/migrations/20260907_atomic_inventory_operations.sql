
create table if not exists public.medtrack_inventory_operations (
    operation_key text primary key,
    item_type text not null,
    item_id text not null,
    quantity integer not null check (quantity > 0),
    created_by uuid not null,
    created_at timestamptz not null default now()
);

alter table public.medtrack_inventory_operations
enable row level security;

revoke all on table public.medtrack_inventory_operations
from anon, authenticated;

create or replace function public.medtrack_borrow_item(
    p_item_type text,
    p_item_id text,
    p_borrower text,
    p_department text,
    p_borrow_date date,
    p_due_date date,
    p_purpose text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_item_name text;
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

    if coalesce(trim(p_item_id), '') = '' then
        raise exception 'An inventory item is required.';
    end if;

    if p_due_date < p_borrow_date then
        raise exception 'Due date cannot be earlier than borrow date.';
    end if;

    case p_item_type
        when 'Medical Supply' then
            update public.medical_supplies
            set quantity = quantity - 1,
                updated_at = now()
            where id = p_item_id
              and quantity >= 1
            returning name into v_item_name;

        when 'Medical Equipment' then
            update public.medical_equipment
            set quantity = quantity - 1,
                status = case
                    when quantity - 1 = 0 then 'Unavailable'
                    else status
                end,
                updated_at = now()
            where id = p_item_id
              and quantity >= 1
              and lower(status) = 'available'
            returning name into v_item_name;

        when 'Mobility Asset' then
            update public.mobility_assets
            set status = 'Deployed',
                updated_at = now()
            where id = p_item_id
              and lower(status) = 'available'
            returning name into v_item_name;

        else
            raise exception 'Unsupported inventory item type.';
    end case;

    if not found then
        raise exception 'This item is no longer available.';
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
        due_date,
        return_date,
        status,
        purpose,
        inventory_item_id,
        inventory_adjusted,
        inventory_returned,
        updated_at
    ) values (
        v_transaction_id,
        coalesce(nullif(trim(p_borrower), ''), 'MedTrack User'),
        coalesce(nullif(trim(p_department), ''), 'Staff'),
        p_item_type,
        v_item_name,
        1,
        p_borrow_date,
        p_due_date,
        null,
        'Borrowed',
        coalesce(nullif(trim(p_purpose), ''), 'Inventory transaction'),
        p_item_id,
        true,
        false,
        now()
    );

    return jsonb_build_object(
        'id', v_transaction_id,
        'itemName', v_item_name,
        'status', 'Borrowed'
    );
end;
$$;


create or replace function public.medtrack_return_item(
    p_transaction_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_transaction public.borrow_transactions%rowtype;
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

    select *
    into v_transaction
    from public.borrow_transactions
    where id = p_transaction_id
    for update;

    if not found then
        raise exception 'Borrow transaction was not found.';
    end if;

    if v_transaction.status = 'Returned' then
        return jsonb_build_object(
            'id', v_transaction.id,
            'status', 'Returned',
            'inventoryReturned',
                coalesce(v_transaction.inventory_returned, false)
        );
    end if;

    if coalesce(v_transaction.inventory_adjusted, false)
       and not coalesce(v_transaction.inventory_returned, false)
       and v_transaction.inventory_item_id is not null then

        case v_transaction.item_type
            when 'Medical Supply' then
                update public.medical_supplies
                set quantity = quantity + v_transaction.quantity,
                    updated_at = now()
                where id = v_transaction.inventory_item_id;

            when 'Medical Equipment' then
                update public.medical_equipment
                set quantity = quantity + v_transaction.quantity,
                    status = case
                        when lower(status) = 'unavailable' then 'Available'
                        else status
                    end,
                    updated_at = now()
                where id = v_transaction.inventory_item_id;

            when 'Mobility Asset' then
                update public.mobility_assets
                set status = 'Available',
                    updated_at = now()
                where id = v_transaction.inventory_item_id;

            else
                raise exception 'Unsupported inventory item type.';
        end case;

        if not found then
            raise exception 'The related inventory item was not found.';
        end if;
    end if;

    update public.borrow_transactions
    set status = 'Returned',
        return_date = current_date,
        inventory_returned = case
            when coalesce(v_transaction.inventory_adjusted, false)
                then true
            else coalesce(v_transaction.inventory_returned, false)
        end,
        updated_at = now()
    where id = p_transaction_id;

    return jsonb_build_object(
        'id', p_transaction_id,
        'status', 'Returned',
        'inventoryReturned',
            coalesce(v_transaction.inventory_adjusted, false)
    );
end;
$$;


create or replace function public.medtrack_use_inventory(
    p_operation_key text,
    p_item_type text,
    p_item_id text,
    p_quantity integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_item_name text;
    v_operation_key text;
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

    if p_quantity is null or p_quantity < 1 then
        raise exception 'Quantity must be at least 1.';
    end if;

    if coalesce(trim(p_operation_key), '') = '' then
        raise exception 'An inventory operation key is required.';
    end if;

    insert into public.medtrack_inventory_operations (
        operation_key,
        item_type,
        item_id,
        quantity,
        created_by
    ) values (
        p_operation_key,
        p_item_type,
        p_item_id,
        p_quantity,
        auth.uid()
    )
    on conflict (operation_key) do nothing
    returning operation_key into v_operation_key;

    if v_operation_key is null then
        return jsonb_build_object(
            'itemId', p_item_id,
            'quantityUsed', 0,
            'alreadyApplied', true
        );
    end if;

    case p_item_type
        when 'Medical Supply' then
            update public.medical_supplies
            set quantity = quantity - p_quantity,
                updated_at = now()
            where id = p_item_id
              and quantity >= p_quantity
            returning name into v_item_name;

        when 'Medical Equipment' then
            update public.medical_equipment
            set quantity = quantity - p_quantity,
                status = case
                    when quantity - p_quantity = 0 then 'Unavailable'
                    else status
                end,
                updated_at = now()
            where id = p_item_id
              and quantity >= p_quantity
              and lower(status) = 'available'
            returning name into v_item_name;

        when 'Mobility Asset' then
            if p_quantity <> 1 then
                raise exception 'Mobility asset quantity must be 1.';
            end if;

            update public.mobility_assets
            set status = 'Deployed',
                updated_at = now()
            where id = p_item_id
              and lower(status) = 'available'
            returning name into v_item_name;

        else
            raise exception 'Unsupported inventory item type.';
    end case;

    if not found then
        raise exception 'The requested quantity is no longer available.';
    end if;

    return jsonb_build_object(
        'itemId', p_item_id,
        'itemName', v_item_name,
        'quantityUsed', p_quantity,
        'alreadyApplied', false
    );
end;
$$;


revoke all on function public.medtrack_borrow_item(
    text, text, text, text, date, date, text
) from public;

revoke all on function public.medtrack_return_item(text) from public;

revoke all on function public.medtrack_use_inventory(
    text, text, text, integer
) from public;

grant execute on function public.medtrack_borrow_item(
    text, text, text, text, date, date, text
) to authenticated;

grant execute on function public.medtrack_return_item(text)
to authenticated;

grant execute on function public.medtrack_use_inventory(
    text, text, text, integer
) to authenticated;
