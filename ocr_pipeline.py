#!/usr/bin/env python3
"""
OCR-Pipeline: Konvertiert alle Split-PDFs zu OCR-Textdateien.
Nutzt pdf2image + tesseract für gescannte Seiten.
Für Seiten die bereits Text haben, wird der Originaltext verwendet.
"""
import fitz
import os
import subprocess
import sys
from pdf2image import convert_from_path

SPLIT_DIR = "/home/goe/Katalog PDF/split"
OCR_DIR = "/home/goe/Katalog PDF/ocr"

os.makedirs(OCR_DIR, exist_ok=True)

def ocr_image(image_path, lang='deu+eng'):
    """OCR a single image with tesseract."""
    result = subprocess.run(
        ['tesseract', image_path, 'stdout', '-l', lang, '--psm', '6'],
        capture_output=True, text=True, timeout=60
    )
    return result.stdout.strip()

def process_pdf(filepath, output_path):
    """Process a single PDF: use native text if available, OCR if not."""
    doc = fitz.open(filepath)
    total_pages = len(doc)
    
    all_text = []
    
    for i in range(total_pages):
        page = doc[i]
        native_text = page.get_text().strip()
        
        # Check if page has meaningful text (not just headers/footers)
        # Heuristic: if less than 100 chars, it's probably a scanned page
        if len(native_text) > 100:
            all_text.append(f"=== SEITE {i+1} (Nativ-Text) ===\n{native_text}")
        else:
            # Need OCR for this page
            # Convert just this page to image
            try:
                images = convert_from_path(
                    filepath, 
                    first_page=i+1, 
                    last_page=i+1,
                    dpi=200  # Good balance of quality vs speed
                )
                if images:
                    # Save temp image
                    tmp_path = f"/tmp/ocr_page_{i}.png"
                    images[0].save(tmp_path, 'PNG')
                    
                    # OCR
                    ocr_text = ocr_image(tmp_path)
                    if ocr_text:
                        all_text.append(f"=== SEITE {i+1} (OCR) ===\n{ocr_text}")
                    
                    # Cleanup
                    os.unlink(tmp_path)
            except Exception as e:
                all_text.append(f"=== SEITE {i+1} (FEHLER) ===\nOCR fehlgeschlagen: {e}")
    
    doc.close()
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n\n'.join(all_text))
    
    return len(all_text)

def main():
    files = sorted([f for f in os.listdir(SPLIT_DIR) if f.endswith('.pdf')])
    print(f"Starte OCR für {len(files)} PDFs...")
    print()
    
    for idx, filename in enumerate(files):
        filepath = os.path.join(SPLIT_DIR, filename)
        txt_name = filename.replace('.pdf', '.txt')
        txt_path = os.path.join(OCR_DIR, txt_name)
        
        # Skip if already done
        if os.path.exists(txt_path) and os.path.getsize(txt_path) > 100:
            print(f"[{idx+1}/{len(files)}] ⏭️ {txt_name} (bereits vorhanden)")
            continue
        
        print(f"[{idx+1}/{len(files)}] 📄 {filename}...", end='', flush=True)
        try:
            pages = process_pdf(filepath, txt_path)
            size_kb = os.path.getsize(txt_path) / 1024
            print(f" {pages} Seiten, {size_kb:.0f} KB")
        except Exception as e:
            print(f" FEHLER: {e}")
    
    print(f"\nFertig! OCR-Texte in {OCR_DIR}")

if __name__ == "__main__":
    main()
