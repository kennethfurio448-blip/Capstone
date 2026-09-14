do $$
declare
    v_batch_ids uuid[] := array[
        '20260914-0000-4000-8000-000000000001'::uuid,
        '20260914-0000-4000-8000-000000000002'::uuid
    ];
    v_batch_count integer;
    v_total_count integer;
    v_pending_count integer;
    v_imported_count integer;
    v_duplicate_count integer;
    v_unresolved_count integer;
begin
    select count(*) into v_batch_count
    from public.inventory_import_batches
    where id = any(v_batch_ids);

    if v_batch_count <> 2 then
        raise exception 'Inventory import verification failed: expected 2 batches, found %.',
            v_batch_count;
    end if;

    select
        count(*),
        count(*) filter (where validation_status = 'pending'),
        count(*) filter (where validation_status = 'imported'),
        count(*) filter (where validation_status = 'duplicate'),
        count(*) filter (
            where validation_status in ('ready', 'error')
               or validation_status = 'imported'
                  and (target_table is null or target_id is null)
               or validation_status = 'duplicate'
                  and target_id is not null
                  and target_table is null
        )
    into
        v_total_count,
        v_pending_count,
        v_imported_count,
        v_duplicate_count,
        v_unresolved_count
    from public.inventory_import_rows
    where batch_id = any(v_batch_ids);

    if v_total_count <> 121 then
        raise exception 'Inventory import verification failed: expected 121 staged rows, found %.',
            v_total_count;
    end if;

    if v_pending_count <> 16 then
        raise exception 'Inventory import verification failed: expected 16 pending rows, found %.',
            v_pending_count;
    end if;

    if v_imported_count + v_duplicate_count <> 105 then
        raise exception 'Inventory import verification failed: expected 105 resolved rows, found % imported and % duplicate.',
            v_imported_count,
            v_duplicate_count;
    end if;

    if v_duplicate_count < 37 then
        raise exception 'Inventory import verification failed: expected at least 37 source-template duplicates, found %.',
            v_duplicate_count;
    end if;

    if v_unresolved_count <> 0 then
        raise exception 'Inventory import verification failed: found % unresolved promoted rows.',
            v_unresolved_count;
    end if;

    if exists (
        select 1
        from public.inventory_import_rows import_row
        where import_row.batch_id = any(v_batch_ids)
          and import_row.validation_status in ('imported', 'duplicate')
          and import_row.target_id is not null
          and not (
              import_row.target_table = 'medical_supplies'
              and exists (
                  select 1 from public.medical_supplies supply
                  where supply.id = import_row.target_id
              )
              or import_row.target_table = 'medical_equipment'
              and exists (
                  select 1 from public.medical_equipment equipment
                  where equipment.id = import_row.target_id
              )
              or import_row.target_table = 'mobility_assets'
              and exists (
                  select 1 from public.mobility_assets asset
                  where asset.id = import_row.target_id
              )
          )
    ) then
        raise exception 'Inventory import verification failed: a resolved staging row references a missing inventory record.';
    end if;
end
$$;
