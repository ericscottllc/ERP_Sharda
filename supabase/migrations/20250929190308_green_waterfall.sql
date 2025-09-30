/*
  # Update commercial header trigger for manual document numbers

  1. Changes
    - Modify trg_commercial_hdr_default_doc_no to only assign default doc_no if user didn't provide one
    - Allow manual document number input to take precedence over system-generated values

  2. Security
    - Maintains existing trigger functionality
    - Only changes the logic for when to assign default document numbers
*/

-- Update the trigger function to only assign default doc_no if none provided
CREATE OR REPLACE FUNCTION public.trg_commercial_hdr_default_doc_no()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only assign default doc_no if user didn't provide one (NULL or empty string)
  IF NEW.doc_no IS NULL OR trim(NEW.doc_no) = '' THEN
    NEW.doc_no := NEW.doc_type || '-' || to_char(nextval('commercial_hdr_doc_no_seq'), 'FM000000');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create sequence if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'commercial_hdr_doc_no_seq') THEN
    CREATE SEQUENCE public.commercial_hdr_doc_no_seq START 1;
  END IF;
END $$;