/*
  # Add Physical Status to Movement Records

  1. Schema Changes
    - Add `physical_status` column to `movement_hdr` table
    - Set appropriate defaults and constraints for each movement type

  2. Status Values
    - Shipments: 'Pending Pickup', 'In Transit', 'Delivered'
    - Receipts: 'Pending Delivery', 'In Transit', 'Received'
    - Adjustments: No physical status (NULL allowed)

  3. Defaults
    - Shipments: Default to 'In Transit'
    - Receipts: Default to 'Received'
    - Adjustments: NULL (no physical status)
*/

-- Add physical_status column to movement_hdr
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'movement_hdr' AND column_name = 'physical_status'
  ) THEN
    ALTER TABLE movement_hdr ADD COLUMN physical_status text;
  END IF;
END $$;

-- Add check constraint for physical_status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'movement_hdr_physical_status_check'
  ) THEN
    ALTER TABLE movement_hdr ADD CONSTRAINT movement_hdr_physical_status_check 
    CHECK (
      (doc_type = 'Shipment' AND physical_status IN ('Pending Pickup', 'In Transit', 'Delivered')) OR
      (doc_type = 'Receipt' AND physical_status IN ('Pending Delivery', 'In Transit', 'Received')) OR
      (doc_type NOT IN ('Shipment', 'Receipt') AND physical_status IS NULL)
    );
  END IF;
END $$;

-- Create trigger function to set default physical status
CREATE OR REPLACE FUNCTION trg_set_default_physical_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Set default physical status based on doc_type
  IF NEW.physical_status IS NULL THEN
    CASE NEW.doc_type
      WHEN 'Shipment' THEN
        NEW.physical_status := 'In Transit';
      WHEN 'Receipt' THEN
        NEW.physical_status := 'Received';
      ELSE
        NEW.physical_status := NULL;
    END CASE;
  END IF;
  
  -- Special logic: If physical_status is 'Pending Pickup' or 'Pending Delivery', set status to 'Draft'
  IF NEW.physical_status IN ('Pending Pickup', 'Pending Delivery') THEN
    NEW.status := 'Draft';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS movement_hdr_set_physical_status ON movement_hdr;
CREATE TRIGGER movement_hdr_set_physical_status
  BEFORE INSERT OR UPDATE ON movement_hdr
  FOR EACH ROW
  EXECUTE FUNCTION trg_set_default_physical_status();

-- Update existing records with default physical status
UPDATE movement_hdr 
SET physical_status = CASE 
  WHEN doc_type = 'Shipment' THEN 'In Transit'
  WHEN doc_type = 'Receipt' THEN 'Received'
  ELSE NULL
END
WHERE physical_status IS NULL;