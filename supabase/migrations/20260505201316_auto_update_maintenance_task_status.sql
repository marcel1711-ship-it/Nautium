/*
  # Auto-update Maintenance Task Status

  ## Summary
  Creates a PostgreSQL function and cron job that automatically recalculates the
  status of all non-completed maintenance tasks based on their next_due_date.

  ## Rules
  - overdue:   next_due_date < today
  - due_soon:  next_due_date between today and today + 7 days
  - upcoming:  next_due_date > today + 7 days

  ## New Objects
  1. Function `update_maintenance_task_statuses()` — updates all pending tasks
  2. pg_cron job `update-task-statuses` — runs every day at 00:05 UTC
  3. Immediate invocation so existing data is corrected right away

  ## Notes
  - Only tasks with status != 'completed' are updated
  - The 7-day due_soon window matches the frontend behaviour
  - pg_cron and pg_net extensions already enabled from prior migration
*/

-- Function that recalculates status for all active tasks
CREATE OR REPLACE FUNCTION update_maintenance_task_statuses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE maintenance_tasks
  SET status = CASE
    WHEN next_due_date < CURRENT_DATE                               THEN 'overdue'
    WHEN next_due_date <= CURRENT_DATE + INTERVAL '7 days'         THEN 'due_soon'
    ELSE 'upcoming'
  END
  WHERE status != 'completed';
END;
$$;

-- Run it immediately so current data is accurate
SELECT update_maintenance_task_statuses();

-- Schedule daily at 00:05 UTC (runs just after midnight so the day is correct)
-- Remove existing job first if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'update-task-statuses') THEN
    PERFORM cron.unschedule('update-task-statuses');
  END IF;
END $$;

SELECT cron.schedule(
  'update-task-statuses',
  '5 0 * * *',
  $$ SELECT update_maintenance_task_statuses(); $$
);
