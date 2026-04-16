-- Fügt die Spalte für den Standard-Großhändler zu den Entwürfen hinzu
ALTER TABLE public.import_drafts ADD COLUMN IF NOT EXISTS default_supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;
