-- Add is_from_angebot flag to project_items
ALTER TABLE project_items ADD COLUMN IF NOT EXISTS is_from_angebot BOOLEAN DEFAULT false;
