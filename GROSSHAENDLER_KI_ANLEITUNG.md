# Anleitung: Grosshaendler-Katalog in Supabase importieren

Diese Anleitung richtet sich an eine KI, die den Grosshaendler-Katalog aus einer PDF-Datei analysiert und die strukturierten Daten in die Supabase-Datenbank der Rebelein Aufmass-Anwendung eintraegt.

---

## WICHTIG: Deine Hauptaufgabe – Katalogstruktur aus dem Inhaltsverzeichnis ableiten

**Bevor du einen einzigen Artikel eintraegst, analysiere zuerst das Inhaltsverzeichnis (Table of Contents) des PDFs.**

Dein Ziel ist es, die **Kapitelstruktur des Inhaltsverzeichnisses direkt als Kategorienstruktur** in der Datenbank abzubilden. Das Inhaltsverzeichnis des Grosshaendler-Katalogs ist in der Regel nach Produktgruppen gegliedert – genau diese Struktur soll in der App navigierbar sein.

### Schritt-fuer-Schritt Vorgehen:

**1. Inhaltsverzeichnis lesen und Struktur aufbauen**

Lese alle Kapitel und Unterkapitel aus dem Inhaltsverzeichnis. Baue daraus einen Strukturbaum:

```
Kapitel 1: Rohre und Rohrverbindungen          → Hauptkategorie (Ebene 1)
  1.1 C-Stahl Rohre                            → Unterkategorie (Ebene 2)
  1.2 Edelstahl Rohre                          → Unterkategorie (Ebene 2)
  1.3 Kupferrohre                              → Unterkategorie (Ebene 2)
Kapitel 2: Press-Fittings                      → Hauptkategorie (Ebene 1)
  2.1 Stahl Press-Fittings                     → Unterkategorie (Ebene 2)
  2.2 Edelstahl Press-Fittings                 → Unterkategorie (Ebene 2)
Kapitel 3: Armaturen                           → Hauptkategorie (Ebene 1)
  3.1 Kugelhähne                               → Unterkategorie (Ebene 2)
  ...
```

**2. Kapitelbezeichnungen bereinigen**

- Kapitel-Nummern (1., 1.1, 2.3) aus dem Namen entfernen – nur den reinen Produktnamen verwenden
- Abkuerzungen wenn moeglich ausschreiben
- Beispiele: "1.1 C-St. Rohre" → "C-Stahl Rohre"

**3. Tiefe der Struktur: maximal 2 Ebenen**

Das System unterstuetzt maximal 2 Ebenen (Haupt- und Unterkategorie):
- Wenn das Inhaltsverzeichnis 3+ Ebenen hat: Die oberste Kapitel-Ebene ignorieren und ab Ebene 2 beginnen, ODER die tiefste Ebene zusammenfassen
- Artikel haengen immer an einer Ebene-2-Kategorie (mit parent_id)
- Wenn eine Hauptgruppe keine Unterkategorien hat: Artikel direkt an die Hauptkategorie haengen

**4. Reihenfolge beibehalten**

Die `order`-Felder sollen die Reihenfolge aus dem Inhaltsverzeichnis widerspiegeln:
- Kapitel 1 → order: 0
- Kapitel 2 → order: 1
- usw.

**5. Erst dann Artikel eintragen**

Nachdem alle Kategorien angelegt wurden, durchsuche den PDF-Inhalt der jeweiligen Kapitel und trage die Artikel in die passende Kategorie ein.

---

## 1. Zugangsdaten

```
VITE_SUPABASE_URL=https://<deine-projekt-url>.supabase.co
VITE_SUPABASE_ANON_KEY=<dein-anon-key>
```

Alternativ: Den **Service Role Key** (aus dem Supabase Dashboard unter Settings > API) fuer Bulk-Inserts ohne RLS-Einschraenkungen.

---

## 2. Datenbankstruktur

### Tabelle: `categories`

| Spalte      | Typ    | Pflicht | Beschreibung                              |
|-------------|--------|---------|-------------------------------------------|
| `id`        | UUID   | AUTO    | Wird automatisch generiert (gen_random_uuid()) |
| `name`      | TEXT   | JA      | Kategoriename, z.B. "C-Stahl Rohre"      |
| `parent_id` | UUID   | NEIN    | Referenz auf uebergeordnete Kategorie (NULL = Hauptkategorie) |
| `order`     | INT    | JA      | Reihenfolge innerhalb der Ebene (0, 1, 2, ...) |
| `image_url` | TEXT   | NEIN    | URL zum Kategoriebild (leer lassen)       |
| `source`    | TEXT   | JA      | **Immer `'wholesale'` setzen!**           |

### Tabelle: `articles`

| Spalte           | Typ    | Pflicht | Beschreibung                              |
|------------------|--------|---------|-------------------------------------------|
| `id`             | UUID   | AUTO    | Wird automatisch generiert                |
| `name`           | TEXT   | JA      | Artikelname, z.B. "C-Stahl Rohr 15 mm"  |
| `article_number` | TEXT   | JA      | Artikelnummer, z.B. "MMVVR15"            |
| `unit`           | TEXT   | JA      | Einheit: "Stk", "m", "kg", "Paar", etc.  |
| `category_id`    | UUID   | JA      | ID der zugehoerigen Kategorie             |
| `order`          | INT    | JA      | Reihenfolge innerhalb der Kategorie       |
| `image_url`      | TEXT   | NEIN    | URL zum Artikelbild (leer lassen)         |
| `aliases`        | TEXT[] | NEIN    | Alternative Bezeichnungen als Array       |
| `source`         | TEXT   | JA      | **Immer `'wholesale'` setzen!**           |

---

## 3. Import-Strategie

### Empfohlene Reihenfolge

1. **Inhaltsverzeichnis analysieren** und Kategorienstruktur planen (s. oben)
2. Alle **Hauptkategorien** eintragen (parent_id = NULL)
3. Alle **Unterkategorien** eintragen (parent_id = ID der Hauptkategorie)
4. Alle **Artikel** eintragen (category_id = ID der Unterkategorie)

### Duplikat-Vermeidung

Pruefe vor dem Insert, ob ein Artikel mit gleichem `article_number` und `source = 'wholesale'` bereits existiert:

```sql
SELECT id FROM articles 
WHERE article_number = 'MMVVR15' AND source = 'wholesale';
```

Falls vorhanden: UPDATE statt INSERT verwenden.

---

## 4. Beispiel: SQL Insert

Beispiel basierend auf einem Inhaltsverzeichnis mit Kapitel "Rohrsystem > C-Stahl":

```sql
-- Schritt 1: Hauptkategorie aus Kapitel 1 des Inhaltsverzeichnisses
INSERT INTO categories (name, parent_id, "order", source)
VALUES ('Rohrsystem', NULL, 0, 'wholesale')
RETURNING id;
-- Ergebnis-ID merken: 'aaaa-bbbb-cccc-dddd'

-- Schritt 2: Unterkategorie aus Abschnitt 1.1
INSERT INTO categories (name, parent_id, "order", source)
VALUES ('C-Stahl Rohre', 'aaaa-bbbb-cccc-dddd', 0, 'wholesale')
RETURNING id;
-- Ergebnis-ID merken: 'eeee-ffff-gggg-hhhh'

-- Schritt 3: Artikel aus dem Kapitelinhalt
INSERT INTO articles (name, article_number, unit, category_id, "order", source)
VALUES 
  ('C-Stahl Rohr 15 mm', 'MMVVR15', 'Stk', 'eeee-ffff-gggg-hhhh', 0, 'wholesale'),
  ('C-Stahl Rohr 18 mm', 'MMVVR18', 'Stk', 'eeee-ffff-gggg-hhhh', 1, 'wholesale'),
  ('C-Stahl Rohr 22 mm', 'MMVVR22', 'Stk', 'eeee-ffff-gggg-hhhh', 2, 'wholesale');
```

---

## 5. Beispiel: REST API (JavaScript/Python)

```javascript
// Hauptkategorie (aus Inhaltsverzeichnis Kapitel 1)
const { data: mainCat } = await supabase
  .from('categories')
  .insert({ name: 'Rohrsystem', parent_id: null, order: 0, source: 'wholesale' })
  .select('id')
  .single();

// Unterkategorie (aus Abschnitt 1.1)
const { data: subCat } = await supabase
  .from('categories')
  .insert({ name: 'C-Stahl Rohre', parent_id: mainCat.id, order: 0, source: 'wholesale' })
  .select('id')
  .single();

// Artikel aus dem Kapitelinhalt
await supabase.from('articles').insert([
  { name: 'C-Stahl Rohr 15 mm', article_number: 'MMVVR15', unit: 'Stk', category_id: subCat.id, order: 0, source: 'wholesale' },
  { name: 'C-Stahl Rohr 18 mm', article_number: 'MMVVR18', unit: 'Stk', category_id: subCat.id, order: 1, source: 'wholesale' },
]);
```

```python
# Python Beispiel mit supabase-py
main_cat = supabase.table('categories').insert({
    'name': 'Rohrsystem', 'parent_id': None, 'order': 0, 'source': 'wholesale'
}).execute()
main_cat_id = main_cat.data[0]['id']

sub_cat = supabase.table('categories').insert({
    'name': 'C-Stahl Rohre', 'parent_id': main_cat_id, 'order': 0, 'source': 'wholesale'
}).execute()
sub_cat_id = sub_cat.data[0]['id']

supabase.table('articles').insert([
    {'name': 'C-Stahl Rohr 15 mm', 'article_number': 'MMVVR15', 'unit': 'Stk',
     'category_id': sub_cat_id, 'order': 0, 'source': 'wholesale'},
]).execute()
```

---

## 6. Wichtige Regeln

- `source` muss bei **jedem** Insert (categories + articles) auf `'wholesale'` gesetzt sein!
- `order` beginnt bei 0 und wird pro Ebene/Kategorie hochgezaehlt
- `article_number` muss eindeutig je Grosshaendler-Katalog sein
- Kapitel-Nummern (2.3, 1.1.2) gehoeren **nicht** in den Kategorienamen
- Leere Felder (`image_url`, `aliases`) als NULL uebergeben
- **Niemals** bestehende Daten mit `source = 'own'` loeschen oder veraendern!

---

## 7. Batch-Import fuer grosse Kataloge

Artikel in Batches von 500 eintragen um Timeouts zu vermeiden:

```javascript
const BATCH_SIZE = 500;
for (let i = 0; i < allArticles.length; i += BATCH_SIZE) {
  const batch = allArticles.slice(i, i + BATCH_SIZE);
  await supabase.from('articles').insert(batch);
}
```

---

## 8. Verifikation nach dem Import

```sql
-- Anzahl importierter Kategorien pruefen
SELECT COUNT(*) FROM categories WHERE source = 'wholesale';

-- Kategorienstruktur anzeigen (Haupt- und Unterkategorien)
SELECT 
  p.name AS hauptkategorie,
  c.name AS unterkategorie,
  c."order"
FROM categories c
LEFT JOIN categories p ON c.parent_id = p.id
WHERE c.source = 'wholesale'
ORDER BY p."order", c."order";

-- Anzahl importierter Artikel pruefen
SELECT COUNT(*) FROM articles WHERE source = 'wholesale';

-- Artikel pro Kategorie zaehlen
SELECT c.name, COUNT(a.id) AS artikel_anzahl
FROM categories c
LEFT JOIN articles a ON a.category_id = c.id AND a.source = 'wholesale'
WHERE c.source = 'wholesale'
GROUP BY c.name, c."order"
ORDER BY c."order";

-- Struktur-Check: Artikel ohne gueltige Kategorie (sollte 0 sein!)
SELECT a.id, a.name FROM articles a
LEFT JOIN categories c ON a.category_id = c.id
WHERE a.source = 'wholesale' AND c.id IS NULL;
```
