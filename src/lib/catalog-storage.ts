'use client';

import { supabase } from './supabase';
import type { Article, Category, Supplier } from './data';
import type { ProposedCategory } from '@/lib/types';
import { syncEvents } from './sync-events';

// --- Cache Helpers ---

const CACHE_KEYS = {
  CATEGORIES: (source?: string) => `cat_cache_categories_${source ?? 'all'}`,
  ARTICLES: (source?: string) => `cat_cache_articles_${source ?? 'all'}`,
  SUPPLIERS: 'cat_cache_suppliers'
};

function saveToCache(key: string, data: any) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn("Failed to save to local cache (quota exceeded?)", e);
  }
}

function loadFromCache<T>(key: string): T | null {
  try {
    const cached = localStorage.getItem(key);
    return cached ? JSON.parse(cached) : null;
  } catch (e) {
    return null;
  }
}

// --- Supplier Functions ---

export async function getSuppliersList(): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .order('name');

  if (error) {
    console.error("Error fetching suppliers:", error);
    return loadFromCache<Supplier[]>(CACHE_KEYS.SUPPLIERS) || [];
  }
  
  saveToCache(CACHE_KEYS.SUPPLIERS, data);
  return data as Supplier[];
}

export function subscribeToSuppliers(callback: (suppliers: Supplier[]) => void) {
  // 1. Instant load from cache
  const cached = loadFromCache<Supplier[]>(CACHE_KEYS.SUPPLIERS);
  if (cached) callback(cached);

  const channel = supabase
    .channel('public:suppliers')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, async () => {
      const suppliers = await getSuppliersList();
      callback(suppliers);
    })
    .subscribe();

  getSuppliersList().then(callback);
  return () => { supabase.removeChannel(channel); };
}

export async function preloadCatalog(force: boolean = false): Promise<void> {
  const isInitDone = localStorage.getItem('cat_init_done') === 'true';
  
  if (!isInitDone || force) {
    syncEvents.emit({ type: 'startInitial', label: 'Lade Katalog-Daten...' });
    
    // Simulate steps for better UX progress
    syncEvents.emit({ type: 'progress', current: 10, total: 100 });
    const categories = await getCategoriesList();
    
    syncEvents.emit({ type: 'progress', current: 40, total: 100 });
    const articles = await getArticlesList();
    
    syncEvents.emit({ type: 'progress', current: 80, total: 100 });
    const suppliers = await getSuppliersList();
    
    syncEvents.emit({ type: 'progress', current: 100, total: 100 });
    
    localStorage.setItem('cat_init_done', 'true');
    syncEvents.emit({ type: 'complete', label: 'Datenbank bereit', changes: articles.length });
  } else {
    // Background check
    getCategoriesList();
    getArticlesList();
    getSuppliersList();
  }
}

export async function addSupplier(supplierData: Omit<Supplier, 'id'>): Promise<Supplier | null> {
  const { data, error } = await supabase
    .from('suppliers')
    .insert([supplierData])
    .select()
    .single();

  if (error) return null;
  return data as Supplier;
}

export async function updateSupplier(id: string, data: Partial<Omit<Supplier, 'id'>>): Promise<boolean> {
  const { error } = await supabase
    .from('suppliers')
    .update(data)
    .eq('id', id);
  return !error;
}

export async function deleteSupplier(supplierId: string): Promise<boolean> {
  const { error } = await supabase
    .from('suppliers')
    .delete()
    .eq('id', supplierId);
  return !error;
}


// --- Category Functions ---

export async function getCategoriesList(source?: 'own' | 'wholesale'): Promise<Category[]> {
  const cacheKey = CACHE_KEYS.CATEGORIES(source);
  const cachedData = loadFromCache<Category[]>(cacheKey);
  const isFirstRun = !cachedData;

  if (isFirstRun) {
    syncEvents.emit({ type: 'startInitial', label: 'Lade Kategorien...' });
  }

  let query = supabase
    .from('categories')
    .select('*')
    .order('order');

  if (source) {
    query = query.eq('source', source);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching categories:", error);
    return cachedData || [];
  }
  
  // Map database snake_case to UI camelCase for compatibility
  const mapped = (data as any[]).map(cat => ({
    ...cat,
    parentId: cat.parent_id,
    imageUrl: cat.image_url,
    source: cat.source ?? 'own',
  })) as Category[];

  if (isFirstRun) {
    syncEvents.emit({ type: 'complete', label: 'Kategorien initialisiert', changes: mapped.length });
  } else {
    // Compare with cache to see if there are changes
    const diff = mapped.length - (cachedData?.length || 0);
    if (diff !== 0) {
       syncEvents.emit({ type: 'complete', label: 'Katalog aktualisiert', changes: Math.abs(diff) });
    }
  }

  saveToCache(cacheKey, mapped);
  return mapped;
}

export function subscribeToCategories(callback: (categories: Category[]) => void, source?: 'own' | 'wholesale') {
  // 1. Instant load from cache
  const cached = loadFromCache<Category[]>(CACHE_KEYS.CATEGORIES(source));
  if (cached) callback(cached);

  const channel = supabase
    .channel(`public:categories:${source ?? 'all'}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, async () => {
      const categories = await getCategoriesList(source);
      callback(categories);
    })
    .subscribe();

  getCategoriesList(source).then(callback);
  return () => { supabase.removeChannel(channel); };
}

export async function addCategory(categoryData: Omit<Category, 'id'>): Promise<Category | null> {
  const { data, error } = await supabase
    .from('categories')
    .insert([{
      name: categoryData.name,
      parent_id: categoryData.parentId,
      order: categoryData.order
    }])
    .select()
    .single();

  if (error) return null;
  return { 
    ...data, 
    parentId: data.parent_id,
    imageUrl: data.image_url
  } as Category;
}

export async function updateCategory(id: string, data: Partial<Omit<Category, 'id'>>): Promise<boolean> {
  const updateData: any = {};
  if (data.name) updateData.name = data.name;
  if (data.parentId !== undefined) updateData.parent_id = data.parentId;
  if (data.order !== undefined) updateData.order = data.order;
  if (data.imageUrl !== undefined) updateData.image_url = data.imageUrl;

  const { error } = await supabase
    .from('categories')
    .update(updateData)
    .eq('id', id);
  return !error;
}

export async function updateCategoryImage(categoryId: string, imageUrl: string | null): Promise<boolean> {
  const { error } = await supabase
    .from('categories')
    .update({ image_url: imageUrl })
    .eq('id', categoryId);
  return !error;
}

export async function deleteCategoryAndReparentChildren(categoryId: string, parentId: string | null | undefined): Promise<boolean> {
    // 1. Reparent children
    const { error: updateError } = await supabase
        .from('categories')
        .update({ parent_id: parentId || null })
        .eq('parent_id', categoryId);

    if (updateError) return false;

    // 2. Delete category
    const { error: deleteError } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId);

    return !deleteError;
}

export async function deleteCategoryWithChildren(categoryId: string): Promise<boolean> {
  // 1. Alle Unterkategorien rekursiv ermitteln
  const { data: allCats } = await supabase.from('categories').select('id, parent_id');
  const catsToDelete = new Set<string>([categoryId]);
  
  let added = true;
  while (added) {
    added = false;
    allCats?.forEach(c => {
      if (c.parent_id && catsToDelete.has(c.parent_id) && !catsToDelete.has(c.id)) {
        catsToDelete.add(c.id);
        added = true;
      }
    });
  }
  
  const idsToDelete = Array.from(catsToDelete);

  // 2. Alle Artikel in diesen Kategorien löschen
  await supabase.from('articles').delete().in('category_id', idsToDelete);

  // 3. Alle ermittelten Kategorien löschen
  const { error } = await supabase.from('categories').delete().in('id', idsToDelete);

  return !error;
}

export async function batchUpdateCategories(categoriesToUpdate: Partial<Category>[]): Promise<boolean> {
  // Supabase doesn't have a direct batch update by ID for different values in one call easily like Firestore
  // We'll do it sequentially or with a custom RPC if needed. For now, sequential is fine for small numbers.
  for (const cat of categoriesToUpdate) {
    if (cat.id) {
      await updateCategory(cat.id, cat);
    }
  }
  return true;
}


// --- Article Functions ---

function mapArticleData(data: any[]): Article[] {
  return data.map(art => ({
    ...art,
    articleNumber: art.article_number,
    categoryId: art.category_id,
    supplierId: art.supplier_id,
    imageUrl: art.image_url ?? undefined,
    source: art.source ?? 'own',
    categoryName: art.categories?.name || '',
    supplierName: art.suppliers?.name || ''
  })) as Article[];
}

export async function getArticlesList(source?: 'own' | 'wholesale'): Promise<Article[]> {
  const cacheKey = CACHE_KEYS.ARTICLES(source);
  const cachedData = loadFromCache<Article[]>(cacheKey);
  const isFirstRun = !cachedData;

  if (isFirstRun) {
    syncEvents.emit({ type: 'startInitial', label: 'Lade Artikel-Datenbank...' });
  }

  let query = supabase
    .from('articles')
    .select('*, categories(name), suppliers(name)')
    .order('order');

  if (source) {
    query = query.eq('source', source);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching articles:", error);
    return cachedData || [];
  }

  const mapped = mapArticleData(data);
  
  if (isFirstRun) {
    syncEvents.emit({ type: 'complete', label: 'Artikel initialisiert', changes: mapped.length });
  } else {
    const diff = mapped.length - (cachedData?.length || 0);
    if (diff !== 0) {
      syncEvents.emit({ type: 'complete', label: 'Neue Artikel verfügbar', changes: Math.abs(diff) });
    }
  }

  saveToCache(cacheKey, mapped);
  return mapped;
}

export async function fetchWholesaleArticlesByCategory(categoryIds: string[]): Promise<Article[]> {
  if (categoryIds.length === 0) return [];
  const { data, error } = await supabase
    .from('articles')
    .select('*, categories(name), suppliers(name)')
    .eq('source', 'wholesale')
    .in('category_id', categoryIds)
    .order('order')
    .limit(1000); // safety limit

  if (error) {
    console.error("Error fetching wholesale articles:", error);
    return [];
  }
  return mapArticleData(data);
}

export async function searchWholesaleArticles(query: string): Promise<Article[]> {
  if (!query.trim()) return [];
  const { data, error } = await supabase
    .from('articles')
    .select('*, categories(name), suppliers(name)')
    .eq('source', 'wholesale')
    .or(`name.ilike.%${query}%,article_number.ilike.%${query}%`)
    .order('name')
    .limit(150); // limit search results to prevent freezing

  if (error) {
    console.error("Error searching wholesale articles:", error);
    return [];
  }
  return mapArticleData(data);
}

export async function findWholesaleArticleByNumber(articleNumber: string): Promise<Article | null> {
  if (!articleNumber) return null;
  const { data, error } = await supabase
    .from('articles')
    .select('*, categories(name), suppliers(name)')
    .eq('source', 'wholesale')
    .eq('article_number', articleNumber)
    .maybeSingle();

  if (error) {
    console.error("Error finding wholesale article by number:", error);
    return null;
  }
  if (!data) return null;
  return mapArticleData([data])[0];
}

export function subscribeToArticles(callback: (articles: Article[]) => void, source?: 'own' | 'wholesale') {
  // 1. Instant load from cache
  const cached = loadFromCache<Article[]>(CACHE_KEYS.ARTICLES(source));
  if (cached) callback(cached);

  const channel = supabase
    .channel(`public:articles:${source ?? 'all'}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'articles' }, async () => {
      const articles = await getArticlesList(source);
      callback(articles);
    })
    .subscribe();

  getArticlesList(source).then(callback);
  return () => { supabase.removeChannel(channel); };
}

/**
 * Kopiert einen Grosshaendler-Artikel in den eigenen Katalog.
 * Erstellt einen neuen Eintrag mit source='own' in der angegebenen Zielkategorie.
 */
export async function copyArticleToOwnCatalog(
  wholesaleArticle: Article,
  targetCategoryId: string
): Promise<Article | null> {
  // Bestimme den naechsten Order-Wert in der Zielkategorie
  const { data: existing } = await supabase
    .from('articles')
    .select('order')
    .eq('category_id', targetCategoryId)
    .eq('source', 'own')
    .order('order', { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? (existing[0].order ?? 0) + 1 : 0;

  const { data, error } = await supabase
    .from('articles')
    .insert([{
      name: wholesaleArticle.name,
      article_number: wholesaleArticle.articleNumber,
      unit: wholesaleArticle.unit,
      category_id: targetCategoryId,
      image_url: wholesaleArticle.imageUrl ?? null,
      aliases: wholesaleArticle.aliases ?? [],
      order: nextOrder,
      source: 'own',
    }])
    .select()
    .single();

  if (error) {
    console.error('copyArticleToOwnCatalog error:', error);
    return null;
  }
  return {
    ...data,
    articleNumber: data.article_number,
    categoryId: data.category_id,
    source: 'own',
  } as Article;
}

export async function addArticle(articleData: Omit<Article, 'id'>): Promise<Article | null> {
  const { data, error } = await supabase
    .from('articles')
    .insert([{
      name: articleData.name,
      article_number: articleData.articleNumber,
      unit: articleData.unit,
      category_id: articleData.categoryId,
      supplier_id: articleData.supplierId,
      order: articleData.order,
      aliases: articleData.aliases || []
    }])
    .select()
    .single();

  if (error) {
    console.error("Error adding article:", error);
    return null;
  }
  return { 
    ...data, 
    articleNumber: data.article_number,
    categoryId: data.category_id,
    supplierId: data.supplier_id
  } as Article;
}

export async function updateArticle(id: string, data: Partial<Omit<Article, 'id'>>): Promise<boolean> {
  const updateData: any = {};
  if (data.name) updateData.name = data.name;
  if (data.articleNumber) updateData.article_number = data.articleNumber;
  if (data.unit) updateData.unit = data.unit;
  if (data.categoryId) updateData.category_id = data.categoryId;
  if ('supplierId' in data) updateData.supplier_id = data.supplierId || null;
  if ('imageUrl' in data) updateData.image_url = data.imageUrl || null;
  if (data.order !== undefined) updateData.order = data.order;
  if (data.aliases) updateData.aliases = data.aliases;

  const { error } = await supabase
    .from('articles')
    .update(updateData)
    .eq('id', id);
  return !error;
}

export async function deleteArticles(articleIds: string[]): Promise<boolean> {
  const { error } = await supabase
    .from('articles')
    .delete()
    .in('id', articleIds);
  return !error;
}

export async function batchUpdateArticles(articlesToUpdate: Partial<Article>[]): Promise<boolean> {
  for (const art of articlesToUpdate) {
    if (art.id) {
      await updateArticle(art.id, art);
    }
  }
  return true;
}

export async function addAliasToArticle(articleId: string, newAlias: string): Promise<boolean> {
  const { data: article, error: fetchError } = await supabase
    .from('articles')
    .select('aliases')
    .eq('id', articleId)
    .single();

  if (fetchError || !article) return false;

  const existingAliases = article.aliases || [];
  if (existingAliases.includes(newAlias)) return true;

  const { error: updateError } = await supabase
    .from('articles')
    .update({ aliases: [...existingAliases, newAlias] })
    .eq('id', articleId);

  return !updateError;
}


// --- Catalog Import ---

export async function batchAddCatalog(
  catalogData: ProposedCategory[],
  existingCategories: Category[],
  rootParentId: string | null = null,
  defaultSupplierId: string | null = null,
  source: 'own' | 'wholesale' = 'own'
): Promise<boolean> {
    
    const processCategory = async (category: ProposedCategory, parentId: string | null, order: number) => {
      // 1. Create Category
      const { data: newCat, error: catError } = await supabase
        .from('categories')
        .insert([{ name: category.categoryName, parent_id: parentId, order: order, source: source }])
        .select()
        .single();

      if (catError || !newCat) return;

      // 2. Create Articles
      const articlesToInsert = category.articles.map((art: any, idx: number) => ({
        name: art.name,
        article_number: art.articleNumber,
        unit: art.unit,
        category_id: newCat.id,
        supplier_id: art.supplierId || defaultSupplierId,
        order: idx,
        source: source
      }));

      if (articlesToInsert.length > 0) {
        await supabase.from('articles').insert(articlesToInsert);
      }
      
      // 3. Subcategories
      for (let i = 0; i < category.subCategories.length; i++) {
        await processCategory(category.subCategories[i], newCat.id, i);
      }
    };

    const siblingCategories = existingCategories.filter(c => c.parentId === rootParentId);
    let currentOrder = siblingCategories.length > 0 ? Math.max(...siblingCategories.map(c => c.order ?? -1)) + 1 : 0;

    for (const topCat of catalogData) {
        await processCategory(topCat, rootParentId, currentOrder++);
    }
    
    return true;
}
