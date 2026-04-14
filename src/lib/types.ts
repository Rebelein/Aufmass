export interface ProcessedSummaryItem {
  type: 'article' | 'section';
  id: string;
  order: number;
  article_id?: string;
  article?: {
    id?: string;
    name?: string;
    articleNumber?: string;
    unit?: string;
    supplierName?: string;
    categoryId?: string;
    order?: number;
    [key: string]: unknown;
  };
  quantity?: number;
  text?: string;
}
