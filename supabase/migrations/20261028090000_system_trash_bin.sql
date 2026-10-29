-- Centralized, auditable recycle bin for MedTrack operational records.

create extension if not exists pgcrypto;

create table if not exists public.trash_records (
    id uuid primary key default gen_random_uuid(),
    source_table text not null,
    record_id text not null,
    module text not null,
    record_name text not null,
    record_details jsonb not null default '{}'::jsonb,
    record_data jsonb not null,
    deleted_by uuid references public.profiles(id) on delete set null,
    deleted_by_name text not null default 'MedTrack User',
    deleted_at timestamptz not null default now(),
    operation_key text not null unique,
    restored_by uuid references public.profiles(id) on delete set null,
    restored_at timestamptz,
    permanently_deleted_by uuid references public.profiles(id) on delete set null,
    permanently_deleted_at timestamptz,
    constraint trash_records_source_table_check check (
        source_table in (
            'medical_supplies',
            'medical_equipment',
            'mobility_assets',
            'emergency_requests',
            'profiles'
        )
    )
);

create unique index if not exists trash_records_active_source_idx
    on public.trash_records (source_table, record_id)
    where restored_at is null and permanently_deleted_at is null;

create index if not exists trash_records_active_date_idx
    on public.trash_records (deleted_at desc)
    where restored_at is null and permanently_deleted_at is null;

alter table public.trash_records enable row level security;

revoke all on table public.trash_records from anon, authenticated;
grant select on table public.trash_records to authenticated;
grant select, insert, update on table public.trash_records to service_role;

drop policy if exists "Active users can read recoverable trash" on public.trash_records;
create policy "Active users can read recoverable trash"
on public.trash_records for select to authenticated
using (
    public.medtrack_is_active_user()
    and restored_at is null
    and permanently_deleted_at is null
    and (source_table <> 'profiles' or public.medtrack_is_admin())
);

create or replace function public.medtrack_enrich_trash_actor()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    new.deleted_by := coalesce(new.deleted_by, auth.uid());
    select coalesce(nullif(trim(full_name), ''), nullif(trim(username), ''), 'MedTrack User')
    into new.deleted_by_name
    from public.profiles where id = new.deleted_by;
    new.deleted_by_name := coalesce(new.deleted_by_name, 'MedTrack User');
    return new;
end;
$$;

drop trigger if exists enrich_trash_actor on public.trash_records;
create trigger enrich_trash_actor
before insert on public.trash_records
for each row execute function public.medtrack_enrich_trash_actor();

create or replace function public.medtrack_trash_module(p_table text)
returns text
language sql
immutable
set search_path = ''
as $$
    select case p_table
        when 'medical_supplies' then 'Medical Supplies'
        when 'medical_equipment' then 'Medical Equipment'
        when 'mobility_assets' then 'Mobility'
        when 'emergency_requests' then 'Emergency Response'
        when 'profiles' then 'User Management'
        else 'System'
    end;
$$;

create or replace function public.medtrack_soft_delete(
    p_source_table text,
    p_record_id text,
    p_trash_id uuid,
    p_operation_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_row jsonb;
    v_trash public.trash_records%rowtype;
    v_name text;
    v_details jsonb;
begin
    if not public.medtrack_is_active_user() then
        raise exception 'Active MedTrack access is required.' using errcode = '42501';
    end if;

    if p_source_table not in (
        'medical_supplies', 'medical_equipment',
        'mobility_assets', 'emergency_requests'
    ) then
        raise exception 'This record type cannot be moved to Trash.' using errcode = '22023';
    end if;

    if coalesce(trim(p_record_id), '') = '' or
       coalesce(trim(p_operation_key), '') = '' or p_trash_id is null then
        raise exception 'A record, Trash ID, and operation key are required.';
    end if;

    select * into v_trash
    from public.trash_records
    where operation_key = p_operation_key;

    if found then
        return to_jsonb(v_trash);
    end if;

    execute format(
        'select to_jsonb(source_row) from public.%I source_row where id::text = $1 for update',
        p_source_table
    ) into v_row using p_record_id;

    if v_row is null then
        select * into v_trash
        from public.trash_records
        where source_table = p_source_table
          and record_id = p_record_id
          and restored_at is null
          and permanently_deleted_at is null;
        if found then return to_jsonb(v_trash); end if;
        raise exception 'The selected record no longer exists.' using errcode = 'P0002';
    end if;

    v_name := coalesce(
        nullif(v_row ->> 'name', ''),
        nullif(v_row ->> 'type', ''),
        nullif(v_row ->> 'contact_person', ''),
        p_record_id
    );
    v_details := jsonb_strip_nulls(jsonb_build_object(
        'category', v_row ->> 'category',
        'quantity', v_row -> 'quantity',
        'location', v_row ->> 'location',
        'status', v_row ->> 'status',
        'date', v_row ->> 'request_date'
    ));

    insert into public.trash_records (
        id, source_table, record_id, module, record_name,
        record_details, record_data, deleted_by, operation_key
    ) values (
        p_trash_id, p_source_table, p_record_id,
        public.medtrack_trash_module(p_source_table), v_name,
        v_details, v_row, auth.uid(), p_operation_key
    ) returning * into v_trash;

    execute format('delete from public.%I where id::text = $1', p_source_table)
        using p_record_id;

    insert into public.audit_events (
        actor_id, action, module, entity_type, entity_id, details, metadata
    ) values (
        auth.uid(), 'Moved to Trash', v_trash.module, p_source_table,
        p_record_id, 'Moved ' || lower(v_trash.module) || ' record ' ||
        p_record_id || ' to the Trash Bin.',
        jsonb_build_object('trashId', p_trash_id, 'operationKey', p_operation_key)
    );

    return to_jsonb(v_trash);
end;
$$;

create or replace function public.medtrack_restore_trash_record(
    p_trash_id uuid,
    p_operation_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_trash public.trash_records%rowtype;
begin
    if not public.medtrack_is_active_user() then
        raise exception 'Active MedTrack access is required.' using errcode = '42501';
    end if;

    select * into v_trash from public.trash_records
    where id = p_trash_id for update;

    if not found then
        raise exception 'The Trash record was not found.' using errcode = 'P0002';
    end if;
    if v_trash.source_table = 'profiles' then
        raise exception 'User accounts must be restored through secure account administration.'
            using errcode = '42501';
    end if;
    if v_trash.permanently_deleted_at is not null then
        raise exception 'This record was permanently deleted.';
    end if;
    if v_trash.restored_at is not null then
        return to_jsonb(v_trash);
    end if;

    execute format(
        'insert into public.%I select * from jsonb_populate_record(null::public.%I, $1)',
        v_trash.source_table, v_trash.source_table
    ) using v_trash.record_data;

    update public.trash_records
    set restored_by = auth.uid(), restored_at = now()
    where id = p_trash_id
    returning * into v_trash;

    insert into public.audit_events (
        actor_id, action, module, entity_type, entity_id, details, metadata
    ) values (
        auth.uid(), 'Restored', v_trash.module, v_trash.source_table,
        v_trash.record_id, 'Restored ' || lower(v_trash.module) || ' record ' ||
        v_trash.record_id || ' from the Trash Bin.',
        jsonb_build_object('trashId', p_trash_id, 'operationKey', p_operation_key)
    );

    return to_jsonb(v_trash);
exception
    when unique_violation then
        raise exception 'A record with the same ID already exists. Remove the conflict before restoring.'
            using errcode = '23505';
end;
$$;

create or replace function public.medtrack_permanently_delete_trash_record(
    p_trash_id uuid,
    p_operation_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_trash public.trash_records%rowtype;
begin
    if not public.medtrack_is_admin() then
        raise exception 'Administrator access is required.' using errcode = '42501';
    end if;

    select * into v_trash from public.trash_records
    where id = p_trash_id for update;
    if not found then
        raise exception 'The Trash record was not found.' using errcode = 'P0002';
    end if;
    if v_trash.source_table = 'profiles' then
        raise exception 'User accounts require secure account administration.'
            using errcode = '42501';
    end if;
    if v_trash.restored_at is not null then
        raise exception 'A restored record cannot be permanently deleted from Trash.';
    end if;
    if v_trash.permanently_deleted_at is not null then
        return to_jsonb(v_trash);
    end if;

    update public.trash_records
    set permanently_deleted_by = auth.uid(),
        permanently_deleted_at = now(),
        record_data = '{}'::jsonb
    where id = p_trash_id
    returning * into v_trash;

    insert into public.audit_events (
        actor_id, action, module, entity_type, entity_id, details, metadata
    ) values (
        auth.uid(), 'Permanently Deleted', v_trash.module, v_trash.source_table,
        v_trash.record_id, 'Permanently deleted ' || lower(v_trash.module) ||
        ' record ' || v_trash.record_id || ' from the Trash Bin.',
        jsonb_build_object('trashId', p_trash_id, 'operationKey', p_operation_key)
    );

    return to_jsonb(v_trash);
end;
$$;

revoke all on function public.medtrack_trash_module(text) from public;
revoke all on function public.medtrack_soft_delete(text, text, uuid, text) from public;
revoke all on function public.medtrack_restore_trash_record(uuid, text) from public;
revoke all on function public.medtrack_permanently_delete_trash_record(uuid, text) from public;

grant execute on function public.medtrack_soft_delete(text, text, uuid, text) to authenticated;
grant execute on function public.medtrack_restore_trash_record(uuid, text) to authenticated;
grant execute on function public.medtrack_permanently_delete_trash_record(uuid, text) to authenticated;

notify pgrst, 'reload schema';
