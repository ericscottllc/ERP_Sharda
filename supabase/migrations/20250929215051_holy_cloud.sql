/*
  # Create invoice automation trigger

  1. Functions
    - `trg_auto_populate_invoice_lines()` - Automatically creates invoice lines from SO lines
    - `trg_inherit_terms_from_so()` - Inherits terms from sales order if not specified

  2. Triggers
    - Trigger on `invoice_hdr` AFTER INSERT to auto-populate lines and inherit terms

  3. Logic
    - When invoice is created, automatically copy all SO lines to invoice lines
    - Inherit terms from SO if not specified on invoice
    - Set default UOM to 'EA' and copy quantities
*/

-- Function to auto-populate invoice lines from sales order lines
CREATE OR REPLACE FUNCTION trg_auto_populate_invoice_lines()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert invoice lines based on commercial lines from the sales order
  INSERT INTO invoice_line (
    invoice_hdr_id,
    so_line_id,
    line_no,
    item_name,
    qty_invoiced,
    uom
  )
  SELECT 
    NEW.id,
    cl.id,
    cl.line_no,
    cl.item_name,
    cl.qty_ordered,
    'EA'
  FROM commercial_line cl
  WHERE cl.hdr_id = NEW.so_hdr_id
  ORDER BY cl.line_no;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to inherit terms from sales order if not specified
CREATE OR REPLACE FUNCTION trg_inherit_terms_from_so()
RETURNS TRIGGER AS $$
BEGIN
  -- If terms_id is not specified, inherit from the sales order
  IF NEW.terms_id IS NULL THEN
    SELECT ch.terms_id INTO NEW.terms_id
    FROM commercial_hdr ch
    WHERE ch.id = NEW.so_hdr_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER invoice_inherit_terms
  BEFORE INSERT ON invoice_hdr
  FOR EACH ROW
  EXECUTE FUNCTION trg_inherit_terms_from_so();

CREATE TRIGGER invoice_auto_populate_lines
  AFTER INSERT ON invoice_hdr
  FOR EACH ROW
  EXECUTE FUNCTION trg_auto_populate_invoice_lines();