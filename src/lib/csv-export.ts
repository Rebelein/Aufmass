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

export const generateHeinzeUgl = (items: ProcessedSummaryItem[]): string => {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  
  const padRight = (str: string, len: number) => str.substring(0, len).padEnd(len, ' ');
  const padLeftZero = (num: number | string, len: number) => String(num).padStart(len, '0');

  // KOP Record
  let header = 'KOP02BE'; // 1-7
  header += padRight('AUFMASS', 15); // 8-22
  header += padRight('', 15); // 23-37
  header += `${yyyy}${mm}${dd}`; // 38-45
  header = padRight(header, 200);

  const articleItems = items.filter((item) => item.type === 'article');
  
  let index = 1;
  const rows = articleItems.map((item) => {
    const articleNumber = item.article?.articleNumber || (item as any).article_number || '';
    const quantity = item.quantity || 0;
    const name = item.article?.name || item.text || (item as any).name || '';
    const unit = item.article?.unit || (item as any).unit || 'ST';
    const priceVal = (item.article as any)?.price || 0;
    
    let pos = 'POA'; // 1-3
    pos += padLeftZero(index * 10, 10); // 4-13 Handwerker Pos
    pos += padLeftZero(0, 10); // 14-23 Großhändler Pos
    pos += padRight(String(articleNumber), 15); // 24-38 Artikelnummer
    pos += padLeftZero(Math.round(quantity * 1000), 9); // 39-47 Menge (3 NK)
    pos += padRight(unit.toUpperCase(), 4); // 48-51 Einheit
    pos += padRight(name, 40); // 52-91 Text 1
    pos += padRight('', 40); // 92-131 Text 2
    pos += padLeftZero(Math.round(priceVal * 100), 11); // 132-142 Einzelpreis (2 NK)
    
    index++;
    return padRight(pos, 200);
  });
  
  // END Record
  let footer = 'END'; // 1-3
  footer += padLeftZero(articleItems.length, 6); // 4-9 Anzahl Positionen
  footer = padRight(footer, 200);

  return [header, ...rows, footer].join('\r\n');
};

// Keeps compatibility but might be deprecated
export const generateHeinzeCsv = (items: ProcessedSummaryItem[]): string => {
  return generateHeinzeUgl(items);
};

export const generateExportForSupplier = (supplier: string, items: ProcessedSummaryItem[]): { content: string, extension: string, useBom: boolean } => {
  const normalizedSupplier = supplier.toUpperCase();
  if (normalizedSupplier.includes('HEINZE')) {
    return { content: generateHeinzeUgl(items), extension: 'ugl', useBom: false };
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
  const mimeType = filename.endsWith('.ugl') ? 'text/plain;charset=utf-8;' : 'text/csv;charset=utf-8;';
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
