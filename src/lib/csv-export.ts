import type { ProcessedSummaryItem } from '@/lib/types';

export const formatGermanNumber = (num: number, decimals: number): string => {
  return num.toFixed(decimals).replace('.', ',');
};

export const getSupplierName = (item: ProcessedSummaryItem): string => {
  if (item.type !== 'article') return '';
  return item.article?.supplierName || (item as any).supplier_name || 'Andere';
};

export const generateGCCsv = (items: ProcessedSummaryItem[]): string => {
  const header = ';Artikelnummer;Menge;Beschreibung 1;Beschreibung 2;Listenpreis;\n';
  const rows = items
    .filter((item) => item.type === 'article')
    .map((item) => {
      const articleNumber = item.article?.articleNumber || (item as any).article_number || '';
      const quantity = item.quantity || 0;
      
      const qtyStr = formatGermanNumber(quantity, 3);
      
      // GC benötigt nur Artikelnummer und Menge. Rest bleibt leer, damit das GC-System die Daten selbst ergänzt.
      return `ART;${articleNumber};${qtyStr};;;;`;
    })
    .join('\n');
  
  return header + rows;
};

export const generateHeinzeCsv = (items: ProcessedSummaryItem[]): string => {
  const rows = items
    .filter((item) => item.type === 'article')
    .map((item) => {
      const articleNumber = item.article?.articleNumber || (item as any).article_number || '';
      const quantity = item.quantity || 0;
      const name = item.article?.name || item.text || (item as any).name || '';
      const unit = item.article?.unit || (item as any).unit || 'ST';
      const priceVal = (item.article as any)?.price;
      
      const qtyStr = formatGermanNumber(quantity, 3);
      const priceStr = priceVal ? formatGermanNumber(priceVal, 2) : '';
      
      // Structure: [Nummer];[Menge];[Einheit];[Beschreibung];[Preis];
      return `${articleNumber};${qtyStr};${unit};${name};${priceStr};`;
    })
    .join('\n');
  
  return rows;
};

export const generateCsvForSupplier = (supplier: string, items: ProcessedSummaryItem[]): string => {
  const normalizedSupplier = supplier.toUpperCase();
  if (normalizedSupplier.includes('GC')) {
    return generateGCCsv(items);
  } else if (normalizedSupplier.includes('HEINZE')) {
    return generateHeinzeCsv(items);
  } else {
    // Default to GC format as requested
    return generateGCCsv(items);
  }
};

export const downloadCsv = (content: string, filename: string) => {
  // UTF-8 BOM is essential for Excel to recognize characters correctly
  const blob = new Blob(["\ufeff" + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
