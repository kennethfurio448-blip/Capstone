begin;

create sequence if not exists public.medtrack_medical_supply_id_seq;
create sequence if not exists public.medtrack_medical_equipment_id_seq;
create sequence if not exists public.medtrack_mobility_asset_id_seq;

do $$
declare
    v_maximum bigint;
begin
    select coalesce(max(substring(id from '([0-9]+)$')::bigint), 0)
    into v_maximum
    from public.medical_supplies
    where id ~ '^MED-(IMP-[0-9]{4}-[A-Z0-9]+-)?[0-9]+$';

    perform setval(
        'public.medtrack_medical_supply_id_seq',
        greatest(v_maximum, 1),
        v_maximum > 0
    );

    select coalesce(max(substring(id from '([0-9]+)$')::bigint), 0)
    into v_maximum
    from public.medical_equipment
    where id ~ '^EQP-(IMP-[0-9]{4}-[A-Z0-9]+-)?[0-9]+$';

    perform setval(
        'public.medtrack_medical_equipment_id_seq',
        greatest(v_maximum, 1),
        v_maximum > 0
    );

    select coalesce(max(substring(id from '([0-9]+)$')::bigint), 0)
    into v_maximum
    from public.mobility_assets
    where id ~ '^MOB-(IMP-[0-9]{4}-[A-Z0-9]+-)?[0-9]+$';

    perform setval(
        'public.medtrack_mobility_asset_id_seq',
        greatest(v_maximum, 1),
        v_maximum > 0
    );
end;
$$;

create or replace function public.medtrack_allocate_inventory_id(
    p_inventory_module text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_year text := extract(
        year from timezone('Asia/Manila', now())
    )::integer::text;
    v_sequence bigint;
begin
    if not public.medtrack_is_active_user() then
        raise exception 'Active inventory management access is required.'
            using errcode = '42501';
    end if;

    case lower(coalesce(trim(p_inventory_module), ''))
        when 'medical_supplies' then
            v_sequence := nextval('public.medtrack_medical_supply_id_seq');
            return 'MED-IMP-' || v_year || '-TB-' ||
                lpad(v_sequence::text, 3, '0');
        when 'medical_equipment' then
            v_sequence := nextval('public.medtrack_medical_equipment_id_seq');
            return 'EQP-IMP-' || v_year || '-TB-' ||
                lpad(v_sequence::text, 3, '0');
        when 'mobility_assets' then
            v_sequence := nextval('public.medtrack_mobility_asset_id_seq');
            return 'MOB-IMP-' || v_year || '-DVI-' ||
                lpad(v_sequence::text, 3, '0');
        else
            raise exception 'Unsupported inventory module.';
    end case;
end;
$$;

revoke all on function public.medtrack_allocate_inventory_id(text)
from public;

grant execute on function public.medtrack_allocate_inventory_id(text)
to authenticated;

notify pgrst, 'reload schema';

commit;
