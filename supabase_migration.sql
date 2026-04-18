-- ============================================================
-- Grosshaendler-Katalog Migration
-- Ausfuehren im Supabase Dashboard: SQL Editor
-- ============================================================

-- Schritt 1: source-Feld zu categories hinzufuegen
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'own';

-- Schritt 2: source-Feld zu articles hinzufuegen
ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'own';

-- Schritt 3: Performance-Indizes
CREATE INDEX IF NOT EXISTS idx_categories_source ON categories(source);
CREATE INDEX IF NOT EXISTS idx_articles_source   ON articles(source);

-- Schritt 4: Bestehende Eintraege explizit als 'own' markieren (redundant, aber sicher)
UPDATE categories SET source = 'own' WHERE source IS NULL OR source = '';
UPDATE articles   SET source = 'own' WHERE source IS NULL OR source = '';

-- Fertig. Alle bestehenden Daten haben jetzt source = 'own'.
-- Grosshaendler-Daten werden mit source = 'wholesale' eingetragen.
