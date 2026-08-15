/*
  # Setup pg_cron Daily Alert Job

  ## Summary
  Creates a scheduled cron job that runs every day at 8:00 AM UTC to trigger
  the check-alerts Edge Function. This powers the automated email notifications
  for premium customers without requiring any user interaction.

  ## Details
  - Job name: daily-alert-check
  - Schedule: 0 8 * * * (every day at 08:00 UTC)
  - Calls: the check-alerts Edge Function via HTTP
  - Only runs for companies with email_notifications_enabled = true

  ## Notes
  1. Requires pg_cron and pg_net extensions
  2. The job uses net.http_post to call the Edge Function
  3. If the job already exists it will be replaced with the latest schedule
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing job if present so we can recreate cleanly
SELECT cron.unschedule('daily-alert-check') 
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'daily-alert-check'
);

-- Schedule daily alerts at 08:00 UTC
SELECT cron.schedule(
  'daily-alert-check',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/check-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
