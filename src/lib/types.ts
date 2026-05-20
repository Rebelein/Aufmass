// --- Aufmaß / Projekt-Typen ---

export interface ProcessedSummaryItem {
  type: 'article' | 'section';
  id: string;
  order: number;
  article_id?: string;
  images?: string[] | null;
  article?: {
    id?: string;
    name?: string;
    articleNumber?: string;
    supplierArticleNumbers?: Record<string, string>;
    supplierId?: string;
    unit?: string;
    supplierName?: string;
    categoryId?: string;
    order?: number;
    [key: string]: unknown;
  };
  quantity?: number;
  text?: string;
  section_id?: string | null;
  name?: string;
  article_number?: string;
  unit?: string;
  supplier_name?: string;
}

// --- KI-Import / Katalog-Vorschlag-Typen ---

export interface ProposedArticle {
  id?: string;
  name: string;
  articleNumber: string;
  unit: string;
  supplierId?: string;
  supplierName?: string;
  matchedArticleId?: string;
}

export interface ProposedCategory {
  id?: string;
  categoryName: string;
  articles: ProposedArticle[];
  subCategories: ProposedCategory[];
}

// --- Artikel-Formular ---

export interface NewArticleFormData {
  name: string;
  articleNumber: string;
  unit: string;
  supplierId?: string;
  aliases?: string;
}

// --- Abgaswerte (Testo CSV Import) ---

export interface Abgaswert {
  source?: string;
  messdatum?: Date;
  abgastemperatur?: number;
  raumtemperatur?: number;
  o2?: number;
  co?: number;
  coUnverduennt?: number;
  abgasverlust?: number;
  wirkungsgrad?: number;
  kaminzug?: number;
  geraetedruck?: number;
  lambda?: number;
  spreizung?: number;
  tOel?: number;
}
