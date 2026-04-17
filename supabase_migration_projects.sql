-- Führe dieses Skript im Supabase SQL Editor aus, um die Tabelle `projects` zu erweitern.

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'completed')),
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS client_name text,
ADD COLUMN IF NOT EXISTS start_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS end_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS notes text;
