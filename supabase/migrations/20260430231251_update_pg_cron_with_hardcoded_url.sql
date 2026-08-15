/*
  # Update pg_cron Job with Direct URL

  ## Summary
  Updates the daily alert cron job to use the hardcoded Supabase project URL
  and anon key directly, since custom database settings are not available
  on hosted Supabase.

  ## Notes
  1. The schedule remains daily at 08:00 UTC
  2. Uses net.http_post with direct project URL
*/

-- Remove existing job
SELECT cron.unschedule('daily-alert-check')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'daily-alert-check'
);

-- Recreate with hardcoded project URL
SELECT cron.schedule(
  'daily-alert-check',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://zinelqapsweetjzdrkpw.supabase.co/functions/v1/check-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppbmVscWFwc3dlZXRqemRya3B3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMDEwOTIsImV4cCI6MjA5MDY3NzA5Mn0.Ykb9ta9lYWuHzL5pFryxEfSYQ8Hxy82qF4f_v12Va9A'
    ),
    body := '{}'::jsonb
  );
  $$
);
