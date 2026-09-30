begin;

create index if not exists inventory_activity_type_occurred_id_idx
on public.inventory_activity_events (event_type, occurred_at desc, id desc);

create or replace function public.medtrack_restore_encrypted_backup(p_data jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if not public.medtrack_is_admin() then
        raise exception 'Administrator access is required.'
            using errcode = '42501';
    end if;

    perform public.medtrack_restore_encrypted_backup_without_priority(p_data);

    update public.emergency_requests request
    set priority = case
        when entry.value ->> 'priority' in ('Low', 'Medium', 'High', 'Critical')
            then entry.value ->> 'priority'
        else 'Medium'
    end
    from jsonb_array_elements(p_data -> 'medtrackEmergencyRequests') entry(value)
    where entry.value ->> 'id' = request.id;

    update public.medical_equipment equipment
    set maintenance_type = case
        when entry.value ->> 'maintenance_type' in (
            'Inspection', 'Calibration', 'Cleaning',
            'Repair', 'Replacement', 'Not required'
        ) then entry.value ->> 'maintenance_type'
        else 'Inspection'
    end
    from jsonb_array_elements(p_data -> 'medtrackMedicalEquipment') entry(value)
    where entry.value ->> 'id' = equipment.id;
end;
$$;

revoke all on function public.medtrack_restore_encrypted_backup(jsonb)
from public;

grant execute on function public.medtrack_restore_encrypted_backup(jsonb)
to authenticated;

notify pgrst, 'reload schema';

commit;
