-- Supabase Schema for Aufmaß App

-- 1. Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Categories (Hierarchical)
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Suppliers
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Articles (Catalog)
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  article_number TEXT,
  unit TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  "order" INTEGER DEFAULT 0,
  aliases TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Project Items (The selected items within a project)
CREATE TABLE project_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('article', 'section')),
  article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
  quantity DECIMAL DEFAULT 1,
  text TEXT, -- For sections or custom notes
  name TEXT, -- For manual/one-off articles not in catalog
  article_number TEXT,
  unit TEXT,
  supplier_name TEXT,
  "order" INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) - Basic setup (Allow all for now, as it was a local-first style app)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_items ENABLE ROW LEVEL SECURITY;

-- Simple policies (Can be refined later with Auth)
CREATE POLICY "Allow all access" ON projects FOR ALL USING (true);
CREATE POLICY "Allow all access" ON categories FOR ALL USING (true);
CREATE POLICY "Allow all access" ON suppliers FOR ALL USING (true);
CREATE POLICY "Allow all access" ON articles FOR ALL USING (true);
CREATE POLICY "Allow all access" ON project_items FOR ALL USING (true);

-- Functions for updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_projects_modtime BEFORE UPDATE ON projects FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
