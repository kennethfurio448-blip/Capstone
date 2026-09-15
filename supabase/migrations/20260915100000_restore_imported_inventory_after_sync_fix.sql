begin;

-- This recovery is intentionally non-destructive. It snapshots the current
-- inventory, then restores only rows previously validated and imported from
-- the two approved 2026 source files. Existing records are never overwritten.

insert into public.inventory_cleanup_runs (
    id, reason, status, pre_cleanup_counts
) values (
    '20260915-0000-4000-8000-000000000001'::uuid,
    'Restore source-backed 2026 inventory after preventing browser-cache inferred deletes.',
    'backed_up',
    jsonb_build_object(
        'medical_supplies', (select count(*) from public.medical_supplies),
        'medical_equipment', (select count(*) from public.medical_equipment),
        'mobility_assets', (select count(*) from public.mobility_assets)
    )
) on conflict (id) do nothing;

insert into public.inventory_cleanup_backup_rows (
    run_id, source_table, source_id, row_data
)
select
    '20260915-0000-4000-8000-000000000001'::uuid,
    'medical_supplies', item.id, to_jsonb(item)
from public.medical_supplies item
on conflict do nothing;

insert into public.inventory_cleanup_backup_rows (
    run_id, source_table, source_id, row_data
)
select
    '20260915-0000-4000-8000-000000000001'::uuid,
    'medical_equipment', item.id, to_jsonb(item)
from public.medical_equipment item
on conflict do nothing;

insert into public.inventory_cleanup_backup_rows (
    run_id, source_table, source_id, row_data
)
select
    '20260915-0000-4000-8000-000000000001'::uuid,
    'mobility_assets', item.id, to_jsonb(item)
from public.mobility_assets item
on conflict do nothing;

do $$
declare
    v_supplies integer;
    v_equipment integer;
    v_mobility integer;
begin
    select count(*) into v_supplies
    from public.inventory_import_rows
    where batch_id in (
        '20260914-0000-4000-8000-000000000001'::uuid,
        '20260914-0000-4000-8000-000000000002'::uuid
    )
      and validation_status = 'imported'
      and target_module = 'medical_supplies';

    select count(*) into v_equipment
    from public.inventory_import_rows
    where batch_id in (
        '20260914-0000-4000-8000-000000000001'::uuid,
        '20260914-0000-4000-8000-000000000002'::uuid
    )
      and validation_status = 'imported'
      and target_module = 'medical_equipment';

    select count(*) into v_mobility
    from public.inventory_import_rows
    where batch_id in (
        '20260914-0000-4000-8000-000000000001'::uuid,
        '20260914-0000-4000-8000-000000000002'::uuid
    )
      and validation_status = 'imported'
      and target_module = 'mobility';

    if v_supplies <> 27 or v_equipment <> 30 or v_mobility <> 11 then
        raise exception
            'Approved import manifest mismatch (supplies %, equipment %, mobility %).',
            v_supplies, v_equipment, v_mobility;
    end if;
end
$$;

with source_rows as (
    select imported.*, backup.row_data
    from public.inventory_import_rows imported
    left join lateral (
        select saved.row_data
        from public.inventory_cleanup_backup_rows saved
        where saved.source_table = 'medical_supplies'
          and saved.source_id = coalesce(
              imported.target_id,
              imported.normalized_record ->> 'id'
          )
        order by saved.backed_up_at desc
        limit 1
    ) backup on true
    where imported.batch_id =
            '20260914-0000-4000-8000-000000000001'::uuid
      and imported.validation_status = 'imported'
      and imported.target_module = 'medical_supplies'
)
insert into public.medical_supplies (
    id, name, category, quantity, unit, expiration_date,
    low_stock_level, updated_at
)
select
    coalesce(row_data ->> 'id', normalized_record ->> 'id'),
    coalesce(row_data ->> 'name', normalized_record ->> 'name'),
    coalesce(row_data ->> 'category', normalized_record ->> 'category'),
    coalesce(row_data ->> 'quantity', normalized_record ->> 'quantity')::integer,
    coalesce(row_data ->> 'unit', normalized_record ->> 'unit'),
    nullif(coalesce(
        row_data ->> 'expiration_date',
        normalized_record ->> 'expiration_date'
    ), '')::date,
    coalesce(
        row_data ->> 'low_stock_level',
        normalized_record ->> 'low_stock_level'
    )::integer,
    coalesce(nullif(row_data ->> 'updated_at', '')::timestamptz, now())
from source_rows source
where not exists (
    select 1
    from public.medical_supplies existing
    where public.medtrack_normalize_inventory_text(existing.name) =
        public.medtrack_normalize_inventory_text(
            source.normalized_record ->> 'name'
        )
)
on conflict (id) do nothing;

with source_rows as (
    select imported.*, backup.row_data
    from public.inventory_import_rows imported
    left join lateral (
        select saved.row_data
        from public.inventory_cleanup_backup_rows saved
        where saved.source_table = 'medical_equipment'
          and saved.source_id = coalesce(
              imported.target_id,
              imported.normalized_record ->> 'id'
          )
        order by saved.backed_up_at desc
        limit 1
    ) backup on true
    where imported.batch_id in (
            '20260914-0000-4000-8000-000000000001'::uuid,
            '20260914-0000-4000-8000-000000000002'::uuid
        )
      and imported.validation_status = 'imported'
      and imported.target_module = 'medical_equipment'
)
insert into public.medical_equipment (
    id, name, category, quantity, condition, location,
    maintenance_date, status, updated_at
)
select
    coalesce(row_data ->> 'id', normalized_record ->> 'id'),
    coalesce(row_data ->> 'name', normalized_record ->> 'name'),
    coalesce(row_data ->> 'category', normalized_record ->> 'category'),
    coalesce(row_data ->> 'quantity', normalized_record ->> 'quantity')::integer,
    coalesce(row_data ->> 'condition', normalized_record ->> 'condition'),
    coalesce(row_data ->> 'location', normalized_record ->> 'location'),
    nullif(coalesce(
        row_data ->> 'maintenance_date',
        normalized_record ->> 'maintenance_date'
    ), '')::date,
    coalesce(row_data ->> 'status', normalized_record ->> 'status'),
    coalesce(nullif(row_data ->> 'updated_at', '')::timestamptz, now())
from source_rows source
where not exists (
    select 1
    from public.medical_equipment existing
    where public.medtrack_normalize_inventory_text(existing.name) =
        public.medtrack_normalize_inventory_text(
            source.normalized_record ->> 'name'
        )
)
on conflict (id) do nothing;

with source_rows as (
    select imported.*, backup.row_data
    from public.inventory_import_rows imported
    left join lateral (
        select saved.row_data
        from public.inventory_cleanup_backup_rows saved
        where saved.source_table = 'mobility_assets'
          and saved.source_id = coalesce(
              imported.target_id,
              imported.normalized_record ->> 'id'
          )
        order by saved.backed_up_at desc
        limit 1
    ) backup on true
    where imported.batch_id =
            '20260914-0000-4000-8000-000000000002'::uuid
      and imported.validation_status = 'imported'
      and imported.target_module = 'mobility'
)
insert into public.mobility_assets (
    id, name, type, plate_number, condition, driver, location,
    maintenance_date, status, updated_at
)
select
    coalesce(row_data ->> 'id', normalized_record ->> 'id'),
    coalesce(row_data ->> 'name', normalized_record ->> 'name'),
    coalesce(row_data ->> 'type', normalized_record ->> 'type'),
    nullif(coalesce(
        row_data ->> 'plate_number',
        normalized_record ->> 'plate_number'
    ), ''),
    coalesce(row_data ->> 'condition', normalized_record ->> 'condition'),
    nullif(coalesce(row_data ->> 'driver', normalized_record ->> 'driver'), ''),
    coalesce(row_data ->> 'location', normalized_record ->> 'location'),
    nullif(coalesce(
        row_data ->> 'maintenance_date',
        normalized_record ->> 'maintenance_date'
    ), '')::date,
    coalesce(row_data ->> 'status', normalized_record ->> 'status'),
    coalesce(nullif(row_data ->> 'updated_at', '')::timestamptz, now())
from source_rows source
where not exists (
    select 1
    from public.mobility_assets existing
    where (
        nullif(source.normalized_record ->> 'plate_number', '') is not null
        and public.medtrack_normalize_inventory_text(existing.plate_number) =
            public.medtrack_normalize_inventory_text(
                source.normalized_record ->> 'plate_number'
            )
    ) or public.medtrack_normalize_inventory_text(existing.name) =
        public.medtrack_normalize_inventory_text(
            source.normalized_record ->> 'name'
        )
)
on conflict (id) do nothing;

update public.inventory_import_rows imported
set target_id = matched.id,
    target_table = 'medical_supplies',
    updated_at = now()
from public.medical_supplies matched
where imported.batch_id =
        '20260914-0000-4000-8000-000000000001'::uuid
  and imported.validation_status = 'imported'
  and imported.target_module = 'medical_supplies'
  and public.medtrack_normalize_inventory_text(matched.name) =
      public.medtrack_normalize_inventory_text(
          imported.normalized_record ->> 'name'
      );

update public.inventory_import_rows imported
set target_id = matched.id,
    target_table = 'medical_equipment',
    updated_at = now()
from public.medical_equipment matched
where imported.batch_id in (
        '20260914-0000-4000-8000-000000000001'::uuid,
        '20260914-0000-4000-8000-000000000002'::uuid
    )
  and imported.validation_status = 'imported'
  and imported.target_module = 'medical_equipment'
  and public.medtrack_normalize_inventory_text(matched.name) =
      public.medtrack_normalize_inventory_text(
          imported.normalized_record ->> 'name'
      );

update public.inventory_import_rows imported
set target_id = matched.id,
    target_table = 'mobility_assets',
    updated_at = now()
from public.mobility_assets matched
where imported.batch_id =
        '20260914-0000-4000-8000-000000000002'::uuid
  and imported.validation_status = 'imported'
  and imported.target_module = 'mobility'
  and (
      (
          nullif(imported.normalized_record ->> 'plate_number', '') is not null
          and public.medtrack_normalize_inventory_text(matched.plate_number) =
              public.medtrack_normalize_inventory_text(
                  imported.normalized_record ->> 'plate_number'
              )
      ) or public.medtrack_normalize_inventory_text(matched.name) =
          public.medtrack_normalize_inventory_text(
              imported.normalized_record ->> 'name'
          )
  );

do $$
declare
    v_supplies integer;
    v_equipment integer;
    v_mobility integer;
begin
    select count(*) into v_supplies
    from public.inventory_import_rows imported
    join public.medical_supplies item on item.id = imported.target_id
    where imported.batch_id =
            '20260914-0000-4000-8000-000000000001'::uuid
      and imported.validation_status = 'imported'
      and imported.target_module = 'medical_supplies';

    select count(*) into v_equipment
    from public.inventory_import_rows imported
    join public.medical_equipment item on item.id = imported.target_id
    where imported.batch_id in (
            '20260914-0000-4000-8000-000000000001'::uuid,
            '20260914-0000-4000-8000-000000000002'::uuid
        )
      and imported.validation_status = 'imported'
      and imported.target_module = 'medical_equipment';

    select count(*) into v_mobility
    from public.inventory_import_rows imported
    join public.mobility_assets item on item.id = imported.target_id
    where imported.batch_id =
            '20260914-0000-4000-8000-000000000002'::uuid
      and imported.validation_status = 'imported'
      and imported.target_module = 'mobility';

    if v_supplies <> 27 or v_equipment <> 30 or v_mobility <> 11 then
        raise exception
            'Inventory recovery verification failed (supplies %, equipment %, mobility %).',
            v_supplies, v_equipment, v_mobility;
    end if;
end
$$;

update public.inventory_cleanup_runs
set status = 'completed',
    candidate_counts = jsonb_build_object(
        'medical_supplies', 27,
        'medical_equipment', 30,
        'mobility_assets', 11
    ),
    deleted_counts = '{}'::jsonb,
    completed_at = now()
where id = '20260915-0000-4000-8000-000000000001'::uuid;

insert into public.audit_events (
    actor_name, actor_role, action, module, entity_type,
    entity_id, details, metadata
)
select
    'System', 'system', 'Restored', 'Inventory Recovery',
    'inventory_cleanup_run', run.id::text,
    'Restored the 68 approved source-backed inventory records without overwriting existing records.',
    jsonb_build_object(
        'medicalSupplies', 27,
        'medicalEquipment', 30,
        'mobilityAssets', 11,
        'deletedRecords', 0,
        'preRestoreCounts', run.pre_cleanup_counts
    )
from public.inventory_cleanup_runs run
where run.id = '20260915-0000-4000-8000-000000000001'::uuid
  and not exists (
      select 1 from public.audit_events event
      where event.module = 'Inventory Recovery'
        and event.entity_id = run.id::text
  );

notify pgrst, 'reload schema';

commit;
