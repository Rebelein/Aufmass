import type { ProcessedSummaryItem } from '@/lib/types';

export const formatGermanNumber = (num: number, decimals: number): string => {
  return num.toFixed(decimals).replace('.', ',');
};

export const generateGCCsv = (items: ProcessedSummaryItem[]): string => {
  const header = ';Artikelnummer;Menge;Beschreibung 1;Beschreibung 2;Listenpreis;\n';
  const rows = items
    .filter((item) => item.type === 'article' && item.article)
    .map((item) => {
      const articleNumber = item.article?.articleNumber || '';
      const quantity = item.quantity || 0;
      const name = item.article?.name || item.text || '';
      // Assuming price could be on the article, if not it's empty
      const priceVal = (item.article as any)?.price;
      
      const qtyStr = formatGermanNumber(quantity, 3);
      const priceStr = priceVal ? `${formatGermanNumber(priceVal, 2)} €` : '';
      
      return `ART;${articleNumber};${qtyStr};${name};;${priceStr};`;
    })
    .join('\n');
  
  return header + rows;
};

export const generateHeinzeCsv = (items: ProcessedSummaryItem[]): string => {
  const rows = items
    .filter((item) => item.type === 'article' && item.article)
    .map((item) => {
      const articleNumber = item.article?.articleNumber || '';
      const quantity = item.quantity || 0;
      const name = item.article?.name || item.text || '';
      const unit = item.article?.unit || 'ST';
      const priceVal = (item.article as any)?.price;
      
      const qtyStr = formatGermanNumber(quantity, 3);
      const priceStr = priceVal ? formatGermanNumber(priceVal, 2) : '';
      
      // Structure: [Nummer];[Menge];[Einheit];[Beschreibung];[Preis];
      return `${articleNumber};${qtyStr};${unit};${name};${priceStr};`;
    })
    .join('\n');
  
  return rows;
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
