/*
  # Add Email Notifications to Companies

  ## Summary
  Adds email notification fields to the companies table to support the automated
  alert system for premium customers.

  ## Changes

  ### Modified Tables
  - `companies`
    - `email_notifications_enabled` (boolean) — master toggle for email alerts, default false
    - `notification_emails` (text[]) — additional recipient emails beyond registered users

  ## Notes
  1. Only companies with email_notifications_enabled = true will receive automated alerts
  2. notification_emails is an array so multiple recipients can be added per company
  3. The contact_email and any registered users are always included automatically when enabled
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'email_notifications_enabled'
  ) THEN
    ALTER TABLE companies ADD COLUMN email_notifications_enabled boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'notification_emails'
  ) THEN
    ALTER TABLE companies ADD COLUMN notification_emails text[] NOT NULL DEFAULT '{}';
  END IF;
END $$;
