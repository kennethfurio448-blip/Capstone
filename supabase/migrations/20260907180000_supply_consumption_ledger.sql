-- Medical supply additions and emergency consumption ledger.
-- Stock changes and their audit records are committed atomically.

create table if not exists public.medical_supply_transactions (
    id bigint generated always as identity primary key,
    operation_key text not null unique,
    transaction_type text not null
        check (transaction_type in ('added', 'consumed')),
    supply_id text not null,
    supply_name text not null,
    unit text not null,
    quantity integer not null check (quantity > 0),
    emergency_request_id text,
    emergency_label text,
    occurred_at timestamptz not null default now(),
    remaining_stock integer not null check (remaining_stock >= 0),
    created_by uuid,
    created_at timestamptz not null default now(),
    constraint consumed_supply_requires_emergency check (
        transaction_type <> 'consumed' or
        emergency_request_id is not null
    )
);

create index if not exists medical_supply_transactions_occurred_at_idx
on public.medical_supply_transactions (occurred_at desc);

create index if not exists medical_supply_transactions_emergency_idx
on public.medical_supply_transactions (emergency_request_id);

alter table public.medical_supply_transactions
enable row level security;

drop policy if exists "Active users can view supply transactions"
on public.medical_supply_transactions;

create policy "Active users can view supply transactions"
on public.medical_supply_transactions
for select
to authenticated
using (
    exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and profiles.status = 'active'
          and profiles.role in ('admin', 'staff')
    )
);

revoke all on table public.medical_supply_transactions
from anon, authenticated;

grant select on table public.medical_supply_transactions
to authenticated;


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


create or replace function public.medtrack_consume_medical_supply(
    p_operation_key text,
    p_supply_id text,
    p_emergency_request_id text,
    p_quantity integer,
    p_consumed_at timestamptz,
    p_emergency_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_supply_name text;
    v_unit text;
    v_remaining_stock integer;
    v_emergency_label text;
    v_claimed_operation text;
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

    if coalesce(trim(p_operation_key), '') = '' then
        raise exception 'An inventory operation key is required.';
    end if;

    if coalesce(trim(p_emergency_request_id), '') = '' then
        raise exception 'An emergency response is required.';
    end if;

    if p_quantity is null or p_quantity < 1 then
        raise exception 'Quantity consumed must be at least 1.';
    end if;

    select concat(
        id,
        ' - ',
        type,
        ' - ',
        location
    )
    into v_emergency_label
    from public.emergency_requests
    where id = p_emergency_request_id;

    if not found then
        v_emergency_label := coalesce(
            nullif(trim(p_emergency_label), ''),
            p_emergency_request_id
        );
    end if;

    insert into public.medtrack_inventory_operations (
        operation_key,
        item_type,
        item_id,
        quantity,
        created_by
    ) values (
        p_operation_key,
        'Medical Supply Consumption',
        p_supply_id,
        p_quantity,
        auth.uid()
    )
    on conflict (operation_key) do nothing
    returning operation_key into v_claimed_operation;

    if v_claimed_operation is null then
        select supply_name, unit, remaining_stock
        into v_supply_name, v_unit, v_remaining_stock
        from public.medical_supply_transactions
        where operation_key = p_operation_key;

        return jsonb_build_object(
            'supplyId', p_supply_id,
            'itemName', v_supply_name,
            'quantityUsed', 0,
            'remainingStock', v_remaining_stock,
            'alreadyApplied', true
        );
    end if;

    update public.medical_supplies
    set quantity = quantity - p_quantity,
        updated_at = now()
    where id = p_supply_id
      and quantity >= p_quantity
    returning name, unit, quantity
    into v_supply_name, v_unit, v_remaining_stock;

    if not found then
        raise exception 'The requested quantity is no longer available.';
    end if;

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
        'consumed',
        p_supply_id,
        v_supply_name,
        v_unit,
        p_quantity,
        p_emergency_request_id,
        v_emergency_label,
        coalesce(p_consumed_at, now()),
        v_remaining_stock,
        auth.uid()
    );

    return jsonb_build_object(
        'supplyId', p_supply_id,
        'itemName', v_supply_name,
        'quantityUsed', p_quantity,
        'remainingStock', v_remaining_stock,
        'alreadyApplied', false
    );
end;
$$;


revoke all on function public.medtrack_save_medical_supply(
    text, text, text, text, integer, text, date, integer
) from public;

revoke all on function public.medtrack_consume_medical_supply(
    text, text, text, integer, timestamptz, text
) from public;

grant execute on function public.medtrack_save_medical_supply(
    text, text, text, text, integer, text, date, integer
) to authenticated;

grant execute on function public.medtrack_consume_medical_supply(
    text, text, text, integer, timestamptz, text
) to authenticated;


-- Represent stock that predates this ledger as an opening addition.
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
)
select
    'OPENING:' || id,
    'added',
    id,
    name,
    unit,
    quantity,
    null,
    'Opening inventory balance',
    coalesce(updated_at, now()),
    quantity,
    null
from public.medical_supplies
where quantity > 0
on conflict (operation_key) do nothing;

-- Make the new table and RPC signatures visible to PostgREST immediately.
notify pgrst, 'reload schema';
