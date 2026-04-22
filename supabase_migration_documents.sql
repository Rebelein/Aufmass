-- Add documents array to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS documents jsonb DEFAULT '[]'::jsonb;
