/*
  # Fix RLS Recursion and Stack Depth Issues

  1. Security Changes
    - Convert app_user_role() to SECURITY DEFINER to bypass RLS
    - Add helper functions is_admin() and is_viewer_or_admin()
    - Update app_user policies to avoid recursion

  2. Function Optimizations
    - Set search_path for all functions for security
    - Grant proper permissions to helper functions

  3. Policy Cleanup
    - Remove old recursive policies on app_user table
    - Add optimized policies that avoid self-reference
*/

-- =========================================
-- BREAK THE RLS RECURSION
-- =========================================

-- 1) Recreate role lookup as SECURITY DEFINER (bypasses RLS)
CREATE OR REPLACE FUNCTION public.app_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT role FROM public.app_user WHERE uid = auth.uid()
  ), 'pending')
$$;

GRANT EXECUTE ON FUNCTION public.app_user_role() TO anon, authenticated;

-- Optional helpers (cleaner policies)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ 
  SELECT public.app_user_role() = 'admin' 
$$;

CREATE OR REPLACE FUNCTION public.is_viewer_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ 
  SELECT public.app_user_role() IN ('viewer','admin') 
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_viewer_or_admin() TO anon, authenticated;

-- 2) Replace app_user policies to avoid self-recursion
DROP POLICY IF EXISTS viewer_select_app_user ON public.app_user;
DROP POLICY IF EXISTS admin_all_app_user ON public.app_user;

-- Users can read their own row (no function call here)
CREATE POLICY app_user_self_select ON public.app_user
  FOR SELECT USING (auth.uid() = uid);

-- Admins can do anything on app_user (checked via SECURITY DEFINER fn)
CREATE POLICY app_user_admin_all ON public.app_user
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3) Set search_path for all existing functions for security
ALTER FUNCTION public.trg_commercial_line_inherit_wh() SET search_path = public;
ALTER FUNCTION public.trg_commercial_hdr_default_doc_no() SET search_path = public;
ALTER FUNCTION public.trg_movement_line_defaults_validate() SET search_path = public;
ALTER FUNCTION public.trg_movement_hdr_validate_transfer() SET search_path = public;
ALTER FUNCTION public.trg_system_note() SET search_path = public;
ALTER FUNCTION public.attach_system_note(regclass) SET search_path = public;
ALTER FUNCTION public.trg_touch_updated_at() SET search_path = public;
ALTER FUNCTION public.commercial_line_progress(uuid) SET search_path = public;
ALTER FUNCTION public.recompute_commercial_status(uuid) SET search_path = public;
ALTER FUNCTION public.trg_recompute_on_link() SET search_path = public;
ALTER FUNCTION public.trg_recompute_on_movement_status() SET search_path = public;
ALTER FUNCTION public.refresh_mv_inventory_prev_day() SET search_path = public;
ALTER FUNCTION public.inventory_as_of(date) SET search_path = public;

-- 4) Optional: Update other policies to use helper functions for better performance
-- (Only updating a few key ones that are commonly used)

-- Update party policies
DROP POLICY IF EXISTS viewer_select_party ON public.party;
DROP POLICY IF EXISTS admin_all_party ON public.party;

CREATE POLICY viewer_select_party ON public.party
  FOR SELECT USING (public.is_viewer_or_admin());

CREATE POLICY admin_all_party ON public.party
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Update warehouse policies
DROP POLICY IF EXISTS viewer_select_warehouse ON public.warehouse;
DROP POLICY IF EXISTS admin_all_warehouse ON public.warehouse;

CREATE POLICY viewer_select_warehouse ON public.warehouse
  FOR SELECT USING (public.is_viewer_or_admin());

CREATE POLICY admin_all_warehouse ON public.warehouse
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Update commercial_hdr policies
DROP POLICY IF EXISTS viewer_select_commercial_hdr ON public.commercial_hdr;
DROP POLICY IF EXISTS admin_all_commercial_hdr ON public.commercial_hdr;

CREATE POLICY viewer_select_commercial_hdr ON public.commercial_hdr
  FOR SELECT USING (public.is_viewer_or_admin());

CREATE POLICY admin_all_commercial_hdr ON public.commercial_hdr
  USING (public.is_admin())
  WITH CHECK (public.is_admin());