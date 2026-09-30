begin;

-- Remove only the five returned test/history records identified by the user.
-- Current inventory quantities and availability are not changed by this cleanup.
delete from public.asset_status_history
where transaction_id in (
    'TRN-004',
    'TRN-5A6CCB149E93',
    'TRN-815189DA6F57',
    'TRN-C0BABAA4D09A',
    'TRN-F1362CF74F88'
);

delete from public.inventory_activity_events
where source_type = 'borrow_transaction'
  and source_id in (
      'TRN-004',
      'TRN-5A6CCB149E93',
      'TRN-815189DA6F57',
      'TRN-C0BABAA4D09A',
      'TRN-F1362CF74F88'
  );

delete from public.borrow_transactions
where status = 'Returned'
  and id in (
      'TRN-004',
      'TRN-5A6CCB149E93',
      'TRN-815189DA6F57',
      'TRN-C0BABAA4D09A',
      'TRN-F1362CF74F88'
  );

notify pgrst, 'reload schema';

commit;
