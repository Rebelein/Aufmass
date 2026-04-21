import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusCircle, Trash2, Edit3, ChevronDown, ChevronRight, ArrowUp, ArrowDown, GripVertical, PackagePlus, ListPlus, Settings2, FolderPlus, Sparkles, Package, MoreVertical } from 'lucide-react';
import type { Category, Article, Supplier } from '@/lib/data';
import { subscribeToCategories, addCategory, updateCategory, batchUpdateCategories, subscribeToArticles, batchUpdateArticles, subscribeToSuppliers, addSupplier, updateSupplier, deleteSupplier, deleteArticles, addArticle, updateArticle, getCategoriesList, getArticlesList, getSuppliersList, batchAddCatalog } from '@/lib/catalog-storage';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useToast } from '@/hooks/use-toast';
import ArticleManagementPanel from '@/components/admin/ArticleManagementPanel';
import { WholesaleCatalogPanel } from '@/components/admin/WholesaleCatalogPanel';
import SupplierManagementDialog from '@/components/dialogs/SupplierManagementDialog';
import ImportDraftsDialog from '@/components/dialogs/ImportDraftsDialog';
import ImportReviewDialog from '@/components/dialogs/ImportReviewDialog';
import { getImportDrafts, updateImportDraftData, markImportDraftCompleted, createImportDraft, updateImportDraftSuccess, type ImportDraft } from '@/lib/import-storage';
import { parseCsvToCatalog } from '@/lib/csv-parser';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, FileUp, Check, Copy, Menu, BookMarked, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/use-haptic-feedback';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useNavigate } from 'react-router-dom';
import { CategoryTree } from '@/components/catalog/CategoryTree';
import { motion } from 'framer-motion';

const AdminPage = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [wholesaleCategories, setWholesaleCategories] = useState<Category[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [articlesAdmin, setArticlesAdmin] = useState<Article[]>([]);
  const [dynamicWholesaleArticles, setDynamicWholesaleArticles] = useState<Article[]>([]);
  const [isFetchingWholesale, setIsFetchingWholesale] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [catalogSource, setCatalogSource] = useState<'own' | 'wholesale'>('own');
  const [newMainCategoryName, setNewMainCategoryName] = useState('');
  const [inlineCreateParentId, setInlineCreateParentId] = useState<string | null>(null);
  const [inlineNewSubCategoryName, setInlineNewSubCategoryName] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{id: string, type: 'category' | 'article'} | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [isCategorySheetOpen, setIsCategorySheetOpen] = useState(false);
  const [isSupplierManagementDialogOpen, setIsSupplierManagementDialogOpen] = useState(false);
  const [inlineEditingCategoryId, setInlineEditingCategoryId] = useState<string | null>(null);
  const [inlineEditedCategoryName, setInlineEditedCategoryName] = useState('');
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [importDrafts, setImportDrafts] = useState<ImportDraft[]>([]);
  const [isDraftsDialogOpen, setIsDraftsDialogOpen] = useState(false);
  const [reviewingDraft, setReviewingDraft] = useState<ImportDraft | null>(null);
  const [isSyncEditing, setIsSyncEditing] = useState(true);
  const [reviewSupplierId, setReviewSupplierId] = useState<string>('none');
  const [reviewTargetCategoryId, setReviewTargetCategoryId] = useState<string>('root');
  const [collapsedDraftCategories, setCollapsedDraftCategories] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { impactMedium, impactLight } = useHapticFeedback();

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const stored = localStorage.getItem('admin-sidebar-width');
    return stored ? Math.max(200, Math.min(parseInt(stored, 10), 800)) : 308;
  });
  const isResizing = useRef(false);

  const handleSidebarMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(200, Math.min(startWidth + delta, 800));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [sidebarWidth]);

  useEffect(() => {
    localStorage.setItem('admin-sidebar-width', String(Math.round(sidebarWidth)));
  }, [sidebarWidth]);

  const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    impactMedium();
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const { catalog, error } = parseCsvToCatalog(text);
      
      if (error || !catalog) {
        toast({ title: 'Fehler beim CSV-Import', description: error || 'Unbekannter Fehler', variant: 'destructive' });
        return;
      }
      
      // Create a draft for the parsed catalog
      const draftId = await createImportDraft(file.name, null);
      if (draftId) {
        await updateImportDraftSuccess(draftId, catalog);
        toast({ title: 'CSV erfolgreich gelesen', description: 'Du kannst den Import nun prüfen.' });
        refreshDrafts();
      } else {
        toast({ title: 'Fehler', description: 'Import-Entwurf konnte nicht erstellt werden.', variant: 'destructive' });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const refreshDrafts = async () => {
    const drafts = await getImportDrafts();
    setImportDrafts(drafts);
  };

  useEffect(() => {
    refreshDrafts();
    const interval = setInterval(refreshDrafts, 10000); // Alle 10 Sekunden prüfen
    return () => clearInterval(interval);
  }, []);

  const refreshData = async () => {
    const [cats, supps, arts, wCats] = await Promise.all([
      getCategoriesList('own'), getSuppliersList(), getArticlesList('own'),
      getCategoriesList('wholesale'),
    ]);
    setCategories(cats); setSuppliers(supps); setArticlesAdmin(arts);
    setWholesaleCategories(wCats);
  };

  useEffect(() => {
    const unsubscribeCategories = subscribeToCategories(cats => setCategories(cats.filter(c => c.source !== 'wholesale')), 'own');
    const unsubscribeWholesaleCategories = subscribeToCategories(cats => setWholesaleCategories(cats), 'wholesale');
    const unsubscribeSuppliers = subscribeToSuppliers(setSuppliers);
    const unsubscribeArticles = subscribeToArticles(arts => setArticlesAdmin(arts.filter(a => a.source !== 'wholesale')), 'own');
    const handleToggleCatalog = () => setIsCategorySheetOpen(true);
    window.addEventListener('toggle-catalog-sheet', handleToggleCatalog);

    return () => { 
      unsubscribeCategories(); 
      unsubscribeWholesaleCategories(); 
      unsubscribeSuppliers(); 
      unsubscribeArticles(); 
      window.removeEventListener('toggle-catalog-sheet', handleToggleCatalog);
    };
  }, []);

  const handleAddMainCategory = async () => {
    if (newMainCategoryName.trim() === '') return;
    const siblings = categories.filter(cat => cat.parentId === null);
    const newOrder = siblings.length > 0 ? Math.max(...siblings.map(s => s.order ?? 0)) + 1 : 0;
    await addCategory({ name: newMainCategoryName.trim(), parentId: null, order: newOrder });
    setNewMainCategoryName('');
    toast({ title: 'Hauptkategorie hinzugefügt' });
    await refreshData();
  };

  const handleSaveNewSubCategory = async () => {
    if (!inlineCreateParentId || !inlineNewSubCategoryName.trim()) return;
    const siblings = categories.filter(cat => cat.parentId === inlineCreateParentId);
    const newOrder = siblings.length > 0 ? Math.max(...siblings.map(s => s.order ?? 0)) + 1 : 0;
    await addCategory({ name: inlineNewSubCategoryName.trim(), parentId: inlineCreateParentId, order: newOrder });
    setInlineCreateParentId(null); setInlineNewSubCategoryName('');
    toast({ title: 'Unterkategorie hinzugefügt' });
    await refreshData();
  };

  const confirmDeleteItem = async () => {
    if (!itemToDelete) return;
    if (itemToDelete.type === 'article') {
      await deleteArticles([itemToDelete.id]);
      toast({ title: "Artikel gelöscht" });
    }
    setIsDeleteDialogOpen(false); setItemToDelete(null); await refreshData();
  };

  const handleConfirmDeleteCategory = async (categoryId: string) => {
    const { error } = await supabase.from('categories').delete().eq('id', categoryId);
    if (error) toast({ variant: 'destructive', title: 'Fehler', description: error.message });
    else toast({ title: "Kategorie gelöscht" });
    setDeletingCategoryId(null);
    if (activeCategoryId === categoryId) setActiveCategoryId(null);
    await refreshData();
  };

  const handleSaveEditCategory = async () => {
    if (!inlineEditingCategoryId || !inlineEditedCategoryName.trim()) return;
    await updateCategory(inlineEditingCategoryId, { name: inlineEditedCategoryName.trim() });
    setInlineEditingCategoryId(null); setInlineEditedCategoryName('');
    toast({ title: "Kategorie aktualisiert" }); await refreshData();
  };

  const handleMoveCategory = async (categoryId: string, direction: 'up' | 'down') => {
    const categoryToMove = categories.find(cat => cat.id === categoryId);
    if (!categoryToMove) return;
    const siblings = categories.filter(cat => cat.parentId === categoryToMove.parentId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const currentIndex = siblings.findIndex(s => s.id === categoryId);
    if (direction === 'up' && currentIndex > 0) {
      const prevSibling = siblings[currentIndex - 1];
      await batchUpdateCategories([{ id: categoryToMove.id, order: prevSibling.order }, { id: prevSibling.id, order: categoryToMove.order }]);
    } else if (direction === 'down' && currentIndex < siblings.length - 1) {
      const nextSibling = siblings[currentIndex + 1];
      await batchUpdateCategories([{ id: categoryToMove.id, order: nextSibling.order }, { id: nextSibling.id, order: categoryToMove.order }]);
    }
    await refreshData();
  };

  const handleReorderCategory = async (activeId: string, overId: string) => {
    if (activeId === overId) return;
    
    const activeCat = categories.find(c => c.id === activeId);
    const overCat = categories.find(c => c.id === overId);
    if (!activeCat || !overCat) return;
    
    if (activeCat.parentId !== overCat.parentId) return;
    
    const siblings = categories
      .filter(cat => cat.parentId === activeCat.parentId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    
    const oldIndex = siblings.findIndex(s => s.id === activeId);
    const newIndex = siblings.findIndex(s => s.id === overId);
    
    if (oldIndex !== -1 && newIndex !== -1) {
      const newSiblings = [...siblings];
      const [removed] = newSiblings.splice(oldIndex, 1);
      newSiblings.splice(newIndex, 0, removed);
      
      const updates = newSiblings.map((cat, index) => ({ id: cat.id, order: index }));
      
      // Update local state optimistically
      setCategories(prev => {
        const next = [...prev];
        updates.forEach(u => {
          const item = next.find(x => x.id === u.id);
          if (item) item.order = u.order;
        });
        return next;
      });

      await batchUpdateCategories(updates);
      await refreshData();
    }
  };

  const handleAddSupplierAdmin = async (name: string) => { await addSupplier({ name }); await refreshData(); };
  const handleUpdateSupplierAdmin = async (id: string, name: string) => { await updateSupplier(id, { name }); await refreshData(); };
  const handleDeleteSupplierAdmin = async (id: string) => { await deleteSupplier(id); await refreshData(); };

  const handleAddNewArticleToCategory = async (targetCategoryId: string, newArticleData: any) => {
    const articlesInThisCategory = articlesAdmin.filter(art => art.categoryId === targetCategoryId);
    const newOrder = articlesInThisCategory.length > 0 ? Math.max(...articlesInThisCategory.map(art => art.order ?? -1)) + 1 : 0;
    await addArticle({ ...newArticleData, categoryId: targetCategoryId, order: newOrder });
    toast({ title: "Artikel hinzugefügt" }); await refreshData();
  };

  const handleUpdateExistingArticle = async (articleId: string, formData: any) => {
    await updateArticle(articleId, formData); toast({ title: "Artikel aktualisiert" }); await refreshData();
  };

  const handleDeleteArticles = async (articleIds: string[]) => {
    await deleteArticles(articleIds); toast({ title: "Artikel gelöscht" }); await refreshData();
  };

  const handleReorderArticlesInCategory = async (categoryId: string, reorderedArticlesForCategory: Article[]) => {
    const updates = reorderedArticlesForCategory.map((art, index) => ({ id: art.id, order: index }));
    await batchUpdateArticles(updates); await refreshData();
  };

  const handleAssignSupplierToArticles = async (articleIds: string[], supplierName: string | undefined) => {
    const supplierId = suppliers.find(s => s.name === supplierName)?.id;
    const updates = articleIds.map(id => ({ id, supplierId: supplierId ?? null }));
    await batchUpdateArticles(updates); toast({ title: 'Großhändler aktualisiert' }); await refreshData();
  };

  const handleAssignImageToArticles = async (articleIds: string[], imageUrl: string | null) => {
    const updates = articleIds.map(id => ({ id, imageUrl }));
    await batchUpdateArticles(updates); toast({ title: 'Artikelbild aktualisiert' }); await refreshData();
  };

  const toggleCategoryExpansion = (categoryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId); else next.add(categoryId);
      return next;
    });
  };

  const handleSelectCategory = (categoryId: string) => {
    setActiveCategoryId(categoryId);
    if (window.innerWidth < 1024) {
      setIsCategorySheetOpen(false);
    }
  };

  const renderAdminActions = (category: Category, { isFirst, isLast }: { isFirst: boolean; isLast: boolean }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-white/40 hover:text-white hover:bg-white/10 rounded-md">
          <MoreVertical size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-gray-900 border-white/10 text-white shadow-xl">
        <DropdownMenuItem onClick={() => handleMoveCategory(category.id, 'up')} disabled={isFirst} className="hover:bg-white/10 cursor-pointer focus:bg-white/10">
          <ArrowUp size={14} className="mr-2 text-white/50" /> Nach oben
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleMoveCategory(category.id, 'down')} disabled={isLast} className="hover:bg-white/10 cursor-pointer focus:bg-white/10">
          <ArrowDown size={14} className="mr-2 text-white/50" /> Nach unten
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem onClick={() => { setInlineCreateParentId(category.id); setInlineNewSubCategoryName(''); setExpandedCategories(prev => new Set(prev).add(category.id)); }} className="hover:bg-white/10 cursor-pointer focus:bg-white/10 text-orange-400 focus:text-orange-300">
          <PackagePlus size={14} className="mr-2" /> Unterkategorie
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => { setInlineEditingCategoryId(category.id); setInlineEditedCategoryName(category.name); }} className="hover:bg-white/10 cursor-pointer focus:bg-white/10 text-blue-400 focus:text-blue-300">
          <Edit3 size={14} className="mr-2" /> Bearbeiten
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem onClick={() => setDeletingCategoryId(category.id)} className="hover:bg-red-500/20 cursor-pointer focus:bg-red-500/20 text-red-400 focus:text-red-300">
          <Trash2 size={14} className="mr-2" /> Löschen
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const toggleDraftCategory = (catIdx: number) => {
    setCollapsedDraftCategories(prev => {
      const next = new Set(prev);
      if (next.has(catIdx)) next.delete(catIdx); else next.add(catIdx);
      return next;
    });
  };

  const handleOpenDraftForReview = (draft: ImportDraft) => {
    setIsDraftsDialogOpen(false);
    setReviewingDraft(draft);
  };

  const handleSaveReviewDraft = async (id: string, data: any, supplierId: string | null) => {
    await updateImportDraftData(id, data, supplierId);
    toast({ title: 'Entwurf gespeichert' });
    refreshDrafts();
  };

  const handleConfirmReviewImport = async (id: string, data: any, targetId: string | null, supplierId: string | null, importMode?: string) => {
    if (importMode === 'add_to_existing' && targetId) {
      const allArticles = data.flatMap((c: any) => c.articles || []);
      const existingCount = articlesAdmin.filter(a => a.categoryId === targetId).length;
      const articlesToInsert = allArticles.map((art: any, idx: number) => ({
        name: art.name,
        article_number: art.articleNumber,
        unit: art.unit,
        category_id: targetId,
        supplier_id: art.supplierId || (supplierId === 'none' ? null : supplierId),
        order: existingCount + idx,
      }));
      
      if (articlesToInsert.length > 0) {
        const { supabase } = await import('@/lib/supabase');
        await supabase.from('articles').insert(articlesToInsert);
      }
    } else {
      const catalogData: any[] = [];

      const getOrCreateCategory = (list: any[], name: string) => {
          let cat = list.find((c: any) => c.categoryName === name);
          if (!cat) {
              cat = { categoryName: name, articles: [], subCategories: [] };
              list.push(cat);
          }
          return cat;
      };

      data.forEach((flatCat: any) => {
          const pathParts = flatCat.categoryName.split('>').map((p: string) => p.trim()).filter(Boolean);
          if (pathParts.length === 0) return;

          let currentLevel = catalogData;
          let targetCategory: any = null;

          for (let i = 0; i < pathParts.length; i++) {
              targetCategory = getOrCreateCategory(currentLevel, pathParts[i]);
              currentLevel = targetCategory.subCategories;
          }

          if (targetCategory) {
              targetCategory.articles.push(...(flatCat.articles || []));
          }
      });

      await batchAddCatalog(catalogData, categories, targetId, supplierId);
    }
    await markImportDraftCompleted(id);

    setReviewingDraft(null);
    toast({ title: 'Import erfolgreich' });
    refreshData();
    refreshDrafts();
  };
  const pageVariants = {
    initial: { opacity: 0, y: 15 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.2 } }
  };

  return (
    <motion.div 
      className="h-full flex flex-col relative overflow-hidden"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >

      <div className="relative z-10 flex flex-col flex-1 min-h-0 animate-in fade-in duration-500 overflow-hidden">

        {/* Body: Staggered Overlay Miller Columns */}
        <div className="flex flex-1 min-h-0 overflow-hidden relative">

          {/* Mobile Katalog Sheet - triggered from Header burger */}
          <Sheet open={isCategorySheetOpen} onOpenChange={setIsCategorySheetOpen}>
            <SheetContent side="left" onOpenAutoFocus={(e) => e.preventDefault()} className="w-[85vw] sm:w-[400px] rounded-r-3xl border-r border-white/10 bg-black/20 backdrop-blur-[60px] shadow-[inset_1px_0_0_rgba(255,255,255,0.05)] flex flex-col p-0">
              {/* Dummy button to catch focus and prevent mobile keyboard from opening */}
              <button autoFocus className="sr-only" aria-hidden="true" />
              <SheetHeader className="p-6 pb-4 border-b border-white/5 shrink-0">
                <SheetTitle className="text-left text-xl text-gradient-emerald flex items-center gap-2">
                  <BookMarked size={20} className="text-emerald-400" /> Katalog
                </SheetTitle>
              </SheetHeader>
              
              <div className="overflow-y-auto flex-1 flex flex-col">
                <div className="p-4 border-b border-white/5 bg-white/[0.02] shrink-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-2.5 flex items-center gap-2">
                    <ListPlus size={14} /> Hauptgruppen
                  </p>
                  <div className="flex gap-2">
                    <Input value={newMainCategoryName} onChange={(e) => setNewMainCategoryName(e.target.value)}
                      placeholder="Neue Gruppe…" className="glass-input h-9 text-xs flex-1 min-w-0"
                      onKeyDown={e => { if (e.key === 'Enter') handleAddMainCategory(); }} />
                    <Button onClick={handleAddMainCategory} className="glass-button h-9 w-9 p-0 shrink-0">
                      <PlusCircle size={16} />
                    </Button>
                  </div>
                </div>
                <div className="flex-1 py-3 overflow-y-auto">
                    <CategoryTree
                    categories={categories}
                    activeCategoryId={activeCategoryId}
                    expandedCategories={expandedCategories}
                    onSelectCategory={handleSelectCategory}
                    onToggleExpansion={toggleCategoryExpansion}
                    renderActions={renderAdminActions}
                    onReorderCategory={handleReorderCategory}
                    inlineEditingCategoryId={inlineEditingCategoryId}
                    editedCategoryName={inlineEditedCategoryName}
                    onEditedCategoryNameChange={setInlineEditedCategoryName}
                    onSaveEdit={handleSaveEditCategory}
                    deletingCategoryId={deletingCategoryId}
                    onConfirmDeleteCategory={handleConfirmDeleteCategory}
                    onCancelDeleteCategory={() => setDeletingCategoryId(null)}
                    onCancelEdit={() => setInlineEditingCategoryId(null)}
                    inlineCreateParentId={inlineCreateParentId}
                    newSubCategoryName={inlineNewSubCategoryName}
                    onNewSubCategoryNameChange={setInlineNewSubCategoryName}
                    onSaveNewSubCategory={handleSaveNewSubCategory}
                    onCancelNewSubCategory={() => setInlineCreateParentId(null)}
                  />
                </div>
              </div>
              
              {/* Bottom: KI + Stammdaten inside Sheet */}
              <div className="p-4 border-t border-white/10 bg-background space-y-3 shrink-0 flex flex-col">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30 flex items-center gap-1.5 mb-2">
                    <Sparkles size={10} className="text-emerald-400" /> KI-Management
                  </p>
                  <div className="space-y-2">
                    <div onClick={() => { setIsDraftsDialogOpen(true); setIsCategorySheetOpen(false); }}
                      className="p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-all group">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-white/80 group-hover:text-emerald-400 transition-colors">KI-Scans prüfen</span>
                        <div className="flex items-center gap-1.5">
                          {importDrafts.filter(d => d.status === 'processing').length > 0 && (
                            <Badge variant="outline" className="text-[10px] px-2 py-0 border bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse">
                              <Loader2 size={10} className="mr-1 animate-spin" />
                              {importDrafts.filter(d => d.status === 'processing').length}
                            </Badge>
                          )}
                          <Badge variant="outline" className={cn("text-[10px] px-2 py-0 border",
                            importDrafts.some(d => d.status === 'ready_for_review')
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                              : "bg-transparent text-white/40 border-white/10")}>
                            {importDrafts.filter(d => d.status === 'ready_for_review').length}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div onClick={() => fileInputRef.current?.click()}
                      className="p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-all group flex items-center gap-2">
                      <FileUp size={14} className="text-emerald-400" />
                      <span className="text-xs font-semibold text-white/80 group-hover:text-emerald-400 transition-colors">CSV Import</span>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30 flex items-center gap-1.5 mb-2">
                    <Settings2 size={10} className="text-teal-400" /> Stammdaten
                  </p>
                  <Button onClick={() => { setIsSupplierManagementDialogOpen(true); setIsCategorySheetOpen(false); }} className="w-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/80 justify-start gap-2 h-9 text-xs">
                    <FolderPlus size={14} className="text-teal-400 shrink-0" />
                    Großhändler / Lieferanten
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* ===== SIDEBAR CONTAINER ===== */}
          <div className={cn(
            "hidden xl:block relative shrink-0 h-full"
          )} style={{ width: `${sidebarWidth}px` }}>
            
            {/* Drawer: KATEGORIEN + KI */}
            <aside className={cn(
              "absolute top-0 bottom-0 left-0 w-full flex flex-col border-r border-white/10 bg-black/20 backdrop-blur-[60px] shadow-[inset_1px_0_0_rgba(255,255,255,0.05),10px_0_30px_rgba(0,0,0,0.5)] z-20"
            )}>
              {/* Resize handle */}
              <div
                className="absolute top-0 bottom-0 right-0 w-1.5 cursor-col-resize group z-30 hover:bg-emerald-500/30 active:bg-emerald-500/50 transition-colors -mr-0.5"
                onMouseDown={handleSidebarMouseDown}
              >
                <div className="absolute top-1/2 left-0.5 -translate-y-1/2 w-0.5 h-12 rounded-full bg-white/10 group-hover:bg-emerald-400/60 transition-colors" />
              </div>

              {/* Top 75%: Hauptgruppen */}
              <div className="flex-[3] min-h-0 flex flex-col relative overflow-hidden">
                <div className="px-4 pt-4 pb-3 border-b border-white/5 bg-white/[0.02] shrink-0 space-y-3">
                  {/* Katalog-Tab-Switcher (Deaktiviert für reinen "Eigener Katalog" Modus) */}
                  {catalogSource === 'own' && (
                    <div className="flex gap-2">
                      <Input value={newMainCategoryName} onChange={(e) => setNewMainCategoryName(e.target.value)}
                        placeholder="Neue Gruppe…" className="glass-input h-9 text-xs flex-1 min-w-0"
                        onKeyDown={e => { if (e.key === 'Enter') handleAddMainCategory(); }} />
                      <Button onClick={handleAddMainCategory} className="glass-button h-9 w-9 p-0 shrink-0">
                        <PlusCircle size={16} />
                      </Button>
                    </div>
                  )}
                  {catalogSource === 'wholesale' && wholesaleCategories.length === 0 && (
                    <p className="text-xs text-amber-400/60 text-center py-1">Noch kein Großhändler-Katalog importiert.</p>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto py-3">
                  <CategoryTree
                    categories={catalogSource === 'own' ? categories : wholesaleCategories}
                    activeCategoryId={activeCategoryId}
                    expandedCategories={expandedCategories}
                    onSelectCategory={handleSelectCategory}
                    onToggleExpansion={toggleCategoryExpansion}
                    renderActions={catalogSource === 'own' ? renderAdminActions : undefined}
                    onReorderCategory={catalogSource === 'own' ? handleReorderCategory : undefined}
                    inlineEditingCategoryId={catalogSource === 'own' ? inlineEditingCategoryId : null}
                    editedCategoryName={inlineEditedCategoryName}
                    onEditedCategoryNameChange={setInlineEditedCategoryName}
                    onSaveEdit={handleSaveEditCategory}
                    onCancelEdit={() => setInlineEditingCategoryId(null)}
                    inlineCreateParentId={catalogSource === 'own' ? inlineCreateParentId : null}
                    newSubCategoryName={inlineNewSubCategoryName}
                    onNewSubCategoryNameChange={setInlineNewSubCategoryName}
                    onSaveNewSubCategory={handleSaveNewSubCategory}
                    onCancelNewSubCategory={() => setInlineCreateParentId(null)}
                    deletingCategoryId={catalogSource === 'own' ? deletingCategoryId : null}
                    onConfirmDeleteCategory={handleConfirmDeleteCategory}
                    onCancelDeleteCategory={() => setDeletingCategoryId(null)}
                  />
                </div>
              </div>

              {/* Bottom 25%: KI + Stammdaten */}
              <div className="flex-[1] min-h-[140px] border-t border-white/10 bg-background p-4 space-y-3 shrink-0 flex flex-col overflow-y-auto">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30 flex items-center gap-1.5 mb-2">
                    <Sparkles size={10} className="text-emerald-400" /> KI-Management
                  </p>
                  <div className="space-y-2">
                    <div onClick={() => setIsDraftsDialogOpen(true)}
                      className="p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-all group">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-white/80 group-hover:text-emerald-400 transition-colors">KI-Scans prüfen</span>
                        <div className="flex items-center gap-1.5">
                          {importDrafts.filter(d => d.status === 'processing').length > 0 && (
                            <Badge variant="outline" className="text-[10px] px-2 py-0 border bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse">
                              <Loader2 size={10} className="mr-1 animate-spin" />
                              {importDrafts.filter(d => d.status === 'processing').length}
                            </Badge>
                          )}
                          <Badge variant="outline" className={cn("text-[10px] px-2 py-0 border",
                            importDrafts.some(d => d.status === 'ready_for_review')
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                              : "bg-transparent text-white/40 border-white/10")}>
                            {importDrafts.filter(d => d.status === 'ready_for_review').length}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div onClick={() => fileInputRef.current?.click()}
                      className="p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-all group flex items-center gap-2">
                      <FileUp size={14} className="text-emerald-400" />
                      <span className="text-xs font-semibold text-white/80 group-hover:text-emerald-400 transition-colors">CSV Import</span>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30 flex items-center gap-1.5 mb-2">
                    <Settings2 size={10} className="text-teal-400" /> Stammdaten
                  </p>
                  <Button onClick={() => setIsSupplierManagementDialogOpen(true)} className="w-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/80 justify-start gap-2 h-9 text-xs">
                    <FolderPlus size={14} className="text-teal-400 shrink-0" />
                    Großhändler / Lieferanten
                  </Button>
                </div>
              </div>
            </aside>
          </div>

          {/* ===== CENTER: ARTICLE PANEL ===== */}
          <div className="flex-1 min-w-0 overflow-hidden bg-transparent relative z-0">
            <div className="absolute inset-0 overflow-y-auto">
              {(() => {
                const activeCategory = activeCategoryId
                  ? (catalogSource === 'own' ? categories : wholesaleCategories).find(c => c.id === activeCategoryId)
                  : null;

                if (!activeCategory) {
                  return (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                      <div className="w-20 h-20 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center">
                        <Package size={36} className={catalogSource === 'wholesale' ? 'text-amber-500/20' : 'text-white/15'} />
                      </div>
                      <div className="space-y-1.5">
                        <h3 className="text-lg font-semibold text-white/50">
                          {catalogSource === 'wholesale' ? 'Großhändler-Katalog' : 'Katalog Leerlauf'}
                        </h3>
                        <p className="text-sm text-white/30 max-w-[300px] leading-relaxed">
                          {catalogSource === 'wholesale'
                            ? 'Wähle eine Kategorie aus dem Großhändler-Katalog, um Artikel zu durchsuchen und in den eigenen Katalog zu übernehmen.'
                            : 'Wähle links im Baummenü eine Haupt- oder Untergruppe aus, um Artikel zu verwalten.'}
                        </p>
                      </div>
                    </div>
                  );
                }

                if (catalogSource === 'wholesale') {
                  return (
                    <WholesaleCatalogPanel
                      categoryName={activeCategory.name}
                      categoryId={activeCategory.id}
                      articles={dynamicWholesaleArticles.filter(a => a.categoryId === activeCategory.id).sort((a,b) => (a.name || '').replace(/\s+/g, ' ').trim().localeCompare((b.name || '').replace(/\s+/g, ' ').trim(), undefined, { numeric: true, sensitivity: 'base' }))}
                      ownCategories={categories}
                      onArticlesCopied={refreshData}
                    />
                  );
                }

                return (
                  <ArticleManagementPanel
                    categoryName={activeCategory.name} categoryId={activeCategory.id}
                    articles={articlesAdmin.filter(art => art.categoryId === activeCategory.id).sort((a,b) => (a.name || '').replace(/\s+/g, ' ').trim().localeCompare((b.name || '').replace(/\s+/g, ' ').trim(), undefined, { numeric: true, sensitivity: 'base' }))}
                    allArticles={articlesAdmin}
                    onAddNewArticle={(data) => handleAddNewArticleToCategory(activeCategory.id, data)}
                    onUpdateExistingArticle={handleUpdateExistingArticle}
                    onReorderArticles={handleReorderArticlesInCategory}
                    onDeleteArticles={handleDeleteArticles}
                    onAssignSupplier={handleAssignSupplierToArticles}
                    allCategories={categories} suppliers={suppliers}
                    onAssignImage={handleAssignImageToArticles} onNavigateCategory={() => {}} />
                    );
                    })()}            </div>
          </div>

        </div>
      </div>

      {/* ===== DIALOGS ===== */}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="ios-card border border-white/10 bg-background sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-bold text-red-400">Element löschen?</AlertDialogTitle>
            <p className="text-white/50">Dieser Vorgang kann nicht rückgängig gemacht werden.</p>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 mt-4">
            <AlertDialogCancel className="ios-button-secondary">Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteItem} className="bg-red-500/90 hover:bg-red-500 text-white rounded-xl font-bold px-6">Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SupplierManagementDialog isOpen={isSupplierManagementDialogOpen} onClose={() => setIsSupplierManagementDialogOpen(false)}
        suppliers={suppliers} onAddSupplier={handleAddSupplierAdmin} onUpdateSupplier={handleUpdateSupplierAdmin} onDeleteSupplier={handleDeleteSupplierAdmin} />

      <ImportDraftsDialog isOpen={isDraftsDialogOpen} onClose={() => setIsDraftsDialogOpen(false)} onOpenDraft={handleOpenDraftForReview} />

      <ImportReviewDialog draft={reviewingDraft} isOpen={!!reviewingDraft} onClose={() => setReviewingDraft(null)}
        onSaveDraft={handleSaveReviewDraft} onConfirmImport={handleConfirmReviewImport}
        categories={categories} suppliers={suppliers} articles={articlesAdmin} />

      <input type="file" ref={fileInputRef} onChange={handleCsvUpload} accept=".csv" className="hidden" />
      </motion.div>
      );
      }

      export default AdminPage;
