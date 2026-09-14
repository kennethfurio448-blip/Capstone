begin;

do $$
declare
    v_run public.inventory_cleanup_runs%rowtype;
    v_backup_count integer;
    v_expected_backup_count integer;
    v_missing_targets integer;
    v_undeleted_candidates integer;
begin
    select * into v_run
    from public.inventory_cleanup_runs
    where id = '20260914-0000-4000-8000-000000000003'::uuid;

    if not found or v_run.status <> 'completed' then
        raise exception 'Inventory cleanup did not complete.';
    end if;

    v_expected_backup_count :=
        coalesce((v_run.pre_cleanup_counts ->> 'medical_supplies')::integer, 0) +
        coalesce((v_run.pre_cleanup_counts ->> 'medical_equipment')::integer, 0) +
        coalesce((v_run.pre_cleanup_counts ->> 'mobility_assets')::integer, 0);

    select count(*) into v_backup_count
    from public.inventory_cleanup_backup_rows
    where run_id = v_run.id
      and source_table in (
          'medical_supplies', 'medical_equipment', 'mobility_assets'
      );

    if v_backup_count <> v_expected_backup_count then
        raise exception
            'Inventory backup mismatch: expected %, found %.',
            v_expected_backup_count, v_backup_count;
    end if;

    select count(*) into v_undeleted_candidates
    from public.inventory_cleanup_candidates candidate
    where candidate.run_id = v_run.id
      and (
          (candidate.source_table = 'medical_supplies' and exists (
              select 1 from public.medical_supplies item
              where item.id = candidate.source_id
          ))
          or
          (candidate.source_table = 'medical_equipment' and exists (
              select 1 from public.medical_equipment item
              where item.id = candidate.source_id
          ))
          or
          (candidate.source_table = 'mobility_assets' and exists (
              select 1 from public.mobility_assets item
              where item.id = candidate.source_id
          ))
      );

    if v_undeleted_candidates <> 0 then
        raise exception '% verified demo candidates remain.',
            v_undeleted_candidates;
    end if;

    select count(*) into v_missing_targets
    from public.inventory_import_rows imported
    where imported.target_id is not null
      and imported.target_table in (
          'medical_supplies', 'medical_equipment', 'mobility_assets'
      )
      and not (
          (imported.target_table = 'medical_supplies' and exists (
              select 1 from public.medical_supplies item
              where item.id = imported.target_id
          ))
          or
          (imported.target_table = 'medical_equipment' and exists (
              select 1 from public.medical_equipment item
              where item.id = imported.target_id
          ))
          or
          (imported.target_table = 'mobility_assets' and exists (
              select 1 from public.mobility_assets item
              where item.id = imported.target_id
          ))
      );

    if v_missing_targets <> 0 then
        raise exception '% source-backed inventory targets are missing.',
            v_missing_targets;
    end if;

    if not exists (
        select 1 from pg_class table_record
        join pg_namespace schema_record
          on schema_record.oid = table_record.relnamespace
        where schema_record.nspname = 'public'
          and table_record.relname = 'inventory_activity_events'
          and table_record.relrowsecurity
    ) then
        raise exception 'Inventory activity RLS is not enabled.';
    end if;

    if not exists (
        select 1 from pg_proc function_record
        join pg_namespace schema_record
          on schema_record.oid = function_record.pronamespace
        where schema_record.nspname = 'public'
          and function_record.proname = 'medtrack_inventory_activity_trends'
    ) then
        raise exception 'Inventory trends function is missing.';
    end if;
end
$$;

notify pgrst, 'reload schema';

commit;
