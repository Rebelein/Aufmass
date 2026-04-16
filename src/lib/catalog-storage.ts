'use client';

import { supabase } from './supabase';
import type { Article, Category, Supplier } from './data';
import type { ProposedCategory } from '@/ai/catalog-schemas';

// --- Supplier Functions ---

export async function getSuppliersList(): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .order('name');

  if (error) {
    console.error("Error fetching suppliers:", error);
    return [];
  }
  return data as Supplier[];
}

export function subscribeToSuppliers(callback: (suppliers: Supplier[]) => void) {
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

export async function getCategoriesList(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('order');

  if (error) {
    console.error("Error fetching categories:", error);
    return [];
  }
  // Map parent_id to parentId for compatibility with existing UI
  return (data as any[]).map(cat => ({
    ...cat,
    parentId: cat.parent_id
  })) as Category[];
}

export function subscribeToCategories(callback: (categories: Category[]) => void) {
  const channel = supabase
    .channel('public:categories')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, async () => {
      const categories = await getCategoriesList();
      callback(categories);
    })
    .subscribe();

  getCategoriesList().then(callback);
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
  return { ...data, parentId: data.parent_id } as Category;
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

export async function getArticlesList(): Promise<Article[]> {
  const { data, error } = await supabase
    .from('articles')
    .select('*, categories(name), suppliers(name)')
    .order('order');

  if (error) {
    console.error("Error fetching articles:", error);
    return [];
  }

  return (data as any[]).map(art => ({
    ...art,
    articleNumber: art.article_number,
    categoryId: art.category_id,
    supplierId: art.supplier_id,
    categoryName: art.categories?.name || '',
    supplierName: art.suppliers?.name || ''
  })) as Article[];
}

export function subscribeToArticles(callback: (articles: Article[]) => void) {
  const channel = supabase
    .channel('public:articles')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'articles' }, async () => {
      const articles = await getArticlesList();
      callback(articles);
    })
    .subscribe();

  getArticlesList().then(callback);
  return () => { supabase.removeChannel(channel); };
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
  return { ...data, articleId: data.id, articleNumber: data.article_number } as unknown as Article;
}

export async function updateArticle(id: string, data: Partial<Omit<Article, 'id'>>): Promise<boolean> {
  const updateData: any = {};
  if (data.name) updateData.name = data.name;
  if (data.articleNumber) updateData.article_number = data.articleNumber;
  if (data.unit) updateData.unit = data.unit;
  if (data.categoryId) updateData.category_id = data.categoryId;
  if (data.supplierId) updateData.supplier_id = data.supplierId;
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
  defaultSupplierId: string | null = null
): Promise<boolean> {
    
    const processCategory = async (category: ProposedCategory, parentId: string | null, order: number) => {
      // 1. Create Category
      const { data: newCat, error: catError } = await supabase
        .from('categories')
        .insert([{ name: category.categoryName, parent_id: parentId, order: order }])
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
        order: idx
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
