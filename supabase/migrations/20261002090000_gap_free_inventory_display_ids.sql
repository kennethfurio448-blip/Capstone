begin;

alter table public.medical_supplies
add column if not exists display_id text;

alter table public.medical_equipment
add column if not exists display_id text;

alter table public.mobility_assets
add column if not exists display_id text;

with ranked as (
    select id,
           regexp_replace(id, '[0-9]+$', '') as prefix,
           greatest(length(substring(id from '([0-9]+)$')), 3) as width,
           row_number() over (
               partition by regexp_replace(id, '[0-9]+$', '')
               order by substring(id from '([0-9]+)$')::bigint, id
           ) as sequence_number
    from public.medical_supplies
    where id ~ '[0-9]+$'
)
update public.medical_supplies item
set display_id = ranked.prefix ||
    lpad(ranked.sequence_number::text, ranked.width, '0')
from ranked
where ranked.id = item.id;

update public.medical_supplies
set display_id = id
where display_id is null or trim(display_id) = '';

with ranked as (
    select id,
           regexp_replace(id, '[0-9]+$', '') as prefix,
           greatest(length(substring(id from '([0-9]+)$')), 3) as width,
           row_number() over (
               partition by regexp_replace(id, '[0-9]+$', '')
               order by substring(id from '([0-9]+)$')::bigint, id
           ) as sequence_number
    from public.medical_equipment
    where id ~ '[0-9]+$'
)
update public.medical_equipment item
set display_id = ranked.prefix ||
    lpad(ranked.sequence_number::text, ranked.width, '0')
from ranked
where ranked.id = item.id;

update public.medical_equipment
set display_id = id
where display_id is null or trim(display_id) = '';

with ranked as (
    select id,
           regexp_replace(id, '[0-9]+$', '') as prefix,
           greatest(length(substring(id from '([0-9]+)$')), 3) as width,
           row_number() over (
               partition by regexp_replace(id, '[0-9]+$', '')
               order by substring(id from '([0-9]+)$')::bigint, id
           ) as sequence_number
    from public.mobility_assets
    where id ~ '[0-9]+$'
)
update public.mobility_assets item
set display_id = ranked.prefix ||
    lpad(ranked.sequence_number::text, ranked.width, '0')
from ranked
where ranked.id = item.id;

update public.mobility_assets
set display_id = id
where display_id is null or trim(display_id) = '';

alter table public.medical_supplies
alter column display_id set not null;

alter table public.medical_equipment
alter column display_id set not null;

alter table public.mobility_assets
alter column display_id set not null;

create unique index if not exists medical_supplies_display_id_unique
on public.medical_supplies (display_id);

create unique index if not exists medical_equipment_display_id_unique
on public.medical_equipment (display_id);

create unique index if not exists mobility_assets_display_id_unique
on public.mobility_assets (display_id);

create or replace function public.medtrack_assign_inventory_display_id()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_prefix text;
    v_width integer;
    v_candidate bigint := 1;
    v_exists boolean;
begin
    if nullif(trim(new.display_id), '') is not null then
        return new;
    end if;

    if new.id !~ '[0-9]+$' then
        new.display_id := new.id;
        return new;
    end if;

    v_prefix := regexp_replace(new.id, '[0-9]+$', '');
    v_width := greatest(length(substring(new.id from '([0-9]+)$')), 3);

    perform pg_advisory_xact_lock(
        hashtextextended(tg_table_name || ':' || v_prefix, 0)
    );

    loop
        new.display_id := v_prefix ||
            lpad(v_candidate::text, v_width, '0');
        execute format(
            'select exists (select 1 from public.%I where display_id = $1)',
            tg_table_name
        ) into v_exists using new.display_id;
        exit when not v_exists;
        v_candidate := v_candidate + 1;
    end loop;

    return new;
end;
$$;

revoke all on function public.medtrack_assign_inventory_display_id()
from public;

drop trigger if exists assign_medical_supply_display_id
on public.medical_supplies;
create trigger assign_medical_supply_display_id
before insert on public.medical_supplies
for each row execute function public.medtrack_assign_inventory_display_id();

drop trigger if exists assign_medical_equipment_display_id
on public.medical_equipment;
create trigger assign_medical_equipment_display_id
before insert on public.medical_equipment
for each row execute function public.medtrack_assign_inventory_display_id();

drop trigger if exists assign_mobility_asset_display_id
on public.mobility_assets;
create trigger assign_mobility_asset_display_id
before insert on public.mobility_assets
for each row execute function public.medtrack_assign_inventory_display_id();

notify pgrst, 'reload schema';

commit;
