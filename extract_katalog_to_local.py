#!/usr/bin/env python3
"""
Katalog PDF Extractor - Creates local JSON/CSV files for review before Supabase import
Based on: GROSSHAENDLER_KI_ANLEITUNG.md + KI_ANLEITUNG_LOKALER_EXPORT.md
"""

import os
import re
import json
import csv
from pathlib import Path
from datetime import datetime
from collections import defaultdict

# Configuration
OCR_DIR = Path("/home/goe/Katalog PDF/ocr")
OUTPUT_DIR = Path("/home/goe/Katalog PDF/export")
SOURCE = "wholesale"

# Category mapping from file prefixes
CATEGORY_MAPPING = {
    "A": "Rohrsysteme / Installationssysteme",
    "B": "Press-Systeme Edelstahl",
    "C": "Press-Systeme Stahl",
    "D": "Press-Systeme Kupfer/Rotguss",
    "E": "Rohre/Fittings Stahl/Edelstahl/Temperguss",
    "F": "Flansche/Siederohrbogen/Einschweißfittings",
    "G": "Rohre/Fittings Kupfer/Messing/Rotguss",
    "H": "Victaulic Rohrsysteme",
    "I": "Abflussrohre/Verbindungsteile",
    "J": "Haus-/Hofentwässerung",
    "K": "Befestigungs-/Montagesysteme",
    "L": "Isolierungen/Heizbänder/Dichtungen",
    "M": "Chemiewirkstoffe",
    "N": "Installationselemente/Montageelemente",
    "O": "Dachtechnik",
    "P": "Armaturen",
    "Q": "Brandschutz",
    "R": "Dichtungssysteme/Hauseinführungen",
    "S": "Elektrotechnik",
    "T": "Werkzeuge/Maschinen/Arbeitsmittel",
}

def parse_filename(filename):
    """Extract category code and subcategory name from filename."""
    stem = Path(filename).stem  # Remove .txt extension
    parts = stem.split("_", 1)
    if len(parts) == 2:
        cat_code, subcat_name = parts
    else:
        cat_code = parts[0]
        subcat_name = parts[0]
    
    # Clean up subcategory name (replace underscores with spaces)
    subcat_name = subcat_name.replace("_", " ").strip()
    
    return cat_code.upper(), subcat_name

def extract_article_number(line):
    """Try to extract an article number from a line."""
    # Match 5-6 digit numbers (common in German catalogs)
    match = re.search(r'\b(\d{5,6})\b', line)
    if match:
        return match.group(1)
    
    # Match alphanumeric codes like FVWEAS15
    match = re.search(r'\b([A-Z]{2,8}\d{1,4}[A-Z]?)\b', line)
    if match:
        return match.group(1)
    
    # Match codes with dashes like MM-VVR-15
    match = re.search(r'\b([A-Z]{2,4}-[A-Z0-9]{2,8})\b', line)
    if match:
        return match.group(1)
    
    return None

def extract_unit(text):
    """Extract unit from text."""
    text_lower = text.lower()
    
    # Common units
    if re.search(r'\b(meter|m\b|lfd\.?\s*m)', text_lower):
        return "m"
    if re.search(r'\b(stück|stk\.?|st\.?)', text_lower):
        return "Stk"
    if re.search(r'\b(set|satz)', text_lower):
        return "Set"
    if re.search(r'\b(paar)', text_lower):
        return "Paar"
    if re.search(r'\b(kg|kilogramm)', text_lower):
        return "kg"
    if re.search(r'\b(packung|pkg\.?)', text_lower):
        return "Pack"
    
    # Default to Stück for most items
    return "Stk"

def clean_article_name(name):
    """Clean up article name."""
    # Remove multiple spaces
    name = re.sub(r'\s+', ' ', name)
    # Remove leading/trailing whitespace
    name = name.strip()
    # Remove price patterns (EUR, €, prices)
    name = re.sub(r'\s*(EUR|€)\s*[\d.,]+\s*$', '', name)
    name = re.sub(r'\s*[\d.,]+\s*€\s*$', '', name)
    # Remove standalone prices
    name = re.sub(r'\s+[\d.,]+\s+€\s+', ' ', name)
    return name.strip()

def parse_ocr_file(filepath):
    """Parse a single OCR text file and extract articles."""
    articles = []
    current_article_num = None
    current_article_name = []
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return articles
    
    # Split by page markers
    pages = re.split(r'=== SEITE \d+.*?===', content)
    
    for page in pages:
        lines = page.strip().split('\n')
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Skip headers and metadata
            if re.match(r'^(Installation|01\.\d{2}\.\d{4}|Mai 2024|Seite)$', line):
                continue
            
            # Try to extract article number
            art_num = extract_article_number(line)
            
            if art_num:
                # Save previous article if exists
                if current_article_num and current_article_name:
                    name = ' '.join(current_article_name)
                    if len(name) > 5:  # Minimum name length
                        articles.append({
                            'article_number': current_article_num,
                            'name': clean_article_name(name),
                            'unit': extract_unit(name),
                            'description': ''
                        })
                
                # Start new article
                current_article_num = art_num
                # Extract name from rest of line after article number
                name_part = line.replace(art_num, '').strip()
                current_article_name = [name_part] if name_part else []
            else:
                # Accumulate description lines
                if current_article_num:
                    # Skip lines that look like prices or metadata
                    if re.match(r'^[\d.,]+\s*€?$', line):
                        continue
                    if re.match(r'^(DN|RG|Artikelnr\.?)\s', line):
                        # This might be a table row, extract what we can
                        current_article_name.append(line)
                    else:
                        current_article_name.append(line)
    
    # Save last article
    if current_article_num and current_article_name:
        name = ' '.join(current_article_name)
        if len(name) > 5:
            articles.append({
                'article_number': current_article_num,
                'name': clean_article_name(name),
                'unit': extract_unit(name),
                'description': ''
            })
    
    # Deduplicate by article number
    seen = set()
    unique_articles = []
    for art in articles:
        if art['article_number'] not in seen:
            seen.add(art['article_number'])
            unique_articles.append(art)
    
    return unique_articles

def process_all_files():
    """Process all OCR files and create export."""
    print(f"Processing OCR files from: {OCR_DIR}")
    print(f"Output directory: {OUTPUT_DIR}")
    
    # Ensure output directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # Collect all data
    categories = {}  # temp_id -> category data
    subcategories = {}  # temp_id -> subcategory data
    all_articles = []
    suppliers = set()
    
    # Track order counters
    cat_order = {}
    subcat_order = {}
    
    # Get all .txt files
    txt_files = sorted(OCR_DIR.glob("*.txt"))
    print(f"Found {len(txt_files)} OCR files")
    
    for filepath in txt_files:
        filename = filepath.name
        cat_code, subcat_name = parse_filename(filename)
        
        # Create main category if not exists
        cat_temp_id = f"cat_{cat_code}"
        if cat_temp_id not in categories:
            categories[cat_temp_id] = {
                'temp_id': cat_temp_id,
                'name': CATEGORY_MAPPING.get(cat_code, f"Kategorie {cat_code}"),
                'parent_id': None,
                'order': len(categories),
                'source': SOURCE
            }
        
        # Create subcategory
        subcat_temp_id = f"cat_{cat_code}_{subcat_name.replace(' ', '_')}"
        if subcat_temp_id not in subcategories:
            # Extract supplier name if possible
            supplier_name = subcat_name.split()[0] if subcat_name else subcat_name
            suppliers.add(supplier_name)
            
            # Track order within parent category
            if cat_code not in subcat_order:
                subcat_order[cat_code] = 0
            
            subcategories[subcat_temp_id] = {
                'temp_id': subcat_temp_id,
                'name': subcat_name,
                'parent_id': cat_temp_id,
                'order': subcat_order[cat_code],
                'source': SOURCE,
                'supplier': supplier_name
            }
            subcat_order[cat_code] += 1
        
        # Parse articles from this file
        print(f"Processing: {filename}...")
        articles = parse_ocr_file(filepath)
        
        for i, art in enumerate(articles):
            art['category_temp_id'] = subcat_temp_id
            art['order'] = i
            art['source'] = SOURCE
            all_articles.append(art)
        
        print(f"  -> {len(articles)} articles extracted")
    
    # Create output data structures
    export_time = datetime.now().isoformat()
    
    # Categories JSON
    categories_json = {
        'exported_at': export_time,
        'source': SOURCE,
        'categories': list(categories.values()) + list(subcategories.values())
    }
    
    # Articles JSON
    articles_json = {
        'exported_at': export_time,
        'source': SOURCE,
        'total_articles': len(all_articles),
        'articles': all_articles
    }
    
    # Suppliers JSON
    suppliers_json = {
        'exported_at': export_time,
        'suppliers': [{'name': s} for s in sorted(suppliers)]
    }
    
    # Write JSON files
    with open(OUTPUT_DIR / 'kategorien.json', 'w', encoding='utf-8') as f:
        json.dump(categories_json, f, ensure_ascii=False, indent=2)
    print(f"Written: kategorien.json ({len(categories_json['categories'])} categories)")
    
    with open(OUTPUT_DIR / 'artikel.json', 'w', encoding='utf-8') as f:
        json.dump(articles_json, f, ensure_ascii=False, indent=2)
    print(f"Written: artikel.json ({len(all_articles)} articles)")
    
    with open(OUTPUT_DIR / 'lieferanten.json', 'w', encoding='utf-8') as f:
        json.dump(suppliers_json, f, ensure_ascii=False, indent=2)
    print(f"Written: lieferanten.json ({len(suppliers)} suppliers)")
    
    # Write CSV files
    # Categories CSV
    with open(OUTPUT_DIR / 'kategorien.csv', 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f, delimiter=';')
        writer.writerow(['temp_id', 'name', 'parent_id', 'order', 'source', 'supplier'])
        for cat in categories.values():
            writer.writerow([cat['temp_id'], cat['name'], cat['parent_id'], cat['order'], cat['source'], ''])
        for subcat in subcategories.values():
            writer.writerow([subcat['temp_id'], subcat['name'], subcat['parent_id'], subcat['order'], subcat['source'], subcat.get('supplier', '')])
    print(f"Written: kategorien.csv")
    
    # Articles CSV
    with open(OUTPUT_DIR / 'artikel.csv', 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f, delimiter=';')
        writer.writerow(['article_number', 'name', 'unit', 'category_temp_id', 'order', 'source', 'description'])
        for art in all_articles:
            writer.writerow([art['article_number'], art['name'], art['unit'], art['category_temp_id'], art['order'], art['source'], art.get('description', '')])
    print(f"Written: artikel.csv")
    
    # Create summary
    summary = {
        'exported_at': export_time,
        'total_files_processed': len(txt_files),
        'total_categories': len(categories) + len(subcategories),
        'main_categories': len(categories),
        'subcategories': len(subcategories),
        'total_articles': len(all_articles),
        'total_suppliers': len(suppliers),
        'output_files': [
            'kategorien.json',
            'kategorien.csv',
            'artikel.json',
            'artikel.csv',
            'lieferanten.json',
            'export_summary.json'
        ]
    }
    
    with open(OUTPUT_DIR / 'export_summary.json', 'w', encoding='utf-8') as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    print(f"Written: export_summary.json")
    
    print("\n" + "="*50)
    print("EXTRACTION COMPLETE!")
    print("="*50)
    print(f"Files processed: {len(txt_files)}")
    print(f"Categories: {len(categories)} main + {len(subcategories)} sub = {len(categories) + len(subcategories)} total")
    print(f"Articles: {len(all_articles)}")
    print(f"Suppliers: {len(suppliers)}")
    print(f"\nOutput directory: {OUTPUT_DIR}")
    
    return summary

if __name__ == "__main__":
    process_all_files()
