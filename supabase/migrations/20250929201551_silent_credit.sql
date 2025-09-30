/*
  # Fix Transfer Validation Logic

  1. Problem
    - Transfer validation is incorrectly triggering on Shipments and Receipts
    - The validation should only apply to Transfer document types
    - Current logic has timing issues with constraint triggers

  2. Solution
    - Update the validation function to be more robust
    - Add better error handling and debugging
    - Ensure validation only runs for Transfer documents
    - Fix timing issues with deferred constraints

  3. Security
    - Maintains existing RLS policies
    - Preserves data integrity for actual transfers
*/

-- Drop and recreate the transfer validation function with better logic
CREATE OR REPLACE FUNCTION public.trg_movement_hdr_validate_transfer()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
declare
  v_type text;
  v_pos numeric(20,6);
  v_neg numeric(20,6);
  v_primary uuid;
  v_secondary uuid;
  v_bad int;
  v_hdr_id uuid;
begin
  -- Get the header ID from either the current row or the related header
  if TG_TABLE_NAME = 'movement_hdr' then
    v_hdr_id := coalesce(new.id, old.id);
  elsif TG_TABLE_NAME = 'movement_line' then
    v_hdr_id := coalesce(new.hdr_id, old.hdr_id);
  else
    return coalesce(new, old);
  end if;

  -- Get header information
  select doc_type, primary_warehouse_id, secondary_warehouse_id
    into v_type, v_primary, v_secondary
  from movement_hdr 
  where id = v_hdr_id;

  -- Only validate Transfer documents
  if v_type is null or v_type <> 'Transfer' then
    return coalesce(new, old);
  end if;

  -- Calculate positive and negative quantities for this transfer
  select 
    coalesce(sum(case when qty_base > 0 then qty_base else 0 end), 0),
    coalesce(sum(case when qty_base < 0 then -qty_base else 0 end), 0)
    into v_pos, v_neg
  from movement_line 
  where hdr_id = v_hdr_id;

  -- For transfers, we need both positive and negative lines
  if v_pos = 0 or v_neg = 0 then
    raise exception 'Transfer must have at least one positive and one negative line';
  end if;

  -- Transfer lines must net to zero
  if v_pos <> v_neg then
    raise exception 'Transfer lines must net to zero: positive=%, negative=%', v_pos, v_neg;
  end if;

  -- If secondary warehouse is set, enforce warehouse mapping
  if v_secondary is not null then
    select count(*) into v_bad
    from movement_line
    where hdr_id = v_hdr_id
      and ( (qty_base < 0 and warehouse_id <> v_primary)
            or (qty_base > 0 and warehouse_id <> v_secondary) );
    
    if v_bad > 0 then
      raise exception 'Transfer lines must use primary warehouse for negative quantities and secondary warehouse for positive quantities';
    end if;
  end if;

  return coalesce(new, old);
end $function$;

-- Ensure the triggers are properly configured
-- Drop existing triggers first
DROP TRIGGER IF EXISTS movement_hdr_validate_transfer ON movement_hdr;
DROP TRIGGER IF EXISTS movement_hdr_validate_transfer2 ON movement_line;

-- Recreate triggers with proper timing
-- Header trigger - runs after insert/update to validate the complete document
CREATE CONSTRAINT TRIGGER movement_hdr_validate_transfer
  AFTER INSERT OR UPDATE ON movement_hdr
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION trg_movement_hdr_validate_transfer();

-- Line trigger - runs after insert/update/delete to validate when lines change
CREATE CONSTRAINT TRIGGER movement_line_validate_transfer
  AFTER INSERT OR UPDATE OR DELETE ON movement_line
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION trg_movement_hdr_validate_transfer();