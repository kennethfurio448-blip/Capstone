
create or replace function public.medtrack_record_admin_settings_event(
    p_event text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_action text;
    v_details text;
begin
    if not public.medtrack_is_admin() then
        raise exception 'Administrator access is required.'
            using errcode = '42501';
    end if;

    case trim(coalesce(p_event, ''))
        when 'general_settings_updated' then
            v_action := 'Updated';
            v_details := 'Updated the general system settings.';
        when 'inventory_settings_updated' then
            v_action := 'Updated';
            v_details := 'Updated the inventory settings.';
        when 'notification_settings_updated' then
            v_action := 'Updated';
            v_details := 'Updated the notification settings.';
        when 'password_changed' then
            v_action := 'Updated';
            v_details := 'Changed the Administrator password.';
        when 'encrypted_backup_downloaded' then
            v_action := 'Created';
            v_details := 'Downloaded an encrypted MedTrack backup.';
        when 'encrypted_backup_restored' then
            v_action := 'Updated';
            v_details := 'Restored an encrypted MedTrack backup.';
        else
            raise exception 'Unsupported Settings audit event.';
    end case;

    insert into public.audit_events (
        actor_id,
        action,
        module,
        entity_type,
        entity_id,
        details,
        metadata
    ) values (
        auth.uid(),
        v_action,
        'System Settings',
        'settings',
        trim(p_event),
        v_details,
        jsonb_build_object('source', 'authenticated_client')
    );
end;
$$;

revoke all on function public.medtrack_record_admin_settings_event(text)
from public;

grant execute on function public.medtrack_record_admin_settings_event(text)
to authenticated;

create or replace function public.medtrack_restore_encrypted_backup(
    p_data jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_key text;
begin
    if not public.medtrack_is_admin() then
        raise exception 'Administrator access is required.'
            using errcode = '42501';
    end if;

    if p_data is null or jsonb_typeof(p_data) <> 'object' then
        raise exception 'Invalid backup data.';
    end if;

    foreach v_key in array array[
        'medtrackMedicalSupplies',
        'medtrackMedicalEquipment',
        'medtrackMobilityAssets',
        'medtrackBorrowTransactions',
        'medtrackEmergencyRequests'
    ]
    loop
        if jsonb_typeof(p_data -> v_key) <> 'array' then
            raise exception 'Invalid backup section: %', v_key;
        end if;
    end loop;

    insert into public.medical_supplies (
        id, name, category, quantity, unit, expiration_date,
        low_stock_level, updated_at
    )
    select
        trim(record.id), trim(record.name), trim(record.category),
        record.quantity, trim(record.unit), nullif(record.expiration_date, '')::date,
        record.low_stock_level, now()
    from jsonb_to_recordset(p_data -> 'medtrackMedicalSupplies') as record(
        id text, name text, category text, quantity integer, unit text,
        expiration_date text, low_stock_level integer
    )
    on conflict (id) do update set
        name = excluded.name,
        category = excluded.category,
        quantity = excluded.quantity,
        unit = excluded.unit,
        expiration_date = excluded.expiration_date,
        low_stock_level = excluded.low_stock_level,
        updated_at = now();

    delete from public.medical_supplies item
    where not exists (
        select 1 from jsonb_array_elements(p_data -> 'medtrackMedicalSupplies') entry
        where entry ->> 'id' = item.id
    );

    insert into public.medical_equipment (
        id, name, category, quantity, condition, location,
        maintenance_date, status, updated_at
    )
    select
        trim(record.id), trim(record.name), trim(record.category),
        record.quantity, trim(record.condition), trim(record.location),
        nullif(record.maintenance_date, '')::date, trim(record.status), now()
    from jsonb_to_recordset(p_data -> 'medtrackMedicalEquipment') as record(
        id text, name text, category text, quantity integer, condition text,
        location text, maintenance_date text, status text
    )
    on conflict (id) do update set
        name = excluded.name,
        category = excluded.category,
        quantity = excluded.quantity,
        condition = excluded.condition,
        location = excluded.location,
        maintenance_date = excluded.maintenance_date,
        status = excluded.status,
        updated_at = now();

    delete from public.medical_equipment item
    where not exists (
        select 1 from jsonb_array_elements(p_data -> 'medtrackMedicalEquipment') entry
        where entry ->> 'id' = item.id
    );

    insert into public.mobility_assets (
        id, name, type, plate_number, condition, driver, location,
        maintenance_date, status, updated_at
    )
    select
        trim(record.id), trim(record.name), trim(record.asset_type),
        nullif(trim(record.plate_number), ''), trim(record.condition),
        nullif(trim(record.driver), ''), trim(record.location),
        nullif(record.maintenance_date, '')::date, trim(record.status), now()
    from jsonb_to_recordset(p_data -> 'medtrackMobilityAssets') as record(
        id text, name text, asset_type text, plate_number text, condition text,
        driver text, location text, maintenance_date text, status text
    )
    on conflict (id) do update set
        name = excluded.name,
        type = excluded.type,
        plate_number = excluded.plate_number,
        condition = excluded.condition,
        driver = excluded.driver,
        location = excluded.location,
        maintenance_date = excluded.maintenance_date,
        status = excluded.status,
        updated_at = now();

    delete from public.mobility_assets item
    where not exists (
        select 1 from jsonb_array_elements(p_data -> 'medtrackMobilityAssets') entry
        where entry ->> 'id' = item.id
    );

    insert into public.borrow_transactions (
        id, borrower, department, item_type, item_name, quantity,
        borrow_date, borrowed_at, due_date, return_date, status, purpose,
        assigned_personnel, destination, remarks, inventory_item_id,
        inventory_adjusted, inventory_returned, updated_at
    )
    select
        trim(record.id), trim(record.borrower), trim(record.department),
        trim(record.item_type), trim(record.item_name), record.quantity,
        record.borrow_date::date, record.borrowed_at::timestamptz,
        record.due_date::date, nullif(record.return_date, '')::date,
        trim(record.status), trim(record.purpose),
        nullif(trim(record.assigned_personnel), ''),
        nullif(trim(record.destination), ''), nullif(trim(record.remarks), ''),
        nullif(trim(record.inventory_item_id), ''),
        coalesce(record.inventory_adjusted, false),
        coalesce(record.inventory_returned, false), now()
    from jsonb_to_recordset(p_data -> 'medtrackBorrowTransactions') as record(
        id text, borrower text, department text, item_type text, item_name text,
        quantity integer, borrow_date text, borrowed_at text, due_date text,
        return_date text, status text, purpose text, assigned_personnel text,
        destination text, remarks text, inventory_item_id text,
        inventory_adjusted boolean, inventory_returned boolean
    )
    on conflict (id) do update set
        borrower = excluded.borrower,
        department = excluded.department,
        item_type = excluded.item_type,
        item_name = excluded.item_name,
        quantity = excluded.quantity,
        borrow_date = excluded.borrow_date,
        borrowed_at = excluded.borrowed_at,
        due_date = excluded.due_date,
        return_date = excluded.return_date,
        status = excluded.status,
        purpose = excluded.purpose,
        assigned_personnel = excluded.assigned_personnel,
        destination = excluded.destination,
        remarks = excluded.remarks,
        inventory_item_id = excluded.inventory_item_id,
        inventory_adjusted = excluded.inventory_adjusted,
        inventory_returned = excluded.inventory_returned,
        updated_at = now();

    delete from public.borrow_transactions item
    where not exists (
        select 1 from jsonb_array_elements(p_data -> 'medtrackBorrowTransactions') entry
        where entry ->> 'id' = item.id
    );

    insert into public.emergency_requests (
        id, request_date, request_time, type, priority, location,
        contact_person, contact_number, assigned_team, status, resources,
        description, inventory_usage, inventory_deducted,
        inventory_deducted_at, completed_at, updated_at
    )
    select
        trim(record.id), record.request_date::date, record.request_time::time,
        trim(record.request_type), trim(record.priority), trim(record.location),
        trim(record.contact_person), trim(record.contact_number),
        trim(record.assigned_team), trim(record.status), trim(record.resources),
        trim(record.description), record.inventory_usage,
        coalesce(record.inventory_deducted, false),
        nullif(record.inventory_deducted_at, '')::timestamptz,
        nullif(record.completed_at, '')::timestamptz, now()
    from jsonb_to_recordset(p_data -> 'medtrackEmergencyRequests') as record(
        id text, request_date text, request_time text, request_type text,
        priority text, location text, contact_person text, contact_number text,
        assigned_team text, status text, resources text, description text,
        inventory_usage jsonb, inventory_deducted boolean,
        inventory_deducted_at text, completed_at text
    )
    on conflict (id) do update set
        request_date = excluded.request_date,
        request_time = excluded.request_time,
        type = excluded.type,
        priority = excluded.priority,
        location = excluded.location,
        contact_person = excluded.contact_person,
        contact_number = excluded.contact_number,
        assigned_team = excluded.assigned_team,
        status = excluded.status,
        resources = excluded.resources,
        description = excluded.description,
        inventory_usage = excluded.inventory_usage,
        inventory_deducted = excluded.inventory_deducted,
        inventory_deducted_at = excluded.inventory_deducted_at,
        completed_at = excluded.completed_at,
        updated_at = now();

    delete from public.emergency_requests item
    where not exists (
        select 1 from jsonb_array_elements(p_data -> 'medtrackEmergencyRequests') entry
        where entry ->> 'id' = item.id
    );
end;
$$;

revoke all on function public.medtrack_restore_encrypted_backup(jsonb)
from public;

grant execute on function public.medtrack_restore_encrypted_backup(jsonb)
to authenticated;

notify pgrst, 'reload schema';
