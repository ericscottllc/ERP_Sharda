/*
  # Insert predefined payment terms

  1. Data
    - Insert all predefined payment terms
    - Terms include Net 7, Net 30, Consignment, etc.

  2. Notes
    - Uses INSERT ... ON CONFLICT to prevent duplicates
    - Terms are sorted alphabetically for consistency
*/

INSERT INTO terms (name, description) VALUES
  ('Advance', 'Payment in advance'),
  ('Consignment', 'Consignment terms'),
  ('CONSIGNMENT', 'Consignment terms (uppercase)'),
  ('Ne 30', 'Net 30 days (typo variant)'),
  ('Net 7', 'Net 7 days'),
  ('Net 7 / Net 90', 'Net 7 or Net 90 days'),
  ('Net 10', 'Net 10 days'),
  ('Net 15', 'Net 15 days'),
  ('Net 30', 'Net 30 days'),
  ('Net 45', 'Net 45 days'),
  ('Net 60', 'Net 60 days'),
  ('Net 60,90,120', 'Net 60, 90, or 120 days'),
  ('Net 90', 'Net 90 days'),
  ('Net 120', 'Net 120 days'),
  ('Net 180', 'Net 180 days'),
  ('Net April 30', 'Net April 30th'),
  ('Net Aug 15', 'Net August 15th'),
  ('Net Dec 15', 'Net December 15th'),
  ('Net Dec 31', 'Net December 31st'),
  ('Net Jan 30', 'Net January 30th'),
  ('Net July 15', 'Net July 15th'),
  ('Net July 30', 'Net July 30th'),
  ('Net June 1', 'Net June 1st'),
  ('Net June 30', 'Net June 30th'),
  ('Net March 31', 'Net March 31st'),
  ('Net May 30', 'Net May 30th'),
  ('Net Oct 14', 'Net October 14th'),
  ('Net Sep 15', 'Net September 15th')
ON CONFLICT (name) DO NOTHING;