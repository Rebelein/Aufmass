#!/usr/bin/env python3
"""
Grosshaendler-Katalog PDF-Export-Script
========================================

Dieses Script verarbeitet den Grosshaendler-Installationskatalog (GC_Installation.pdf)
und erstellt eine strukturierte CSV-Datei gemaess der GROSSHAENDLER_KI_ANLEITUNG.md.

Funktionsweise:
1. PDF-Zerlegung: Die grosse PDF-Datei wird in Chunks zu je 100 Seiten aufgeteilt,
   da PyMuPDF (fitz) bei sehr grossen Dateien speichereffizienter arbeitet wenn
   seitenweise verarbeitet wird.
2. Strukturierte Textextraktion: Jede Seite wird mit Positions- und Groesseninformationen
   extrahiert, um die tabellarische Struktur des Katalogs zu erkennen.
3. Artikelerkennung: Anhand von Schriftgroessen und X-Positionen werden identifiziert:
   - Abschnitts-Header (size=9.5, x=16) -> Hauptkategorie
   - Unterkategorie-Ueberschriften (size=11.4, x=102) -> Produktlinie
   - Produktgruppennamen (size=9.5, x=102) -> Bauform/Produkttyp
   - Artikelnummern (size=7.6, x~102, Muster: [A-Z]{2,}[A-Z0-9]+)
   - Dimensionen (size=7.6, x>180, gleiche Y-Position wie Artikelnummer)
   - Einheiten (size=7.6, x>400, "1 Meter", "1 Stueck" etc.)
4. Surgical Cleaning:
   - Inhaltsverzeichnis-Seiten werden komplett uebersprungen
   - Rabattgruppen-Codes (RG, z.B. A6AC, UNBG) werden aus Artikelnamen entfernt
   - EUR-Preise werden nicht in die CSV uebernommen
   - VPE-Verpackungsmengen werden aus dem Namen gefiltert
   - Werksummer-Nummern (6+ Ziffern) werden ignoriert
5. Bauform-Zuordnung: Artikel erhalten automatisch eine Bauform-Unterkategorie
   (Ebene 3), z.B. "Rohre", "Bogen 90", "T-Stuecke", "Reduzierstuecke", "Kugelhaehne".
   Auch wenn die Bauform nicht explizit im PDF steht, wird sie aus dem Artikelnamen
   abgeleitet. Artikel wie "Reduktion 20 x 16 mm" unter "CONNECT MV2 Pressfittings"
   werden korrekt als "... > CONNECT MV2 Pressfittings > Reduzierstuecke" einsortiert.
6. Grosshaendler-Zuordnung: Anhand von Schluesselwoertern in der Unterkategorie
   wird der Grosshaendler automatisch bestimmt (CONEL, Geberit, Viega, Uponor, etc.)

Verwendung:
  python3 grosshaender_pdf_export.py <pfad_zur_pdf> <ausgabe_csv>

Beispiel:
  python3 grosshaender_pdf_export.py "/home/goe/Grosshaendler PDF/GC_Installation.pdf" \
                                     "/home/goe/Grosshaendler PDF/GC_Installation_export.csv"
"""

import fitz
import re
import csv
import os
import sys


# === HAUPTKATEGORIEN (aus PDF-Seite 3, Abschnitte A-T) ===

MAIN_CATEGORIES = {
    'A': 'Zuflussrohre aus Kunststoff und Verbindungsteile',
    'B': 'Press-Systeme aus Edelstahl',
    'C': 'Press-Systeme aus Stahl',
    'D': 'Press-Systeme aus Kupfer / Rotguss',
    'E': 'Rohre und Fittings aus Stahl, Edelstahl und Temperguss',
    'F': 'Flansche, Siederohrbogen, Einschweissfittings',
    'G': 'Rohre und Fittings aus Kupfer und Messing, Schraubfittings aus Rotguss',
    'H': 'Victaulic Rohrsysteme',
    'I': 'Abflussrohre und Verbindungsteile',
    'J': 'Haus- und Hofentwaesserung',
    'K': 'Befestigungs- und Montagesysteme',
    'L': 'Isolierungen, Heizbaender, Dichtungen',
    'M': 'Chemiewirkstoffe',
    'N': 'Installationselemente, Montageelemente',
    'O': 'Dachtechnik',
    'P': 'Rohrleitungsarmaturen Wasser und Gas',
    'Q': 'Brandschutz',
    'R': 'Dichtungssysteme und Hauseinfuehrungen',
    'S': 'Elektrotechnik',
    'T': 'Werkzeuge, Maschinen und Arbeitsmittel',
}

# === BAUFORM-KEYWORDS: Artikelname -> Bauform-Gruppe ===
# Laengere Schluessel zuerst fuer spezifischere Treffer

BAUFORM_KEYWORDS = [
    ('mehrschichtverbundrohr', 'Rohre'),
    ('kupfer-installationsrohr', 'Rohre'),
    ('leitungsrohr', 'Rohre'),
    ('systemrohr', 'Rohre'),
    ('verbundrohr', 'Rohre'),
    ('gewinderohr', 'Gewinderohre'),
    ('hydraulikleitungsrohr', 'Rohre'),
    ('rohr', 'Rohre'),
    ('rohre', 'Rohre'),
    ('bogen 90', 'Bogen 90\u00b0'),
    ('bogen 45', 'Bogen 45\u00b0'),
    ('ueberbogen', 'Bogen'),
    ('ueber-/sprungbogen', 'Bogen'),
    ('ueberspringbogen', 'Bogen'),
    ('sprungbogen', 'Bogen'),
    ('bogen', 'Bogen'),
    ('t-stueck', 'T-St\u00fccke'),
    ('t-stuecke', 'T-St\u00fccke'),
    ('kreuz-stueck', 'Kreuzst\u00fccke'),
    ('kreuzstueck', 'Kreuzst\u00fccke'),
    ('kreuz', 'Kreuzst\u00fccke'),
    ('reduzierstueck', 'Reduzierst\u00fccke'),
    ('reduzierstuecke', 'Reduzierst\u00fccke'),
    ('reduktion', 'Reduzierst\u00fccke'),
    ('reduzierungen', 'Reduzierst\u00fccke'),
    ('reduzierung', 'Reduzierst\u00fccke'),
    ('schiebemuffe', 'Schiebemuffen'),
    ('schiebemuffen', 'Schiebemuffen'),
    ('uebergangsmuffe', '\u00dcbergangsmuffen'),
    ('uebergangsmuffen', '\u00dcbergangsmuffen'),
    ('doppelmuffe', 'Muffen'),
    ('muffe', 'Muffen'),
    ('muffen', 'Muffen'),
    ('uebergangsstueck', '\u00dcbergangsst\u00fccke'),
    ('uebergang', '\u00dcberg\u00e4nge'),
    ('uebergaenge', '\u00dcberg\u00e4nge'),
    ('kappe', 'Kappen'),
    ('kappen', 'Kappen'),
    ('verschlussstopfen', 'Kappen'),
    ('stopfen', 'Kappen'),
    ('kugelhahn', 'Kugelh\u00e4hne'),
    ('kugelhaehne', 'Kugelh\u00e4hne'),
    ('absperrventil', 'Absperrventile'),
    ('absperrventile', 'Absperrventile'),
    ('rueckschlagventil', 'R\u00fcckschlagventile'),
    ('rueckschlagventile', 'R\u00fcckschlagventile'),
    ('sicherheitsventil', 'Sicherheitsventile'),
    ('sicherheitsventile', 'Sicherheitsventile'),
    ('druckminderer', 'Druckminderer'),
    ('regulierventil', 'Regulierventile'),
    ('regulierarmatur', 'Regulierarmaturen'),
    ('absperrklappe', 'Absperrklappen'),
    ('ventil', 'Ventile'),
    ('ventile', 'Ventile'),
    ('wasserzaehler', 'Wasserz\u00e4hler'),
    ('wohnungswasserzaehler', 'Wasserz\u00e4hler'),
    ('probenahmeventil', 'Probenahmeventile'),
    ('freistromventil', 'Freistromventile'),
    ('systemtrenn', 'Systemtrennung'),
    ('sicherheitstrennstation', 'Systemtrennung'),
    ('sicherheitscenter', 'Sicherheitsgruppen'),
    ('sicherheitsgrupp', 'Sicherheitsgruppen'),
    ('rohrhalter', 'Rohrhalter'),
    ('konsole', 'Konsolen'),
    ('konsolen', 'Konsolen'),
    ('rohrschelle', 'Rohrschellen'),
    ('schelle', 'Schellen'),
    ('schellen', 'Schellen'),
    ('anbohrschelle', 'Anbohrschellen'),
    ('winkel', 'Winkel'),
    ('anschlusswinkel', 'Winkel'),
    ('doppelwandwinkel', 'Doppelwandwinkel'),
    ('verschraubung', 'Verschraubungen'),
    ('verschraubungen', 'Verschraubungen'),
    ('wandscheibe', 'Wandscheiben'),
    ('heizkoerperanbindung', 'Heizk\u00f6rperanbindungen'),
    ('heizkoerper-anschluss', 'Heizk\u00f6rperanbindungen'),
    ('presshuelse', 'Pressh\u00fclsen'),
    ('pressfittings', 'Pressfittings'),
    ('pressfitting', 'Pressfittings'),
    ('steckfittings', 'Steckfittings'),
    ('steckfitting', 'Steckfittings'),
    ('fitting', 'Fittings'),
    ('fittings', 'Fittings'),
    ('formteil', 'Formteile'),
    ('formteile', 'Formteile'),
    ('kupplung', 'Kupplungen'),
    ('nippe', 'Nippel'),
    ('flansch', 'Flansche'),
    ('flansche', 'Flansche'),
    ('dichtung', 'Dichtungen'),
    ('dichtungen', 'Dichtungen'),
    ('dichtmasse', 'Dichtmassen'),
    ('dichtmassen', 'Dichtmassen'),
    ('abdichtung', 'Abdichtungen'),
    ('schneidringverschraubung', 'Schneidringverschraubungen'),
    ('rohrdurchfuehrung', 'Rohrdurchf\u00fchrungen'),
    ('montageblock', 'Montagebl\u00f6cke'),
    ('montagebloecke', 'Montagebl\u00f6cke'),
    ('daemmschale', 'D\u00e4mmschalen'),
    ('daemmbox', 'D\u00e4mmboxen'),
    ('isolierbox', 'Isolierboxen'),
    ('isolierung', 'Isolierungen'),
    ('isolierschlauch', 'Schl\u00e4uche'),
    ('isolierschale', 'Isolierschalen'),
    ('schlauch', 'Schl\u00e4uche'),
    ('kabel', 'Kabel'),
    ('leitung', 'Leitungen'),
    ('steckdose', 'Steckdosen'),
    ('werkzeug', 'Werkzeuge'),
    ('maschine', 'Maschinen'),
    ('presse', 'Pressen'),
    ('pressbacke', 'Pressbacken'),
    ('presszange', 'Presszangen'),
    ('siphon', 'Siphons'),
    ('fettabscheider', 'Fettabscheider'),
    ('zaehler', 'Z\u00e4hler'),
    ('manometer', 'Manometer'),
    ('thermometer', 'Thermometer'),
    ('filter', 'Filter'),
    ('reiniger', 'Reiniger'),
    ('kleber', 'Kleber'),
    ('silikon', 'Silikone'),
    ('schaum', 'Sch\u00e4ume'),
    ('zement', 'Zement'),
    ('gips', 'Gips'),
    ('designrinne', 'Duschrinnen'),
    ('duschrinne', 'Duschrinnen'),
    ('bodenablauf', 'Bodenabl\u00e4ufe'),
    ('dachablauf', 'Dachabl\u00e4ufe'),
    ('ablauf', 'Abl\u00e4ufe'),
    ('ablaeufe', 'Abl\u00e4ufe'),
    ('rueckstauverschlu', 'R\u00fcckstauverschl\u00fcsse'),
    ('rueckstauverschlue', 'R\u00fcckstauverschl\u00fcsse'),
    ('hebeanlage', 'Hebeanlagen'),
    ('betatigungsplatte', 'Bet\u00e4tigungsplatten'),
    ('montageelement', 'Montageelemente'),
    ('trageelement', 'Trageelemente'),
    ('wc-element', 'WC-Elemente'),
    ('waschtisch-element', 'Waschtisch-Elemente'),
    ('urinal-element', 'Urinal-Elemente'),
    ('vorwandblock', 'Vorwandbl\u00f6cke'),
    ('trockenbaumodul', 'Trockenbaumodule'),
    ('trockenbauprofil', 'Trockenbauprofile'),
    ('installationsbox', 'Installationsboxen'),
]


def normalize_german(text):
    text = text.replace('\u00e4', 'ae').replace('\u00f6', 'oe').replace('\u00fc', 'ue')
    text = text.replace('\u00c4', 'Ae').replace('\u00d6', 'Oe').replace('\u00dc', 'Ue')
    text = text.replace('\u00df', 'ss')
    return text


def detect_bauform(product_name):
    """Leitet die Bauform-Gruppe aus dem Artikelnamen ab."""
    name_lower = normalize_german(product_name.lower())
    for key, value in sorted(BAUFORM_KEYWORDS, key=lambda x: len(x[0]), reverse=True):
        if key in name_lower:
            return value
    return None


def detect_einheit(unit_text, product_name, bauform):
    """Bestimmt die Einheit aus dem PDF-Text oder dem Artikeltyp."""
    ut = normalize_german((unit_text or '').lower())
    nl = normalize_german(product_name.lower())
    if 'meter' in ut:
        return 'm'
    if 'stueck' in ut:
        return 'Stk'
    if 'set' in ut:
        return 'Set'
    if 'dose' in ut:
        return 'Dose'
    if ' kg' in ut or ut.strip().startswith('kg'):
        return 'kg'
    if 'liter' in ut:
        return 'l'
    if 'paar' in ut:
        return 'Paar'
    if 'rolle' in ut:
        return 'Rolle'
    if 'packung' in ut:
        return 'Pkg'
    if 'karton' in ut:
        return 'Karton'
    if bauform in ('Rohre', 'Gewinderohre'):
        return 'm'
    if 'rohr' in nl and 'fitting' not in nl:
        return 'm'
    return 'Stk'


# === RG-CODE (Rabattgruppen) ERKENNUNG ===
# Diese Muster entfernen wir aus Artikelnamen (Surgical Cleaning)

RG_PATTERNS = [
    r'^[A-Z]\d[A-Z0-9]{1,3}$',       # A6AC, A6AD, UNBG, UNBF, UNBH, UNBI
    r'^[A-Z]\d[A-Z]{1,3}$',           # A6AC, ABIB, ACAA, ACDA, ACBA, ACGB, ACDC
    r'^[A-Z]{2,3}[A-Z]\d$',           # seltene Variante
    r'^BB[A-Z]{1,2}$',                 # BBQH, BBQI, BBPB, BBPC, BBDB
]


def is_article_number(text):
    """Prueft ob der Text eine echte Artikelnummer ist."""
    text = text.strip()
    if len(text) < 4 or len(text) > 20:
        return False
    has_letter = bool(re.search(r'[A-Z]', text))
    has_digit = bool(re.search(r'\d', text))
    if not (has_letter and has_digit):
        if re.match(r'^\d{5,}$', text):
            return True
        return False
    if re.match(r'^[A-Z]{2,}[A-Z0-9]+$', text):
        return True
    return False


def is_rg_code(text):
    """Prueft ob der Text ein Rabattgruppen-Code ist (zu entfernen)."""
    t = text.strip()
    for pattern in RG_PATTERNS:
        if re.match(pattern, t):
            return True
    return False


def is_eur_price(text):
    """Prueft ob der Text ein EUR-Preis ist."""
    t = text.strip().replace('.', '').replace(',', '.')
    try:
        val = float(t)
        return 0.01 < val < 100000
    except ValueError:
        return False


def clean_name(name):
    """Surgical Cleaning: Entfernt RG-Codes, Preise, VPE etc. aus dem Namen."""
    tokens = name.split()
    cleaned = []

    for i, t in enumerate(tokens):
        t_stripped = t.strip()
        if not t_stripped:
            continue
        if is_rg_code(t_stripped):
            continue
        if is_eur_price(t_stripped):
            continue
        if t_stripped in ('Artikelnr.', 'VPE', 'RG', 'EUR', 'Werksnr.'):
            continue
        if re.match(r'^\d{6,}$', t_stripped):
            continue
        cleaned.append(t_stripped)

    result = ' '.join(cleaned)
    result = re.sub(r'\s+', ' ', result).strip()
    return result


def detect_grosshaendler(subcategory, section_name):
    """Bestimmt den Grosshaendler aus Unterkategorie und Abschnittsname."""
    sl = normalize_german((subcategory or '').lower())
    sn = normalize_german((section_name or '').lower())

    brand_map = [
        ('conel', 'CONEL'), ('viega', 'Viega'), ('geberit', 'Geberit'),
        ('uponor', 'Uponor'), ('fränkische', 'FRÄNKISCHE'),
        ('fraenkische', 'FRÄNKISCHE'), ('frankische', 'FRÄNKISCHE'),
        ('walraven', 'WALRAVEN'),
        ('kemper', 'KEMPER'), ('reha', 'REHAU'),
        ('aco', 'ACO Passavant'), ('dallmer', 'Dallmer'),
        ('kessel', 'Kessel'), ('loro', 'LORO'), ('care', 'CARE'),
        ('tece', 'TECE'), ('grohe', 'Grohe'),
        ('seppelfricke', 'Seppelfricke'), ('bender', 'BENDER'),
        ('syr', 'SYR'), ('trinnity', 'TRINNITY'), ('alpex', 'alpex'),
        ('sanipex', 'Sanipex'), ('tangit', 'Tangit'), ('plasson', 'Plasson'),
        ('raufoss', 'Raufoss'), ('beulco', 'Beulco'),
        ('mapress', 'Geberit'), ('conex', 'Conex|Bänninger'),
        ('saint-gobain', 'SAINT-GOBAIN'), ('victaulic', 'Victaulic'),
        ('raychem', 'Raychem'), ('rockwool', 'ROCKWOOL'),
        ('doyma', 'DOYMA'), ('missel', 'Missel'), ('bcg', 'BCG'),
        ('allmess', 'Allmess'), ('deltamess', 'Deltamess'),
        ('maxitrol', 'Maxitrol'), ('gebo', 'Gebo'),
        ('hem ', 'HEM'), ('aduxa', 'aduxa'), ('pam-global', 'SAINT-GOBAIN'),
        ('prestabo', 'Viega'), ('profipress', 'Viega'), ('sanpress', 'Viega'),
        ('megapress', 'Viega'), ('sanfix', 'Viega'), ('temponox', 'Viega'),
        ('easy drain', 'Easy Drain'), ('pyro-fox', 'PYRO-FOX'), ('roth', 'Roth'),
        ('b-press', 'Conex|Bänninger'), ('c-stahl', 'Geberit'),
        ('sanco', 'SANCO'), ('cuprofrio', 'cuprofrio'),
        ('raupiano', 'REHAU'), ('pluvia', 'Geberit'),
        ('mepla', 'Geberit'), ('pushfit', 'Geberit'),
        ('flowfit', 'Geberit'), ('s-press', 'Uponor'),
        ('clic', 'CONEL'), ('flex', 'CONEL'), ('stream', 'CONEL'),
        ('drain', 'CONEL'), ('vis', 'CONEL'), ('flam', 'CONEL'),
        ('rapex', 'Rapex'), ('inox', 'CONEL'), ('plasson', 'Plasson'),
        ('tectite', 'Tectite'), ('aquavip', 'Viega'),
        ('easytop', 'Viega'), ('prevista', 'Viega'),
        ('q-elect', 'Q-Elect'), ('ags', 'Victaulic'),
        ('rautitan', 'REHAU'), ('sanit', 'SANIT'),
        ('wittigsthal', 'Wittigsthal'), ('sensus', 'Sensus'),
        ('resideo', 'Resideo'), ('braukmann', 'Resideo'),
        ('geka', 'GEKA'), ('kirchner', 'Kirchner'),
        ('boagaz', 'BOAGAZ'), ('klöber', 'Klöber'),
        ('kloeber', 'Klöber'), ('elster', 'Elster'),
        ('sentry', 'Maxitrol'), ('brunata', 'Brunata'),
        ('techem', 'Techem'), ('ista', 'Ista'),
        ('oyster', 'Oyster'), ('oytser', 'Oyster'),
        ('unox', 'CONEL'), ('eskimo', 'CONEL'),
    ]

    for keyword, brand in brand_map:
        if keyword in sl:
            return brand
    for keyword, brand in brand_map:
        if keyword in sn:
            return brand
    return 'CONEL'


def extract_blocks_from_page(page):
    """Extrahiert alle Text-Bloecke einer Seite mit Position und Groesse."""
    text_dict = page.get_text("dict")
    blocks = []
    for block in text_dict["blocks"]:
        if block["type"] != 0:
            continue
        for line in block["lines"]:
            line_text = ""
            max_size = 0
            for span in line["spans"]:
                line_text += span["text"]
                max_size = max(max_size, span.get("size", 0))
            if line_text.strip():
                bbox = line["bbox"]
                blocks.append({
                    "text": line_text.strip(),
                    "x": round(bbox[0]),
                    "y": round(bbox[1]),
                    "size": round(max_size, 1)
                })
    blocks.sort(key=lambda b: (b["y"], b["x"]))
    return blocks


def process_pdf(pdf_path, output_csv_path, skip_pages=44):
    """
    Hauptfunktion: Verarbeitet die PDF und erstellt die CSV.

    Parameter:
      pdf_path: Pfad zur Grosshaendler-PDF
      output_csv_path: Pfad fuer die Ausgabe-CSV
      skip_pages: Anzahl der zu ueberspringenden Seiten (Inhaltsverzeichnis etc.)
    """
    doc = fitz.open(pdf_path)
    total_pages = doc.page_count
    print(f"PDF: {pdf_path} ({total_pages} Seiten)")

    articles = []
    current_section_letter = None
    current_section_name = None
    current_subcategory = None

    for page_num in range(skip_pages, total_pages):
        if page_num % 200 == 0:
            print(f"  Seite {page_num + 1}/{total_pages}...")

        page = doc[page_num]
        blocks = extract_blocks_from_page(page)

        # Abschnittsbuchstabe aus Fusszeile erkennen (z.B. "A 5", "B 15")
        for b in blocks:
            if b["y"] > 640 and b["size"] >= 14.0:
                match = re.match(r'^([A-T])\s+(\d+)$', b["text"])
                if match:
                    letter = match.group(1)
                    if letter in MAIN_CATEGORIES:
                        current_section_letter = letter
                        current_section_name = MAIN_CATEGORIES[letter]

        # Abschnittsname aus Kopfzeile erkennen
        for b in blocks:
            if b["y"] < 15 and b["x"] < 20 and b["size"] >= 9.0 and len(b["text"]) > 5:
                current_section_name = b["text"]

        # Unterkategorie erkennen (size=11.4, x~102)
        for b in blocks:
            if abs(b["size"] - 11.4) < 0.5 and b["x"] >= 90 and b["y"] < 50:
                current_subcategory = b["text"]

        # Produkt-Header erkennen (size~9.5, x~102)
        product_headers = []
        for b in blocks:
            if 9.0 <= b["size"] <= 10.0 and b["x"] >= 95 and 20 < b["y"] < 640:
                product_headers.append(b)

        # Artikelnummer-Bloecke erkennen (size~7.6, x~102)
        article_blocks = []
        for b in blocks:
            if abs(b["size"] - 7.6) < 0.5 and b["x"] >= 95 and b["x"] <= 120:
                if is_article_number(b["text"]):
                    article_blocks.append(b)

        if not article_blocks:
            continue

        # Einheit fuer die Seite finden
        page_unit = None
        for b in blocks:
            if b["size"] < 8.5 and b["x"] >= 400 and b["y"] > 50:
                text = normalize_german(b["text"].strip().lower())
                if any(u in text for u in
                       ['meter', 'stueck', 'set', 'dose', 'liter', 'paar', 'rolle', 'packung']):
                    page_unit = b["text"].strip()

        # Y-Positionen fuer Zeilen-Zuordnung gruppieren
        block_by_y = {}
        for b in blocks:
            y_key = round(b["y"] / 3) * 3
            if y_key not in block_by_y:
                block_by_y[y_key] = []
            block_by_y[y_key].append(b)

        # Jeden Artikel verarbeiten
        for ab in article_blocks:
            art_y = ab["y"]
            article_nr = ab["text"]

            # Naechstgelegenen Produkt-Header oberhalb finden
            best_header = None
            for ph in product_headers:
                if ph["y"] < art_y and ph["y"] > art_y - 250:
                    if best_header is None or ph["y"] > best_header["y"]:
                        best_header = ph

            product_name = best_header["text"] if best_header else ""

            # Einheit zwischen Header und Artikel finden
        unit_text = page_unit or ""
        if best_header:
            for b in blocks:
                if abs(b["size"] - 7.6) < 0.5 and abs(b["x"] - 102) < 10:
                    if best_header["y"] < b["y"] < art_y:
                        t = normalize_german(b["text"].strip().lower())
                        if any(u in t for u in
                               ['meter', 'stueck', 'set', 'dose', 'liter', 'kg']):
                            unit_text = b["text"].strip()

            # Dimension aus gleicher Zeile lesen
            dim_parts = []
            y_key = round(art_y / 3) * 3
            same_row = block_by_y.get(y_key, [])
            for b in sorted(same_row, key=lambda x: x["x"]):
                if b["x"] <= 120:
                    continue
                t = b["text"].strip()
                if is_rg_code(t):
                    continue
                if is_eur_price(t):
                    continue
                if t in ('Artikelnr.', 'VPE', 'RG', 'EUR', 'Werksnr.'):
                    continue
                if re.match(r'^\d{1,4}$', t) and int(t) < 2000:
                    continue
                if re.match(r'^\d{6,}$', t):
                    continue
                dim_parts.append(t)

            dim_text = " ".join(dim_parts)

            # Artikelnamen zusammenbauen und bereinigen
            if dim_text:
                raw_name = f"{product_name} {dim_text}"
            else:
                raw_name = product_name if product_name else "Artikel"

            name = clean_name(raw_name)

            # Bauform bestimmen (immer versuchen, auch aus Artikelname)
            bauform = detect_bauform(product_name)
            if not bauform:
                bauform = detect_bauform(name)

            # Kategoriepfad aufbauen: Hauptkategorie > Unterkategorie > Bauform
            parts = []
            if current_section_letter and current_section_letter in MAIN_CATEGORIES:
                parts.append(MAIN_CATEGORIES[current_section_letter])
            if current_subcategory:
                parts.append(current_subcategory)
            if bauform:
                parts.append(bauform)

            if not parts:
                parts.append('Sonstige')

            category = " > ".join(parts)
            einheit = detect_einheit(unit_text, product_name, bauform)
            grosshaendler = detect_grosshaendler(current_subcategory, current_section_name)

            articles.append({
                'category': category,
                'name': name,
                'article_nr': article_nr,
                'einheit': einheit,
                'grosshaendler': grosshaendler,
            })

    doc.close()
    print(f"Roh extrahiert: {len(articles)} Artikel")

    # Deduplizierung nach Artikelnummer
    seen = set()
    unique_articles = []
    for a in articles:
        key = a['article_nr']
        if key not in seen:
            seen.add(key)
            unique_articles.append(a)

    print(f"Nach Dedup: {len(unique_articles)} Artikel")

    # CSV schreiben
    with open(output_csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f, delimiter=';', quotechar='"', quoting=csv.QUOTE_MINIMAL)
        writer.writerow(['Kategorie', 'Name', 'Artikel-Nr.', 'Einheit', 'Grosshaendler'])
        for a in unique_articles:
            writer.writerow([
                a['category'], a['name'], a['article_nr'],
                a['einheit'], a['grosshaendler']
            ])

    size_kb = os.path.getsize(output_csv_path) / 1024
    print(f"CSV geschrieben: {output_csv_path} ({size_kb:.1f} KB)")
    return unique_articles


if __name__ == '__main__':
    if len(sys.argv) < 3:
        pdf_path = "/home/goe/Großhändler PDF/GC_Installation.pdf"
        csv_path = "/home/goe/Großhändler PDF/GC_Installation_export.csv"
        print(f"Keine Argumente - verwende Standardpfade:")
        print(f"  PDF: {pdf_path}")
        print(f"  CSV: {csv_path}")
    else:
        pdf_path = sys.argv[1]
        csv_path = sys.argv[2]

    if not os.path.exists(pdf_path):
        print(f"FEHLER: PDF nicht gefunden: {pdf_path}")
        sys.exit(1)

    process_pdf(pdf_path, csv_path)
