/*
  # Create invoice header table

  1. New Tables
    - `invoice_hdr`
      - `id` (uuid, primary key)
      - `so_hdr_id` (uuid, not null, foreign key to commercial_hdr)
      - `shipment_hdr_id` (uuid, optional, foreign key to movement_hdr)
      - `invoice_no` (text, unique, not null)
      - `invoice_date` (date, default today)
      - `due_date` (date, optional)
      - `terms_id` (uuid, optional, foreign key to terms)
      - `status` (text, not null, check constraint)
      - `note` (text, optional)
      - `pdf_url` (text, optional)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `invoice_hdr` table
    - Add policies for admin and viewer access

  3. Constraints
    - Status must be one of: Draft, Issued, Paid, Canceled
    - Invoice number must be unique
*/

CREATE TABLE IF NOT EXISTS invoice_hdr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  so_hdr_id uuid NOT NULL,
  shipment_hdr_id uuid,
  invoice_no text UNIQUE NOT NULL,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  terms_id uuid,
  status text NOT NULL DEFAULT 'Draft',
  note text,
  pdf_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT invoice_hdr_status_check 
    CHECK (status = ANY (ARRAY['Draft', 'Issued', 'Paid', 'Canceled'])),
  
  CONSTRAINT invoice_hdr_so_hdr_id_fkey 
    FOREIGN KEY (so_hdr_id) REFERENCES commercial_hdr(id) ON DELETE CASCADE,
  
  CONSTRAINT invoice_hdr_shipment_hdr_id_fkey 
    FOREIGN KEY (shipment_hdr_id) REFERENCES movement_hdr(id) ON DELETE SET NULL,
  
  CONSTRAINT invoice_hdr_terms_id_fkey 
    FOREIGN KEY (terms_id) REFERENCES terms(id)
);

ALTER TABLE invoice_hdr ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_invoice_hdr"
  ON invoice_hdr
  FOR ALL
  TO public
  USING (app_user_role() = 'admin')
  WITH CHECK (app_user_role() = 'admin');

CREATE POLICY "viewer_select_invoice_hdr"
  ON invoice_hdr
  FOR SELECT
  TO public
  USING (app_user_role() = ANY (ARRAY['viewer', 'admin']));

CREATE TRIGGER touch_invoice_hdr
  BEFORE UPDATE ON invoice_hdr
  FOR EACH ROW
  EXECUTE FUNCTION trg_touch_updated_at();

CREATE TRIGGER invoice_hdr_system_note
  AFTER INSERT OR UPDATE OR DELETE ON invoice_hdr
  FOR EACH ROW
  EXECUTE FUNCTION trg_system_note();