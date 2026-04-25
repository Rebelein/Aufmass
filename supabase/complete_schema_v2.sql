-- Vollständiges Datenbank Schema (Stand: 25.04.2026)
-- Inklusive Unterstützung für mehrere Listen (Angebote/Aufmaße) pro Projekt

-- 1. Lieferanten
CREATE TABLE IF NOT EXISTS public.suppliers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    created_at timestamptz DEFAULT now()
);

-- 2. Projekte / Baustellen
CREATE TABLE IF NOT EXISTS public.projects (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    client_name text,
    address text,
    notes text,
    start_date date,
    end_date date,
    status text DEFAULT 'planning',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3. Kategorien (Katalog)
CREATE TABLE IF NOT EXISTS public.categories (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    parent_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
    image_url text,
    source text DEFAULT 'own',
    "order" integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- 4. Artikel (Katalog)
CREATE TABLE IF NOT EXISTS public.articles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    article_number text,
    unit text,
    category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
    supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
    source text DEFAULT 'own',
    "order" integer DEFAULT 0,
    aliases text[] DEFAULT '{}'::text[],
    image_url text,
    created_at timestamptz DEFAULT now()
);

-- 5. NEU: Projekt-Listen (Angebote, Aufmaße pro Bauabschnitt etc.)
CREATE TABLE IF NOT EXISTS public.project_lists (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name text NOT NULL,
    type text NOT NULL CHECK (type IN ('angebot', 'aufmass')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 6. Projekt-Positionen (Die eigentlichen Aufmaß-Daten)
CREATE TABLE IF NOT EXISTS public.project_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    list_id uuid REFERENCES public.project_lists(id) ON DELETE CASCADE, -- NEUE VERKNÜPFUNG
    section_id uuid REFERENCES public.project_items(id) ON DELETE SET NULL,
    type text NOT NULL CHECK (type IN ('article', 'section')),
    article_id uuid REFERENCES public.articles(id) ON DELETE SET NULL,
    quantity numeric DEFAULT 1,
    text text,
    name text,
    article_number text,
    unit text,
    supplier_name text,
    is_from_angebot boolean DEFAULT false,
    images jsonb DEFAULT '[]'::jsonb,
    "order" integer NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Index für schnellere Abfragen nach Listen
CREATE INDEX IF NOT EXISTS idx_project_items_list_id ON public.project_items(list_id);

-- 7. Import-Entwürfe (OCR/PDF)
CREATE TABLE IF NOT EXISTS public.import_drafts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready_for_review', 'completed', 'failed')),
    file_name text,
    extracted_data jsonb,
    error_message text,
    default_supplier_id uuid REFERENCES public.suppliers(id),
    default_target_category_id uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Migration für bestehende Tabellen (falls list_id noch fehlt)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='project_items' AND column_name='list_id') THEN
        ALTER TABLE public.project_items ADD COLUMN list_id uuid REFERENCES public.project_lists(id) ON DELETE CASCADE;
    END IF;
END $$;
