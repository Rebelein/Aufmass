#!/usr/bin/env python3
"""
Konvertiert alle Split-PDFs zu Text-Dateien für die KI-Analyse.
Speichert pro PDF eine .txt Datei mit allen Seiten.
"""
import fitz
import os

SPLIT_DIR = "/home/goe/Katalog PDF/split"
TEXT_DIR = "/home/goe/Katalog PDF/text"

os.makedirs(TEXT_DIR, exist_ok=True)

files = sorted([f for f in os.listdir(SPLIT_DIR) if f.endswith('.pdf')])

for filename in files:
    filepath = os.path.join(SPLIT_DIR, filename)
    txt_name = filename.replace('.pdf', '.txt')
    txt_path = os.path.join(TEXT_DIR, txt_name)
    
    doc = fitz.open(filepath)
    all_text = []
    for i, page in enumerate(doc):
        text = page.get_text()
        if text.strip():
            all_text.append(f"=== SEITE {i+1} ===\n{text}")
    doc.close()
    
    with open(txt_path, 'w', encoding='utf-8') as f:
        f.write('\n\n'.join(all_text))
    
    size_kb = os.path.getsize(txt_path) / 1024
    print(f"✓ {txt_name} ({len(all_text)} Seiten, {size_kb:.0f} KB)")

print(f"\nFertig! Text-Dateien in {TEXT_DIR}")
