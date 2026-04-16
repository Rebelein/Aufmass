-- Migration: Add section_id to project_items and image_url to categories
-- Run this in the Supabase SQL Editor

-- 1. Add section_id to project_items (self-referencing FK)
ALTER TABLE public.project_items
  ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES public.project_items(id) ON DELETE SET NULL;

-- 2. Add image_url to categories (was missing from schema)
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 3. Allow WITH CHECK for project_items insert (fix for RLS)
DROP POLICY IF EXISTS "Allow all access" ON public.project_items;
CREATE POLICY "Allow all access" ON public.project_items
  USING (true)
  WITH CHECK (true);
