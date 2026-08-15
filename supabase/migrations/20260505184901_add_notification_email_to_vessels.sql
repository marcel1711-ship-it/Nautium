/*
  # Add notification_email to vessels table

  ## Summary
  Adds a per-vessel notification email field so that vessel owners can receive
  alert emails (maintenance overdue, low stock) for their specific vessel only,
  independently of the company-wide notification settings.

  ## Changes
  - `vessels` table: new column `notification_email` (text, nullable)

  ## Logic
  - If a vessel has a notification_email set, that address receives an email
    containing only alerts for that vessel.
  - The armador/company still receives a consolidated email with all vessels
    (grouped by vessel) as before.
  - Both emails are sent independently on the daily cron run.

  ## Security
  - No RLS changes needed; vessels table already has existing policies.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vessels' AND column_name = 'notification_email'
  ) THEN
    ALTER TABLE vessels ADD COLUMN notification_email text DEFAULT NULL;
  END IF;
END $$;
