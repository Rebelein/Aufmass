import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Article, Category, Supplier } from '@/lib/data';
import { subscribeToCategories, subscribeToArticles, subscribeToSuppliers } from '@/lib/catalog-storage';
import { useToast } from '@/hooks/use-toast';
import { getCurrentProjectId, getProjectById, syncProjectItems } from '@/lib/project-storage';
import type { Project, ProjectSelectedItem } from '@/lib/project-storage';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Star, Plus, Minus, FileDown, Menu, ChevronRight, Check, Package, Sparkles } from 'lucide-react';
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
  const [sheetViewCategoryId, setSheetViewCategoryId] = useState<string | null>(null);
  const [favoriteCategories, setFavoriteCategories] = useState<Set<string>>(new Set());
  const [recentCategories, setRecentCategories] = useState<string[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const projectId = getCurrentProjectId();
    if (!projectId) { navigate.replace('/projects'); return; }

    let isMounted = true;
    const unsubscribeCategories = subscribeToCategories((cats) => { if (isMounted) setCategories(cats); });
    const unsubscribeArticles = subscribeToArticles((arts) => { if (isMounted) setArticlesData(arts); });
    const unsubscribeSuppliers = subscribeToSuppliers((supps) => { if (isMounted) setSuppliers(supps); });

    const loadProject = async () => {
      const project = await getProjectById(projectId);
      if (!project) { navigate.replace('/projects'); return; }
      if (isMounted) { setCurrentProject(project); setIsLoadingData(false); }
    };
    loadProject();

    return () => {
      isMounted = false;
      unsubscribeCategories();
      unsubscribeArticles();
      unsubscribeSuppliers();
    };
  }, [navigate]);

  useEffect(() => {
    if (categories.length > 0 && !selectedCategoryId) {
      const firstTopLevelCategory = categories.filter(c => !c.parentId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
      if (firstTopLevelCategory) setSelectedCategoryId(firstTopLevelCategory.id);
    }
  }, [categories, selectedCategoryId]);

  const selectedCategory = useMemo(() => categories.find(c => c.id === selectedCategoryId), [categories, selectedCategoryId]);

const filteredArticles = useMemo(() => {
    if (!selectedCategoryId) return [];
    
    // Check if selected category has subcategories
    const subcategories = categories.filter(cat => cat.parentId === selectedCategoryId);
    
    // If it has subcategories, show articles from those subcategories
    if (subcategories.length > 0) {
        const subcategoryIds = subcategories.map(subcat => subcat.id);
        return articlesData.filter((article) => subcategoryIds.includes(article.categoryId)).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    
    // Otherwise show articles directly in this category
    return articlesData.filter((article) => article.categoryId === selectedCategoryId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
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
      type: 'article', id: crypto.randomUUID(), project_id: currentProject.id,
      order: currentProject.selectedItems.length, article_id: articleId, quantity,
    };
    updateProjectItems([...currentProject.selectedItems, newItem]);
    if (navigator.vibrate) navigator.vibrate(50);
    toast({ title: "Hinzugefügt", description: `${quantity}x ${article.name}` });
    setRecentCategories(prev => { const filtered = prev.filter(id => id !== selectedCategoryId); return [selectedCategoryId!, ...filtered].slice(0, 5); });
  }, [currentProject, articlesData, selectedCategoryId, toast]);

  const handleUpdateItemQuantity = (itemId: string, delta: number) => {
    if (!currentProject) return;
    updateProjectItems(currentProject.selectedItems.map(item => item.id === itemId ? { ...item, quantity: Math.max(0, (item.quantity || 0) + delta) } : item).filter(item => (item.quantity || 0) > 0));
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
    } catch (error) { console.error("PDF error:", error); }
  };

  const handleSelectCategory = (categoryId: string) => { 
    setSelectedCategoryId(categoryId); 
    setIsCategorySheetOpen(false); 
    setSheetViewCategoryId(null);
  };

  const toggleFavorite = (categoryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavoriteCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) { next.delete(categoryId); } else { next.add(categoryId); }
      return next;
    });
  };

  const topLevelCategories = categories.filter(c => !c.parentId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const favoriteCategoriesList = topLevelCategories.filter(c => favoriteCategories.has(c.id));

  if (isLoadingData || !currentProject) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center animate-pulse">
            <Sparkles className="w-8 h-8 text-emerald-400" />
          </div>
          <p className="text-white/50 font-medium">Projekt wird geladen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      {/* Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="orb orb-emerald w-64 h-64 -top-10 right-20" style={{ animationDelay: '0s' }} />
        <div className="orb orb-teal w-48 h-48 bottom-40 -left-10" style={{ animationDelay: '-2s' }} />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Sticky Header */}
        <header className="glass-nav sticky top-0 z-40">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/projects')} className="p-2.5 -ml-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all">
                <ChevronLeft size={24} />
              </button>
              <div>
                <h1 className="font-semibold text-white truncate max-w-[200px]">{currentProject.name}</h1>
                <p className="text-xs text-white/50">{articleCount} Artikel</p>
              </div>
            </div>

            <Sheet open={isCategorySheetOpen} onOpenChange={setIsCategorySheetOpen}>
              <SheetTrigger asChild>
                <Button className="ios-button-secondary gap-2">
                  <Menu size={18} className="text-emerald-400" />
                  <span className="font-medium">{selectedCategory?.name || 'Kategorie'}</span>
                  <ChevronRight size={16} className="text-white/50" />
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl border-t border-white/10 bg-slate-900/95 backdrop-blur-xl flex flex-col p-0">
                <SheetHeader className="p-6 pb-4 border-b border-white/5 shrink-0">
                  <div className="flex items-center gap-3">
                    {sheetViewCategoryId && (
                      <button onClick={() => {
                        const parent = categories.find(c => c.id === sheetViewCategoryId)?.parentId;
                        setSheetViewCategoryId(parent || null);
                      }} className="p-2 -ml-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all">
                        <ChevronLeft size={20} />
                      </button>
                    )}
                    <SheetTitle className="text-left text-xl text-gradient-emerald">
                      {sheetViewCategoryId ? categories.find(c => c.id === sheetViewCategoryId)?.name : 'Kategorien'}
                    </SheetTitle>
                  </div>
                </SheetHeader>
                <div className="overflow-y-auto p-6 flex-1 space-y-6">
{/* Favorites */}
                   {!sheetViewCategoryId && favoriteCategoriesList.length > 0 && (
                     <div>
                       <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3 flex items-center gap-2">
                         <Star size={14} className="text-amber-400" /> Favoriten
                       </h3>
                       <div className="grid grid-cols-2 gap-2">
                         {favoriteCategoriesList.map(category => {
                           const subcategories = categories.filter(cat => cat.parentId === category.id);
                           const hasSubcategories = subcategories.length > 0;
                           return (
                           <div key={category.id} className="relative">
                             <button onClick={() => {
                               if (hasSubcategories) {
                                 setSheetViewCategoryId(category.id);
                               } else {
                                 handleSelectCategory(category.id);
                               }
                             }}
                               className={cn("p-4 rounded-xl border text-left transition-all w-full",
                                 selectedCategoryId === category.id ? "border-emerald-500 bg-emerald-500/20" : "border-white/10 bg-white/5 hover:bg-white/10")}>
                               <span className="font-medium text-white">{category.name}</span>
                             </button>
                             <button onClick={(e) => {
                                   e.stopPropagation();
                                   toggleFavorite(category.id, e);
                                 }}
                                 className={cn("absolute top-3 right-3 p-1 rounded-full", favoriteCategories.has(category.id) ? "text-amber-400" : "text-white/30 hover:text-amber-400")}>
                                 <Star size={16} fill={favoriteCategories.has(category.id) ? "currentColor" : "none"} />
                               </button>
                           </div>
                           );
                         })}
                       </div>
                     </div>
                   )}

                  {/* Recent */}
                  {!sheetViewCategoryId && recentCategories.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Zuletzt verwendet</h3>
                      <div className="flex flex-wrap gap-2">
{recentCategories.map(catId => {
  const cat = categories.find(c => c.id === catId);
  return cat ? (
    <div key={cat.id} onClick={() => {
      const subs = categories.filter(c => c.parentId === cat.id);
      if (subs.length > 0) setSheetViewCategoryId(cat.id);
      else handleSelectCategory(cat.id);
    }}
      className="px-4 py-2 rounded-full bg-white/10 text-white/70 text-sm font-medium hover:bg-white/20 cursor-pointer">
      {cat.name}
    </div>
  ) : null;
})}
                      </div>
                    </div>
                  )}

{/* Categories List */}
                    <div>
                      <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
                        {sheetViewCategoryId ? 'Unterkategorien' : 'Alle Kategorien'}
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        {(sheetViewCategoryId ? categories.filter(c => c.parentId === sheetViewCategoryId).sort((a,b)=>(a.order??0)-(b.order??0)) : topLevelCategories).map(category => {
                          const subcategories = categories.filter(cat => cat.parentId === category.id);
                          const hasSubcategories = subcategories.length > 0;
                          
                          return (
                            <div key={category.id} className="relative">
                              <button onClick={() => {
                                    if (hasSubcategories) {
                                      setSheetViewCategoryId(category.id);
                                    } else {
                                      handleSelectCategory(category.id);
                                    }
                                  }}
                                className={cn("p-4 rounded-xl border text-left transition-all relative w-full",
                                  selectedCategoryId === category.id ? "border-emerald-500 bg-emerald-500/20" : "border-white/10 bg-white/5 hover:bg-white/10")}>
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-white">{category.name}</span>
                                  {hasSubcategories && (
                                    <ChevronRight size={14} className="text-white/40" />
                                  )}
                                </div>
                              </button>
                              <button onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFavorite(category.id, e);
                                }}
                                className={cn("absolute top-3 right-3 p-1 rounded-full", favoriteCategories.has(category.id) ? "text-amber-400" : "text-white/30 hover:text-amber-400")}>
                                <Star size={16} fill={favoriteCategories.has(category.id) ? "currentColor" : "none"} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 pb-28 overflow-y-auto">
          {filteredArticles.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center mb-4">
                <Package size={36} className="text-emerald-400" />
              </div>
              <p className="text-white/70 font-semibold text-lg">Keine Artikel</p>
              <p className="text-white/40 text-sm mt-1">Wählen Sie eine andere Kategorie</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredArticles.map(article => {
                const quantityInProject = processedSummaryItems.filter(i => i.type === 'article' && i.article_id === article.id).reduce((sum, i) => sum + (i.quantity || 0), 0);
                return (
                  <ArticleCard key={article.id} article={article} quantityInProject={quantityInProject}
                    onAdd={handleDirectAddArticle} onUpdateQuantity={handleUpdateItemQuantity}
                    onDelete={handleDeleteItem} itemIds={processedSummaryItems.filter(i => i.type === 'article' && i.article_id === article.id).map(i => i.id)} />
                );
              })}
            </div>
          )}
        </main>

        {/* Sticky Bottom Summary */}
        <div className="fixed bottom-0 left-0 right-0 z-40 glass-nav border-t border-white/10">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg">
                <Package size={22} className="text-white" />
              </div>
              <div>
                <p className="font-semibold text-white text-lg">{articleCount}</p>
                <p className="text-xs text-white/50">Artikel im Aufmaß</p>
              </div>
            </div>
            <Button onClick={handleGeneratePdf} disabled={articleCount === 0} className="glass-button text-lg">
              <FileDown size={20} className="mr-2" /> PDF
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Article Card Component
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
    <div className="ios-card overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white leading-tight line-clamp-2">{article.name}</h3>
            {article.articleNumber && (
               <p className="text-xs text-white/40 font-mono mt-1">Art.-Nr: {article.articleNumber}</p>
            )}
          </div>
          {quantityInProject > 0 && (
            <div className="shrink-0 bg-gradient-to-br from-emerald-500 to-teal-500 text-white text-sm font-bold px-3 py-1.5 rounded-lg shadow-lg">
              {quantityInProject}x
            </div>
          )}
        </div>

        {/* Quick Add Buttons */}
        <div className="flex gap-2 mt-4">
          {!showQuickAdd ? (
            <>
              <Button onClick={() => onAdd(article.id, 1)} className="flex-1 h-14 ios-button text-lg font-bold">
                <Plus size={22} className="mr-1" /> 1x
              </Button>
              <Button onClick={() => onAdd(article.id, 5)} className="flex-1 h-14 ios-button-secondary text-lg font-semibold">
                +5
              </Button>
              <Button onClick={() => setShowQuickAdd(true)} className="h-14 w-14 ios-button-secondary" aria-label="Menge eingeben">
                <span className="text-xl">⋯</span>
              </Button>
            </>
          ) : (
            <div className="flex gap-2 w-full">
              <Button onClick={() => setShowQuickAdd(false)} className="ios-button-secondary h-14">Abbrechen</Button>
              <input type="number" min="1" defaultValue="10"
                className="flex-1 h-14 text-center text-lg font-bold glass-input"
                onKeyDown={(e) => { if (e.key === 'Enter') { const value = parseInt((e.target as HTMLInputElement).value, 10); if (value > 0) { onAdd(article.id, value); setShowQuickAdd(false); } }}}
                autoFocus />
              <Button onClick={() => { const input = document.querySelector('input[type="number"]') as HTMLInputElement; const value = parseInt(input.value, 10); if (value > 0) { onAdd(article.id, value); setShowQuickAdd(false); }}}
                className="h-14 px-5 glass-button">OK</Button>
            </div>
          )}
        </div>

        {/* Quantity Adjustment */}
        {quantityInProject > 0 && itemIds.length > 0 && (
          <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-white/10">
            <Button onClick={() => onUpdateQuantity(itemIds[0], -1)} className="h-11 w-11 rounded-xl ios-button-secondary p-0">
              <Minus size={18} />
            </Button>
            <span className="text-sm text-white/50">Anpassen</span>
            <Button onClick={() => onUpdateQuantity(itemIds[0], 1)} className="h-11 w-11 rounded-xl ios-button-secondary p-0">
              <Plus size={18} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AufmassPage;
