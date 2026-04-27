ALTER TABLE public.import_drafts ADD COLUMN IF NOT EXISTS import_options jsonb DEFAULT '{}'::jsonb;
