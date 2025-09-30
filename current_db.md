
CREATE TABLE public.address (
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
CREATE TABLE public.app_user (
  uid uuid NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['pending'::text, 'viewer'::text, 'admin'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT app_user_pkey PRIMARY KEY (uid)
);
CREATE TABLE public.case_type (
  package_type text NOT NULL,
  CONSTRAINT case_type_pkey PRIMARY KEY (package_type)
);
CREATE TABLE public.commercial_hdr (
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
CREATE TABLE public.commercial_line (
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
CREATE TABLE public.commercial_line_tag (
  commercial_line_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  CONSTRAINT commercial_line_tag_pkey PRIMARY KEY (commercial_line_id, tag_id),
  CONSTRAINT commercial_line_tag_commercial_line_id_fkey FOREIGN KEY (commercial_line_id) REFERENCES public.commercial_line(id),
  CONSTRAINT commercial_line_tag_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tag(id)
);
CREATE TABLE public.fulfillment_link (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  commercial_line_id uuid NOT NULL,
  movement_line_id uuid NOT NULL,
  qty_linked_base numeric NOT NULL CHECK (qty_linked_base > 0::numeric),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT fulfillment_link_pkey PRIMARY KEY (id),
  CONSTRAINT fulfillment_link_commercial_line_id_fkey FOREIGN KEY (commercial_line_id) REFERENCES public.commercial_line(id),
  CONSTRAINT fulfillment_link_movement_line_id_fkey FOREIGN KEY (movement_line_id) REFERENCES public.movement_line(id)
);
CREATE TABLE public.invoice_hdr (
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
CREATE TABLE public.invoice_line (
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
CREATE TABLE public.item (
  product_name text,
  pack_size text,
  item_name text NOT NULL,
  CONSTRAINT item_pkey PRIMARY KEY (item_name),
  CONSTRAINT item_pack_size_fkey FOREIGN KEY (pack_size) REFERENCES public.pack_size(pack_size),
  CONSTRAINT item_product_name_fkey FOREIGN KEY (product_name) REFERENCES public.product(product_name)
);
CREATE TABLE public.lot_catalog (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_name text NOT NULL,
  lot_number text NOT NULL,
  mfg_date date,
  exp_date date,
  note text,
  CONSTRAINT lot_catalog_pkey PRIMARY KEY (id),
  CONSTRAINT lot_catalog_item_name_fkey FOREIGN KEY (item_name) REFERENCES public.item(item_name)
);
CREATE TABLE public.movement_ext (
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
CREATE TABLE public.movement_hdr (
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
CREATE TABLE public.movement_line (
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
CREATE TABLE public.old_transaction_detail (
  detail_id text NOT NULL,
  transaction_id text,
  item_name text,
  quantity double precision,
  inventory_status text,
  created_at text,
  lot_number text,
  comments text,
  last_updated_at text,
  status text,
  created_by text,
  last_edited_by text,
  CONSTRAINT old_transaction_detail_pkey PRIMARY KEY (detail_id)
);
CREATE TABLE public.old_transaction_header (
  transaction_id text NOT NULL,
  transaction_type text,
  transaction_date timestamp with time zone,
  reference_type text,
  reference_number text,
  created_at timestamp with time zone,
  shipment_carrier text,
  shipping_document text,
  customer_po text,
  customer_name text,
  comments text,
  last_updated_at text,
  related_transaction_id text,
  warehouse text,
  temp_id text,
  created_by text,
  last_edited_by text,
  CONSTRAINT old_transaction_header_pkey PRIMARY KEY (transaction_id)
);
CREATE TABLE public.pack_size (
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
CREATE TABLE public.party (
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
CREATE TABLE public.party_address (
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
CREATE TABLE public.party_role (
  party_id uuid NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['customer'::text, 'vendor'::text, 'carrier'::text, 'contact'::text])),
  CONSTRAINT party_role_pkey PRIMARY KEY (role, party_id),
  CONSTRAINT party_role_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.party(id)
);
CREATE TABLE public.product (
  product_name text NOT NULL,
  registrant text,
  product_type text,
  CONSTRAINT product_pkey PRIMARY KEY (product_name),
  CONSTRAINT product_registrant_fkey FOREIGN KEY (registrant) REFERENCES public.registrant(registrant),
  CONSTRAINT product_product_type_fkey FOREIGN KEY (product_type) REFERENCES public.product_type(product_type)
);
CREATE TABLE public.product_type (
  product_type text NOT NULL,
  CONSTRAINT product_type_pkey PRIMARY KEY (product_type)
);
CREATE TABLE public.registrant (
  registrant text NOT NULL,
  CONSTRAINT registrant_pkey PRIMARY KEY (registrant)
);
CREATE TABLE public.system_note (
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
CREATE TABLE public.tag (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  color text NOT NULL DEFAULT '#6b7280'::text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tag_pkey PRIMARY KEY (id)
);
CREATE TABLE public.terms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT terms_pkey PRIMARY KEY (id)
);
CREATE TABLE public.units_of_units (
  units_of_units text NOT NULL,
  CONSTRAINT units_of_units_pkey PRIMARY KEY (units_of_units)
);
CREATE TABLE public.warehouse (
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
CREATE TABLE public.warehouse_address (
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



SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY schema_name, function_name;

[
  {
    "schema_name": "public",
    "function_name": "app_user_role",
    "definition": "CREATE OR REPLACE FUNCTION public.app_user_role()\n RETURNS text\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'public'\nAS $function$\nSELECT COALESCE((\nSELECT role FROM public.app_user WHERE uid = auth.uid()\n), 'pending')\n$function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "attach_system_note",
    "definition": "CREATE OR REPLACE FUNCTION public.attach_system_note(p_table regclass)\n RETURNS void\n LANGUAGE plpgsql\n SET search_path TO 'public'\nAS $function$\nbegin\n  execute format($f$\n    drop trigger if exists %1$s_system_note on %1$s;\n    create trigger %1$s_system_note\n    after insert or update or delete on %1$s\n    for each row execute function trg_system_note();\n  $f$, p_table::text);\nend $function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "commercial_line_progress",
    "definition": "CREATE OR REPLACE FUNCTION public.commercial_line_progress(p_line_id uuid)\n RETURNS TABLE(qty_shipped numeric, qty_received numeric, qty_transfer_shipped numeric, qty_transfer_received numeric)\n LANGUAGE sql\n STABLE\n SET search_path TO 'public'\nAS $function$\n  with ml as (\n    select fl.qty_linked_base as qty, mh.doc_type, ml.qty_base\n    from fulfillment_link fl\n    join movement_line ml on ml.id = fl.movement_line_id\n    join movement_hdr mh on mh.id = ml.hdr_id\n    where fl.commercial_line_id = p_line_id\n      and mh.status = 'Posted'\n  )\n  select\n    coalesce(sum(case when doc_type='Shipment' then qty end),0)::numeric as qty_shipped,\n    coalesce(sum(case when doc_type='Receipt' then qty end),0)::numeric as qty_received,\n    coalesce(sum(case when doc_type='Transfer' and qty_base < 0 then qty end),0)::numeric as qty_transfer_shipped,\n    coalesce(sum(case when doc_type='Transfer' and qty_base > 0 then qty end),0)::numeric as qty_transfer_received\n  from ml;\n$function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "inventory_as_of",
    "definition": "CREATE OR REPLACE FUNCTION public.inventory_as_of(p_cutoff date)\n RETURNS TABLE(item_name text, warehouse_id uuid, inventory_state text, qty_on_hand_base numeric)\n LANGUAGE sql\n STABLE\n SET search_path TO 'public'\nAS $function$\n  select\n    ml.item_name,\n    ml.warehouse_id,\n    ml.inventory_state,\n    sum(ml.qty_base) as qty_on_hand_base\n  from movement_line ml\n  join movement_hdr mh on mh.id = ml.hdr_id\n  where mh.status = 'Posted'\n    and ml.effective_date <= p_cutoff\n  group by ml.item_name, ml.warehouse_id, ml.inventory_state\n  having sum(ml.qty_base) <> 0\n  order by ml.item_name, ml.warehouse_id, ml.inventory_state;\n$function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "is_admin",
    "definition": "CREATE OR REPLACE FUNCTION public.is_admin()\n RETURNS boolean\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'public'\nAS $function$ \nSELECT public.app_user_role() = 'admin' \n$function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "is_viewer_or_admin",
    "definition": "CREATE OR REPLACE FUNCTION public.is_viewer_or_admin()\n RETURNS boolean\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'public'\nAS $function$ \nSELECT public.app_user_role() IN ('viewer','admin') \n$function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "recompute_commercial_status",
    "definition": "CREATE OR REPLACE FUNCTION public.recompute_commercial_status(p_hdr_id uuid)\n RETURNS void\n LANGUAGE plpgsql\n SET search_path TO 'public'\nAS $function$\ndeclare\n  v_type text;\n  v_total int;\n  v_all_pending int;\n  v_all_done int;\n  v_any_partial int;\n  r record;\n  v_line_status text;\nbegin\n  select doc_type into v_type from commercial_hdr where id = p_hdr_id;\n\n  for r in\n    select cl.id, cl.qty_ordered\n    from commercial_line cl\n    where cl.hdr_id = p_hdr_id\n  loop\n    if v_type = 'SO' then\n      if (select qty_shipped from commercial_line_progress(r.id)) = 0 then\n        v_line_status := 'Pending Shipment';\n      elsif (select qty_shipped from commercial_line_progress(r.id)) < r.qty_ordered then\n        v_line_status := 'Partially Shipped';\n      else\n        v_line_status := 'Shipped';\n      end if;\n    elsif v_type = 'PO' then\n      if (select qty_received from commercial_line_progress(r.id)) = 0 then\n        v_line_status := 'Pending Receipt';\n      elsif (select qty_received from commercial_line_progress(r.id)) < r.qty_ordered then\n        v_line_status := 'Partially Received';\n      else\n        v_line_status := 'Received';\n      end if;\n    elsif v_type = 'TO' then\n      if (select qty_transfer_received from commercial_line_progress(r.id)) >= r.qty_ordered then\n        v_line_status := 'Received';\n      elsif (select qty_transfer_shipped from commercial_line_progress(r.id)) >= r.qty_ordered then\n        v_line_status := 'Shipped';\n      elsif ( (select qty_transfer_shipped from commercial_line_progress(r.id)) > 0\n           or (select qty_transfer_received from commercial_line_progress(r.id)) > 0 ) then\n        v_line_status := 'Partially Shipped';\n      else\n        v_line_status := 'Open';\n      end if;\n    end if;\n\n    update commercial_line set status = v_line_status, updated_at = now()\n    where id = r.id and status is distinct from v_line_status;\n  end loop;\n\n  if v_type = 'SO' then\n    select\n      count(*) as total,\n      count(*) filter (where status='Pending Shipment') as all_pending,\n      count(*) filter (where status='Shipped') as all_shipped,\n      count(*) filter (where status not in ('Pending Shipment','Shipped')) as any_partial\n    into v_total, v_all_pending, v_all_done, v_any_partial\n    from commercial_line where hdr_id = p_hdr_id;\n\n    update commercial_hdr set status =\n      case\n        when v_all_done = v_total then 'Shipped'\n        when v_all_pending = v_total then 'Pending Shipment'\n        when v_any_partial > 0 then 'Partially Shipped'\n        else status\n      end,\n      updated_at = now()\n    where id = p_hdr_id;\n\n  elsif v_type = 'PO' then\n    select\n      count(*) as total,\n      count(*) filter (where status='Pending Receipt') as all_pending,\n      count(*) filter (where status='Received') as all_received,\n      count(*) filter (where status not in ('Pending Receipt','Received')) as any_partial\n    into v_total, v_all_pending, v_all_done, v_any_partial\n    from commercial_line where hdr_id = p_hdr_id;\n\n    update commercial_hdr set status =\n      case\n        when v_all_done = v_total then 'Received'\n        when v_all_pending = v_total then 'Pending Receipt'\n        when v_any_partial > 0 then 'Partially Received'\n        else status\n      end,\n      updated_at = now()\n    where id = p_hdr_id;\n\n  elsif v_type = 'TO' then\n    select\n      count(*) as total,\n      count(*) filter (where status='Open') as all_open,\n      count(*) filter (where status='Received') as all_received,\n      count(*) filter (where status not in ('Open','Received')) as any_in_progress\n    into v_total, v_all_pending, v_all_done, v_any_partial\n    from commercial_line where hdr_id = p_hdr_id;\n\n    update commercial_hdr set status =\n      case\n        when v_all_done = v_total then 'Closed'\n        when v_all_pending = v_total then 'Open'\n        when v_any_partial > 0 then 'Shipped'\n        else status\n      end,\n      updated_at = now()\n    where id = p_hdr_id;\n  end if;\nend $function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "refresh_mv_inventory_prev_day",
    "definition": "CREATE OR REPLACE FUNCTION public.refresh_mv_inventory_prev_day()\n RETURNS void\n LANGUAGE sql\n SECURITY DEFINER\n SET search_path TO 'public'\nAS $function$\n  refresh materialized view concurrently internal.mv_inventory_prev_day;\n$function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "trg_auto_populate_invoice_lines",
    "definition": "CREATE OR REPLACE FUNCTION public.trg_auto_populate_invoice_lines()\n RETURNS trigger\n LANGUAGE plpgsql\nAS $function$\nBEGIN\n-- Insert invoice lines based on commercial lines from the sales order\nINSERT INTO invoice_line (\ninvoice_hdr_id,\nso_line_id,\nline_no,\nitem_name,\nqty_invoiced,\nuom\n)\nSELECT \nNEW.id,\ncl.id,\ncl.line_no,\ncl.item_name,\ncl.qty_ordered,\n'EA'\nFROM commercial_line cl\nWHERE cl.hdr_id = NEW.so_hdr_id\nORDER BY cl.line_no;\n\nRETURN NEW;\nEND;\n$function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "trg_commercial_hdr_default_doc_no",
    "definition": "CREATE OR REPLACE FUNCTION public.trg_commercial_hdr_default_doc_no()\n RETURNS trigger\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'public'\nAS $function$\nBEGIN\n-- Only assign default doc_no if user didn't provide one (NULL or empty string)\nIF NEW.doc_no IS NULL OR trim(NEW.doc_no) = '' THEN\nNEW.doc_no := NEW.doc_type || '-' || to_char(nextval('commercial_hdr_doc_no_seq'), 'FM000000');\nEND IF;\n\nRETURN NEW;\nEND;\n$function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "trg_commercial_line_inherit_wh",
    "definition": "CREATE OR REPLACE FUNCTION public.trg_commercial_line_inherit_wh()\n RETURNS trigger\n LANGUAGE plpgsql\n SET search_path TO 'public'\nAS $function$\ndeclare\n  v_primary uuid;\n  v_secondary uuid;\nbegin\n  select primary_warehouse_id, secondary_warehouse_id\n    into v_primary, v_secondary\n  from commercial_hdr where id = new.hdr_id;\n\n  if new.warehouse_id is null then new.warehouse_id := v_primary; end if;\n  if new.secondary_warehouse_id is null then new.secondary_warehouse_id := v_secondary; end if;\n\n  return new;\nend $function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "trg_inherit_terms_from_so",
    "definition": "CREATE OR REPLACE FUNCTION public.trg_inherit_terms_from_so()\n RETURNS trigger\n LANGUAGE plpgsql\nAS $function$\nBEGIN\n-- If terms_id is not specified, inherit from the sales order\nIF NEW.terms_id IS NULL THEN\nSELECT ch.terms_id INTO NEW.terms_id\nFROM commercial_hdr ch\nWHERE ch.id = NEW.so_hdr_id;\nEND IF;\n\nRETURN NEW;\nEND;\n$function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "trg_movement_hdr_validate_transfer",
    "definition": "CREATE OR REPLACE FUNCTION public.trg_movement_hdr_validate_transfer()\n RETURNS trigger\n LANGUAGE plpgsql\n SET search_path TO 'public'\nAS $function$\ndeclare\nv_type text;\nv_pos numeric(20,6);\nv_neg numeric(20,6);\nv_primary uuid;\nv_secondary uuid;\nv_bad int;\nv_hdr_id uuid;\nbegin\n-- Get the header ID from either the current row or the related header\nif TG_TABLE_NAME = 'movement_hdr' then\nv_hdr_id := coalesce(new.id, old.id);\nelsif TG_TABLE_NAME = 'movement_line' then\nv_hdr_id := coalesce(new.hdr_id, old.hdr_id);\nelse\nreturn coalesce(new, old);\nend if;\n\n-- Get header information\nselect doc_type, primary_warehouse_id, secondary_warehouse_id\ninto v_type, v_primary, v_secondary\nfrom movement_hdr \nwhere id = v_hdr_id;\n\n-- Only validate Transfer documents\nif v_type is null or v_type <> 'Transfer' then\nreturn coalesce(new, old);\nend if;\n\n-- Calculate positive and negative quantities for this transfer\nselect \ncoalesce(sum(case when qty_base > 0 then qty_base else 0 end), 0),\ncoalesce(sum(case when qty_base < 0 then -qty_base else 0 end), 0)\ninto v_pos, v_neg\nfrom movement_line \nwhere hdr_id = v_hdr_id;\n\n-- For transfers, we need both positive and negative lines\nif v_pos = 0 or v_neg = 0 then\nraise exception 'Transfer must have at least one positive and one negative line';\nend if;\n\n-- Transfer lines must net to zero\nif v_pos <> v_neg then\nraise exception 'Transfer lines must net to zero: positive=%, negative=%', v_pos, v_neg;\nend if;\n\n-- If secondary warehouse is set, enforce warehouse mapping\nif v_secondary is not null then\nselect count(*) into v_bad\nfrom movement_line\nwhere hdr_id = v_hdr_id\nand ( (qty_base < 0 and warehouse_id <> v_primary)\nor (qty_base > 0 and warehouse_id <> v_secondary) );\n\nif v_bad > 0 then\nraise exception 'Transfer lines must use primary warehouse for negative quantities and secondary warehouse for positive quantities';\nend if;\nend if;\n\nreturn coalesce(new, old);\nend $function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "trg_movement_line_defaults_validate",
    "definition": "CREATE OR REPLACE FUNCTION public.trg_movement_line_defaults_validate()\n RETURNS trigger\n LANGUAGE plpgsql\n SET search_path TO 'public'\nAS $function$\ndeclare\n  v_type text;\n  v_eff date;\n  v_primary uuid;\n  v_secondary uuid;\nbegin\n  select doc_type, effective_date, primary_warehouse_id, secondary_warehouse_id\n    into v_type, v_eff, v_primary, v_secondary\n  from movement_hdr where id = new.hdr_id;\n\n  if new.effective_date is null then new.effective_date := v_eff; end if;\n  if new.warehouse_id is null then new.warehouse_id := v_primary; end if;\n\n  if v_type in ('Shipment','Return_Out') then\n    if new.qty_base >= 0 then\n      raise exception 'For %, qty_base must be negative', v_type;\n    end if;\n    if new.warehouse_id <> v_primary then\n      raise exception '% lines must use primary_warehouse_id', v_type;\n    end if;\n  elsif v_type in ('Receipt','Return_In') then\n    if new.qty_base <= 0 then\n      raise exception 'For %, qty_base must be positive', v_type;\n    end if;\n    if new.warehouse_id <> v_primary then\n      raise exception '% lines must use primary_warehouse_id', v_type;\n    end if;\n  elsif v_type = 'Adjustment' then\n    if new.qty_base = 0 then\n      raise exception 'Adjustment qty_base cannot be zero';\n    end if;\n    -- adjustments may be at primary warehouse only for consistency\n    if new.warehouse_id <> v_primary then\n      raise exception 'Adjustment lines must use primary_warehouse_id';\n    end if;\n  elsif v_type = 'Transfer' then\n    -- For transfers: negatives at primary, positives at secondary (if provided)\n    if new.qty_base < 0 and new.warehouse_id <> v_primary then\n      raise exception 'Transfer negative lines must use primary_warehouse_id';\n    end if;\n    if v_secondary is not null and new.qty_base > 0 and new.warehouse_id <> v_secondary then\n      raise exception 'Transfer positive lines must use secondary_warehouse_id when set';\n    end if;\n  else\n    raise exception 'Unknown movement doc_type: %', v_type;\n  end if;\n\n  return new;\nend $function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "trg_recompute_on_link",
    "definition": "CREATE OR REPLACE FUNCTION public.trg_recompute_on_link()\n RETURNS trigger\n LANGUAGE plpgsql\n SET search_path TO 'public'\nAS $function$\ndeclare\n  v_hdr uuid;\nbegin\n  select cl.hdr_id into v_hdr from commercial_line cl where cl.id = coalesce(new.commercial_line_id, old.commercial_line_id);\n  perform recompute_commercial_status(v_hdr);\n  return coalesce(new, old);\nend $function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "trg_recompute_on_movement_status",
    "definition": "CREATE OR REPLACE FUNCTION public.trg_recompute_on_movement_status()\n RETURNS trigger\n LANGUAGE plpgsql\n SET search_path TO 'public'\nAS $function$\ndeclare\n  r record;\nbegin\n  if new.status is distinct from old.status then\n    for r in\n      select distinct cl.hdr_id\n      from movement_line ml\n      join fulfillment_link fl on fl.movement_line_id = ml.id\n      join commercial_line cl on cl.id = fl.commercial_line_id\n      where ml.hdr_id = new.id\n    loop\n      perform recompute_commercial_status(r.hdr_id);\n    end loop;\n  end if;\n  return new;\nend $function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "trg_set_default_physical_status",
    "definition": "CREATE OR REPLACE FUNCTION public.trg_set_default_physical_status()\n RETURNS trigger\n LANGUAGE plpgsql\nAS $function$\nBEGIN\n-- Set default physical status based on doc_type\nIF NEW.physical_status IS NULL THEN\nCASE NEW.doc_type\nWHEN 'Shipment' THEN\nNEW.physical_status := 'In Transit';\nWHEN 'Receipt' THEN\nNEW.physical_status := 'Received';\nELSE\nNEW.physical_status := NULL;\nEND CASE;\nEND IF;\n\n-- Special logic: If physical_status is 'Pending Pickup' or 'Pending Delivery', set status to 'Draft'\nIF NEW.physical_status IN ('Pending Pickup', 'Pending Delivery') THEN\nNEW.status := 'Draft';\nEND IF;\n\nRETURN NEW;\nEND;\n$function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "trg_system_note",
    "definition": "CREATE OR REPLACE FUNCTION public.trg_system_note()\n RETURNS trigger\n LANGUAGE plpgsql\n SET search_path TO 'public'\nAS $function$\ndeclare\n  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(OLD) end;\n  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(NEW) end;\n  v_diff jsonb := '{}'::jsonb;\n  k text;\n  v_pk jsonb := '{}'::jsonb;\nbegin\n  -- gather PK columns into JSON\n  for k in\n    select a.attname\n    from pg_index i\n    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)\n    where i.indrelid = tg_relid and i.indisprimary\n  loop\n    if v_new ? k then\n      v_pk := v_pk || jsonb_build_object(k, v_new -> k);\n    elsif v_old ? k then\n      v_pk := v_pk || jsonb_build_object(k, v_old -> k);\n    end if;\n  end loop;\n\n  if tg_op = 'UPDATE' then\n    -- compute changed keys only; ignore volatile timestamps\n    for k in select key from jsonb_object_keys(v_new) as t(key)\n    loop\n      if k in ('updated_at') then continue; end if;\n      if v_old -> k is distinct from v_new -> k then\n        v_diff := v_diff || jsonb_build_object(k, jsonb_build_object('old', v_old -> k, 'new', v_new -> k));\n      end if;\n    end loop;\n  end if;\n\n  insert into system_note(table_name, action, pk, changed_by, diff, old_row, new_row)\n  values (tg_table_name, tg_op, nullif(v_pk, '{}'::jsonb), auth.uid(), nullif(v_diff, '{}'::jsonb), v_old, v_new);\n\n  return coalesce(NEW, OLD);\nend $function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "trg_touch_updated_at",
    "definition": "CREATE OR REPLACE FUNCTION public.trg_touch_updated_at()\n RETURNS trigger\n LANGUAGE plpgsql\n SET search_path TO 'public'\nAS $function$\nbegin\n  if exists (\n    select 1 from information_schema.columns\n    where table_schema = tg_table_schema and table_name = tg_table_name and column_name = 'updated_at'\n  ) then\n    new.updated_at := now();\n  end if;\n  return new;\nend $function$\n"
  }
]

select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  permissive,
  qual,
  with_check
from pg_policies
order by schemaname, tablename, policyname;

[
  {
    "schemaname": "public",
    "tablename": "address",
    "policyname": "admin_all_address",
    "cmd": "ALL",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = 'admin'::text)",
    "with_check": "(app_user_role() = 'admin'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "address",
    "policyname": "viewer_select_address",
    "cmd": "SELECT",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = ANY (ARRAY['viewer'::text, 'admin'::text]))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "app_user",
    "policyname": "app_user_admin_all",
    "cmd": "ALL",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "is_admin()",
    "with_check": "is_admin()"
  },
  {
    "schemaname": "public",
    "tablename": "app_user",
    "policyname": "app_user_self_select",
    "cmd": "SELECT",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(auth.uid() = uid)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "case_type",
    "policyname": "admin_all_case_type",
    "cmd": "ALL",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = 'admin'::text)",
    "with_check": "(app_user_role() = 'admin'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "case_type",
    "policyname": "viewer_select_case_type",
    "cmd": "SELECT",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = ANY (ARRAY['viewer'::text, 'admin'::text]))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "commercial_hdr",
    "policyname": "admin_all_commercial_hdr",
    "cmd": "ALL",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "is_admin()",
    "with_check": "is_admin()"
  },
  {
    "schemaname": "public",
    "tablename": "commercial_hdr",
    "policyname": "viewer_select_commercial_hdr",
    "cmd": "SELECT",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "is_viewer_or_admin()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "commercial_line",
    "policyname": "admin_all_commercial_line",
    "cmd": "ALL",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = 'admin'::text)",
    "with_check": "(app_user_role() = 'admin'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "commercial_line",
    "policyname": "viewer_select_commercial_line",
    "cmd": "SELECT",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = ANY (ARRAY['viewer'::text, 'admin'::text]))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "commercial_line_tag",
    "policyname": "admin_all_commercial_line_tag",
    "cmd": "ALL",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = 'admin'::text)",
    "with_check": "(app_user_role() = 'admin'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "commercial_line_tag",
    "policyname": "viewer_select_commercial_line_tag",
    "cmd": "SELECT",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = ANY (ARRAY['viewer'::text, 'admin'::text]))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "fulfillment_link",
    "policyname": "admin_all_fulfillment_link",
    "cmd": "ALL",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = 'admin'::text)",
    "with_check": "(app_user_role() = 'admin'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "fulfillment_link",
    "policyname": "viewer_select_fulfillment_link",
    "cmd": "SELECT",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = ANY (ARRAY['viewer'::text, 'admin'::text]))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "invoice_hdr",
    "policyname": "admin_all_invoice_hdr",
    "cmd": "ALL",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = 'admin'::text)",
    "with_check": "(app_user_role() = 'admin'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "invoice_hdr",
    "policyname": "viewer_select_invoice_hdr",
    "cmd": "SELECT",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = ANY (ARRAY['viewer'::text, 'admin'::text]))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "invoice_line",
    "policyname": "admin_all_invoice_line",
    "cmd": "ALL",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = 'admin'::text)",
    "with_check": "(app_user_role() = 'admin'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "invoice_line",
    "policyname": "viewer_select_invoice_line",
    "cmd": "SELECT",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = ANY (ARRAY['viewer'::text, 'admin'::text]))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "item",
    "policyname": "admin_all_item",
    "cmd": "ALL",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = 'admin'::text)",
    "with_check": "(app_user_role() = 'admin'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "item",
    "policyname": "viewer_select_item",
    "cmd": "SELECT",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = ANY (ARRAY['viewer'::text, 'admin'::text]))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "lot_catalog",
    "policyname": "admin_all_lot_catalog",
    "cmd": "ALL",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = 'admin'::text)",
    "with_check": "(app_user_role() = 'admin'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "lot_catalog",
    "policyname": "viewer_select_lot_catalog",
    "cmd": "SELECT",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = ANY (ARRAY['viewer'::text, 'admin'::text]))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "movement_ext",
    "policyname": "admin_all_movement_ext",
    "cmd": "ALL",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = 'admin'::text)",
    "with_check": "(app_user_role() = 'admin'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "movement_ext",
    "policyname": "viewer_select_movement_ext",
    "cmd": "SELECT",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = ANY (ARRAY['viewer'::text, 'admin'::text]))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "movement_hdr",
    "policyname": "admin_all_movement_hdr",
    "cmd": "ALL",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = 'admin'::text)",
    "with_check": "(app_user_role() = 'admin'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "movement_hdr",
    "policyname": "viewer_select_movement_hdr",
    "cmd": "SELECT",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = ANY (ARRAY['viewer'::text, 'admin'::text]))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "movement_line",
    "policyname": "admin_all_movement_line",
    "cmd": "ALL",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = 'admin'::text)",
    "with_check": "(app_user_role() = 'admin'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "movement_line",
    "policyname": "viewer_select_movement_line",
    "cmd": "SELECT",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = ANY (ARRAY['viewer'::text, 'admin'::text]))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "pack_size",
    "policyname": "admin_all_pack_size",
    "cmd": "ALL",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = 'admin'::text)",
    "with_check": "(app_user_role() = 'admin'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "pack_size",
    "policyname": "viewer_select_pack_size",
    "cmd": "SELECT",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = ANY (ARRAY['viewer'::text, 'admin'::text]))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "party",
    "policyname": "admin_all_party",
    "cmd": "ALL",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "is_admin()",
    "with_check": "is_admin()"
  },
  {
    "schemaname": "public",
    "tablename": "party",
    "policyname": "viewer_select_party",
    "cmd": "SELECT",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "is_viewer_or_admin()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "party_address",
    "policyname": "admin_all_party_address",
    "cmd": "ALL",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = 'admin'::text)",
    "with_check": "(app_user_role() = 'admin'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "party_address",
    "policyname": "viewer_select_party_address",
    "cmd": "SELECT",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = ANY (ARRAY['viewer'::text, 'admin'::text]))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "party_role",
    "policyname": "admin_all_party_role",
    "cmd": "ALL",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = 'admin'::text)",
    "with_check": "(app_user_role() = 'admin'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "party_role",
    "policyname": "viewer_select_party_role",
    "cmd": "SELECT",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = ANY (ARRAY['viewer'::text, 'admin'::text]))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "product",
    "policyname": "admin_all_product",
    "cmd": "ALL",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = 'admin'::text)",
    "with_check": "(app_user_role() = 'admin'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "product",
    "policyname": "viewer_select_product",
    "cmd": "SELECT",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = ANY (ARRAY['viewer'::text, 'admin'::text]))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "product_type",
    "policyname": "admin_all_product_type",
    "cmd": "ALL",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = 'admin'::text)",
    "with_check": "(app_user_role() = 'admin'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "product_type",
    "policyname": "viewer_select_product_type",
    "cmd": "SELECT",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = ANY (ARRAY['viewer'::text, 'admin'::text]))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "registrant",
    "policyname": "admin_all_registrant",
    "cmd": "ALL",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = 'admin'::text)",
    "with_check": "(app_user_role() = 'admin'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "registrant",
    "policyname": "viewer_select_registrant",
    "cmd": "SELECT",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = ANY (ARRAY['viewer'::text, 'admin'::text]))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "system_note",
    "policyname": "admin_all_system_note",
    "cmd": "ALL",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = 'admin'::text)",
    "with_check": "(app_user_role() = 'admin'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "system_note",
    "policyname": "viewer_select_system_note",
    "cmd": "SELECT",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = ANY (ARRAY['viewer'::text, 'admin'::text]))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "tag",
    "policyname": "admin_all_tag",
    "cmd": "ALL",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = 'admin'::text)",
    "with_check": "(app_user_role() = 'admin'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "tag",
    "policyname": "viewer_select_tag",
    "cmd": "SELECT",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = ANY (ARRAY['viewer'::text, 'admin'::text]))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "terms",
    "policyname": "admin_all_terms",
    "cmd": "ALL",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = 'admin'::text)",
    "with_check": "(app_user_role() = 'admin'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "terms",
    "policyname": "viewer_select_terms",
    "cmd": "SELECT",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = ANY (ARRAY['viewer'::text, 'admin'::text]))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "units_of_units",
    "policyname": "admin_all_units_of_units",
    "cmd": "ALL",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = 'admin'::text)",
    "with_check": "(app_user_role() = 'admin'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "units_of_units",
    "policyname": "viewer_select_units_of_units",
    "cmd": "SELECT",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "(app_user_role() = ANY (ARRAY['viewer'::text, 'admin'::text]))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "warehouse",
    "policyname": "admin_all_warehouse",
    "cmd": "ALL",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "is_admin()",
    "with_check": "is_admin()"
  },
  {
    "schemaname": "public",
    "tablename": "warehouse",
    "policyname": "viewer_select_warehouse",
    "cmd": "SELECT",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "is_viewer_or_admin()",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "warehouse_address",
    "policyname": "admin_all_warehouse_address",
    "cmd": "ALL",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "is_admin()",
    "with_check": "is_admin()"
  },
  {
    "schemaname": "public",
    "tablename": "warehouse_address",
    "policyname": "viewer_select_warehouse_address",
    "cmd": "SELECT",
    "roles": "{public}",
    "permissive": "PERMISSIVE",
    "qual": "is_viewer_or_admin()",
    "with_check": null
  }
]