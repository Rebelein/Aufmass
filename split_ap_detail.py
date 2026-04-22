#!/usr/bin/env python3
"""
Teilt die großen PDFs A und P nach L3-Unterkategorien weiter auf.
"""
import fitz
import os
import re

SOURCE_PDF = "/home/goe/Katalog PDF/GC_Installation.pdf"
OUTPUT_DIR = "/home/goe/Katalog PDF/split"

doc = fitz.open(SOURCE_PDF)
toc = doc.get_toc()
total_pages = len(doc)

def split_range(name, start_page_1based, end_page_1based):
    """Split a page range into its own PDF."""
    start_idx = start_page_1based - 1
    end_idx = end_page_1based - 1
    new_doc = fitz.open()
    new_doc.insert_pdf(doc, from_page=start_idx, to_page=end_idx)
    safe_name = name.replace('/', '_').replace('\\', '_').replace(',', '').replace('(', '').replace(')', '')
    safe_name = re.sub(r'\s+', '_', safe_name).strip('_')
    # Max 80 chars
    safe_name = safe_name[:80]
    filename = f"{safe_name}.pdf"
    filepath = os.path.join(OUTPUT_DIR, filename)
    new_doc.save(filepath)
    new_doc.close()
    size_mb = os.path.getsize(filepath) / (1024 * 1024)
    page_count = end_page_1based - start_page_1based + 1
    print(f"  ✓ {filename} — S.{start_page_1based}-{end_page_1based} ({page_count} S., {size_mb:.1f} MB)")
    return filename, page_count, size_mb

# Delete old A and P files first
for f in os.listdir(OUTPUT_DIR):
    if f.startswith('A_') or f.startswith('P_'):
        os.remove(os.path.join(OUTPUT_DIR, f))
        print(f"  ✗ Gelöscht: {f}")

print("\n=== A - Zuflussrohre weiter aufteilen ===")
# A pages: 43-288
# L3 subcategories with their start pages
a_subs = [
    ("A_CONEL_CONNECT", 43),
    ("A_FRÄNKISCHE", 65),
    ("A_Geberit", 90),
    ("A_Uponor", 136),
    ("A_REHAU", 162),
    ("A_Viega", 184),
    ("A_PVC_Rohre", 207),
    ("A_PE_Rohre", 220),
    ("A_Sanipex_MT", 254),
    ("A_Sanipex_Classic", 276),
]
a_end = 288
for i, (name, start) in enumerate(a_subs):
    end = a_subs[i + 1][1] - 1 if i + 1 < len(a_subs) else a_end
    split_range(name, start, end)

print("\n=== P - Armaturen weiter aufteilen ===")
# P pages: 1331-1602
# Group P subcategories into manageable chunks (max ~40 pages each)
p_subs = [
    ("P_CONEL_Armaturen", 1331),
    ("P_KEMPER_Absperr", 1343),
    ("P_KEMPER_Sicherungs", 1350),
    ("P_KEMPER_Regulier", 1352),
    ("P_KEMPER_Oberteile_ThermoTrenner", 1355),
    ("P_KEMPER_Hygienesystem_KHS", 1362),
    ("P_Flamco_Resideo_Rückschlag", 1375),
    ("P_LegioStop_QUICKTURN", 1383),
    ("P_Installationsarmaturen", 1387),
    ("P_Seppelfricke_Uponor_Kugelhähne", 1402),
    ("P_BENDER_Hygienesysteme", 1416),
    ("P_Probenahme_Auslauf_Panzerschläuche", 1435),
    ("P_Ventile_Armaturen_Druckminderer", 1447),
    ("P_Sicherheits_Systemtrenner_Rohrbelüfter", 1463),
    ("P_Absperrarmaturen", 1484),
    ("P_TRINNITY_Wasserzähler", 1486),
    ("P_Allmess_Wasserzähler", 1492),
    ("P_Sensus_Wasserzähler", 1501),
    ("P_Deltamess_Eichgebühren_Zubehör", 1507),
    ("P_TRINNITY_Montageblöcke_Wittigsthal", 1524),
    ("P_QUICKTURN_KEMPER_Wasserzähler", 1537),
    ("P_Gartenarmaturen", 1543),
    ("P_Gasarmaturen", 1564),
    ("P_Propanarmaturen", 1594),
]
p_end = 1602
for i, (name, start) in enumerate(p_subs):
    end = p_subs[i + 1][1] - 1 if i + 1 < len(p_subs) else p_end
    split_range(name, start, end)

doc.close()
print("\nFertig! 🦞")
