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

export const generateHeinzeUgs = (items: ProcessedSummaryItem[]): string => {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const header = `V ${yy}${mm}${dd}\n`;

  let index = 1;
  const rows = items
    .filter((item) => item.type === 'article')
    .map((item) => {
      const articleNumber = item.article?.articleNumber || (item as any).article_number || '';
      const quantity = item.quantity || 0;
      
      const posStr = String(index++).padEnd(4, ' ');
      const artStr = String(articleNumber).padEnd(17, ' ');
      const qtyStr = String(Math.round(quantity * 1000)).padStart(8, '0');
      
      return `A ${posStr}${artStr}${qtyStr}`;
    })
    .join('\n');
  
  return header + rows;
};

// Keeps compatibility but might be deprecated
export const generateHeinzeCsv = (items: ProcessedSummaryItem[]): string => {
  return generateHeinzeUgs(items);
};

export const generateExportForSupplier = (supplier: string, items: ProcessedSummaryItem[]): { content: string, extension: string, useBom: boolean } => {
  const normalizedSupplier = supplier.toUpperCase();
  if (normalizedSupplier.includes('HEINZE')) {
    return { content: generateHeinzeUgs(items), extension: 'ugs', useBom: false };
  } else {
    // Default to GC format as requested
    return { content: generateGCCsv(items), extension: 'csv', useBom: true };
  }
};

export const generateCsvForSupplier = (supplier: string, items: ProcessedSummaryItem[]): string => {
  return generateExportForSupplier(supplier, items).content;
};

export const downloadFile = (content: string, filename: string, useBom: boolean = true) => {
  const finalContent = useBom ? "\ufeff" + content : content;
  const mimeType = filename.endsWith('.ugs') ? 'text/plain;charset=utf-8;' : 'text/csv;charset=utf-8;';
  const blob = new Blob([finalContent], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const downloadCsv = (content: string, filename: string) => {
  downloadFile(content, filename, true);
};
