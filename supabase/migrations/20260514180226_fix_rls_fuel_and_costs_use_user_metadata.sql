
/*
  # Fix RLS policies for fuel_resources, fuel_log, and operational_expenses

  The existing policies incorrectly query user_profiles for company_id, which
  does not have that column. Replacing with auth.users.raw_user_meta_data reads,
  consistent with user_has_vessel_access().
*/

-- ============================================================
-- fuel_resources
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can select their company fuel resources" ON fuel_resources;
DROP POLICY IF EXISTS "Authenticated users can insert their company fuel resources" ON fuel_resources;
DROP POLICY IF EXISTS "Authenticated users can update their company fuel resources" ON fuel_resources;
DROP POLICY IF EXISTS "Authenticated users can delete their company fuel resources" ON fuel_resources;

CREATE POLICY "Users can view their company fuel resources"
  ON fuel_resources FOR SELECT TO authenticated
  USING (
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'master_admin'
    OR company_id::text = (SELECT raw_user_meta_data->>'company_id' FROM auth.users WHERE id = auth.uid())
    OR vessel_id::text IN (
      SELECT jsonb_array_elements_text(raw_user_meta_data->'vessel_ids')
      FROM auth.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their company fuel resources"
  ON fuel_resources FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'master_admin'
    OR company_id::text = (SELECT raw_user_meta_data->>'company_id' FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Users can update their company fuel resources"
  ON fuel_resources FOR UPDATE TO authenticated
  USING (
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'master_admin'
    OR company_id::text = (SELECT raw_user_meta_data->>'company_id' FROM auth.users WHERE id = auth.uid())
  )
  WITH CHECK (
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'master_admin'
    OR company_id::text = (SELECT raw_user_meta_data->>'company_id' FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Users can delete their company fuel resources"
  ON fuel_resources FOR DELETE TO authenticated
  USING (
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'master_admin'
    OR company_id::text = (SELECT raw_user_meta_data->>'company_id' FROM auth.users WHERE id = auth.uid())
  );

-- ============================================================
-- fuel_log
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can select their company fuel log" ON fuel_log;
DROP POLICY IF EXISTS "Authenticated users can insert their company fuel log" ON fuel_log;
DROP POLICY IF EXISTS "Authenticated users can update their company fuel log" ON fuel_log;
DROP POLICY IF EXISTS "Authenticated users can delete their company fuel log" ON fuel_log;

CREATE POLICY "Users can view their company fuel log"
  ON fuel_log FOR SELECT TO authenticated
  USING (
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'master_admin'
    OR company_id::text = (SELECT raw_user_meta_data->>'company_id' FROM auth.users WHERE id = auth.uid())
    OR vessel_id::text IN (
      SELECT jsonb_array_elements_text(raw_user_meta_data->'vessel_ids')
      FROM auth.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their company fuel log"
  ON fuel_log FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'master_admin'
    OR company_id::text = (SELECT raw_user_meta_data->>'company_id' FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Users can update their company fuel log"
  ON fuel_log FOR UPDATE TO authenticated
  USING (
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'master_admin'
    OR company_id::text = (SELECT raw_user_meta_data->>'company_id' FROM auth.users WHERE id = auth.uid())
  )
  WITH CHECK (
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'master_admin'
    OR company_id::text = (SELECT raw_user_meta_data->>'company_id' FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Users can delete their company fuel log"
  ON fuel_log FOR DELETE TO authenticated
  USING (
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'master_admin'
    OR company_id::text = (SELECT raw_user_meta_data->>'company_id' FROM auth.users WHERE id = auth.uid())
  );

-- ============================================================
-- operational_expenses
-- ============================================================
DROP POLICY IF EXISTS "Company members can view operational expenses" ON operational_expenses;
DROP POLICY IF EXISTS "Company members can insert operational expenses" ON operational_expenses;
DROP POLICY IF EXISTS "Company members can update operational expenses" ON operational_expenses;
DROP POLICY IF EXISTS "Company members can delete operational expenses" ON operational_expenses;

CREATE POLICY "Users can view their company operational expenses"
  ON operational_expenses FOR SELECT TO authenticated
  USING (
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'master_admin'
    OR company_id::text = (SELECT raw_user_meta_data->>'company_id' FROM auth.users WHERE id = auth.uid())
    OR vessel_id::text IN (
      SELECT jsonb_array_elements_text(raw_user_meta_data->'vessel_ids')
      FROM auth.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their company operational expenses"
  ON operational_expenses FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'master_admin'
    OR company_id::text = (SELECT raw_user_meta_data->>'company_id' FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Users can update their company operational expenses"
  ON operational_expenses FOR UPDATE TO authenticated
  USING (
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'master_admin'
    OR company_id::text = (SELECT raw_user_meta_data->>'company_id' FROM auth.users WHERE id = auth.uid())
  )
  WITH CHECK (
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'master_admin'
    OR company_id::text = (SELECT raw_user_meta_data->>'company_id' FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Users can delete their company operational expenses"
  ON operational_expenses FOR DELETE TO authenticated
  USING (
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'master_admin'
    OR company_id::text = (SELECT raw_user_meta_data->>'company_id' FROM auth.users WHERE id = auth.uid())
  );
