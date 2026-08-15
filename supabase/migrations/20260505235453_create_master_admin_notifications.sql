/*
  # Master Admin Notifications System

  Creates a real notifications system for the master admin user.

  ## New Tables
  - `admin_notifications`
    - `id` (uuid, primary key)
    - `type` (text) - category: 'new_customer', 'new_user', 'vessel_limit_reached', 'system'
    - `title` (text) - short title
    - `message` (text) - full message
    - `metadata` (jsonb) - extra data (company_id, user_id, etc.)
    - `read` (boolean) - whether master admin has read it
    - `created_at` (timestamptz)

  ## Triggers
  - On INSERT into `companies` → creates 'new_customer' notification
  - On INSERT into `auth.users` (via profiles) → creates 'new_user' notification for non-master_admin users

  ## Security
  - RLS enabled, only master_admin role can read/update notifications
*/

CREATE TABLE IF NOT EXISTS admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  metadata jsonb DEFAULT '{}',
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- Only authenticated users with master_admin role can select
CREATE POLICY "Master admin can view notifications"
  ON admin_notifications FOR SELECT
  TO authenticated
  USING (
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'master_admin'
  );

-- Only authenticated users with master_admin role can update (mark as read)
CREATE POLICY "Master admin can update notifications"
  ON admin_notifications FOR UPDATE
  TO authenticated
  USING (
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'master_admin'
  )
  WITH CHECK (
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'master_admin'
  );

-- Service role can insert (used by triggers via security definer functions)
CREATE POLICY "Service role can insert notifications"
  ON admin_notifications FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Allow postgres/authenticated to insert via trigger functions
CREATE POLICY "Postgres can insert notifications"
  ON admin_notifications FOR INSERT
  TO postgres
  WITH CHECK (true);

-- Trigger function: notify when a new company (customer) is created
CREATE OR REPLACE FUNCTION notify_new_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO admin_notifications (type, title, message, metadata)
  VALUES (
    'new_customer',
    'New customer registered',
    'Company "' || NEW.name || '" has been registered' ||
      CASE WHEN NEW.contact_email IS NOT NULL THEN ' (' || NEW.contact_email || ')' ELSE '' END || '.',
    jsonb_build_object(
      'company_id', NEW.id,
      'company_name', NEW.name,
      'contact_email', NEW.contact_email,
      'customer_type', NEW.customer_type
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_company ON companies;
CREATE TRIGGER trg_notify_new_company
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_company();

-- Trigger function: notify when a new non-master user is created via profiles table
-- Note: we watch the profiles table which mirrors auth.users inserts via the app
CREATE OR REPLACE FUNCTION notify_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_name text;
BEGIN
  -- Skip master_admin users
  IF NEW.role = 'master_admin' THEN
    RETURN NEW;
  END IF;

  -- Get company name if available
  SELECT name INTO v_company_name FROM companies WHERE id = NEW.company_id;

  INSERT INTO admin_notifications (type, title, message, metadata)
  VALUES (
    'new_user',
    'New user created',
    'User "' || COALESCE(NEW.full_name, NEW.email) || '"' ||
      CASE WHEN v_company_name IS NOT NULL THEN ' was added to "' || v_company_name || '"' ELSE ' was created' END || '.',
    jsonb_build_object(
      'user_id', NEW.id,
      'user_email', NEW.email,
      'user_name', NEW.full_name,
      'company_id', NEW.company_id,
      'company_name', v_company_name,
      'role', NEW.role
    )
  );
  RETURN NEW;
END;
$$;

-- Check if profiles table exists before creating trigger
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    DROP TRIGGER IF EXISTS trg_notify_new_user ON profiles;
    CREATE TRIGGER trg_notify_new_user
      AFTER INSERT ON profiles
      FOR EACH ROW
      EXECUTE FUNCTION notify_new_user();
  END IF;
END $$;

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_admin_notifications_read ON admin_notifications(read);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON admin_notifications(created_at DESC);
