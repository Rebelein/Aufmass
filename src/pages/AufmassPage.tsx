import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Article, Category } from '@/lib/data';
import { subscribeToCategories, subscribeToArticles, subscribeToSuppliers } from '@/lib/catalog-storage';
import { useToast } from '@/hooks/use-toast';
import {
  getCurrentProjectId, getProjectById,
  upsertProjectItem, deleteProjectItem, updateProjectItemQuantity, addSection
} from '@/lib/project-storage';
import type { Project, ProjectSelectedItem } from '@/lib/project-storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ChevronLeft, FileDown, Menu, Package, Sparkles,
  FileSpreadsheet, BookMarked, Search, X as CloseIcon,
  PenLine
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn, generateUUID } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/use-haptic-feedback';
import { motion } from 'framer-motion';
import { CsvExportDialog } from '@/components/dialogs/CsvExportDialog';
import type { ProcessedSummaryItem } from '@/lib/types';
import Fuse from 'fuse.js';
import { generateAufmassPdf } from '@/lib/pdf-export';
import { generateAngebotPdf } from '@/lib/pdf-export-angebot';
import { ArticleCard } from '@/components/aufmass/ArticleCard';
import { SectionBar } from '@/components/aufmass/SectionBar';
import { SummaryList } from '@/components/aufmass/SummaryList';
import { CategoryTree } from '@/components/catalog/CategoryTree';
import { AngebotTool } from '@/components/aufmass/AngebotTool';

// --- Main Page ---

const AufmassPage = () => {
  const [articlesData, setArticlesData] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [viewMode, setViewMode] = useState<'aufmass' | 'angebot'>('angebot');
  const [isCategorySheetOpen, setIsCategorySheetOpen] = useState(false);
  const [isCatalogDrawerOpen, setIsCatalogDrawerOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [isCsvExportDialogOpen, setIsCsvExportDialogOpen] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualQty, setManualQty] = useState('1');
  const [manualUnit, setManualUnit] = useState('');
  const [manualArticleNumber, setManualArticleNumber] = useState('');

  const { toast } = useToast();
  const navigate = useNavigate();
  const { impactMedium, impactLight } = useHapticFeedback();

  // Fuzzy search
  const fuse = useMemo(() => new Fuse(articlesData, {
    keys: ['name', 'articleNumber'],
    threshold: 0.35,
    distance: 100,
    ignoreLocation: true,
  }), [articlesData]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return fuse.search(searchQuery).map(r => r.item);
  }, [searchQuery, fuse]);

  // Load project & catalog
  useEffect(() => {
    const projectId = getCurrentProjectId();
    if (!projectId) { navigate('/'); return; }

    let isMounted = true;
    const unsubCats = subscribeToCategories(cats => { if (isMounted) setCategories(cats); });
    const unsubArts = subscribeToArticles(arts => { if (isMounted) setArticlesData(arts); });
    const unsubSupps = subscribeToSuppliers(() => {});

    const load = async () => {
      const project = await getProjectById(projectId);
      if (!project) { navigate('/'); return; }
      if (isMounted) { setCurrentProject(project); setIsLoadingData(false); }
    };
    load();

    return () => {
      isMounted = false;
      unsubCats(); unsubArts(); unsubSupps();
    };
  }, [navigate]);

  // Auto-select first category
  useEffect(() => {
    if (categories.length > 0 && !activeCategoryId) {
      setActiveCategoryId(categories.find(c => c.parentId === null)?.id || null);
    }
  }, [categories, activeCategoryId]);

    // Force view mode if not in planning
    useEffect(() => {
      if (currentProject && currentProject.status !== 'planning') {
        setViewMode('aufmass');
      } else if (currentProject && currentProject.status === 'planning' && !viewMode) {
        setViewMode('angebot');
      }
    }, [currentProject?.status]);

  const activeCategory = useMemo(() =>
    categories.find(c => c.id === activeCategoryId), [categories, activeCategoryId]);

  const toggleCategoryExpansion = (categoryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId); else next.add(categoryId);
      return next;
    });
  };

  // Expand category hierarchy logic mostly handles finding subsets based on search.
  const searchExpandedIds = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const ids = new Set<string>();
    searchResults.forEach(art => {
      let currentId = art.categoryId;
      while (currentId) {
        ids.add(currentId);
        const parentId = categories.find(c => c.id === currentId)?.parentId;
        if (parentId) ids.add(parentId);
        currentId = parentId || null;
      }
    });
    return Array.from(ids);
  }, [searchResults, categories, searchQuery]);

  const viewArticles = useMemo(() => {
    if (searchQuery.trim().length > 0) return searchResults;
    if (!activeCategoryId) return [];
    
    // Get current cat + subcats
    const subcats = categories.filter(c => c.parentId === activeCategoryId);
    const validIds = [activeCategoryId, ...subcats.map(c => c.id)];
    
    return articlesData.filter(a => a.categoryId && validIds.includes(a.categoryId)).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [articlesData, activeCategoryId, searchQuery, searchResults, categories]);

  const sections = useMemo(() =>
    (currentProject?.selectedItems ?? []).filter(i => i.type === 'section')
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [currentProject]);

  const processedSummaryItems: ProcessedSummaryItem[] = useMemo(() => {
    if (!currentProject) return [];
    return currentProject.selectedItems.map(item => {
      if (item.type === 'article' && item.article_id) {
        const articleDetail = articlesData.find(a => a.id === item.article_id);
        return { ...item, article: articleDetail };
      }
      return item as ProcessedSummaryItem;
    }).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [currentProject, articlesData]);

  const totalArticleCount = useMemo(() =>
    processedSummaryItems.filter(i => i.type === 'article').reduce((s, i) => s + (i.quantity ?? 0), 0),
    [processedSummaryItems]);

  // Returns quantity of an article in the ACTIVE section
  const getQuantityInSection = useCallback((articleId: string): number => {
    if (!currentProject) return 0;
    return currentProject.selectedItems
      .filter(i => i.type === 'article' && i.article_id === articleId && i.section_id === activeSectionId)
      .reduce((s, i) => s + (i.quantity ?? 0), 0);
  }, [currentProject, activeSectionId]);

  // Returns the item (if any) for an article in the ACTIVE section
  const getItemInSection = useCallback((articleId: string): ProjectSelectedItem | undefined => {
    if (!currentProject) return undefined;
    return currentProject.selectedItems.find(
      i => i.type === 'article' && i.article_id === articleId && i.section_id === activeSectionId
    );
  }, [currentProject, activeSectionId]);

  // Update local state optimistically
  const updateLocalItem = useCallback((updatedItem: ProjectSelectedItem) => {
    setCurrentProject(prev => {
      if (!prev) return prev;
      const exists = prev.selectedItems.find(i => i.id === updatedItem.id);
      if (exists) {
        return { ...prev, selectedItems: prev.selectedItems.map(i => i.id === updatedItem.id ? updatedItem : i) };
      }
      return { ...prev, selectedItems: [...prev.selectedItems, updatedItem] };
    });
  }, []);

  const removeLocalItem = useCallback((itemId: string) => {
    setCurrentProject(prev => {
      if (!prev) return prev;
      return { ...prev, selectedItems: prev.selectedItems.filter(i => i.id !== itemId) };
    });
  }, []);

  // Increment article in active section
  const handleIncrement = useCallback(async (article: Article) => {
    if (!currentProject) return;
    impactMedium();

    const existing = getItemInSection(article.id);

    if (existing) {
      const newQty = (existing.quantity ?? 0) + 1;
      // Optimistic update
      updateLocalItem({ ...existing, quantity: newQty });
      const ok = await updateProjectItemQuantity(existing.id, newQty);
      if (!ok) {
        updateLocalItem(existing); // rollback
        toast({ title: 'Fehler', description: 'Menge konnte nicht gespeichert werden.', variant: 'destructive' });
      }
    } else {
      const newItem: ProjectSelectedItem = {
        id: generateUUID(),
        project_id: currentProject.id,
        type: 'article',
        order: currentProject.selectedItems.length,
        article_id: article.id,
        quantity: 1,
        section_id: activeSectionId ?? null,
      };
      // Optimistic update
      updateLocalItem(newItem);
      const saved = await upsertProjectItem(newItem);
      if (!saved) {
        removeLocalItem(newItem.id);
        toast({ title: 'Fehler', description: 'Artikel konnte nicht hinzugefügt werden.', variant: 'destructive' });
      }
    }
  }, [currentProject, activeSectionId, getItemInSection, updateLocalItem, removeLocalItem, impactMedium, toast]);

  // Decrement article in active section
  const handleDecrement = useCallback(async (article: Article) => {
    if (!currentProject) return;
    impactMedium();

    const existing = getItemInSection(article.id);
    if (!existing) return;

    if ((existing.quantity ?? 0) <= 1) {
      removeLocalItem(existing.id);
      const ok = await deleteProjectItem(existing.id);
      if (!ok) {
        updateLocalItem(existing);
        toast({ title: 'Fehler', description: 'Artikel konnte nicht entfernt werden.', variant: 'destructive' });
      }
    } else {
      const newQty = (existing.quantity ?? 0) - 1;
      updateLocalItem({ ...existing, quantity: newQty });
      const ok = await updateProjectItemQuantity(existing.id, newQty);
      if (!ok) {
        updateLocalItem(existing);
        toast({ title: 'Fehler', description: 'Menge konnte nicht gespeichert werden.', variant: 'destructive' });
      }
    }
  }, [currentProject, activeSectionId, getItemInSection, updateLocalItem, removeLocalItem, impactMedium, toast]);

  // Reset article in active section
  const handleResetArticle = useCallback(async (article: Article) => {
    if (!currentProject) return;
    const existing = getItemInSection(article.id);
    if (!existing) return;
    removeLocalItem(existing.id);
    const ok = await deleteProjectItem(existing.id);
    if (!ok) {
      updateLocalItem(existing);
      toast({ title: 'Fehler', description: 'Konnte nicht zurückgesetzt werden.', variant: 'destructive' });
    }
  }, [currentProject, getItemInSection, removeLocalItem, updateLocalItem, toast]);

  // Delete item from summary list
  const handleDeleteItem = useCallback(async (itemId: string) => {
    removeLocalItem(itemId);
    await deleteProjectItem(itemId);
  }, [removeLocalItem]);

  // Update item quantity
  const handleUpdateQuantity = useCallback(async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    impactLight();
    
    // Update local state immediately
    setCurrentProject(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        selectedItems: prev.selectedItems.map(i => 
          i.id === itemId ? { ...i, quantity: newQuantity } : i
        )
      };
    });

    const ok = await updateProjectItemQuantity(itemId, newQuantity);
    if (!ok) {
      toast({ title: 'Fehler', description: 'Menge konnte nicht aktualisiert werden.', variant: 'destructive' });
    }
  }, [toast, impactLight]);

  // Add section
  const handleAddSection = async (sectionName: string) => {
    if (!currentProject || !sectionName.trim()) return;
    const order = currentProject.selectedItems.length;
    const newSec = await addSection(currentProject.id, sectionName, order);
    if (newSec) {
      updateLocalItem(newSec);
      setActiveSectionId(newSec.id);
      toast({ title: 'Abschnitt erstellt', description: sectionName });
    }
  };

  // Add manual position
  const handleAddManualPosition = async () => {
    if (!currentProject || !manualName.trim()) return;
    const newItem: ProjectSelectedItem = {
      id: generateUUID(),
      project_id: currentProject.id,
      type: 'article',
      order: currentProject.selectedItems.length,
      article_id: null,
      quantity: parseFloat(manualQty) || 1,
      name: manualName.trim(),
      unit: manualUnit.trim() || undefined,
      article_number: manualArticleNumber.trim() || undefined,
      section_id: activeSectionId ?? null,
    };
    updateLocalItem(newItem);
    const saved = await upsertProjectItem(newItem);
    if (!saved) {
      removeLocalItem(newItem.id);
      toast({ title: 'Fehler', description: 'Position konnte nicht gespeichert werden.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Manuelle Position hinzugefügt', description: newItem.name });
    setManualName(''); setManualQty('1'); setManualUnit(''); setManualArticleNumber('');
    setIsManualDialogOpen(false);
  };

  // Export CSV
  const handleExportCsv = () => {
    if (!currentProject) return;
    setIsCsvExportDialogOpen(true);
    impactMedium();
  };

  // Export PDF
  const handleGeneratePdf = async () => {
    if (!currentProject) return;
    const sectionItems = currentProject.selectedItems.filter(i => i.type === 'section').sort((a, b) => a.order - b.order);
    const articleItems = processedSummaryItems.filter(i => i.type === 'article');
    generateAufmassPdf({ projectName: currentProject.name, sectionItems, articleItems });
    toast({ title: 'PDF erstellt' });
  };


  // Helper: select category and close mobile sheet
  const handleSelectCategory = (categoryId: string) => {
    setActiveCategoryId(categoryId);
    if (window.innerWidth < 1024) {
      setIsCategorySheetOpen(false);
    }
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

  const pageVariants = {
    initial: { opacity: 0, y: 15 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.2 } }
  };

  return (
    <motion.div 
      className="flex h-[calc(100vh-3rem)] overflow-hidden relative"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >

      {/* ===== SIDEBAR CONTAINER (Desktop/Tablet Landscape) ===== */}
      <div className={cn(
        "hidden lg:block relative shrink-0 transition-[width] duration-300 h-full",
        viewMode === 'angebot' ? "w-[240px]" : "w-[288px] xl:w-[308px]"
      )}>
        
        {/* Drawer: KATEGORIEN */}
        <aside className={cn(
          "absolute top-0 bottom-0 left-0 w-full flex flex-col border-r border-white/5 bg-background/95 shadow-[10px_0_30px_rgba(0,0,0,0.5)] z-20"
        )}>
          {viewMode === 'aufmass' ? (
            <>
              <div className="p-4 border-b border-white/5 bg-white/[0.02] shrink-0">
                <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                  <BookMarked size={14} /> Artikelkatalog
                </h2>
              </div>
              <div className="flex-1 overflow-y-auto py-3">
                <CategoryTree
                  categories={categories}
                  activeCategoryId={activeCategoryId}
                  expandedCategories={expandedCategories}
                  forceExpandedIds={searchExpandedIds}
                  onSelectCategory={handleSelectCategory}
                  onToggleExpansion={toggleCategoryExpansion}
                />
              </div>
            </>
          ) : (
            <>
              <div className="p-4 border-b border-white/5 bg-white/[0.02] shrink-0 space-y-3">
                <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                  <BookMarked size={14} /> Projekt-Struktur
                </h2>
                <Button onClick={() => {
                   const name = "Neuer Bauabschnitt";
                   const order = currentProject?.selectedItems?.length || 0;
                   if (currentProject) {
                     addSection(currentProject.id, name, order).then(res => {
                       if (res) { updateLocalItem(res); setActiveSectionId(res.id); }
                     });
                   }
                }} className="w-full bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 h-9">
                  Abschnitt hinzufügen
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
                {sections.map(s => (
                  <button 
                    key={s.id}
                    onClick={() => setActiveSectionId(s.id)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors truncate", 
                      activeSectionId === s.id ? "bg-white/10 text-white font-medium shadow-sm" : "text-white/70 hover:text-white hover:bg-white/5"
                    )}
                  >
                    {s.text}
                  </button>
                ))}
                {sections.length === 0 && (
                  <p className="text-xs text-white/30 text-center mt-4 px-4 leading-relaxed">Noch kein Abschnitt vorhanden.</p>
                )}
              </div>
              <div className="p-4 border-t border-white/5 bg-white/[0.02] shrink-0">
                <Button onClick={() => {
                   if (!currentProject) return;
                   try {
                     generateAngebotPdf({ project: currentProject, sectionItems: sections, articleItems: processedSummaryItems.filter(i => i.type === 'article') });
                     toast({ title: "Erfolgreich", description: "PDF wurde generiert." });
                   } catch(e) {
                     toast({ title: "Fehler", variant: "destructive", description: "PDF Generierung fehlgeschlagen." });
                   }
                }} className="w-full bg-white text-black hover:bg-white/90">
                  <FileDown size={16} className="mr-2" /> PDF exportieren
                </Button>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* ===== CENTER: Main Content ===== */}
      <div className={cn("flex-1 flex flex-col overflow-hidden z-20 min-w-0", viewMode === 'angebot' && "bg-background/80")}>
        {/* Page header – slim, no duplicate back-button on desktop */}
        <header className="shrink-0 border-b border-white/5 bg-background/40 backdrop-blur-sm relative">
          <div className="flex items-center justify-between px-4 h-12 gap-3">
            {/* Left: back (mobile only) + project name */}
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => navigate('/')}
                className="xl:hidden p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all shrink-0"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="min-w-0">
                <h1 className="font-semibold text-white text-sm truncate">{currentProject.name}</h1>
                <p className="text-[11px] text-white/40 leading-tight">{totalArticleCount} Artikel erfasst</p>
              </div>
            </div>

            {/* Center: Mode Switch (only visible if planning) */}
            {currentProject.status === 'planning' && (
              <div className="hidden sm:flex items-center bg-white/5 p-1 rounded-xl mx-auto absolute left-1/2 -translate-x-1/2">
                <button 
                  onClick={() => setViewMode('angebot')}
                  className={cn("px-4 py-1.5 text-xs font-bold rounded-lg transition-all", viewMode === 'angebot' ? "bg-white text-black shadow-sm" : "text-white/60 hover:text-white")}
                >
                  📸 Struktur & Notizen
                </button>
                <button 
                  onClick={() => setViewMode('aufmass')}
                  className={cn("px-4 py-1.5 text-xs font-bold rounded-lg transition-all", viewMode === 'aufmass' ? "bg-white text-black shadow-sm" : "text-white/60 hover:text-white")}
                >
                  🛒 Material
                </button>
              </div>
            )}
            {/* Right: catalog (mobile/tablet) + manual position button */}
            <div className="flex items-center gap-1.5">
              <Sheet open={isCategorySheetOpen} onOpenChange={setIsCategorySheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="xl:hidden h-8 px-2.5 text-white/50 hover:text-white hover:bg-white/10 gap-1.5">
                    <Menu size={15} className="text-emerald-400" />
                    <span className="hidden sm:inline text-xs">Katalog</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[85vw] sm:w-[400px] rounded-r-3xl border-r border-white/10 bg-background/95 backdrop-blur-xl flex flex-col p-0">
                  <SheetHeader className="p-6 pb-4 border-b border-white/5 shrink-0">
                    <SheetTitle className="text-left text-xl text-gradient-emerald flex items-center gap-2">
                      <BookMarked size={20} className="text-emerald-400" /> Artikelkatalog
                    </SheetTitle>
                  </SheetHeader>
                  <div className="overflow-y-auto p-4 flex-1 space-y-6">
                    <div>
                      <CategoryTree
                        categories={categories}
                        activeCategoryId={activeCategoryId}
                        expandedCategories={expandedCategories}
                        forceExpandedIds={searchExpandedIds}
                        onSelectCategory={handleSelectCategory}
                        onToggleExpansion={toggleCategoryExpansion}
                      />
                    </div>
                  </div>
                  <div className="p-6 border-t border-white/5 bg-white/[0.02]">
                    <Button variant="ghost" onClick={() => { setActiveCategoryId(null); setExpandedCategories(new Set()); setIsCategorySheetOpen(false); }} className="w-full text-white/50 hover:text-white">
                      Filter zurücksetzen
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
              <Button
                onClick={() => setIsManualDialogOpen(true)}
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 text-white/50 hover:text-emerald-400 hover:bg-emerald-500/10 gap-1.5 transition-all"
                title="Manuelle Position"
              >
                <PenLine size={15} />
                <span className="hidden sm:inline text-xs">Manuell</span>
              </Button>
            </div>
          </div>
        </header>

        {viewMode === 'aufmass' ? (
          <>
            {/* Section Bar */}
            <SectionBar
              sections={sections}
              activeSectionId={activeSectionId}
              onSelectSection={setActiveSectionId}
              onAddSection={handleAddSection}
            />

        {/* Search Bar */}
        <div className="px-4 py-3 border-b border-white/5 shrink-0">
          <div className="relative group max-w-full">
            <Search className={cn('absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300', searchQuery ? 'text-emerald-400' : 'text-white/30')} size={18} />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Artikel oder Nummer suchen..."
              className="h-11 pl-11 pr-10 glass-input border-white/5 group-hover:border-emerald-500/20 transition-all"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); impactLight(); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-all">
                <CloseIcon size={16} />
              </button>
            )}
          </div>
          {activeCategory && !searchQuery && (
            <p className="text-xs text-white/40 mt-2 px-1 uppercase tracking-wider">{activeCategory.name}</p>
          )}
        </div>

        {/* Article List */}
        <main className="flex-1 overflow-y-auto p-4 pb-24 lg:pb-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-w-none">
            {viewArticles.length === 0 ? (
              <div className="col-span-full text-center py-20 ios-card">
                {searchQuery
                  ? <Search size={36} className="text-white/20 mx-auto mb-4" />
                  : <Package size={36} className="text-white/20 mx-auto mb-4" />}
                <p className="text-white/40 font-medium">
                  {searchQuery ? 'Kein Material gefunden' : 'Kein Material in dieser Kategorie'}
                </p>
                {!searchQuery && (
                  <Button variant="link" onClick={() => setIsCategorySheetOpen(true)} className="text-emerald-400 mt-2 xl:hidden">
                    Katalog öffnen
                  </Button>
                )}
              </div>
            ) : (
              viewArticles.map(article => {
                const qty = getQuantityInSection(article.id);
                const cat = categories.find(c => c.id === article.categoryId);
                return (
                  <ArticleCard
                    key={article.id}
                    article={article}
                    quantity={qty}
                    onIncrement={() => handleIncrement(article)}
                    onDecrement={() => handleDecrement(article)}
                    onReset={() => handleResetArticle(article)}
                    categoryImageUrl={cat?.imageUrl}
                  />
                );
              })
            )}
          </div>
        </main>
      </>
        ) : (
          <AngebotTool 
            project={currentProject} 
            activeSectionId={activeSectionId}
            onUpdateLocalItem={updateLocalItem}
            onRemoveLocalItem={removeLocalItem}
          />
        )}
      </div>

      {/* ===== RIGHT PANEL: Summary (Tablet landscape+ = permanent, Mobile = BottomSheet) ===== */}
      {viewMode === 'aufmass' && (
        <>
          {/* Desktop/Tablet permanent panel */}
      <aside className="hidden lg:flex flex-col w-80 xl:w-96 shrink-0 border-l border-white/10 bg-background/60 backdrop-blur-xl z-10">
        <div className="p-4 border-b border-white/5 shrink-0">
          <h2 className="text-sm font-bold text-white/60 uppercase tracking-wider">Aufmaß</h2>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{totalArticleCount} <span className="text-sm font-normal text-white/40">Artikel</span></p>
        </div>
        <SummaryList
                sectionItems={currentProject?.selectedItems.filter(i => i.type === 'section').sort((a, b) => a.order - b.order) ?? []}
                articleItems={processedSummaryItems.filter(i => i.type === 'article')}
                activeSectionId={activeSectionId}
                onSelectSection={setActiveSectionId}
                onDeleteItem={handleDeleteItem}
                onUpdateQuantity={handleUpdateQuantity}
              />
        <div className="p-4 border-t border-white/5 bg-white/[0.02] space-y-2 shrink-0">
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={handleGeneratePdf} disabled={totalArticleCount === 0} className="w-full glass-button">
              <FileDown size={16} className="mr-2" /> PDF
            </Button>
            <Button onClick={handleExportCsv} disabled={totalArticleCount === 0} className="w-full ios-button-secondary border-emerald-500/30 text-emerald-400">
              <FileSpreadsheet size={16} className="mr-2" /> CSV
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Summary Sheet */}
      <Sheet open={isSummaryOpen} onOpenChange={setIsSummaryOpen}>
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 glass-nav border-t border-white/10">
          <div className="flex items-center justify-between p-4">
            <SheetTrigger asChild>
              <div className="flex items-center gap-3 cursor-pointer hover:bg-white/5 p-2 -m-2 rounded-2xl transition-colors">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg">
                  <Package size={22} className="text-white" />
                </div>
                <div>
                  <p className="font-semibold text-white text-lg">{totalArticleCount}</p>
                  <p className="text-xs text-white/50">Artikel im Aufmaß</p>
                </div>
              </div>
            </SheetTrigger>
            <Button onClick={handleGeneratePdf} disabled={totalArticleCount === 0} className="glass-button">
              <FileDown size={18} className="mr-2" /> PDF
            </Button>
          </div>
        </div>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-[2.5rem] border-t border-white/10 bg-background/95 backdrop-blur-xl flex flex-col p-0">
          <SheetHeader className="p-6 pb-4 border-b border-white/5 shrink-0">
            <SheetTitle className="text-left text-xl text-gradient-emerald">Aktuelles Aufmaß</SheetTitle>
          </SheetHeader>
          <SummaryList
                sectionItems={currentProject?.selectedItems.filter(i => i.type === 'section').sort((a, b) => a.order - b.order) ?? []}
                articleItems={processedSummaryItems.filter(i => i.type === 'article')}
                activeSectionId={activeSectionId}
                onSelectSection={setActiveSectionId}
                onDeleteItem={handleDeleteItem}
                onUpdateQuantity={handleUpdateQuantity}
              />
          <div className="p-6 border-t border-white/5 shrink-0 bg-white/[0.02] grid grid-cols-2 gap-3">
            <Button onClick={handleGeneratePdf} disabled={totalArticleCount === 0} className="h-14 text-lg glass-button">
              <FileDown size={20} className="mr-2" /> PDF
            </Button>
            <Button onClick={handleExportCsv} disabled={totalArticleCount === 0} className="h-14 text-lg ios-button-secondary border-emerald-500/30 text-emerald-400">
              <FileSpreadsheet size={20} className="mr-2" /> CSV
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Manual Position Dialog */}
      <Dialog open={isManualDialogOpen} onOpenChange={setIsManualDialogOpen}>
        <DialogContent className="ios-card border border-white/10 bg-background sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white text-xl font-bold flex items-center gap-2">
              <PenLine size={18} className="text-emerald-400" /> Manuelle Position
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs text-white/50 uppercase tracking-wider mb-1.5 block">Bezeichnung *</label>
              <Input value={manualName} onChange={e => setManualName(e.target.value)} className="glass-input" placeholder="z.B. Sonderteil Bogen 90°" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/50 uppercase tracking-wider mb-1.5 block">Menge *</label>
                <Input value={manualQty} onChange={e => setManualQty(e.target.value)} type="number" min="1" className="glass-input" inputMode="numeric" />
              </div>
              <div>
                <label className="text-xs text-white/50 uppercase tracking-wider mb-1.5 block">Einheit</label>
                <Input value={manualUnit} onChange={e => setManualUnit(e.target.value)} className="glass-input" placeholder="Stk, m, kg..." />
              </div>
            </div>
            <div>
              <label className="text-xs text-white/50 uppercase tracking-wider mb-1.5 block">Artikelnummer (optional)</label>
              <Input value={manualArticleNumber} onChange={e => setManualArticleNumber(e.target.value)} className="glass-input" placeholder="z.B. ART-001" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button onClick={() => setIsManualDialogOpen(false)} variant="ghost" className="text-white/50">Abbrechen</Button>
            <Button onClick={handleAddManualPosition} disabled={!manualName.trim()} className="glass-button">Hinzufügen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CsvExportDialog
        isOpen={isCsvExportDialogOpen}
        onClose={() => setIsCsvExportDialogOpen(false)}
        projectItems={processedSummaryItems}
        projectName={currentProject.name}
     />
        </>
      )}
    </motion.div>
  );
};

export default AufmassPage;
