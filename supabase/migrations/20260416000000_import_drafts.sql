CREATE TABLE IF NOT EXISTS public.import_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready_for_review', 'completed', 'failed')),
    file_name text,
    extracted_data jsonb,
    error_message text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.import_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access" ON public.import_drafts USING (true);

GRANT ALL ON TABLE public.import_drafts TO anon;
GRANT ALL ON TABLE public.import_drafts TO authenticated;
GRANT ALL ON TABLE public.import_drafts TO service_role;

CREATE TRIGGER update_import_drafts_modtime
BEFORE UPDATE ON public.import_drafts
FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
