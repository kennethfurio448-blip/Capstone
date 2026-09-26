-- Complete the three reserved medical-supply IDs that were held back during
-- the 2026 import because the source checklist listed their quantities as N/A.
-- Quantity zero keeps the records visible without claiming unverified stock.

insert into public.medical_supplies (
    id,
    name,
    category,
    quantity,
    unit,
    expiration_date,
    low_stock_level,
    updated_at
) values
    (
        'MED-IMP-2026-TB-007',
        'Gauze Roll Bandage (2 Inches x 4.1 Yards)',
        'First Aid',
        0,
        'Pieces',
        null,
        10,
        now()
    ),
    (
        'MED-IMP-2026-TB-008',
        'Gauze Roll Bandage (4 Inches x 4.1 Yards)',
        'First Aid',
        0,
        'Pieces',
        null,
        10,
        now()
    ),
    (
        'MED-IMP-2026-TB-009',
        'Glucose Test Strips (50pcs/Box)',
        'Emergency Supply',
        0,
        'Boxes',
        null,
        10,
        now()
    )
on conflict (id) do nothing;

update public.inventory_import_rows import_row
set validation_status = 'imported',
    target_table = 'medical_supplies',
    target_id = import_row.normalized_record ->> 'id',
    issues = import_row.issues ||
        '["quantity_defaulted_to_zero_for_sequence_completion"]'::jsonb,
    updated_at = now()
where import_row.batch_id =
        '20260914-0000-4000-8000-000000000001'::uuid
  and import_row.normalized_record ->> 'id' in (
      'MED-IMP-2026-TB-007',
      'MED-IMP-2026-TB-008',
      'MED-IMP-2026-TB-009'
  )
  and exists (
      select 1
      from public.medical_supplies supply
      where supply.id = import_row.normalized_record ->> 'id'
  );

notify pgrst, 'reload schema';
