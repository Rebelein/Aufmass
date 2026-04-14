"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Article, Category, Supplier } from '@/lib/data';
import { subscribeToCategories, subscribeToArticles, subscribeToSuppliers } from '@/lib/catalog-storage';
import { useToast } from '@/hooks/use-toast';
import { getCurrentProjectId, getProjectById, syncProjectItems, Project, ProjectSelectedItem } from '@/lib/project-storage';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Search, Star, Plus, Minus, FileDown, Menu, ChevronRight, Check, Package } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';

interface ProcessedSummaryItem {
  type: 'article' | 'section';
  id: string;
  order: number;
  article_id?: string;
  article?: Partial<Omit<Article, 'price'>>;
  quantity?: number;
  text?: string;
}

const AufmassPage = () => {
  const [articlesData, setArticlesData] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isCategorySheetOpen, setIsCategorySheetOpen] = useState(false);
  const [favoriteCategories, setFavoriteCategories] = useState<Set<string>>(new Set());
  const [recentCategories, setRecentCategories] = useState<string[]>([]);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const projectId = getCurrentProjectId();
    if (!projectId) {
      router.replace('/projects');
      return;
    }

    let isMounted = true;
    const unsubscribeCategories = subscribeToCategories((cats) => {
      if (isMounted) setCategories(cats);
    });
    const unsubscribeArticles = subscribeToArticles((arts) => {
      if (isMounted) setArticlesData(arts);
    });
    const unsubscribeSuppliers = subscribeToSuppliers((supps) => {
      if (isMounted) setSuppliers(supps);
    });

    const loadProject = async () => {
      const project = await getProjectById(projectId);
      if (!project) {
        router.replace('/projects');
        return;
      }
      if (isMounted) {
        setCurrentProject(project);
        setIsLoadingData(false);
      }
    };

    loadProject();

    return () => {
      isMounted = false;
      unsubscribeCategories();
      unsubscribeArticles();
      unsubscribeSuppliers();
    };
  }, [router]);

  useEffect(() => {
    if (categories.length > 0 && !selectedCategoryId) {
      const firstTopLevelCategory = categories
        .filter(c => !c.parentId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
      if (firstTopLevelCategory) setSelectedCategoryId(firstTopLevelCategory.id);
    }
  }, [categories, selectedCategoryId]);

  const selectedCategory = useMemo(() => {
    return categories.find(c => c.id === selectedCategoryId);
  }, [categories, selectedCategoryId]);

  const filteredArticles = useMemo(() => {
    if (!selectedCategoryId) return [];
    return articlesData
      .filter((article) => article.categoryId === selectedCategoryId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [articlesData, selectedCategoryId]);

  const processedSummaryItems: ProcessedSummaryItem[] = useMemo(() => {
    if (!currentProject) return [];
    return currentProject.selectedItems.map(item => {
      if (item.type === 'article' && item.article_id) {
        const articleDetail = articlesData.find(a => a.id === item.article_id);
        return { ...item, article: articleDetail };
      }
      return item as ProcessedSummaryItem;
    }).filter(i => !!i).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [currentProject, articlesData]);

  const articleCount = processedSummaryItems.filter(i => i.type === 'article').length;

  const updateProjectItems = (newItems: ProjectSelectedItem[]) => {
    if (currentProject) {
      const finalItems = newItems.map((item, index) => ({ ...item, order: index }));
      syncProjectItems(currentProject.id, finalItems).then((success) => {
        if (success) setCurrentProject({ ...currentProject, selectedItems: finalItems });
      });
    }
  };

  const handleDirectAddArticle = useCallback((articleId: string, quantity: number) => {
    if (!currentProject) return;
    
    const article = articlesData.find(a => a.id === articleId);
    if (!article) return;

    const newItem: ProjectSelectedItem = {
      type: 'article',
      id: crypto.randomUUID(),
      article_id: articleId,
      quantity,
    };
    
    updateProjectItems([...currentProject.selectedItems, newItem]);
    
    if (navigator.vibrate) navigator.vibrate(50);
    
    toast({ 
      title: "Hinzugefügt", 
      description: `${quantity}x ${article.name}`
    });

    setRecentCategories(prev => {
      const filtered = prev.filter(id => id !== selectedCategoryId);
      return [selectedCategoryId!, ...filtered].slice(0, 5);
    });
  }, [currentProject, articlesData, selectedCategoryId, toast]);

  const handleUpdateItemQuantity = (itemId: string, delta: number) => {
    if (!currentProject) return;
    updateProjectItems(
      currentProject.selectedItems.map(item => 
        item.id === itemId 
          ? { ...item, quantity: Math.max(0, (item.quantity || 0) + delta) }
          : item
      ).filter(item => (item.quantity || 0) > 0)
    );
  };

  const handleDeleteItem = (itemId: string) => {
    if (!currentProject) return;
    updateProjectItems(currentProject.selectedItems.filter(i => i.id !== itemId));
  };

  const handleGeneratePdf = async () => {
    if (!currentProject) return;
    try {
      const doc = new jsPDF();
      doc.setFontSize(20);
      doc.text(`Projekt: ${currentProject.name}`, 15, 20);
      doc.setFontSize(12);
      let y = 35;
      processedSummaryItems.forEach((item) => {
        if (item.type === 'article' && item.article) {
          doc.text(`${item.quantity}x ${item.article.name} (${item.article.articleNumber})`, 15, y);
          y += 7;
        }
      });
      doc.save(`aufmass_${currentProject.name}.pdf`);
      toast({ title: "PDF erstellt" });
    } catch (error) {
      console.error("PDF error:", error);
    }
  };

  const handleSelectCategory = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setIsCategorySheetOpen(false);
  };

  const toggleFavorite = (categoryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavoriteCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const topLevelCategories = categories
    .filter(c => !c.parentId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const favoriteCategoriesList = topLevelCategories.filter(c => favoriteCategories.has(c.id));

  if (isLoadingData || !currentProject) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-emerald-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.push('/projects')}
              className="p-2 -ml-2 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label="Zurück zu Projekte"
            >
              <ChevronLeft size={24} className="text-slate-600" />
            </button>
            <div>
              <h1 className="font-semibold text-slate-900 truncate max-w-[200px]">
                {currentProject.name}
              </h1>
              <p className="text-xs text-slate-500">
                {articleCount} Artikel
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Sheet open={isCategorySheetOpen} onOpenChange={setIsCategorySheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="lg" className="h-12 px-4 border-slate-200">
                  <Menu size={20} className="text-emerald-600" />
                  <span className="ml-2 font-medium">
                    {selectedCategory?.name || 'Kategorie'}
                  </span>
                  <ChevronRight size={16} className="ml-1 text-slate-400" />
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl px-0">
                <SheetHeader className="px-6 pb-4">
                  <SheetTitle className="text-left text-xl">Kategorien</SheetTitle>
                </SheetHeader>
                <div className="overflow-y-auto px-6 pb-6 space-y-6">
                  {/* Favorites */}
                  {favoriteCategoriesList.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Star size={14} className="text-amber-500" /> Favoriten
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        {favoriteCategoriesList.map(category => (
                          <button
                            key={category.id}
                            onClick={() => handleSelectCategory(category.id)}
                            className={cn(
                              "p-4 rounded-xl border-2 text-left transition-all",
                              selectedCategoryId === category.id
                                ? "border-emerald-500 bg-emerald-50"
                                : "border-slate-200 bg-white hover:border-slate-300"
                            )}
                          >
                            <span className="font-medium text-slate-900">{category.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent */}
                  {recentCategories.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                        Zuletzt verwendet
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {recentCategories.map(catId => {
                          const cat = categories.find(c => c.id === catId);
                          return cat ? (
                            <button
                              key={cat.id}
                              onClick={() => handleSelectCategory(cat.id)}
                              className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors"
                            >
                              {cat.name}
                            </button>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}

                  {/* All Categories */}
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                      Alle Kategorien
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {topLevelCategories.map(category => (
                        <button
                          key={category.id}
                          onClick={() => handleSelectCategory(category.id)}
                          className={cn(
                            "p-4 rounded-xl border-2 text-left transition-all relative",
                            selectedCategoryId === category.id
                              ? "border-emerald-500 bg-emerald-50"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-slate-900">{category.name}</span>
                            <button
                              onClick={(e) => toggleFavorite(category.id, e)}
                              className={cn(
                                "p-1 rounded-full transition-colors",
                                favoriteCategories.has(category.id)
                                  ? "text-amber-500"
                                  : "text-slate-300 hover:text-amber-400"
                              )}
                              aria-label={favoriteCategories.has(category.id) ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
                            >
                              <Star size={16} fill={favoriteCategories.has(category.id) ? "currentColor" : "none"} />
                            </button>
                          </div>
                          {selectedCategoryId === category.id && (
                            <Check size={16} className="absolute top-2 right-2 text-emerald-600" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Main Content - Article Grid */}
      <main className="flex-1 p-4 pb-32 overflow-y-auto">
        {filteredArticles.length === 0 ? (
          <div className="text-center py-12">
            <Package size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 font-medium">Keine Artikel in dieser Kategorie</p>
            <p className="text-sm text-slate-400 mt-1">Wählen Sie eine andere Kategorie</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredArticles.map(article => {
              const quantityInProject = processedSummaryItems
                .filter(i => i.type === 'article' && i.article_id === article.id)
                .reduce((sum, i) => sum + (i.quantity || 0), 0);

              return (
                <ArticleCard
                  key={article.id}
                  article={article}
                  quantityInProject={quantityInProject}
                  onAdd={handleDirectAddArticle}
                  onUpdateQuantity={handleUpdateItemQuantity}
                  onDelete={handleDeleteItem}
                  itemIds={processedSummaryItems
                    .filter(i => i.type === 'article' && i.article_id === article.id)
                    .map(i => i.id)}
                />
              );
            })}
          </div>
        )}
      </main>

      {/* Sticky Bottom Summary */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.1)]">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <Package size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">{articleCount} Artikel</p>
              <p className="text-xs text-slate-500">im Aufmaß</p>
            </div>
          </div>
          <Button
            onClick={handleGeneratePdf}
            disabled={articleCount === 0}
            className="btn-primary h-12 px-6"
          >
            <FileDown size={20} className="mr-2" />
            PDF
          </Button>
        </div>
      </div>
    </div>
  );
};

interface ArticleCardProps {
  article: Article;
  quantityInProject: number;
  onAdd: (articleId: string, quantity: number) => void;
  onUpdateQuantity: (itemId: string, delta: number) => void;
  onDelete: (itemId: string) => void;
  itemIds: string[];
}

function ArticleCard({ article, quantityInProject, onAdd, onUpdateQuantity, onDelete, itemIds }: ArticleCardProps) {
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Article Info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 leading-tight line-clamp-2">
              {article.name}
            </h3>
            <p className="text-xs text-slate-500 font-mono mt-1">
              {article.articleNumber}
            </p>
          </div>
          {quantityInProject > 0 && (
            <div className="shrink-0 bg-emerald-100 text-emerald-700 text-sm font-bold px-2 py-1 rounded-lg">
              {quantityInProject}x
            </div>
          )}
        </div>

        {/* Quick Add Buttons */}
        <div className="flex gap-2 mt-3">
          {!showQuickAdd ? (
            <>
              <Button
                onClick={() => { onAdd(article.id, 1); }}
                className="flex-1 h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
              >
                <Plus size={20} className="mr-1" />
                1x
              </Button>
              <Button
                onClick={() => { onAdd(article.id, 5); }}
                variant="outline"
                className="flex-1 h-12 border-slate-200 font-semibold"
              >
                +5
              </Button>
              <Button
                onClick={() => setShowQuickAdd(true)}
                variant="outline"
                className="h-12 w-12 border-slate-200"
                aria-label="Menge eingeben"
              >
                <span className="text-lg">⋯</span>
              </Button>
            </>
          ) : (
            <div className="flex gap-2 w-full">
              <Button
                onClick={() => setShowQuickAdd(false)}
                variant="ghost"
                className="h-12"
              >
                Abbrechen
              </Button>
              <input
                type="number"
                min="1"
                defaultValue="10"
                className="flex-1 h-12 text-center text-lg font-semibold border-2 border-slate-200 rounded-lg focus:border-emerald-500 focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const value = parseInt((e.target as HTMLInputElement).value, 10);
                    if (value > 0) {
                      onAdd(article.id, value);
                      setShowQuickAdd(false);
                    }
                  }
                }}
                autoFocus
              />
              <Button
                onClick={() => {
                  const input = document.querySelector('input[type="number"]') as HTMLInputElement;
                  const value = parseInt(input.value, 10);
                  if (value > 0) {
                    onAdd(article.id, value);
                    setShowQuickAdd(false);
                  }
                }}
                className="h-12 px-4 bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                OK
              </Button>
            </div>
          )}
        </div>

        {/* Quantity Adjustment for existing items */}
        {quantityInProject > 0 && itemIds.length > 0 && (
          <div className="flex items-center justify-center gap-3 mt-3 pt-3 border-t border-slate-100">
            <Button
              onClick={() => onUpdateQuantity(itemIds[0], -1)}
              variant="outline"
              size="sm"
              className="h-10 w-10 p-0 rounded-full border-slate-200"
            >
              <Minus size={16} />
            </Button>
            <span className="text-sm text-slate-500">Anpassen</span>
            <Button
              onClick={() => onUpdateQuantity(itemIds[0], 1)}
              variant="outline"
              size="sm"
              className="h-10 w-10 p-0 rounded-full border-slate-200"
            >
              <Plus size={16} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AufmassPage;
