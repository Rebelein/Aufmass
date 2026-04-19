# Anleitung: Grosshaendler-Katalog → Lokaler Export (zur Überprüfung vor Supabase-Import)

## Ziel

Anstatt direkt in Supabase zu schreiben, erstellen wir **lokale JSON/CSV-Dateien** die vor dem Import überprüft werden können.

---

## Ausgangslage

- **Quelle:** `/home/goe/Katalog PDF/ocr/` — 52 OCR-Textdateien
- **Ziel:** JSON-Dateien zur Überprüfung, dann Supabase-Import

---

## Schritt 1: Inhaltsverzeichnis aus Dateinamen ableiten

Die 52 Dateien folgen dem Muster: `{Kategorie}_{Lieferant/Produkt}.txt`

**Beispiele:**
- `A_Viega.txt` → Kategorie A: Rohrsysteme, Lieferant: Viega
- `P_KEMPER_Absperr.txt` → Kategorie P: Armaturen, Lieferant: KEMPER

**Kategorie-Codes (aus Dateinamen-Prefix):**
```
A = Rohrsysteme / Installationssysteme
B = Press-Systeme Edelstahl
C = Press-Systeme Stahl
D = Press-Systeme Kupfer/Rotguss
E = Rohre/Fittings Stahl/Edelstahl/Temperguss
F = Flansche/Siederohrbogen/Einschweißfittings
G = Rohre/Fittings Kupfer/Messing/Rotguss
H = Victaulic Rohrsysteme
I = Abflussrohre/Verbindungsteile
J = Haus-/Hofentwässerung
K = Befestigungs-/Montagesysteme
L = Isolierungen/Heizbänder/Dichtungen
M = Chemiewirkstoffe
N = Installationselemente/Montageelemente
O = Dachtechnik
P = Armaturen (Absperr, Wasserzähler, etc.)
Q = Brandschutz
R = Dichtungssysteme/Hauseinführungen
S = Elektrotechnik
T = Werkzeuge/Maschinen/Arbeitsmittel
```

---

## Schritt 2: Kategorien aus Dateinamen extrahieren

**Regeln:**
1. Prefix (A_, B_, etc.) = Hauptkategorie
2. Nachfolgender Name = Unterkategorie / Lieferant
3. Bei mehrfachen Dateien mit gleichem Prefix: Unterkategorien bilden

**Beispiel-Struktur:**
```
A (Rohrsysteme) → parent_id: NULL
├── A_Viega → parent_id: (A)
├── A_Geberit → parent_id: (A)
├── A_REHAU → parent_id: (A)
└── ...

P (Armaturen) → parent_id: NULL
├── P_KEMPER_Absperr → parent_id: (P)
├── P_KEMPER_Hygienesystem → parent_id: (P)
├── P_Ventile_Armaturen → parent_id: (P)
└── ...
```

---

## Schritt 3: Artikel aus OCR-Text extrahieren

**Muster in OCR-Dateien:**
```
=== SEITE 1 (Nativ-Text) ===
Viega Rohrinstallationssysteme Installation Mai 2024
53715 53716 53717
53715 Rohre Sanfix Rohr-im-Rohr-System aus PE-Xc...
```

**Extraktions-Logik:**
1. Artikelnummern erkennen: 5-6 stellige Zahlen (z.B. 53715)
2. Artikelname: Text nach der Artikelnummer
3. Einheit: Aus Kontext ableiten (Stück, m, kg)
4. Beschreibung: Zusätzliche Details (Material, Maße, Normen)

---

## Schritt 4: JSON-Export-Format

### Datei: `/home/goe/Katalog PDF/export/kategorien.json`

```json
{
  "exported_at": "2026-04-19T06:30:00Z",
  "source": "wholesale",
  "categories": [
    {
      "temp_id": "cat_A",
      "name": "Rohrsysteme / Installationssysteme",
      "parent_id": null,
      "order": 0,
      "source": "wholesale"
    },
    {
      "temp_id": "cat_A_Viega",
      "name": "Viega",
      "parent_id": "cat_A",
      "order": 0,
      "source": "wholesale"
    },
    {
      "temp_id": "cat_P",
      "name": "Armaturen",
      "parent_id": null,
      "order": 15,
      "source": "wholesale"
    }
  ]
}
```

### Datei: `/home/goe/Katalog PDF/export/artikel.json`

```json
{
  "exported_at": "2026-04-19T06:30:00Z",
  "source": "wholesale",
  "articles": [
    {
      "article_number": "53715",
      "name": "Rohre Sanfix Rohr-im-Rohr-System PE-Xc",
      "unit": "m",
      "category_temp_id": "cat_A_Viega",
      "order": 0,
      "source": "wholesale",
      "description": "nach DIN / EN 16892 und 16893 der Rohrreihe 2, mit DVGW-Prüfzeichen"
    },
    {
      "article_number": "53716",
      "name": "Rohr Sanfix Fosta PE-Xc / AI / PE-Xc",
      "unit": "m",
      "category_temp_id": "cat_A_Viega",
      "order": 1,
      "source": "wholesale"
    }
  ]
}
```

---

## Schritt 5: CSV-Export (zur Überprüfung in Excel/LibreOffice)

### Datei: `/home/goe/Katalog PDF/export/kategorien.csv`

```csv
temp_id,name,parent_id,order,source
cat_A,Rohrsysteme / Installationssysteme,,0,wholesale
cat_A_Viega,Viega,cat_A,0,wholesale
cat_A_Geberit,Geberit,cat_A,1,wholesale
cat_P,Armaturen,,15,wholesale
```

### Datei: `/home/goe/Katalog PDF/export/artikel.csv`

```csv
article_number,name,unit,category_temp_id,order,source,description
53715,Rohre Sanfix Rohr-im-Rohr-System PE-Xc,m,cat_A_Viega,0,wholesale,nach DIN / EN 16892 und 16893
53716,Rohr Sanfix Fosta PE-Xc / AI / PE-Xc,m,cat_A_Viega,1,wholesale,weiß ohne Schutzrohr Modell 2102
```

---

## Schritt 6: Lieferanten-Extrakt (optional)

### Datei: `/home/goe/Katalog PDF/export/lieferanten.json`

```json
{
  "suppliers": [
    {"name": "Viega"},
    {"name": "Geberit"},
    {"name": "KEMPER"},
    {"name": "REHAU"},
    {"name": "Uponor"},
    {"name": "FRÄNKISCHE"},
    {"name": "BENDER"},
    {"name": "CONEL"},
    {"name": "TRINNITY"}
  ]
}
```

---

## Schritt 7: Nach Überprüfung → Supabase-Import-Script

Nachdem du die CSV/JSON-Dateien überprüft hast, erstelle ein Import-Script:

### Datei: `/home/goe/Katalog PDF/export/import_to_supabase.sql`

```sql
-- 1. Kategorien einfügen (in richtiger Reihenfolge!)
-- Erst Hauptkategorien (parent_id NULL)
INSERT INTO categories (name, parent_id, "order", source) VALUES
('Rohrsysteme / Installationssysteme', NULL, 0, 'wholesale'),
('Armaturen', NULL, 15, 'wholesale');
-- IDs merken für Unterkategorien!

-- 2. Unterkategorien einfügen (mit parent_id)
INSERT INTO categories (name, parent_id, "order", source) VALUES
('Viega', '<Hauptkategorie-ID-Rohrsysteme>', 0, 'wholesale'),
('KEMPER', '<Hauptkategorie-ID-Armaturen>', 0, 'wholesale');

-- 3. Artikel einfügen
INSERT INTO articles (name, article_number, unit, category_id, "order", source) VALUES
('Rohre Sanfix Rohr-im-Rohr-System PE-Xc', '53715', 'm', '<Unterkategorie-ID>', 0, 'wholesale');
```

---

## Wichtige Regeln

1. **temp_id** verwendet für Referenzen VOR dem Supabase-Import (echte UUIDs kommen erst beim Import)
2. **source = 'wholesale'** bei allen Einträgen
3. **order** startet bei 0, wird hochgezählt
4. Duplikate prüfen: artikel_number + source muss eindeutig sein
5. Vor dem Import: CSV in Excel/LibreOffice öffnen und prüfen

---

## Zusammenfassung der Dateien

Nach der Verarbeitung sollen folgende Dateien existieren:

```
/home/goe/Katalog PDF/export/
├── kategorien.json      # Kategorien-Hierarchie (JSON)
├── kategorien.csv       # Kategorien (zur Überprüfung)
├── artikel.json         # Alle Artikel (JSON)
├── artikel.csv          # Artikel (zur Überprüfung)
├── lieferanten.json     # Lieferanten-Liste
└── import_to_supabase.sql  # SQL nach Überprüfung
```

---

## Nächster Schritt

Sage: "**Starte Extraktion**" um mit Schritt 1 zu beginnen und die Kategorien aus allen 52 Dateinamen zu extrahieren.
