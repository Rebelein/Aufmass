import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Article, Category, Supplier } from '@/lib/data';
import { subscribeToCategories, subscribeToArticles, subscribeToSuppliers } from '@/lib/catalog-storage';
import { useToast } from '@/hooks/use-toast';
import { getCurrentProjectId, getProjectById, syncProjectItems } from '@/lib/project-storage';
import type { Project, ProjectSelectedItem } from '@/lib/project-storage';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Star, Plus, Minus, FileDown, Menu, ChevronRight, Check, Package, Sparkles, Copy, FileSpreadsheet, BookMarked } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import { useHapticFeedback } from '@/hooks/use-haptic-feedback';
import { SwipeableItem } from '@/components/catalog/SwipeableItem';
import Fuse from 'fuse.js';
import { Search, X as CloseIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';

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
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [sheetViewCategoryId, setSheetViewCategoryId] = useState<string | null>(null);
  const [favoriteCategories, setFavoriteCategories] = useState<Set<string>>(new Set());
  const [recentCategories, setRecentCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const navigate = useNavigate();
  const { impactMedium, impactLight } = useHapticFeedback();

  // Fuzzy Search Index
  const fuse = useMemo(() => new Fuse(articlesData, {
    keys: ['name', 'articleNumber'],
    threshold: 0.35,
    distance: 100,
    ignoreLocation: true
  }), [articlesData]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return fuse.search(searchQuery).map(r => r.item);
  }, [searchQuery, fuse]);

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
    // Priority 1: Fuzzy Search Results
    if (searchQuery.trim()) {
        return searchResults;
    }

    // Priority 2: Category Filtering
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
}, [articlesData, selectedCategoryId, searchQuery, searchResults, categories]);

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
    impactMedium();
    toast({ title: "Hinzugefügt", description: `${quantity}x ${article.name}` });
    setRecentCategories(prev => { const filtered = prev.filter(id => id !== selectedCategoryId); return [selectedCategoryId!, ...filtered].slice(0, 5); });
  }, [currentProject, articlesData, selectedCategoryId, toast]);

  const handleUpdateItemQuantity = (itemId: string, delta: number) => {
    if (!currentProject) return;
    impactMedium();
    updateProjectItems(currentProject.selectedItems.map(item => item.id === itemId ? { ...item, quantity: Math.max(0, (item.quantity || 0) + delta) } : item).filter(item => (item.quantity || 0) > 0));
  };

  const handleDeleteItem = (itemId: string) => {
    if (!currentProject) return;
    updateProjectItems(currentProject.selectedItems.filter(i => i.id !== itemId));
  };

  const handleExportCsv = () => {
    if (!currentProject || processedSummaryItems.length === 0) return;
    
    // Header
    let csvContent = "Menge;Artikelnummer;Bezeichnung\n";
    
    // Items
    processedSummaryItems.forEach(item => {
      if (item.type === 'article') {
        const qty = item.quantity || 0;
        const artNum = item.article?.articleNumber || "";
        const name = item.article?.name || "";
        // Excel-friendly CSV with semicolon
        csvContent += `${qty};${artNum};${name}\n`;
      }
    });

    // Create Blob and Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `aufmass_${currentProject.name}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    impactMedium();
    toast({ title: "CSV exportiert", description: `Datei wurde gespeichert.` });
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

  const renderCategoryTree = (parentId: string | null = null, level = 0) => {
    const currentCategories = categories
      .filter(c => c.parentId === parentId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    if (currentCategories.length === 0) return null;

    return (
      <Accordion type="single" collapsible className="w-full space-y-1">
        {currentCategories.map(category => {
          const subCategories = categories.filter(c => c.parentId === category.id);
          const hasSubCategories = subCategories.length > 0;

          const content = (
            <div className={cn(
              "flex-1 flex items-center gap-3 py-3 px-4 rounded-xl transition-all text-left",
              selectedCategoryId === category.id 
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                : "hover:bg-white/5 text-white/70 hover:text-white"
            )}>
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden shadow-inner",
                selectedCategoryId === category.id ? "bg-emerald-500/20" : "bg-white/5"
              )}>
                {category.imageUrl ? (
                  <img src={category.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  hasSubCategories ? <Menu size={16} className={selectedCategoryId === category.id ? "text-emerald-400" : "text-white/30"} /> : <Package size={16} className={selectedCategoryId === category.id ? "text-emerald-400" : "text-white/30"} />
                )}
              </div>
              <span className="font-medium truncate flex-1">{category.name}</span>
              {hasSubCategories && <ChevronRight size={14} className="text-white/20 group-data-[state=open]:rotate-90 transition-transform" />}
            </div>
          );

          return (
            <AccordionItem key={category.id} value={category.id} className="border-none">
              {hasSubCategories ? (
                <AccordionTrigger className="w-full p-0 hover:no-underline group">
                  {content}
                </AccordionTrigger>
              ) : (
                <div onClick={() => handleSelectCategory(category.id)} className="cursor-pointer">
                  {content}
                </div>
              )}
              {hasSubCategories && (
                <AccordionContent className="pt-1 pb-1 ml-4 border-l border-white/10 pl-2">
                  {renderCategoryTree(category.id, level + 1)}
                </AccordionContent>
              )}
            </AccordionItem>
          );
        })}
      </Accordion>
    );
  };

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
                <h1 className="font-semibold text-white truncate max-w-[150px] sm:max-w-[300px]">{currentProject.name}</h1>
                <p className="text-xs text-white/50">{articleCount} Artikel erfasst</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Sheet open={isCategorySheetOpen} onOpenChange={setIsCategorySheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="secondary" className="ios-button-secondary gap-2 px-4">
                    <Menu size={18} className="text-emerald-400" />
                    <span className="hidden sm:inline">Katalog</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[85vw] sm:w-[400px] rounded-r-3xl border-r border-white/10 bg-slate-900/95 backdrop-blur-xl flex flex-col p-0">
                  <SheetHeader className="p-6 pb-4 border-b border-white/5 shrink-0">
                    <SheetTitle className="text-left text-xl text-gradient-emerald flex items-center gap-2">
                      <BookMarked size={20} className="text-emerald-400" /> Artikelkatalog
                    </SheetTitle>
                  </SheetHeader>
                  <div className="overflow-y-auto p-4 flex-1">
                    <div className="space-y-4">
                      <div className="px-2">
                        <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-4">Struktur</h3>
                        {renderCategoryTree()}
                      </div>
                    </div>
                  </div>
                  <div className="p-6 border-t border-white/5 bg-white/[0.02]">
                    <Button 
                      variant="ghost" 
                      onClick={() => { setSelectedCategoryId(null); setIsCategorySheetOpen(false); }}
                      className="w-full text-white/50 hover:text-white"
                    >
                      Filter zurücksetzen
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </header>

        {/* Search Bar */}
        <div className="p-4 bg-white/5 border-b border-white/10 shrink-0">
          <div className="relative group max-w-2xl mx-auto">
            <Search className={cn(
              "absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300",
              searchQuery ? "text-emerald-400" : "text-white/30"
            )} size={22} />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Artikel oder Nummer suchen..."
              className="h-14 pl-12 pr-12 glass-input text-lg border-white/5 group-hover:border-emerald-500/30 transition-all duration-300"
            />
            {searchQuery && (
              <button 
                onClick={() => { setSearchQuery(''); impactLight(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-xl text-white/30 hover:text-white hover:bg-white/10 transition-all"
              >
                <CloseIcon size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 p-4 pb-28 overflow-y-auto">
          <div className="max-w-3xl mx-auto space-y-6">
            {searchQuery ? (
              // Search Results View
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.2em]">Suchergebnisse ({filteredArticles.length})</h3>
                </div>
                {filteredArticles.length === 0 ? (
                  <div className="text-center py-16 ios-card">
                    <Search size={36} className="text-white/20 mx-auto mb-4" />
                    <p className="text-white/40 font-medium">Kein Material gefunden</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {filteredArticles.map(article => {
                      const quantityInProject = processedSummaryItems.filter(i => i.type === 'article' && i.article_id === article.id).reduce((sum, i) => sum + (i.quantity || 0), 0);
                      const cat = categories.find(c => c.id === article.categoryId);
                      return (
                        <ArticleCard key={article.id} article={article} quantityInProject={quantityInProject}
                          onAdd={handleDirectAddArticle} onUpdateQuantity={handleUpdateItemQuantity}
                          onDelete={handleDeleteItem} itemIds={processedSummaryItems.filter(i => i.type === 'article' && i.article_id === article.id).map(i => i.id)}
                          categoryImageUrl={cat?.imageUrl} />
                      );
                    })}
                  </div>
                )}
              </div>
            ) : selectedCategoryId ? (
              // Category View
              <div className="space-y-4">
                <div className="px-1">
                  <div className="space-y-1">
                    <h2 className="text-2xl font-bold text-white">{selectedCategory?.name}</h2>
                    <p className="text-xs text-white/40 uppercase tracking-widest">Kategorie</p>
                  </div>
                </div>
                
                {filteredArticles.length === 0 ? (
                  <div className="text-center py-16 ios-card">
                    <Package size={36} className="text-white/20 mx-auto mb-4" />
                    <p className="text-white/40 font-medium">Kein Material in dieser Kategorie</p>
                    <Button variant="link" onClick={() => setIsCategorySheetOpen(true)} className="text-emerald-400 mt-2">
                      Katalog öffnen
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {filteredArticles.map(article => {
                      const quantityInProject = processedSummaryItems.filter(i => i.type === 'article' && i.article_id === article.id).reduce((sum, i) => sum + (i.quantity || 0), 0);
                      const cat = categories.find(c => c.id === article.categoryId);
                      return (
                        <ArticleCard key={article.id} article={article} quantityInProject={quantityInProject}
                          onAdd={handleDirectAddArticle} onUpdateQuantity={handleUpdateItemQuantity}
                          onDelete={handleDeleteItem} itemIds={processedSummaryItems.filter(i => i.type === 'article' && i.article_id === article.id).map(i => i.id)}
                          categoryImageUrl={cat?.imageUrl} />
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              // Empty State (No Category Selected)
              <div className="text-center py-20">
                <div className="w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center mb-6 border border-white/5">
                  <BookMarked size={40} className="text-emerald-400/50" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Bereit zum Erfassen</h2>
                <p className="text-white/40 max-w-[280px] mx-auto mb-8">
                  Wählen Sie eine Kategorie aus dem Katalog, um Material hinzuzufügen.
                </p>
                <Button onClick={() => setIsCategorySheetOpen(true)} className="glass-button px-8 h-14 text-lg">
                  Katalog öffnen
                </Button>
              </div>
            )}
          </div>
        </main>

        {/* Sticky Bottom Summary */}
        <Sheet open={isSummaryOpen} onOpenChange={setIsSummaryOpen}>
          <div className="fixed bottom-0 left-0 right-0 z-40 glass-nav border-t border-white/10">
            <div className="flex items-center justify-between p-4">
              <SheetTrigger asChild>
                <div className="flex items-center gap-3 cursor-pointer hover:bg-white/5 p-2 -m-2 rounded-2xl transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg">
                    <Package size={22} className="text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-white text-lg">{articleCount}</p>
                    <p className="text-xs text-white/50">Artikel im Aufmaß</p>
                  </div>
                </div>
              </SheetTrigger>
              <Button onClick={handleGeneratePdf} disabled={articleCount === 0} className="glass-button text-lg">
                <FileDown size={20} className="mr-2" /> PDF
              </Button>
            </div>
          </div>

          <SheetContent side="bottom" className="h-[85vh] rounded-t-[2.5rem] border-t border-white/10 bg-slate-900/95 backdrop-blur-xl flex flex-col p-0">
            <SheetHeader className="p-6 pb-4 border-b border-white/5 shrink-0">
              <SheetTitle className="text-left text-xl text-gradient-emerald">Aktuelles Aufmaß</SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto p-4 flex-1">
              {processedSummaryItems.length === 0 ? (
                <div className="text-center py-20 text-white/40">Keine Artikel im Aufmaß</div>
              ) : (
                <div className="space-y-1">
                  {processedSummaryItems.map((item) => (
                    <SwipeableItem key={item.id} id={item.id} onDelete={() => handleDeleteItem(item.id)}>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">{item.article?.name || item.text || 'Unbekannt'}</p>
                          <div className="flex items-center gap-2">
                             <p className="text-xs text-white/40 font-mono">{item.article?.articleNumber || 'Keine Art.-Nr.'}</p>
                             {item.article?.articleNumber && (
                               <button 
                                 onClick={async (e) => { 
                                   e.stopPropagation(); 
                                   await navigator.clipboard.writeText(item.article!.articleNumber!);
                                   impactLight();
                                   toast({ title: "Kopiert", description: item.article!.articleNumber });
                                 }}
                                 className="text-white/20 hover:text-white p-1"
                               >
                                 <Copy size={12} />
                               </button>
                             )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <Button 
                            onClick={(e) => { e.stopPropagation(); handleUpdateItemQuantity(item.id, -1); }} 
                            variant="ghost" size="icon" className="h-9 w-9 bg-white/5 hover:bg-white/10"
                          >
                            <Minus size={16} />
                          </Button>
                          <span className="text-white font-bold w-8 text-center">{item.quantity}</span>
                          <Button 
                            onClick={(e) => { e.stopPropagation(); handleUpdateItemQuantity(item.id, 1); }} 
                            variant="ghost" size="icon" className="h-9 w-9 bg-white/5 hover:bg-white/10"
                          >
                            <Plus size={16} />
                          </Button>
                        </div>
                      </div>
                    </SwipeableItem>
                  ))}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-white/5 shrink-0 bg-white/[0.02] space-y-3">
               <div className="grid grid-cols-2 gap-3">
                 <Button onClick={handleGeneratePdf} disabled={articleCount === 0} className="w-full h-16 text-lg glass-button">
                   <FileDown size={22} className="mr-2" /> PDF
                 </Button>
                 <Button onClick={handleExportCsv} disabled={articleCount === 0} className="w-full h-16 text-lg ios-button-secondary border-emerald-500/30 text-emerald-400">
                   <FileSpreadsheet size={22} className="mr-2" /> CSV
                 </Button>
               </div>
            </div>
          </SheetContent>
        </Sheet>
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
  categoryImageUrl?: string;
}

function ArticleCard({ article, quantityInProject, onAdd, onUpdateQuantity, onDelete, itemIds, categoryImageUrl }: ArticleCardProps) {
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const { impactLight } = useHapticFeedback();

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!article.articleNumber) return;
    try {
      await navigator.clipboard.writeText(article.articleNumber);
      setCopied(true);
      impactLight();
      toast({ title: "Artikelnummer kopiert", description: article.articleNumber });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed', err);
    }
  };

  return (
    <div className="ios-card overflow-hidden">
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Article Image (from Category) */}
          <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
            {categoryImageUrl ? (
              <img src={categoryImageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <Package size={24} className="text-white/10" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white leading-tight line-clamp-2">{article.name}</h3>
                {article.articleNumber && (
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-white/40 font-mono">Art.-Nr: {article.articleNumber}</p>
                    <button 
                      onClick={handleCopy}
                      className={cn(
                        "p-1 rounded-md transition-all",
                        copied ? "text-emerald-400 bg-emerald-500/10" : "text-white/20 hover:text-white hover:bg-white/10"
                      )}
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  </div>
                )}
              </div>
              {quantityInProject > 0 && (
                <div className="shrink-0 bg-gradient-to-br from-emerald-500 to-teal-500 text-white text-sm font-bold px-3 py-1.5 rounded-lg shadow-lg">
                  {quantityInProject}x
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Add Buttons */}
        <div className="flex gap-2 mt-4">
          {!showQuickAdd ? (
            <>
              <Button size="lg" onClick={() => onAdd(article.id, 1)} className="flex-1 ios-button text-lg font-bold">
                <Plus size={22} className="mr-1" /> 1x
              </Button>
              <Button size="lg" onClick={() => onAdd(article.id, 5)} className="flex-1 ios-button-secondary text-lg font-semibold">
                +5
              </Button>
              <Button size="icon" onClick={() => setShowQuickAdd(true)} className="ios-button-secondary" aria-label="Menge eingeben">
                <span className="text-xl">⋯</span>
              </Button>
            </>
          ) : (
            <div className="flex gap-2 w-full">
              <Button size="lg" onClick={() => setShowQuickAdd(false)} className="ios-button-secondary">Abbr.</Button>
              <input type="number" min="1" defaultValue="10"
                className="flex-1 h-14 text-center text-lg font-bold glass-input"
                onKeyDown={(e) => { if (e.key === 'Enter') { const value = parseInt((e.target as HTMLInputElement).value, 10); if (value > 0) { onAdd(article.id, value); setShowQuickAdd(false); } }}}
                autoFocus />
              <Button size="lg" onClick={() => { const input = document.querySelector('input[type="number"]') as HTMLInputElement; const value = parseInt(input.value, 10); if (value > 0) { onAdd(article.id, value); setShowQuickAdd(false); }}}
                className="glass-button px-6">OK</Button>
            </div>
          )}
        </div>

        {/* Quantity Adjustment */}
        {quantityInProject > 0 && itemIds.length > 0 && (
          <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-white/10">
            <Button size="icon" onClick={() => onUpdateQuantity(itemIds[0], -1)} className="rounded-xl ios-button-secondary">
              <Minus size={20} />
            </Button>
            <span className="text-sm font-bold text-white/50 uppercase tracking-widest">Anpassen</span>
            <Button size="icon" onClick={() => onUpdateQuantity(itemIds[0], 1)} className="rounded-xl ios-button-secondary">
              <Plus size={20} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AufmassPage;
