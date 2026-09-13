do $$
declare
    legacy_trigger record;
begin
    for legacy_trigger in
        select
            trigger_namespace.nspname as schema_name,
            trigger_table.relname as table_name,
            trigger_entry.tgname as trigger_name
        from pg_trigger trigger_entry
        join pg_class trigger_table
          on trigger_table.oid = trigger_entry.tgrelid
        join pg_namespace trigger_namespace
          on trigger_namespace.oid = trigger_table.relnamespace
        where not trigger_entry.tgisinternal
          and trigger_entry.tgfoid = to_regprocedure(
              'public.medtrack_require_approved_session()'
          )
    loop
        execute format(
            'drop trigger if exists %I on %I.%I',
            legacy_trigger.trigger_name,
            legacy_trigger.schema_name,
            legacy_trigger.table_name
        );
    end loop;
end
$$;

drop function if exists public.medtrack_claim_login_approval(uuid, text);
drop function if exists public.medtrack_revoke_current_approved_session();
drop function if exists public.medtrack_require_approved_session();
drop function if exists public.medtrack_has_approved_session();

drop table if exists public.trusted_devices;
drop table if exists public.approved_sessions;
drop table if exists public.login_approval_requests;

notify pgrst, 'reload schema';
