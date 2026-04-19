#!/usr/bin/env python3
"""
GC Katalog Analyse-Pipeline:
1. Liest jede Teil-PDF aus dem split-Ordner
2. Extrahiert Inhaltsverzeichnis + Artikel
3. Erstellt eine Import-JSON nach der KI-Anleitung-Struktur

Ziel: Eine import_ready.json die Flo vor dem Supabase-Import prüfen kann.
"""

import fitz
import json
import os
import re
import sys

SPLIT_DIR = "/home/goe/Katalog PDF/split"
OUTPUT_FILE = "/home/goe/Aufmass/import_ready.json"

# Die Hauptkategorien-Buchstaben und ihre Titel (aus dem Inhaltsverzeichnis)
CATEGORY_MAP = {
    "A": "Zuflussrohre Kunststoff",
    "B": "Press-Systeme Edelstahl",
    "C": "Press-Systeme Stahl",
    "D": "Press-Systeme Kupfer/Rotguss",
    "E": "Rohre/Fittings Stahl",
    "F": "Flansche/Einschweißfittings",
    "G": "Kupfer/Messing/Rotguss",
    "H": "Victaulic",
    "I": "Abflussrohre",
    "J": "Haus-/Hofentwässerung",
    "K": "Befestigung/Montage",
    "L": "Isolierungen",
    "M": "Chemiewirkstoffe",
    "N": "Installationselemente",
    "O": "Dachtechnik",
    "P": "Armaturen Wasser/Gas",
    "Q": "Brandschutz",
    "R": "Dichtungssysteme",
    "S": "Elektrotechnik",
    "T": "Werkzeuge",
}

def get_parent_letter(filename):
    """Extrahiert den Hauptkategorie-Buchstaben aus dem Dateinamen."""
    return filename[0].upper()

def extract_text_from_pdf(filepath):
    """Extrahiert den gesamten Text aus einer PDF."""
    doc = fitz.open(filepath)
    pages = []
    for i, page in enumerate(doc):
        text = page.get_text()
        if text.strip():
            pages.append({"page": i + 1, "text": text})
    doc.close()
    return pages

def extract_toc_from_pdf(filepath):
    """Extrahiert das Inhaltsverzeichnis (Bookmarks) aus der PDF."""
    doc = fitz.open(filepath)
    toc = doc.get_toc()
    doc.close()
    return toc

def find_articles_in_text(text):
    """
    Versucht Artikel aus dem Text zu erkennen.
    Typisches Muster: Artikelnummer + Beschreibung + Maße + Preis
    """
    articles = []
    # Häufige Muster für Großhändler-Artikel:
    # - Artikelnummer (meist alphanumerisch, 4-15 Zeichen)
    # - Beschreibung (Text)
    # - Maße (z.B. DN15, 1/2", 15mm, d20 etc.)
    # - VE (Verpackungseinheit)
    # - Preis
    
    # Muster: Zeilen die mit einer Artikelnummer beginnen
    # Beispiele: "MMVVR15", "402632", "02 81 10" etc.
    article_pattern = re.compile(
        r'^([A-Z0-9][A-Z0-9\s\-./]{3,20}?)\s+'  # Artikelnummer
        r'(.{10,}?)'  # Beschreibung (mindestens 10 Zeichen)
        r'(?:\s+(VE|VPE|St|Pa|Set|m|kg)\s*(\d+)?)?',  # Einheit
        re.MULTILINE
    )
    
    return articles

def main():
    files = sorted([f for f in os.listdir(SPLIT_DIR) if f.endswith('.pdf')])
    print(f"Gefunden: {len(files)} Teil-PDFs")
    
    import_data = {
        "metadata": {
            "source": "GC_Installation.pdf",
            "supplier": "GC",
            "supplier_id": "fe46aed6-ecac-46ef-868a-2c432b871dbf",
            "total_files": len(files),
            "note": "Vor dem Import prüfen! Alle Einträge haben source=wholesale"
        },
        "categories": [],
        "articles": []
    }
    
    for filename in files:
        filepath = os.path.join(SPLIT_DIR, filename)
        size_mb = os.path.getsize(filepath) / (1024 * 1024)
        
        parent_letter = get_parent_letter(filename)
        parent_title = CATEGORY_MAP.get(parent_letter, f"Kategorie {parent_letter}")
        
        print(f"\n{'='*60}")
        print(f"📄 {filename} ({size_mb:.1f} MB)")
        print(f"   Hauptkategorie: {parent_letter} - {parent_title}")
        
        # Inhaltsverzeichnis extrahieren
        toc = extract_toc_from_pdf(filepath)
        if toc:
            print(f"   Bookmarks: {len(toc)}")
            for level, title, page in toc[:5]:
                print(f"     L{level}: {title} (S.{page})")
            if len(toc) > 5:
                print(f"     ... +{len(toc)-5} weitere")
        
        # Text extrahieren (erste 3 Seiten als Preview)
        doc = fitz.open(filepath)
        total_pages = len(doc)
        print(f"   Seiten: {total_pages}")
        
        # Text von Seite 1 (oft Inhaltsverzeichnis der Kategorie)
        page1_text = doc[0].get_text()[:2000] if total_pages > 0 else ""
        print(f"   Seite 1 Preview: {page1_text[:200].strip()}...")
        
        doc.close()
    
    # Save structure (without articles yet - those need KI analysis)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(import_data, f, ensure_ascii=False, indent=2)
    
    print(f"\n{'='*60}")
    print(f"Struktur-Datei gespeichert: {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
