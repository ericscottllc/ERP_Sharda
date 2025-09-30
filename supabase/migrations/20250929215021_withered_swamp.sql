/*
  # Add terms to commercial header

  1. Changes
    - Add `terms_id` column to `commercial_hdr` table
    - Add foreign key constraint to `terms` table

  2. Notes
    - Column is nullable to allow existing records
    - Terms will flow from sales orders to invoices
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commercial_hdr' AND column_name = 'terms_id'
  ) THEN
    ALTER TABLE commercial_hdr ADD COLUMN terms_id uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'commercial_hdr_terms_id_fkey'
  ) THEN
    ALTER TABLE commercial_hdr 
    ADD CONSTRAINT commercial_hdr_terms_id_fkey 
    FOREIGN KEY (terms_id) REFERENCES terms(id);
  END IF;
END $$;