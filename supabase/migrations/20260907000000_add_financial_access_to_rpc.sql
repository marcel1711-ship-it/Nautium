/*
  Add financial_access to get_all_users_for_admin RPC
*/

DROP FUNCTION IF EXISTS get_all_users_for_admin();

CREATE OR REPLACE FUNCTION get_all_users_for_admin()
RETURNS TABLE (
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  role text,
  company_id text,
  company_name text,
  full_name text,
  vessel_ids jsonb,
  financial_access boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT
    u.id,
    u.email,
    u.created_at,
    u.last_sign_in_at,
    (u.raw_user_meta_data->>'role')::text          AS role,
    (u.raw_user_meta_data->>'company_id')::text    AS company_id,
    (u.raw_user_meta_data->>'company_name')::text  AS company_name,
    (u.raw_user_meta_data->>'full_name')::text     AS full_name,
    COALESCE(u.raw_user_meta_data->'vessel_ids', '[]'::jsonb) AS vessel_ids,
    COALESCE((u.raw_app_meta_data->>'financial_access')::boolean, false) AS financial_access
  FROM auth.users u;
$$;

GRANT EXECUTE ON FUNCTION get_all_users_for_admin() TO service_role;
