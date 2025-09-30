/*
  # Update Movement Status from Draft to Posted

  1. Database Updates
    - Update all existing Draft movement records to Posted status
    - Set posted_at timestamp for newly posted records
    
  2. Business Logic
    - Movements represent actual physical events that should be immediately effective
    - Draft status is rarely appropriate for shipments, receipts, and adjustments
*/

-- Update all Draft movement headers to Posted status
UPDATE movement_hdr 
SET 
  status = 'Posted',
  posted_at = COALESCE(posted_at, created_at),
  updated_at = now()
WHERE status = 'Draft';

-- Log the changes
INSERT INTO system_note (table_name, action, pk, changed_by, diff, old_row, new_row)
SELECT 
  'movement_hdr',
  'UPDATE',
  jsonb_build_object('id', id),
  NULL, -- System update
  jsonb_build_object('status', jsonb_build_object('old', 'Draft', 'new', 'Posted')),
  NULL,
  NULL
FROM movement_hdr 
WHERE status = 'Posted' AND updated_at = now();