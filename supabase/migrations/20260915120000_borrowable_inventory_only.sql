begin;

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
              and lower(trim(status)) = 'available'
              and lower(trim(coalesce(condition, ''))) not in (
                  'missing', 'damaged', 'for repair',
                  'under repair', 'repair'
              )
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
              and lower(trim(status)) = 'available'
              and lower(trim(coalesce(condition, ''))) not in (
                  'missing', 'damaged', 'for repair',
                  'under repair', 'repair'
              )
            returning name, 0
            into v_item_name, v_remaining_quantity;
    end case;

    if not found then
        raise exception
            'The selected item is not currently eligible for borrowing.';
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

do $$
begin
    if exists (
        select 1 from pg_publication where pubname = 'supabase_realtime'
    ) and not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'medical_equipment'
    ) then
        alter publication supabase_realtime
            add table public.medical_equipment;
    end if;

    if exists (
        select 1 from pg_publication where pubname = 'supabase_realtime'
    ) and not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'mobility_assets'
    ) then
        alter publication supabase_realtime
            add table public.mobility_assets;
    end if;
end
$$;

notify pgrst, 'reload schema';

commit;
