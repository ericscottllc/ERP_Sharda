/*
  # Create invoice line table

  1. New Tables
    - `invoice_line`
      - `id` (uuid, primary key)
      - `invoice_hdr_id` (uuid, not null, foreign key to invoice_hdr)
      - `so_line_id` (uuid, not null, foreign key to commercial_line)
      - `line_no` (integer, not null)
      - `item_name` (text, not null, foreign key to item)
      - `qty_invoiced` (numeric, not null, check > 0)
      - `uom` (text, optional)
      - `price` (numeric, optional)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `invoice_line` table
    - Add policies for admin and viewer access

  3. Constraints
    - Quantity invoiced must be positive
    - Unique constraint on (invoice_hdr_id, so_line_id)
*/

CREATE TABLE IF NOT EXISTS invoice_line (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_hdr_id uuid NOT NULL,
  so_line_id uuid NOT NULL,
  line_no integer NOT NULL,
  item_name text NOT NULL,
  qty_invoiced numeric(20,6) NOT NULL,
  uom text,
  price numeric(20,2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT invoice_line_qty_invoiced_check 
    CHECK (qty_invoiced > 0),
  
  CONSTRAINT invoice_line_invoice_hdr_id_so_line_id_key 
    UNIQUE (invoice_hdr_id, so_line_id),
  
  CONSTRAINT invoice_line_invoice_hdr_id_fkey 
    FOREIGN KEY (invoice_hdr_id) REFERENCES invoice_hdr(id) ON DELETE CASCADE,
  
  CONSTRAINT invoice_line_so_line_id_fkey 
    FOREIGN KEY (so_line_id) REFERENCES commercial_line(id) ON DELETE CASCADE,
  
  CONSTRAINT invoice_line_item_name_fkey 
    FOREIGN KEY (item_name) REFERENCES item(item_name)
);

ALTER TABLE invoice_line ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_invoice_line"
  ON invoice_line
  FOR ALL
  TO public
  USING (app_user_role() = 'admin')
  WITH CHECK (app_user_role() = 'admin');

CREATE POLICY "viewer_select_invoice_line"
  ON invoice_line
  FOR SELECT
  TO public
  USING (app_user_role() = ANY (ARRAY['viewer', 'admin']));

CREATE TRIGGER touch_invoice_line
  BEFORE UPDATE ON invoice_line
  FOR EACH ROW
  EXECUTE FUNCTION trg_touch_updated_at();

CREATE TRIGGER invoice_line_system_note
  AFTER INSERT OR UPDATE OR DELETE ON invoice_line
  FOR EACH ROW
  EXECUTE FUNCTION trg_system_note();