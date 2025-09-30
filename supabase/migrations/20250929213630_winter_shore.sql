/*
  # Add Tags System for Sales Order Lines

  1. New Tables
    - `tag`
      - `id` (uuid, primary key)
      - `name` (text, unique)
      - `description` (text, optional)
      - `color` (text, for UI display)
      - `is_active` (boolean, default true)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `commercial_line_tag`
      - `commercial_line_id` (uuid, foreign key to commercial_line)
      - `tag_id` (uuid, foreign key to tag)
      - `created_at` (timestamp)
      - `created_by` (uuid, optional)

  2. Security
    - Enable RLS on both tables
    - Add policies for admin full access and viewer read access

  3. Initial Data
    - Insert the predefined tags with appropriate colors
*/

-- Create tag table
CREATE TABLE IF NOT EXISTS tag (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  color text NOT NULL DEFAULT '#6b7280',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create commercial_line_tag junction table
CREATE TABLE IF NOT EXISTS commercial_line_tag (
  commercial_line_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  PRIMARY KEY (commercial_line_id, tag_id)
);

-- Enable RLS
ALTER TABLE tag ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_line_tag ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for tag table
CREATE POLICY "admin_all_tag"
  ON tag
  FOR ALL
  TO public
  USING (app_user_role() = 'admin')
  WITH CHECK (app_user_role() = 'admin');

CREATE POLICY "viewer_select_tag"
  ON tag
  FOR SELECT
  TO public
  USING (app_user_role() = ANY (ARRAY['viewer', 'admin']));

-- Add RLS policies for commercial_line_tag table
CREATE POLICY "admin_all_commercial_line_tag"
  ON commercial_line_tag
  FOR ALL
  TO public
  USING (app_user_role() = 'admin')
  WITH CHECK (app_user_role() = 'admin');

CREATE POLICY "viewer_select_commercial_line_tag"
  ON commercial_line_tag
  FOR SELECT
  TO public
  USING (app_user_role() = ANY (ARRAY['viewer', 'admin']));

-- Add foreign key constraints
ALTER TABLE commercial_line_tag 
ADD CONSTRAINT commercial_line_tag_commercial_line_id_fkey 
FOREIGN KEY (commercial_line_id) REFERENCES commercial_line(id) ON DELETE CASCADE;

ALTER TABLE commercial_line_tag 
ADD CONSTRAINT commercial_line_tag_tag_id_fkey 
FOREIGN KEY (tag_id) REFERENCES tag(id) ON DELETE CASCADE;

-- Add triggers for updated_at
CREATE TRIGGER touch_tag 
  BEFORE UPDATE ON tag 
  FOR EACH ROW 
  EXECUTE FUNCTION trg_touch_updated_at();

-- Add system note triggers
CREATE TRIGGER tag_system_note 
  AFTER INSERT OR UPDATE OR DELETE ON tag 
  FOR EACH ROW 
  EXECUTE FUNCTION trg_system_note();

CREATE TRIGGER commercial_line_tag_system_note 
  AFTER INSERT OR UPDATE OR DELETE ON commercial_line_tag 
  FOR EACH ROW 
  EXECUTE FUNCTION trg_system_note();

-- Insert predefined tags
INSERT INTO tag (name, description, color) VALUES
  ('On Hold', 'For information', '#ef4444'),
  ('Material Not Available', 'Material is not currently available', '#f97316'),
  ('BOL Ready', 'Waiting to be Released', '#eab308'),
  ('Released', 'Waiting for More Information', '#3b82f6'),
  ('Completed', 'Line item has been completed', '#22c55e')
ON CONFLICT (name) DO NOTHING;