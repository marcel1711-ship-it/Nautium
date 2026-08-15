/*
  # Fix Companies RLS Policies

  ## Overview
  Simplifies the RLS policies for the companies table to directly check
  the user's role in raw_user_meta_data instead of doing complex joins.

  ## Changes
  1. Drop existing policies
  2. Create simplified policies that check role directly from auth.jwt()
  
  ## Security
  - Only master_admin users can perform any operations on companies table
  - Uses auth.jwt() to directly access user metadata
*/

DROP POLICY IF EXISTS "Master admins can view all companies" ON companies;
DROP POLICY IF EXISTS "Master admins can insert companies" ON companies;
DROP POLICY IF EXISTS "Master admins can update companies" ON companies;
DROP POLICY IF EXISTS "Master admins can delete companies" ON companies;

CREATE POLICY "Master admins can view companies"
  ON companies
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'master_admin'
  );

CREATE POLICY "Master admins can insert companies"
  ON companies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'master_admin'
  );

CREATE POLICY "Master admins can update companies"
  ON companies
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'master_admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'master_admin'
  );

CREATE POLICY "Master admins can delete companies"
  ON companies
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'master_admin'
  );