/*
  # Add Warehouse Address Association

  1. New Tables
    - `warehouse_address`
      - `warehouse_id` (uuid, foreign key to warehouse)
      - `address_id` (uuid, foreign key to address)
      - `use` (text, check constraint for address usage type)
      - `is_default` (boolean, default false)
      - `valid_from` (date, optional)
      - `valid_to` (date, optional)

  2. Security
    - Enable RLS on `warehouse_address` table
    - Add policies for admin (full access) and viewer (read-only)

  3. Triggers
    - Add system note tracking
    - Add updated_at timestamp trigger
*/

-- Create warehouse_address junction table
CREATE TABLE IF NOT EXISTS public.warehouse_address (
  warehouse_id uuid NOT NULL,
  address_id uuid NOT NULL,
  use text NOT NULL CHECK (use = ANY (ARRAY['shipping'::text, 'billing'::text, 'mailing'::text, 'other'::text])),
  is_default boolean NOT NULL DEFAULT false,
  valid_from date NULL,
  valid_to date NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT warehouse_address_pkey PRIMARY KEY (warehouse_id, address_id, use),
  CONSTRAINT warehouse_address_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouse(id) ON DELETE CASCADE,
  CONSTRAINT warehouse_address_address_id_fkey FOREIGN KEY (address_id) REFERENCES public.address(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.warehouse_address ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY admin_all_warehouse_address ON public.warehouse_address
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY viewer_select_warehouse_address ON public.warehouse_address
  FOR SELECT
  USING (public.is_viewer_or_admin());

-- Add triggers
CREATE TRIGGER warehouse_address_system_note
  AFTER INSERT OR DELETE OR UPDATE ON public.warehouse_address
  FOR EACH ROW EXECUTE FUNCTION public.trg_system_note();

CREATE TRIGGER touch_warehouse_address
  BEFORE UPDATE ON public.warehouse_address
  FOR EACH ROW EXECUTE FUNCTION public.trg_touch_updated_at();