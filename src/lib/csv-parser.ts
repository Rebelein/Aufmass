
'use client';

import type { ProposedCategory, ProposedArticle } from '@/ai/catalog-schemas';
import type { Abgaswert } from './abgaswerte-storage';

/**
 * Parses a CSV string into a catalog structure.
 * The CSV must contain the headers: 'Kategorie', 'Name', 'Artikel-Nr.', 'Einheit'.
 * 'Großhändler' is optional. The separator must be a semicolon (;).
 * @param csvContent The string content of the CSV file.
 * @returns An object with the parsed catalog or an error message.
 */
export const parseCsvToCatalog = (csvContent: string): { catalog: ProposedCategory[] | null; error?: string } => {
    const lines = csvContent.trim().replace(/\r/g, '').split('\n');
    if (lines.length < 2) {
        return { catalog: null, error: "Die CSV-Datei ist leer oder enthält nur eine Kopfzeile." };
    }

    const headerLine = lines.shift()!;
    // Handle semicolon separator and remove quotes from headers
    const header = headerLine.toLowerCase().split(';').map(h => h.trim().replace(/"/g, ''));

    const catIndex = header.indexOf('kategorie');
    const nameIndex = header.indexOf('name');
    const numIndex = header.indexOf('artikel-nr.');
    const unitIndex = header.indexOf('einheit');
    const supplierIndex = header.indexOf('großhändler'); // This is optional, -1 if not found

    if (catIndex === -1 || nameIndex === -1 || numIndex === -1 || unitIndex === -1) {
        return { catalog: null, error: "Die CSV-Datei muss die Spalten 'Kategorie', 'Name', 'Artikel-Nr.' und 'Einheit' enthalten. Der Separator muss ein Semikolon (;) sein." };
    }

    const categoryMap = new Map<string, ProposedArticle[]>();

    for (const line of lines) {
        if (!line.trim()) continue;
        
        // Use a semicolon as the separator.
        const values = line.split(';').map(v => v.trim().replace(/"/g, ''));

        const categoryName = values[catIndex];
        if (!categoryName) continue; // Skip rows without a category name

        const article: ProposedArticle = {
            name: values[nameIndex] || '',
            articleNumber: values[numIndex] || '',
            unit: values[unitIndex] || 'Stück', // Default to 'Stück' if empty
            supplierName: supplierIndex !== -1 ? (values[supplierIndex] || '') : '',
        };

        if (!categoryMap.has(categoryName)) {
            categoryMap.set(categoryName, []);
        }
        categoryMap.get(categoryName)!.push(article);
    }

    const proposedCatalog: ProposedCategory[] = [];
    for (const [categoryName, articles] of categoryMap.entries()) {
        proposedCatalog.push({
            categoryName,
            articles,
            subCategories: [],
        });
    }

    if (proposedCatalog.length === 0) {
        return { catalog: null, error: "Es konnten keine gültigen Artikelzeilen in der CSV-Datei gefunden werden." };
    }

    return { catalog: proposedCatalog };
};


/**
 * Parses a Testo CSV file with a two-block structure (metadata and data).
 * @param csvContent The string content of the CSV file.
 * @param anlagennummerToMatch The system number to match against.
 * @returns An object with the parsed values, or null if no match or invalid format.
 */
export const parseAbgaswerteCsv = (csvContent: string, anlagennummerToMatch: string): Partial<Abgaswert> | null => {
    const lines = csvContent.trim().replace(/\r/g, '').split('\n');
    
    // --- Block 1: Metadata Extraction ---
    let anlagennummerInFile = '';
    for (const line of lines) {
        const parts = line.split(';');
        if (parts.length > 1 && parts[0].trim().toLowerCase() === 'kunden-/firmenname') {
            anlagennummerInFile = parts[1].trim();
            break;
        }
    }

    if (anlagennummerInFile !== anlagennummerToMatch) {
        console.warn(`Anlagennummer mismatch. Expected: ${anlagennummerToMatch}, Found: ${anlagennummerInFile}`);
        return null;
    }

    // --- Block 2: Data Extraction ---
    const headerLineIndex = lines.findIndex(line => line.toLowerCase().includes('datum/uhrzeit'));
    if (headerLineIndex === -1) return null; // Data header not found

    const header = lines[headerLineIndex].split(';').map(h => h.trim().toLowerCase());
    const dataRow = lines[headerLineIndex + 1]?.split(';'); // Get the first data row
    if (!dataRow) return null; // No data row found

    const colMap = new Map<string, number>();
    header.forEach((h, i) => colMap.set(h, i));

    const parseGermanFloat = (value: string | undefined): number | undefined => {
        if (value === undefined || value.trim() === '') return undefined;
        const sanitized = value.replace(',', '.').trim();
        const num = parseFloat(sanitized);
        return isNaN(num) ? undefined : num;
    };
    
    let messdatum: Date | undefined;
    const dateIndex = colMap.get('datum/uhrzeit');
    if (dateIndex !== undefined && dataRow[dateIndex]) {
        const dateTimeString = dataRow[dateIndex].trim(); // e.g., "10.07.25 13:22"
        const parts = dateTimeString.split(' ');
        if (parts.length === 2) {
            const dateParts = parts[0].split('.');
            const timeParts = parts[1].split(':');
            if (dateParts.length === 3 && timeParts.length === 2) {
                const day = parseInt(dateParts[0], 10);
                const month = parseInt(dateParts[1], 10) - 1; // Month is 0-indexed
                const year = parseInt(`20${dateParts[2]}`, 10);
                const hour = parseInt(timeParts[0], 10);
                const minute = parseInt(timeParts[1], 10);
                if (![day, month, year, hour, minute].some(isNaN)) {
                    messdatum = new Date(year, month, day, hour, minute);
                }
            }
        }
    }
    
    const getValue = (key: string): string | undefined => {
        const index = colMap.get(key.toLowerCase());
        return index !== undefined ? dataRow[index] : undefined;
    }

    return {
        source: 'csv',
        messdatum: messdatum,
        abgastemperatur: parseGermanFloat(getValue('at [°c]')),
        raumtemperatur: parseGermanFloat(getValue('vt [°c]')),
        o2: parseGermanFloat(getValue('o₂ [%]')),
        co: parseGermanFloat(getValue('co [ppm]')),
        coUnverduennt: parseGermanFloat(getValue('counv [ppm]')),
        abgasverlust: parseGermanFloat(getValue('qa + [%]')),
        wirkungsgrad: parseGermanFloat(getValue('η + [%]')),
        kaminzug: parseGermanFloat(getValue('zug [mbar]')),
        geraetedruck: parseGermanFloat(getValue('gt [°c]')),
        lambda: parseGermanFloat(getValue('λ []')),
        // These fields might not exist in this specific CSV, so getValue will return undefined
        // which parseGermanFloat handles correctly.
        spreizung: undefined, 
        tOel: undefined,
    };
};
