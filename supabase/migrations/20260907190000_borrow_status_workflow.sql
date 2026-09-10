
update public.borrow_transactions
set status = 'Borrowed'
where status = 'Overdue';

update public.mobility_assets
set status = 'For Repair',
    updated_at = now()
where status in ('Maintenance', 'Unavailable');


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

    if p_item_type not in ('Medical Equipment', 'Mobility Asset') then
        raise exception
            'Only medical equipment and mobility assets can be borrowed.';
    end if;

    if coalesce(trim(p_item_id), '') = '' then
        raise exception 'An inventory item is required.';
    end if;

    if p_due_date < p_borrow_date then
        raise exception 'Due date cannot be earlier than borrow date.';
    end if;

    case p_item_type
        when 'Medical Equipment' then
            update public.medical_equipment
            set quantity = quantity - 1,
                status = 'Unavailable',
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

    if coalesce(trim(p_transaction_id), '') = '' then
        raise exception 'A borrowing record is required.';
    end if;

    v_status := coalesce(trim(p_status), '');

    if v_status not in (
        'Borrowed',
        'Returned',
        'Missing',
        'Damaged',
        'For Repair'
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
        'Medical Equipment',
        'Mobility Asset'
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

    if v_inventory_item_id is not null
       and v_inventory_item_id is distinct from
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
           and not v_was_returned
           and v_inventory_item_id is not null then

            case v_transaction.item_type
                when 'Medical Equipment' then
                    update public.medical_equipment
                    set quantity = quantity + v_transaction.quantity,
                        status = case
                            when exists (
                                select 1
                                from public.borrow_transactions other
                                where other.inventory_item_id =
                                        v_inventory_item_id
                                  and other.id <> p_transaction_id
                                  and other.status <> 'Returned'
                            ) then 'Unavailable'
                            else 'Available'
                        end,
                        updated_at = now()
                    where id = v_inventory_item_id;

                when 'Mobility Asset' then
                    update public.mobility_assets
                    set status = case
                            when exists (
                                select 1
                                from public.borrow_transactions other
                                where other.inventory_item_id =
                                        v_inventory_item_id
                                  and other.id <> p_transaction_id
                                  and other.status <> 'Returned'
                            ) then 'Deployed'
                            else 'Available'
                        end,
                        updated_at = now()
                    where id = v_inventory_item_id;
            end case;

            if not found then
                raise exception 'The related inventory item was not found.';
            end if;
        end if;

        update public.borrow_transactions
        set status = v_status,
            return_date = coalesce(return_date, current_date),
            inventory_returned = case
                when coalesce(inventory_adjusted, false) then true
                else inventory_returned
            end,
            updated_at = now()
        where id = p_transaction_id;
    else
        if coalesce(v_transaction.inventory_adjusted, false)
           and v_was_returned
           and v_inventory_item_id is not null then

            case v_transaction.item_type
                when 'Medical Equipment' then
                    update public.medical_equipment
                    set quantity = quantity - v_transaction.quantity,
                        status = 'Unavailable',
                        updated_at = now()
                    where id = v_inventory_item_id
                      and quantity >= v_transaction.quantity;

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
                    'The item cannot be made unavailable because it is no longer available.';
            end if;
        elsif coalesce(v_transaction.inventory_adjusted, false)
              and v_inventory_item_id is not null then
            case v_transaction.item_type
                when 'Medical Equipment' then
                    update public.medical_equipment
                    set status = 'Unavailable',
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

            if not found then
                raise exception 'The related inventory item was not found.';
            end if;
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


revoke all on function public.medtrack_borrow_item(
    text, text, text, text, date, date, text
) from public;

grant execute on function public.medtrack_borrow_item(
    text, text, text, text, date, date, text
) to authenticated;

revoke all on function public.medtrack_update_borrow_status(text, text)
from public;

grant execute on function public.medtrack_update_borrow_status(text, text)
to authenticated;

notify pgrst, 'reload schema';
