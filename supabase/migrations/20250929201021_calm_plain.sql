/*
  # Add inventory state columns to commercial tables

  1. New Columns
    - Add `default_inventory_state` to `commercial_hdr` table
    - Add `inventory_state` to `commercial_line` table
  
  2. Constraints
    - Both columns have CHECK constraints for valid values
    - Default values set to 'Stock'
  
  3. Security
    - Existing RLS policies will apply to new columns
*/

-- Add default_inventory_state to commercial_hdr
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commercial_hdr' AND column_name = 'default_inventory_state'
  ) THEN
    ALTER TABLE commercial_hdr 
    ADD COLUMN default_inventory_state text NOT NULL DEFAULT 'Stock';
  END IF;
END $$;

-- Add constraint for valid inventory states on header
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'commercial_hdr_default_inventory_state_check'
  ) THEN
    ALTER TABLE commercial_hdr 
    ADD CONSTRAINT commercial_hdr_default_inventory_state_check 
    CHECK (default_inventory_state = ANY (ARRAY['Stock'::text, 'Consignment'::text, 'Hold'::text]));
  END IF;
END $$;

-- Add inventory_state to commercial_line
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commercial_line' AND column_name = 'inventory_state'
  ) THEN
    ALTER TABLE commercial_line 
    ADD COLUMN inventory_state text NOT NULL DEFAULT 'Stock';
  END IF;
END $$;

-- Add constraint for valid inventory states on line
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'commercial_line_inventory_state_check'
  ) THEN
    ALTER TABLE commercial_line 
    ADD CONSTRAINT commercial_line_inventory_state_check 
    CHECK (inventory_state = ANY (ARRAY['Stock'::text, 'Consignment'::text, 'Hold'::text]));
  END IF;
END $$;

-- Update existing records to have default inventory state (safe to run multiple times)
UPDATE commercial_hdr 
SET default_inventory_state = 'Stock' 
WHERE default_inventory_state IS NULL OR default_inventory_state = '';

UPDATE commercial_line 
SET inventory_state = 'Stock' 
WHERE inventory_state IS NULL OR inventory_state = '';