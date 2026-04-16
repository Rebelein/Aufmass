import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusCircle, Trash2, Edit3, ChevronDown, ChevronRight, ArrowUp, ArrowDown, GripVertical, PackagePlus, ListPlus, Settings2, FolderPlus, Sparkles, Package } from 'lucide-react';
import type { Category, Article, Supplier } from '@/lib/data';
import { subscribeToCategories, addCategory, updateCategory, batchUpdateCategories, subscribeToArticles, batchUpdateArticles, subscribeToSuppliers, addSupplier, updateSupplier, deleteSupplier, deleteArticles, addArticle, updateArticle, getCategoriesList, getArticlesList, getSuppliersList, batchAddCatalog } from '@/lib/catalog-storage';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import ArticleManagementPanel from '@/components/admin/ArticleManagementPanel';
import SupplierManagementDialog from '@/components/dialogs/SupplierManagementDialog';
import ImportDraftsDialog from '@/components/dialogs/ImportDraftsDialog';
import ImportReviewDialog from '@/components/dialogs/ImportReviewDialog';
import { getImportDrafts, updateImportDraftData, markImportDraftCompleted, type ImportDraft } from '@/lib/import-storage';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, FileUp, Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/use-haptic-feedback';

const AdminPage = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [articlesAdmin, setArticlesAdmin] = useState<Article[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [newMainCategoryName, setNewMainCategoryName] = useState('');
  const [newSubCategoryName, setNewSubCategoryName] = useState('');
  const [isAddSubCategoryDialogOpen, setIsAddSubCategoryDialogOpen] = useState(false);
  const [subCategoryParent, setSubCategoryParent] = useState<{ id: string; name: string } | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{id: string, type: 'category' | 'article'} | null>(null);
  const { toast } = useToast();
  const [selectedMainCategoryId, setSelectedMainCategoryId] = useState<string | null>(null);
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string | null>(null);
  const [isSupplierManagementDialogOpen, setIsSupplierManagementDialogOpen] = useState(false);
  const [isEditCategoryDialogOpen, setIsEditCategoryDialogOpen] = useState(false);
  const [editingCategoryData, setEditingCategoryData] = useState<{ id: string; name: string } | null>(null);
  const [editedCategoryName, setEditedCategoryName] = useState('');
  const [importDrafts, setImportDrafts] = useState<ImportDraft[]>([]);
  const [isDraftsDialogOpen, setIsDraftsDialogOpen] = useState(false);
  const [reviewingDraft, setReviewingDraft] = useState<ImportDraft | null>(null);
  const [isSyncEditing, setIsSyncEditing] = useState(true);
  const [reviewSupplierId, setReviewSupplierId] = useState<string>('none');
  const [reviewTargetCategoryId, setReviewTargetCategoryId] = useState<string>('root');
  const [collapsedDraftCategories, setCollapsedDraftCategories] = useState<Set<number>>(new Set());
  const { impactMedium, impactLight } = useHapticFeedback();

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
    const [cats, supps, arts] = await Promise.all([getCategoriesList(), getSuppliersList(), getArticlesList()]);
    setCategories(cats); setSuppliers(supps); setArticlesAdmin(arts);
  };

  useEffect(() => {
    const unsubscribeCategories = subscribeToCategories(setCategories);
    const unsubscribeSuppliers = subscribeToSuppliers(setSuppliers);
    const unsubscribeArticles = subscribeToArticles(setArticlesAdmin);
    return () => { unsubscribeCategories(); unsubscribeSuppliers(); unsubscribeArticles(); };
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

  const handleConfirmAddSubCategory = async () => {
    if (!subCategoryParent || !newSubCategoryName.trim()) return;
    const siblings = categories.filter(cat => cat.parentId === subCategoryParent.id);
    const newOrder = siblings.length > 0 ? Math.max(...siblings.map(s => s.order ?? 0)) + 1 : 0;
    await addCategory({ name: newSubCategoryName.trim(), parentId: subCategoryParent.id, order: newOrder });
    setIsAddSubCategoryDialogOpen(false); setSubCategoryParent(null);
    toast({ title: 'Unterkategorie hinzugefügt' });
    await refreshData();
  };

  const confirmDeleteItem = async () => {
    if (!itemToDelete) return;
    if (itemToDelete.type === 'category') {
      const { error } = await supabase.from('categories').delete().eq('id', itemToDelete.id);
      if (error) toast({ variant: 'destructive', title: 'Fehler', description: error.message });
      else toast({ title: "Kategorie gelöscht" });
    } else {
      await deleteArticles([itemToDelete.id]);
      toast({ title: "Artikel gelöscht" });
    }
    setIsDeleteDialogOpen(false); setItemToDelete(null); await refreshData();
  };

  const handleSaveChangesToCategory = async () => {
    if (!editingCategoryData || !editedCategoryName.trim()) return;
    await updateCategory(editingCategoryData.id, { name: editedCategoryName.trim() });
    setIsEditCategoryDialogOpen(false); toast({ title: "Kategorie aktualisiert" }); await refreshData();
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

  const toggleCategoryExpansion = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId); else next.add(categoryId);
      return next;
    });
  };

  const renderCategoryColumn = (parentId: string | null = null, isSubColumn = false): JSX.Element => {
    const columnCategories = categories.filter(category => category.parentId === parentId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    
    if (columnCategories.length === 0) {
      if (parentId === null) {
        return (
          <div className="py-16 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
              <ListPlus size={32} className="text-emerald-400" />
            </div>
            <p className="text-white/60 font-medium">Keine Kategorien vorhanden</p>
          </div>
        );
      } else {
        return (
          <div className="py-6 text-center px-4">
            <p className="text-white/40 text-xs font-medium mb-3">Keine Unterkategorien</p>
            <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => { 
                    const parentCat = categories.find(c => c.id === parentId);
                    if (parentCat) {
                        setSubCategoryParent({ id: parentCat.id, name: parentCat.name }); 
                        setNewSubCategoryName(''); 
                        setIsAddSubCategoryDialogOpen(true); 
                    }
                }}
                className="h-8 text-xs text-teal-400 hover:text-teal-300 hover:bg-teal-500/10 w-full"
            >
                <PlusCircle size={14} className="mr-1.5" /> Erstellen
            </Button>
          </div>
        );
      }
    }

    return (
      <ul className="space-y-1.5 px-2">
        {columnCategories.map((category, index) => {
          const hasChildren = categories.some(subCat => subCat.parentId === category.id);
          const isFirst = index === 0;
          const isLast = index === columnCategories.length - 1;
          const isSelected = isSubColumn ? category.id === selectedSubCategoryId : category.id === selectedMainCategoryId;
          
          return (
            <li key={category.id} className="group/item">
              <div 
                className={cn(
                  "flex justify-between items-center p-2.5 rounded-xl cursor-pointer transition-all duration-200 border",
                  isSelected 
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]" 
                    : "bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10 text-white/80 hover:text-white"
                )}
                onClick={() => {
                  if (isSubColumn) {
                    setSelectedSubCategoryId(category.id);
                  } else {
                    setSelectedMainCategoryId(category.id);
                    setSelectedSubCategoryId(null); // select main = clear sub
                  }
                }}
              >
                <div className="flex items-center flex-grow gap-2.5 min-w-0 pr-2">
                  <div className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                      isSelected ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-white/40 group-hover/item:bg-white/10 group-hover/item:text-white/70"
                  )}>
                      {hasChildren ? <FolderPlus size={14} /> : <Package size={14} />}
                  </div>
                  <span className={cn(
                      "font-semibold truncate transition-colors text-sm"
                  )}>
                      {category.name}
                  </span>
                  {!isSubColumn && hasChildren && (
                    <ChevronRight size={14} className={cn("ml-auto shrink-0", isSelected ? "text-emerald-400" : "text-white/20")} />
                  )}
                </div>
                
                {/* Actions */}
                <div className="flex gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleMoveCategory(category.id, 'up'); }} disabled={isFirst}
                    className="h-7 w-7 text-white/40 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-md"><ArrowUp size={14} /></Button>
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleMoveCategory(category.id, 'down'); }} disabled={isLast}
                    className="h-7 w-7 text-white/40 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-md"><ArrowDown size={14} /></Button>
                  {!isSubColumn && (
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setSubCategoryParent({ id: category.id, name: category.name }); setNewSubCategoryName(''); setIsAddSubCategoryDialogOpen(true); }}
                      className="h-7 w-7 text-white/40 hover:text-orange-400 hover:bg-orange-500/10 rounded-md"><PackagePlus size={14} /></Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditingCategoryData({ id: category.id, name: category.name }); setEditedCategoryName(category.name); setIsEditCategoryDialogOpen(true); }}
                    className="h-7 w-7 text-white/40 hover:text-blue-400 hover:bg-blue-500/10 rounded-md"><Edit3 size={14} /></Button>
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setItemToDelete({id: category.id, type: 'category'}); setIsDeleteDialogOpen(true); }}
                    className="h-7 w-7 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-md"><Trash2 size={14} /></Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    );
  };

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

  const handleConfirmReviewImport = async (id: string, data: any, targetId: string | null, supplierId: string | null) => {
    const catalogData = data.map((c: any) => ({ ...c, subCategories: [] }));
    await batchAddCatalog(catalogData, categories, targetId, supplierId);
    await markImportDraftCompleted(id);
    
    setReviewingDraft(null);
    toast({ title: 'Import erfolgreich' });
    refreshData();
    refreshDrafts();
  };

  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="orb orb-emerald w-80 h-80 -top-20 -left-20" style={{ animationDelay: '0s' }} />
        <div className="orb orb-teal w-64 h-64 bottom-40 right-10" style={{ animationDelay: '-2s' }} />
      </div>

      <div className="relative z-10 flex flex-col flex-1 min-h-0 animate-in fade-in duration-500 overflow-hidden">
        {/* Page Header */}
        <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3 shrink-0 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <Settings2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white leading-tight">Verwaltung</h1>
            <p className="text-[10px] text-white/40">Katalogstruktur und Stammdaten pflegen</p>
          </div>
        </div>

        {/* Body: Staggered Overlay Miller Columns */}
        <div className="flex flex-1 min-h-0 overflow-hidden relative">

          {/* ===== STAGGERED DRAWER CONTAINER ===== */}
          <div className={cn(
            "relative shrink-0 transition-[width] duration-300 h-full",
            selectedMainCategoryId ? "w-[344px] xl:w-[364px]" : "w-[288px] xl:w-[308px]" // 56px offset
          )}>
            
            {/* Drawer 1: HAUPTGRUPPEN + KI */}
            <aside className={cn(
              "absolute top-0 bottom-0 left-0 w-[288px] xl:w-[308px] flex flex-col border-r border-white/5 bg-slate-900/95 shadow-[10px_0_30px_rgba(0,0,0,0.5)] transition-[z-index] duration-0 delay-75",
              "hover:z-50 hover:delay-0 group/haupt",
              selectedMainCategoryId ? "z-10" : "z-20"
            )}>
              {/* Top 75%: Hauptgruppen */}
              <div className="flex-[3] min-h-0 flex flex-col relative overflow-hidden">
                <div className="px-4 pt-4 pb-3 border-b border-white/5 bg-white/[0.02] shrink-0">
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
                <div className="flex-1 overflow-y-auto py-3">
                  {renderCategoryColumn(null, false)}
                </div>
              </div>

              {/* Bottom 25%: KI + Stammdaten */}
              <div className="flex-[1] min-h-[140px] border-t border-white/10 bg-slate-950 p-4 space-y-3 shrink-0 flex flex-col overflow-y-auto">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30 flex items-center gap-1.5 mb-2">
                    <Sparkles size={10} className="text-emerald-400" /> KI-Management
                  </p>
                  <div onClick={() => setIsDraftsDialogOpen(true)}
                    className="p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-all group">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-white/80 group-hover:text-emerald-400 transition-colors">KI-Scans prüfen</span>
                      <Badge variant="outline" className={cn("text-[10px] px-2 py-0 border",
                        importDrafts.some(d => d.status === 'ready_for_review')
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          : "bg-transparent text-white/40 border-white/10")}>
                        {importDrafts.filter(d => d.status === 'ready_for_review').length}
                      </Badge>
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

            {/* Drawer 2: UNTERGRUPPEN */}
            {selectedMainCategoryId && (
              <aside className={cn(
                "absolute top-0 bottom-0 left-[56px] w-[288px] xl:w-[308px] flex flex-col border-l border-r border-teal-500/30 bg-slate-900/95 backdrop-blur shadow-[-20px_0_40px_rgba(0,0,0,0.6)] transition-[z-index] duration-0 delay-75 animate-in slide-in-from-left-4 fade-in duration-300",
                "hover:z-50 z-20 hover:delay-0 group/unter"
              )}>
                <div className="px-4 py-3 border-b border-white/5 bg-white/[0.01] flex items-center justify-between shrink-0 h-[62px]">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-teal-400/80">Untergruppen</p>
                  <Button variant="ghost" size="sm" onClick={() => {
                    const parentCat = categories.find(c => c.id === selectedMainCategoryId);
                    if (parentCat) { setSubCategoryParent({ id: parentCat.id, name: parentCat.name }); setNewSubCategoryName(''); setIsAddSubCategoryDialogOpen(true); }
                  }} className="h-7 px-2 text-teal-400 hover:text-teal-300 hover:bg-teal-500/10 text-xs gap-1">
                    <PlusCircle size={11} /> Neu
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto py-3">
                  {renderCategoryColumn(selectedMainCategoryId, true)}
                </div>
              </aside>
            )}

          </div>

          {/* ===== CENTER: ARTICLE PANEL ===== */}
          <div className="flex-1 min-w-0 overflow-hidden bg-slate-900/40 relative z-0">
            <div className="absolute inset-0 overflow-y-auto">
              {(() => {
                const activeCategoryId = selectedSubCategoryId || selectedMainCategoryId;
                const activeCategory = activeCategoryId ? categories.find(c => c.id === activeCategoryId) : null;
                return activeCategory ? (
                  <ArticleManagementPanel
                    categoryName={activeCategory.name} categoryId={activeCategory.id}
                    articles={articlesAdmin.filter(art => art.categoryId === activeCategory.id).sort((a,b) => (a.order ?? 0) - (b.order ?? 0))}
                    onAddNewArticle={(data) => handleAddNewArticleToCategory(activeCategory.id, data)}
                    onUpdateExistingArticle={handleUpdateExistingArticle}
                    onReorderArticles={handleReorderArticlesInCategory}
                    onDeleteArticles={handleDeleteArticles}
                    onAssignSupplier={handleAssignSupplierToArticles}
                    allCategories={categories} suppliers={suppliers}
                    onAssignImage={() => {}} onNavigateCategory={() => {}} />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-20 h-20 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center">
                      <Package size={36} className="text-white/15" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-lg font-semibold text-white/50">Katalog Leerlauf</h3>
                      <p className="text-sm text-white/30 max-w-[300px] leading-relaxed">
                        Wähle links im Baummenü eine Haupt- oder Untergruppe aus, um Artikel zu verwalten.
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

        </div>
      </div>

      {/* ===== DIALOGS ===== */}
      <Dialog open={isEditCategoryDialogOpen} onOpenChange={setIsEditCategoryDialogOpen}>
        <DialogContent className="ios-card border border-white/10 bg-slate-900/95">
          <DialogHeader><DialogTitle className="text-xl font-bold text-white">Kategorie umbenennen</DialogTitle></DialogHeader>
          <div className="py-4"><Input value={editedCategoryName} onChange={(e) => setEditedCategoryName(e.target.value)} className="glass-input" /></div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsEditCategoryDialogOpen(false)} className="ios-button-secondary">Abbrechen</Button>
            <Button onClick={handleSaveChangesToCategory} className="glass-button">Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddSubCategoryDialogOpen} onOpenChange={setIsAddSubCategoryDialogOpen}>
        <DialogContent className="ios-card border border-white/10 bg-slate-900/95">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">Unterkategorie erstellen</DialogTitle>
            <p className="text-white/50 text-sm">Neu in: <span className="text-emerald-400 font-bold">{subCategoryParent?.name}</span></p>
          </DialogHeader>
          <div className="py-4"><Input value={newSubCategoryName} onChange={(e) => setNewSubCategoryName(e.target.value)} placeholder="Name..." className="glass-input" /></div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsAddSubCategoryDialogOpen(false)} className="ios-button-secondary">Abbrechen</Button>
            <Button onClick={handleConfirmAddSubCategory} className="glass-button">Erstellen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="ios-card border border-white/10 bg-slate-900/95">
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
        categories={categories} suppliers={suppliers} />
    </div>
  );
};

export default AdminPage;
