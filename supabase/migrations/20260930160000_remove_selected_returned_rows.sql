begin;

-- Remove only the returned transactions and derived history confirmed by the user.
-- Inventory quantities are unchanged, and immutable audit records are preserved.
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
