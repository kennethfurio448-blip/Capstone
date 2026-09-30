begin;

do $$
declare
    v_ids constant text[] := array[
        'TRN-004',
        'TRN-5A6CCB149E93',
        'TRN-815189DA6F57',
        'TRN-C0BABAA4D09A',
        'TRN-F1362CF74F88'
    ];
    v_audit_count integer;
begin
    if exists (
        select 1 from public.borrow_transactions
        where id = any(v_ids)
    ) then
        raise exception 'Selected returned transactions still exist.';
    end if;

    if exists (
        select 1 from public.asset_status_history
        where transaction_id = any(v_ids)
    ) then
        raise exception 'Selected asset status history still exists.';
    end if;

    if exists (
        select 1 from public.inventory_activity_events
        where source_type = 'borrow_transaction'
          and source_id = any(v_ids)
    ) then
        raise exception 'Selected inventory activity history still exists.';
    end if;

    select count(distinct entity_id)
    into v_audit_count
    from public.audit_events
    where entity_type = 'borrow_transactions'
      and action = 'Deleted'
      and entity_id = any(v_ids);

    if v_audit_count <> cardinality(v_ids) then
        raise exception 'Expected deletion audit records for all selected transactions; found %.',
            v_audit_count;
    end if;
end;
$$;

commit;
