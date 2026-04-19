-- Führe diesen SQL Befehl im Supabase SQL Editor aus, um die Ziel-Kategorie bei KI-Import-Entwürfen dauerhaft zu speichern.

ALTER TABLE public.import_drafts 
ADD COLUMN IF NOT EXISTS default_target_category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL;
