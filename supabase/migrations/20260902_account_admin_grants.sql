grant usage on schema public to service_role;

grant select, insert, update, delete
on table public.profiles
to service_role;
