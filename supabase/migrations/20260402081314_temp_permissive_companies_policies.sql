/*
  # Temporary Permissive Companies Policies

  ## Overview
  Creates temporary permissive policies for development purposes.
  These allow authenticated users to perform operations while the auth system is being set up.

  ## Changes
  1. Drop existing restrictive policies
  2. Create permissive policies for authenticated users
  
  ## Security Notes
  - IMPORTANT: These are development-only policies
  - Replace with proper role-based policies in production
  - Currently allows any authenticated user to manage companies
*/

DROP POLICY IF EXISTS "Master admins can view companies" ON companies;
DROP POLICY IF EXISTS "Master admins can insert companies" ON companies;
DROP POLICY IF EXISTS "Master admins can update companies" ON companies;
DROP POLICY IF EXISTS "Master admins can delete companies" ON companies;

CREATE POLICY "Authenticated users can view companies"
  ON companies
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert companies"
  ON companies
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update companies"
  ON companies
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete companies"
  ON companies
  FOR DELETE
  TO authenticated
  USING (true);