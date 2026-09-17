begin;

create table if not exists public.medtrack_offline_operation_results (
    operation_key text primary key,
    operation_type text not null,
    result jsonb not null,
    created_by uuid not null,
    created_at timestamptz not null default now()
);

alter table public.medtrack_offline_operation_results
enable row level security;

revoke all on table public.medtrack_offline_operation_results
from anon, authenticated;

create or replace function public.medtrack_borrow_item_once(
    p_operation_key text,
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
    v_operation_key text;
    v_existing public.medtrack_offline_operation_results%rowtype;
    v_result jsonb;
begin
    v_operation_key := coalesce(trim(p_operation_key), '');
    if v_operation_key = '' or length(v_operation_key) > 160 then
        raise exception 'A valid borrowing operation key is required.';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(v_operation_key, 0));

    select *
    into v_existing
    from public.medtrack_offline_operation_results
    where operation_key = v_operation_key;

    if found then
        if v_existing.created_by <> auth.uid() or
           v_existing.operation_type <> 'borrow' then
            raise exception 'The borrowing operation key is unavailable.';
        end if;
        return v_existing.result;
    end if;

    v_result := public.medtrack_borrow_item(
        p_item_type,
        p_item_id,
        p_quantity,
        p_borrower,
        p_department,
        p_borrowed_at,
        p_due_date,
        p_purpose,
        p_assigned_personnel,
        p_destination,
        p_remarks
    );

    insert into public.medtrack_offline_operation_results (
        operation_key,
        operation_type,
        result,
        created_by
    ) values (
        v_operation_key,
        'borrow',
        v_result,
        auth.uid()
    );

    return v_result;
end;
$$;

revoke all on function public.medtrack_borrow_item_once(
    text, text, text, integer, text, text, timestamptz, date,
    text, text, text, text
) from public;

grant execute on function public.medtrack_borrow_item_once(
    text, text, text, integer, text, text, timestamptz, date,
    text, text, text, text
) to authenticated;

notify pgrst, 'reload schema';

commit;
