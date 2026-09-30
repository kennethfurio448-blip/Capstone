begin;

alter table public.medical_equipment
add column if not exists maintenance_type text;

update public.medical_equipment
set maintenance_type = case
    when lower(name) ~ '(bp apparatus|glucometer|pulse oximeter|thermometer)'
        then 'Calibration'
    when lower(name) ~ '(bandage scissors|forceps|cpr mask|trauma shears)'
        then 'Cleaning'
    when lower(name) ~ '(oxygen|hydraulic|pump motor|spreader|cutter|rescue|life detector|drone|throwline|underwater|sonar|tripod|lifting bag|regulator|cylinder|hose|cribbing|ram|remote controller)'
        then 'Inspection'
    else 'Inspection'
end
where maintenance_type is null
   or trim(maintenance_type) = '';

alter table public.medical_equipment
alter column maintenance_type set default 'Inspection';

alter table public.medical_equipment
alter column maintenance_type set not null;

alter table public.medical_equipment
drop constraint if exists medical_equipment_maintenance_type_check;

alter table public.medical_equipment
add constraint medical_equipment_maintenance_type_check check (
    maintenance_type in (
        'Inspection',
        'Calibration',
        'Cleaning',
        'Repair',
        'Replacement',
        'Not required'
    )
);

notify pgrst, 'reload schema';

commit;
