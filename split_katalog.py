#!/usr/bin/env python3
"""
Teilt GC_Installation.pdf nach L2-Hauptkategorien (A-T) auf.
Jede Teildatei enthält die Seiten eines Kapitels + Inhaltsverzeichnis davor.
"""
import fitz
import os
import re

INPUT = "/home/goe/Katalog PDF/GC_Installation.pdf"
OUTPUT_DIR = "/home/goe/Katalog PDF/split"

doc = fitz.open(INPUT)
toc = doc.get_toc()
total_pages = len(doc)

# L2-Hauptkategorien sammeln (ohne Registerübersicht, Inhaltsverzeichnis, Herstellerverzeichnis)
l2_entries = []
for entry in toc:
    level, title, page = entry
    if level == 2:
        l2_entries.append((title, page - 1))  # 0-basiert

# Kategorien filtern: nur die mit Buchstaben (A-T), nicht die Meta-Seiten
categories = []
for title, page in l2_entries:
    if re.match(r'^[A-T]\s*-', title):
        categories.append((title, page))

print(f"Gefunden: {len(categories)} Kategorien")

# Für jede Kategorie: Startseite = Kategorie-Seite, Ende = Start der nächsten -1
for i, (title, start_page) in enumerate(categories):
    if i + 1 < len(categories):
        end_page = categories[i + 1][1] - 1
    else:
        end_page = total_pages - 1
    
    # Dateiname: "A - Zuflussrohre..." -> "A_Zuflussrohre..."
    safe_name = re.sub(r'^([A-T])\s*-\s*', r'\1_', title)
    safe_name = safe_name.replace(' ', '_').replace('/', '_').replace(',', '').replace('(', '').replace(')', '')
    safe_name = re.sub(r'_+', '_', safe_name).strip('_')
    filename = f"{safe_name}.pdf"
    filepath = os.path.join(OUTPUT_DIR, filename)
    
    # Neues PDF mit den Seiten dieser Kategorie
    new_doc = fitz.open()
    new_doc.insert_pdf(doc, from_page=start_page, to_page=end_page)
    new_doc.save(filepath)
    new_doc.close()
    
    page_count = end_page - start_page + 1
    size_mb = os.path.getsize(filepath) / (1024 * 1024)
    print(f"  ✓ {filename} — Seiten {start_page+1}-{end_page+1} ({page_count} S., {size_mb:.1f} MB)")

doc.close()
print("\nFertig! 🦞")
