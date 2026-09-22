begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

select ok(
    not exists (
        select 1
        from unnest(array[
            'profiles',
            'medical_supplies',
            'medical_equipment',
            'mobility_assets',
            'borrow_transactions',
            'emergency_requests',
            'audit_events',
            'asset_status_history'
        ]) as expected(table_name)
        left join pg_class relation
          on relation.relname = expected.table_name
        left join pg_namespace namespace
          on namespace.oid = relation.relnamespace
         and namespace.nspname = 'public'
        where relation.oid is null or not relation.relrowsecurity
    ),
    'RLS is enabled on all client-facing tables'
);

select ok(
    not has_table_privilege('anon', 'public.profiles', 'SELECT')
    and not has_table_privilege('anon', 'public.medical_supplies', 'SELECT')
    and not has_table_privilege('anon', 'public.emergency_requests', 'SELECT')
    and not has_table_privilege('anon', 'public.audit_events', 'SELECT'),
    'Anonymous users cannot read MedTrack data'
);

select ok(
    not exists (
        select 1
        from unnest(array[
            'medical_supplies',
            'medical_equipment',
            'mobility_assets',
            'borrow_transactions',
            'emergency_requests',
            'medical_supply_transactions',
            'asset_status_history',
            'inventory_activity_events',
            'audit_events'
        ]) as expected(table_name)
        left join pg_policies policy
          on policy.schemaname = 'public'
         and policy.tablename = expected.table_name
         and policy.policyname = 'Admin MFA is required'
         and policy.permissive = 'RESTRICTIVE'
        where policy.policyname is null
    ),
    'Every operational table has restrictive Admin MFA enforcement'
);

select ok(
    not exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'emergency_requests'
          and column_name = 'priority'
    ),
    'Emergency priority was removed from the database'
);

select ok(
    position(
        'aal2' in pg_get_functiondef(
            'public.medtrack_is_admin()'::regprocedure
        )
    ) > 0,
    'Administrator authorization requires AAL2'
);

select ok(
    position(
        'aal2' in pg_get_functiondef(
            'public.medtrack_is_active_user()'::regprocedure
        )
    ) > 0,
    'Administrator access through active-user workflows also requires AAL2'
);

select ok(
    exists (
        select 1
        from pg_trigger
        where tgrelid = 'public.audit_events'::regclass
          and tgname = 'prevent_audit_mutation'
          and not tgisinternal
    ),
    'Audit events remain immutable'
);

select * from finish();
rollback;
