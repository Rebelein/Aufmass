-- UPDATE SQL: Fügt Unterstützung für mehrere Listen hinzu
-- Kopiere diesen Inhalt in den Supabase SQL-Editor

-- 1. Tabelle für Listen erstellen
CREATE TABLE IF NOT EXISTS public.project_lists (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name text NOT NULL,
    type text NOT NULL CHECK (type IN ('angebot', 'aufmass')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Spalte in project_items hinzufügen
ALTER TABLE public.project_items 
ADD COLUMN IF NOT EXISTS list_id uuid REFERENCES public.project_lists(id) ON DELETE CASCADE;

-- 3. Index für Performance
CREATE INDEX IF NOT EXISTS idx_project_items_list_id ON public.project_items(list_id);
