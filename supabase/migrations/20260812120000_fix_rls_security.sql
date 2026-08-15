/*
  # Fix RLS Security Policies

  ## Overview
  Fixes multiple security issues in RLS policies:
  1. Switches user_has_vessel_access() from user_metadata to app_metadata
  2. Fixes vessels table policies (were tautologies - no tenancy check)
  3. Fixes INSERT WITH CHECK (true) on all operational tables
  4. Restores proper companies table RLS (was left world-writable by temp migration)

  ## Changes
  - user_has_vessel_access() now reads raw_app_meta_data with fallback to raw_user_meta_data
  - vessels policies now check company_id matches user's app_metadata
  - INSERT policies now use user_has_vessel_access() instead of WITH CHECK (true)
  - companies policies restored to master_admin + own-company access

  ## Safety
  - No data is deleted or modified
  - app_metadata was synced for all users before this migration
  - Fallback to user_metadata ensures backward compatibility
*/

-- ============================================================
-- 1. Fix user_has_vessel_access() to use app_metadata
-- ============================================================

CREATE OR REPLACE FUNCTION user_has_vessel_access(p_vessel_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    COALESCE(
      (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()),
      (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid())
    ) = 'master_admin'
    OR (
      EXISTS (
        SELECT 1 FROM vessels v
        JOIN companies c ON c.id = v.company_id
        WHERE v.id = p_vessel_id
        AND c.id::text = COALESCE(
          (SELECT raw_app_meta_data->>'company_id' FROM auth.users WHERE id = auth.uid()),
          (SELECT raw_user_meta_data->>'company_id' FROM auth.users WHERE id = auth.uid())
        )
      )
    )
    OR (
      p_vessel_id::text IN (
        SELECT jsonb_array_elements_text(
          COALESCE(
            (SELECT raw_app_meta_data->'vessel_ids' FROM auth.users WHERE id = auth.uid()),
            (SELECT raw_user_meta_data->'vessel_ids' FROM auth.users WHERE id = auth.uid())
          )
        )
      )
    );
$$;

-- ============================================================
-- 2. Fix vessels table RLS policies
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can view vessels of their company" ON vessels;
DROP POLICY IF EXISTS "Authenticated users can insert vessels" ON vessels;
DROP POLICY IF EXISTS "Authenticated users can update vessels" ON vessels;
DROP POLICY IF EXISTS "Authenticated users can delete vessels" ON vessels;

CREATE POLICY "Users can view vessels of their company"
  ON vessels FOR SELECT TO authenticated
  USING (
    COALESCE(
      (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()),
      (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid())
    ) = 'master_admin'
    OR company_id::text = COALESCE(
      (SELECT raw_app_meta_data->>'company_id' FROM auth.users WHERE id = auth.uid()),
      (SELECT raw_user_meta_data->>'company_id' FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Admins can insert vessels for their company"
  ON vessels FOR INSERT TO authenticated
  WITH CHECK (
    COALESCE(
      (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()),
      (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid())
    ) = 'master_admin'
    OR (
      company_id::text = COALESCE(
        (SELECT raw_app_meta_data->>'company_id' FROM auth.users WHERE id = auth.uid()),
        (SELECT raw_user_meta_data->>'company_id' FROM auth.users WHERE id = auth.uid())
      )
      AND COALESCE(
        (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()),
        (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid())
      ) IN ('customer_admin', 'owner')
    )
  );

CREATE POLICY "Admins can update vessels of their company"
  ON vessels FOR UPDATE TO authenticated
  USING (
    COALESCE(
      (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()),
      (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid())
    ) = 'master_admin'
    OR company_id::text = COALESCE(
      (SELECT raw_app_meta_data->>'company_id' FROM auth.users WHERE id = auth.uid()),
      (SELECT raw_user_meta_data->>'company_id' FROM auth.users WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    COALESCE(
      (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()),
      (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid())
    ) = 'master_admin'
    OR company_id::text = COALESCE(
      (SELECT raw_app_meta_data->>'company_id' FROM auth.users WHERE id = auth.uid()),
      (SELECT raw_user_meta_data->>'company_id' FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Admins can delete vessels of their company"
  ON vessels FOR DELETE TO authenticated
  USING (
    COALESCE(
      (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()),
      (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid())
    ) = 'master_admin'
    OR (
      company_id::text = COALESCE(
        (SELECT raw_app_meta_data->>'company_id' FROM auth.users WHERE id = auth.uid()),
        (SELECT raw_user_meta_data->>'company_id' FROM auth.users WHERE id = auth.uid())
      )
      AND COALESCE(
        (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()),
        (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid())
      ) IN ('customer_admin', 'owner')
    )
  );

-- ============================================================
-- 3. Fix INSERT WITH CHECK (true) on operational tables
-- ============================================================

-- Equipment
DROP POLICY IF EXISTS "Users can insert equipment" ON equipment;
CREATE POLICY "Users can insert equipment"
  ON equipment FOR INSERT TO authenticated
  WITH CHECK (user_has_vessel_access(vessel_id));

-- Maintenance tasks
DROP POLICY IF EXISTS "Users can insert maintenance tasks" ON maintenance_tasks;
CREATE POLICY "Users can insert maintenance tasks"
  ON maintenance_tasks FOR INSERT TO authenticated
  WITH CHECK (user_has_vessel_access(vessel_id));

-- Maintenance history
DROP POLICY IF EXISTS "Users can insert maintenance history" ON maintenance_history;
CREATE POLICY "Users can insert maintenance history"
  ON maintenance_history FOR INSERT TO authenticated
  WITH CHECK (user_has_vessel_access(vessel_id));

-- Inventory items
DROP POLICY IF EXISTS "Users can insert inventory items" ON inventory_items;
CREATE POLICY "Users can insert inventory items"
  ON inventory_items FOR INSERT TO authenticated
  WITH CHECK (user_has_vessel_access(vessel_id));

-- Stock movements
DROP POLICY IF EXISTS "Users can insert stock movements" ON stock_movements;
CREATE POLICY "Users can insert stock movements"
  ON stock_movements FOR INSERT TO authenticated
  WITH CHECK (user_has_vessel_access(vessel_id));

-- Maintenance manuals
DROP POLICY IF EXISTS "Users can insert maintenance manuals" ON maintenance_manuals;
CREATE POLICY "Users can insert maintenance manuals"
  ON maintenance_manuals FOR INSERT TO authenticated
  WITH CHECK (user_has_vessel_access(vessel_id));

-- ============================================================
-- 4. Fix companies table RLS (revert temp permissive policies)
-- ============================================================

DROP POLICY IF EXISTS "temp_select_companies" ON companies;
DROP POLICY IF EXISTS "temp_insert_companies" ON companies;
DROP POLICY IF EXISTS "temp_update_companies" ON companies;
DROP POLICY IF EXISTS "temp_delete_companies" ON companies;
DROP POLICY IF EXISTS "Authenticated can view companies" ON companies;
DROP POLICY IF EXISTS "Authenticated can insert companies" ON companies;
DROP POLICY IF EXISTS "Authenticated can update companies" ON companies;
DROP POLICY IF EXISTS "Authenticated can delete companies" ON companies;

CREATE POLICY "Users can view their own company"
  ON companies FOR SELECT TO authenticated
  USING (
    COALESCE(
      (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()),
      (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid())
    ) = 'master_admin'
    OR id::text = COALESCE(
      (SELECT raw_app_meta_data->>'company_id' FROM auth.users WHERE id = auth.uid()),
      (SELECT raw_user_meta_data->>'company_id' FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Only master_admin can insert companies"
  ON companies FOR INSERT TO authenticated
  WITH CHECK (
    COALESCE(
      (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()),
      (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid())
    ) = 'master_admin'
  );

CREATE POLICY "Admins can update their own company"
  ON companies FOR UPDATE TO authenticated
  USING (
    COALESCE(
      (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()),
      (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid())
    ) = 'master_admin'
    OR (
      id::text = COALESCE(
        (SELECT raw_app_meta_data->>'company_id' FROM auth.users WHERE id = auth.uid()),
        (SELECT raw_user_meta_data->>'company_id' FROM auth.users WHERE id = auth.uid())
      )
      AND COALESCE(
        (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()),
        (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid())
      ) IN ('customer_admin', 'owner')
    )
  );

CREATE POLICY "Only master_admin can delete companies"
  ON companies FOR DELETE TO authenticated
  USING (
    COALESCE(
      (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()),
      (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid())
    ) = 'master_admin'
  );

-- ============================================================
-- 5. Fix fuel/costs RLS policies to use app_metadata
-- ============================================================

-- Fuel resources
DROP POLICY IF EXISTS "Users can view fuel resources for their vessels" ON fuel_resources;
CREATE POLICY "Users can view fuel resources for their vessels"
  ON fuel_resources FOR SELECT TO authenticated
  USING (user_has_vessel_access(vessel_id));

DROP POLICY IF EXISTS "Users can insert fuel resources" ON fuel_resources;
CREATE POLICY "Users can insert fuel resources"
  ON fuel_resources FOR INSERT TO authenticated
  WITH CHECK (user_has_vessel_access(vessel_id));

DROP POLICY IF EXISTS "Users can update fuel resources" ON fuel_resources;
CREATE POLICY "Users can update fuel resources"
  ON fuel_resources FOR UPDATE TO authenticated
  USING (user_has_vessel_access(vessel_id));

DROP POLICY IF EXISTS "Users can delete fuel resources" ON fuel_resources;
CREATE POLICY "Users can delete fuel resources"
  ON fuel_resources FOR DELETE TO authenticated
  USING (user_has_vessel_access(vessel_id));

-- Fuel log
DROP POLICY IF EXISTS "Users can view fuel log for their vessels" ON fuel_log;
CREATE POLICY "Users can view fuel log for their vessels"
  ON fuel_log FOR SELECT TO authenticated
  USING (user_has_vessel_access(vessel_id));

DROP POLICY IF EXISTS "Users can insert fuel log" ON fuel_log;
CREATE POLICY "Users can insert fuel log"
  ON fuel_log FOR INSERT TO authenticated
  WITH CHECK (user_has_vessel_access(vessel_id));

DROP POLICY IF EXISTS "Users can update fuel log" ON fuel_log;
CREATE POLICY "Users can update fuel log"
  ON fuel_log FOR UPDATE TO authenticated
  USING (user_has_vessel_access(vessel_id));

DROP POLICY IF EXISTS "Users can delete fuel log" ON fuel_log;
CREATE POLICY "Users can delete fuel log"
  ON fuel_log FOR DELETE TO authenticated
  USING (user_has_vessel_access(vessel_id));

-- Operational expenses
DROP POLICY IF EXISTS "Users can view expenses for their vessels" ON operational_expenses;
CREATE POLICY "Users can view expenses for their vessels"
  ON operational_expenses FOR SELECT TO authenticated
  USING (user_has_vessel_access(vessel_id));

DROP POLICY IF EXISTS "Users can insert expenses" ON operational_expenses;
CREATE POLICY "Users can insert expenses"
  ON operational_expenses FOR INSERT TO authenticated
  WITH CHECK (user_has_vessel_access(vessel_id));

DROP POLICY IF EXISTS "Users can update expenses" ON operational_expenses;
CREATE POLICY "Users can update expenses"
  ON operational_expenses FOR UPDATE TO authenticated
  USING (user_has_vessel_access(vessel_id));

DROP POLICY IF EXISTS "Users can delete expenses" ON operational_expenses;
CREATE POLICY "Users can delete expenses"
  ON operational_expenses FOR DELETE TO authenticated
  USING (user_has_vessel_access(vessel_id));
