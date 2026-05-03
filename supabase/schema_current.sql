-- Aktuelles Datenbank Schema (Stand: 24.04.2026)
-- Instanz: Self-hosted auf vServer (217.154.161.236)

CREATE TABLE public.suppliers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE public.projects (
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

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    parent_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
    image_url text,
    source text DEFAULT 'own',
    "order" integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE public.articles (
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

CREATE TABLE public.project_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
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

CREATE TABLE public.import_drafts (
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
