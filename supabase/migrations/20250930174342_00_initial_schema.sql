/*
  # Initial Database Schema
  
  Creates all base tables for the inventory management system.
  This migration establishes the foundation for:
  - Parties (customers/vendors)
  - Products and items
  - Warehouses and addresses
  - Commercial documents (SO/PO/TO)
  - Movement documents (Shipments/Receipts/Adjustments)
  - Invoicing
  - Tags and terms
*/

-- Enable RLS on all tables (will add policies later)
-- First, create lookup tables with no dependencies

CREATE TABLE IF NOT EXISTS public.units_of_units (
  units_of_units text NOT NULL,
  CONSTRAINT units_of_units_pkey PRIMARY KEY (units_of_units)
);

CREATE TABLE IF NOT EXISTS public.case_type (
  package_type text NOT NULL,
  CONSTRAINT case_type_pkey PRIMARY KEY (package_type)
);

CREATE TABLE IF NOT EXISTS public.product_type (
  product_type text NOT NULL,
  CONSTRAINT product_type_pkey PRIMARY KEY (product_type)
);

CREATE TABLE IF NOT EXISTS public.registrant (
  registrant text NOT NULL,
  CONSTRAINT registrant_pkey PRIMARY KEY (registrant)
);

-- Core entity tables
CREATE TABLE IF NOT EXISTS public.address (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  line1 text NOT NULL,
  line2 text,
  city text NOT NULL,
  region text,
  postal_code text,
  country text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  temp_key text,
  CONSTRAINT address_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.app_user (
  uid uuid NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['pending'::text, 'viewer'::text, 'admin'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT app_user_pkey PRIMARY KEY (uid)
);

CREATE TABLE IF NOT EXISTS public.party (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type = ANY (ARRAY['company'::text, 'person'::text])),
  display_name text NOT NULL,
  initials text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_customer boolean DEFAULT true,
  is_vendor boolean DEFAULT false,
  email text,
  phone text,
  CONSTRAINT party_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.warehouse (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  epa_number text,
  phone text,
  contact_name text,
  location_hours text,
  CONSTRAINT warehouse_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.terms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT terms_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.tag (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  color text NOT NULL DEFAULT '#6b7280'::text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tag_pkey PRIMARY KEY (id)
);

-- Junction tables
CREATE TABLE IF NOT EXISTS public.party_address (
  party_id uuid NOT NULL,
  address_id uuid NOT NULL,
  use text NOT NULL CHECK (use = ANY (ARRAY['ship_to'::text, 'bill_to'::text, 'remit_to'::text, 'other'::text])),
  is_default boolean NOT NULL DEFAULT false,
  valid_from date,
  valid_to date,
  CONSTRAINT party_address_pkey PRIMARY KEY (use, party_id, address_id),
  CONSTRAINT party_address_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.party(id),
  CONSTRAINT party_address_address_id_fkey FOREIGN KEY (address_id) REFERENCES public.address(id)
);

CREATE TABLE IF NOT EXISTS public.party_role (
  party_id uuid NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['customer'::text, 'vendor'::text, 'carrier'::text, 'contact'::text])),
  CONSTRAINT party_role_pkey PRIMARY KEY (role, party_id),
  CONSTRAINT party_role_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.party(id)
);

CREATE TABLE IF NOT EXISTS public.warehouse_address (
  warehouse_id uuid NOT NULL,
  address_id uuid NOT NULL,
  use text NOT NULL CHECK (use = ANY (ARRAY['shipping'::text, 'billing'::text, 'mailing'::text, 'other'::text])),
  is_default boolean NOT NULL DEFAULT false,
  valid_from date,
  valid_to date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT warehouse_address_pkey PRIMARY KEY (warehouse_id, use, address_id),
  CONSTRAINT warehouse_address_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouse(id),
  CONSTRAINT warehouse_address_address_id_fkey FOREIGN KEY (address_id) REFERENCES public.address(id)
);

-- Product/Item hierarchy
CREATE TABLE IF NOT EXISTS public.pack_size (
  pack_size text NOT NULL,
  id bigint,
  units_per_each numeric,
  volume_per_unit numeric,
  units_of_units text,
  package_type text,
  uom_per_each numeric,
  eaches_per_pallet numeric,
  pallets_per_tl numeric,
  eaches_per_tl numeric,
  CONSTRAINT pack_size_pkey PRIMARY KEY (pack_size),
  CONSTRAINT pack_size_units_of_units_fkey FOREIGN KEY (units_of_units) REFERENCES public.units_of_units(units_of_units),
  CONSTRAINT pack_size_package_type_fkey FOREIGN KEY (package_type) REFERENCES public.case_type(package_type)
);

CREATE TABLE IF NOT EXISTS public.product (
  product_name text NOT NULL,
  registrant text,
  product_type text,
  CONSTRAINT product_pkey PRIMARY KEY (product_name),
  CONSTRAINT product_registrant_fkey FOREIGN KEY (registrant) REFERENCES public.registrant(registrant),
  CONSTRAINT product_product_type_fkey FOREIGN KEY (product_type) REFERENCES public.product_type(product_type)
);

CREATE TABLE IF NOT EXISTS public.item (
  product_name text,
  pack_size text,
  item_name text NOT NULL,
  CONSTRAINT item_pkey PRIMARY KEY (item_name),
  CONSTRAINT item_pack_size_fkey FOREIGN KEY (pack_size) REFERENCES public.pack_size(pack_size),
  CONSTRAINT item_product_name_fkey FOREIGN KEY (product_name) REFERENCES public.product(product_name)
);

CREATE TABLE IF NOT EXISTS public.lot_catalog (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_name text NOT NULL,
  lot_number text NOT NULL,
  mfg_date date,
  exp_date date,
  note text,
  CONSTRAINT lot_catalog_pkey PRIMARY KEY (id),
  CONSTRAINT lot_catalog_item_name_fkey FOREIGN KEY (item_name) REFERENCES public.item(item_name)
);

-- Commercial documents
CREATE TABLE IF NOT EXISTS public.commercial_hdr (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  doc_type text NOT NULL CHECK (doc_type = ANY (ARRAY['SO'::text, 'PO'::text, 'TO'::text])),
  doc_no text NOT NULL UNIQUE,
  status text NOT NULL,
  party_id uuid,
  bill_to_address_id uuid,
  ship_to_address_id uuid,
  primary_warehouse_id uuid NOT NULL,
  secondary_warehouse_id uuid,
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  requested_date date,
  note text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  default_inventory_state text NOT NULL DEFAULT 'Stock'::text CHECK (default_inventory_state = ANY (ARRAY['Stock'::text, 'Consignment'::text, 'Hold'::text])),
  terms_id uuid,
  customer_ref text,
  CONSTRAINT commercial_hdr_pkey PRIMARY KEY (id),
  CONSTRAINT commercial_hdr_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.party(id),
  CONSTRAINT commercial_hdr_bill_to_address_id_fkey FOREIGN KEY (bill_to_address_id) REFERENCES public.address(id),
  CONSTRAINT commercial_hdr_ship_to_address_id_fkey FOREIGN KEY (ship_to_address_id) REFERENCES public.address(id),
  CONSTRAINT commercial_hdr_primary_warehouse_id_fkey FOREIGN KEY (primary_warehouse_id) REFERENCES public.warehouse(id),
  CONSTRAINT commercial_hdr_secondary_warehouse_id_fkey FOREIGN KEY (secondary_warehouse_id) REFERENCES public.warehouse(id),
  CONSTRAINT commercial_hdr_terms_id_fkey FOREIGN KEY (terms_id) REFERENCES public.terms(id)
);

CREATE SEQUENCE IF NOT EXISTS commercial_hdr_doc_no_seq;

CREATE TABLE IF NOT EXISTS public.commercial_line (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  hdr_id uuid NOT NULL,
  line_no integer NOT NULL,
  item_name text NOT NULL,
  uom text NOT NULL DEFAULT 'EA'::text,
  qty_ordered numeric NOT NULL CHECK (qty_ordered > 0::numeric),
  requested_date date,
  promise_date date,
  cancel_after date,
  lot_number text,
  status text NOT NULL,
  warehouse_id uuid,
  secondary_warehouse_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  inventory_state text NOT NULL DEFAULT 'Stock'::text CHECK (inventory_state = ANY (ARRAY['Stock'::text, 'Consignment'::text, 'Hold'::text])),
  CONSTRAINT commercial_line_pkey PRIMARY KEY (id),
  CONSTRAINT commercial_line_hdr_id_fkey FOREIGN KEY (hdr_id) REFERENCES public.commercial_hdr(id),
  CONSTRAINT commercial_line_item_name_fkey FOREIGN KEY (item_name) REFERENCES public.item(item_name),
  CONSTRAINT commercial_line_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouse(id),
  CONSTRAINT commercial_line_secondary_warehouse_id_fkey FOREIGN KEY (secondary_warehouse_id) REFERENCES public.warehouse(id)
);

CREATE TABLE IF NOT EXISTS public.commercial_line_tag (
  commercial_line_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  CONSTRAINT commercial_line_tag_pkey PRIMARY KEY (commercial_line_id, tag_id),
  CONSTRAINT commercial_line_tag_commercial_line_id_fkey FOREIGN KEY (commercial_line_id) REFERENCES public.commercial_line(id),
  CONSTRAINT commercial_line_tag_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tag(id)
);

-- Movement documents
CREATE TABLE IF NOT EXISTS public.movement_hdr (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  doc_type text NOT NULL CHECK (doc_type = ANY (ARRAY['Shipment'::text, 'Receipt'::text, 'Adjustment'::text, 'Return_In'::text, 'Return_Out'::text, 'Transfer'::text])),
  status text NOT NULL CHECK (status = ANY (ARRAY['Draft'::text, 'Posted'::text, 'Canceled'::text])),
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  posted_at timestamp with time zone,
  primary_warehouse_id uuid NOT NULL,
  secondary_warehouse_id uuid,
  note text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  physical_status text,
  CONSTRAINT movement_hdr_pkey PRIMARY KEY (id),
  CONSTRAINT movement_hdr_primary_warehouse_id_fkey FOREIGN KEY (primary_warehouse_id) REFERENCES public.warehouse(id),
  CONSTRAINT movement_hdr_secondary_warehouse_id_fkey FOREIGN KEY (secondary_warehouse_id) REFERENCES public.warehouse(id)
);

CREATE TABLE IF NOT EXISTS public.movement_line (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  hdr_id uuid NOT NULL,
  line_no integer NOT NULL,
  item_name text NOT NULL,
  warehouse_id uuid,
  inventory_state text NOT NULL CHECK (inventory_state = ANY (ARRAY['Stock'::text, 'Consignment'::text, 'Hold'::text])),
  qty_base numeric NOT NULL CHECK (qty_base <> 0::numeric),
  lot_number text,
  effective_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT movement_line_pkey PRIMARY KEY (id),
  CONSTRAINT movement_line_hdr_id_fkey FOREIGN KEY (hdr_id) REFERENCES public.movement_hdr(id),
  CONSTRAINT movement_line_item_name_fkey FOREIGN KEY (item_name) REFERENCES public.item(item_name),
  CONSTRAINT movement_line_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouse(id)
);

CREATE TABLE IF NOT EXISTS public.movement_ext (
  movement_hdr_id uuid NOT NULL,
  carrier_name text,
  tracking_number text,
  scac text,
  service_level text,
  pro_number text,
  reference jsonb NOT NULL DEFAULT '{}'::jsonb,
  packages_count integer,
  shipped_weight numeric,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT movement_ext_pkey PRIMARY KEY (movement_hdr_id),
  CONSTRAINT movement_ext_movement_hdr_id_fkey FOREIGN KEY (movement_hdr_id) REFERENCES public.movement_hdr(id)
);

CREATE TABLE IF NOT EXISTS public.fulfillment_link (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  commercial_line_id uuid NOT NULL,
  movement_line_id uuid NOT NULL,
  qty_linked_base numeric NOT NULL CHECK (qty_linked_base > 0::numeric),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT fulfillment_link_pkey PRIMARY KEY (id),
  CONSTRAINT fulfillment_link_commercial_line_id_fkey FOREIGN KEY (commercial_line_id) REFERENCES public.commercial_line(id),
  CONSTRAINT fulfillment_link_movement_line_id_fkey FOREIGN KEY (movement_line_id) REFERENCES public.movement_line(id)
);

-- Invoice tables
CREATE TABLE IF NOT EXISTS public.invoice_hdr (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  so_hdr_id uuid NOT NULL,
  shipment_hdr_id uuid,
  invoice_no text NOT NULL UNIQUE,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  terms_id uuid,
  status text NOT NULL DEFAULT 'Draft'::text CHECK (status = ANY (ARRAY['Draft'::text, 'Issued'::text, 'Paid'::text, 'Canceled'::text])),
  note text,
  pdf_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT invoice_hdr_pkey PRIMARY KEY (id),
  CONSTRAINT invoice_hdr_so_hdr_id_fkey FOREIGN KEY (so_hdr_id) REFERENCES public.commercial_hdr(id),
  CONSTRAINT invoice_hdr_shipment_hdr_id_fkey FOREIGN KEY (shipment_hdr_id) REFERENCES public.movement_hdr(id),
  CONSTRAINT invoice_hdr_terms_id_fkey FOREIGN KEY (terms_id) REFERENCES public.terms(id)
);

CREATE TABLE IF NOT EXISTS public.invoice_line (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  invoice_hdr_id uuid NOT NULL,
  so_line_id uuid NOT NULL,
  line_no integer NOT NULL,
  item_name text NOT NULL,
  qty_invoiced numeric NOT NULL CHECK (qty_invoiced > 0::numeric),
  uom text,
  price numeric,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT invoice_line_pkey PRIMARY KEY (id),
  CONSTRAINT invoice_line_invoice_hdr_id_fkey FOREIGN KEY (invoice_hdr_id) REFERENCES public.invoice_hdr(id),
  CONSTRAINT invoice_line_so_line_id_fkey FOREIGN KEY (so_line_id) REFERENCES public.commercial_line(id),
  CONSTRAINT invoice_line_item_name_fkey FOREIGN KEY (item_name) REFERENCES public.item(item_name)
);

-- System tables
CREATE TABLE IF NOT EXISTS public.system_note (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  action text NOT NULL CHECK (action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])),
  pk jsonb,
  changed_by uuid,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  diff jsonb,
  old_row jsonb,
  new_row jsonb,
  CONSTRAINT system_note_pkey PRIMARY KEY (id)
);

-- Enable RLS on all tables
ALTER TABLE public.address ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_type ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_hdr ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_line ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_line_tag ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fulfillment_link ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_hdr ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_line ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lot_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movement_ext ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movement_hdr ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movement_line ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pack_size ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_address ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_role ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_type ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrant ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_note ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tag ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units_of_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_address ENABLE ROW LEVEL SECURITY;