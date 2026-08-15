/*
  # Create companies table for customer management

  ## Overview
  This migration creates the companies table to store customer information for the Master Admin.

  ## New Tables
  1. `companies`
    - `id` (uuid, primary key) - Unique identifier for each company
    - `name` (text, not null) - Company name
    - `contact_name` (text, not null) - Primary contact person name
    - `contact_email` (text, not null, unique) - Primary contact email
    - `contact_phone` (text) - Primary contact phone number
    - `subscription_status` (text, not null) - Status of subscription (active, trial, inactive)
    - `subscription_renewal_date` (date, not null) - When subscription renews/expires
    - `notes` (text) - Additional notes about the customer
    - `created_at` (timestamptz) - When the company was created
    - `updated_at` (timestamptz) - When the company was last updated

  ## Security
  - Enable RLS on companies table
  - Master admins can perform all operations
  - Regular users cannot access this table
*/

CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_name text NOT NULL,
  contact_email text NOT NULL UNIQUE,
  contact_phone text DEFAULT '',
  subscription_status text NOT NULL DEFAULT 'trial',
  subscription_renewal_date date NOT NULL,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_subscription_status CHECK (subscription_status IN ('active', 'trial', 'inactive'))
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master admins can view all companies"
  ON companies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.id IN (
        SELECT id FROM auth.users
        WHERE raw_user_meta_data->>'role' = 'master_admin'
      )
    )
  );

CREATE POLICY "Master admins can insert companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.id IN (
        SELECT id FROM auth.users
        WHERE raw_user_meta_data->>'role' = 'master_admin'
      )
    )
  );

CREATE POLICY "Master admins can update companies"
  ON companies FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.id IN (
        SELECT id FROM auth.users
        WHERE raw_user_meta_data->>'role' = 'master_admin'
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.id IN (
        SELECT id FROM auth.users
        WHERE raw_user_meta_data->>'role' = 'master_admin'
      )
    )
  );

CREATE POLICY "Master admins can delete companies"
  ON companies FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.id IN (
        SELECT id FROM auth.users
        WHERE raw_user_meta_data->>'role' = 'master_admin'
      )
    )
  );

CREATE INDEX IF NOT EXISTS idx_companies_subscription_status ON companies(subscription_status);
CREATE INDEX IF NOT EXISTS idx_companies_contact_email ON companies(contact_email);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_companies_updated_at'
  ) THEN
    CREATE TRIGGER update_companies_updated_at
      BEFORE UPDATE ON companies
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;