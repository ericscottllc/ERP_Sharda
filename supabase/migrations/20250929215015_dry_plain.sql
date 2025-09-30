/*
  # Create terms table

  1. New Tables
    - `terms`
      - `id` (uuid, primary key)
      - `name` (text, unique, not null)
      - `description` (text, optional)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `terms` table
    - Add policies for admin and viewer access
*/

CREATE TABLE IF NOT EXISTS terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_terms"
  ON terms
  FOR ALL
  TO public
  USING (app_user_role() = 'admin')
  WITH CHECK (app_user_role() = 'admin');

CREATE POLICY "viewer_select_terms"
  ON terms
  FOR SELECT
  TO public
  USING (app_user_role() = ANY (ARRAY['viewer', 'admin']));

CREATE TRIGGER touch_terms
  BEFORE UPDATE ON terms
  FOR EACH ROW
  EXECUTE FUNCTION trg_touch_updated_at();

CREATE TRIGGER terms_system_note
  AFTER INSERT OR UPDATE OR DELETE ON terms
  FOR EACH ROW
  EXECUTE FUNCTION trg_system_note();