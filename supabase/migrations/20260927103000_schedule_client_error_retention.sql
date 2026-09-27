-- Keep detailed client diagnostics for 90 days. The corresponding sanitized
-- Audit Log entry remains available under the organization's audit policy.

create or replace function public.medtrack_cleanup_client_errors_job()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    delete from public.client_error_events
    where occurred_at < now() - interval '90 days';
end;
$$;

revoke all on function public.medtrack_cleanup_client_errors_job() from public;

do $$
declare
    existing_job bigint;
begin
    if exists (select 1 from pg_extension where extname = 'pg_cron') then
        select jobid into existing_job
        from cron.job
        where jobname = 'medtrack-client-error-retention';

        if existing_job is not null then
            perform cron.unschedule(existing_job);
        end if;

        perform cron.schedule(
            'medtrack-client-error-retention',
            '17 3 * * *',
            'select public.medtrack_cleanup_client_errors_job();'
        );
    end if;
end
$$;
