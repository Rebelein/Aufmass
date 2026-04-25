import { useState, useEffect, useRef, useCallback } from 'react';
import { CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusCircle, Trash2, Edit3, ListPlus, Settings2, FolderPlus, Sparkles, Package, MoreVertical, FileUp, Loader2, BookMarked, Search, ChevronLeft, Sun, Moon, ImagePlus, ClipboardPaste } from 'lucide-react';
import type { Category, Article, Supplier } from '@/lib/data';
import { addCategory, updateCategory, batchUpdateCategories, batchUpdateArticles, addSupplier, updateSupplier, deleteSupplier, deleteArticles, addArticle, updateArticle, getCategoriesList, getArticlesList, getSuppliersList, batchAddCatalog } from '@/lib/catalog-storage';
import { supabase } from '@/lib/supabase';
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
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/use-haptic-feedback';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useNavigate } from 'react-router-dom';
import { CategoryTree } from '@/components/catalog/CategoryTree';
import { motion } from 'framer-motion';

const AdminPage = () => {
  const [view, setView] = useState<'catalog' | 'wholesale'>('catalog');
  const [categories, setCategories] = useState<Category[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [articlesAdmin, setArticlesAdmin] = useState<Article[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const categoryImageInputRef = useRef<HTMLInputElement>(null);
  const [activeCategoryIdForImage, setActiveCategoryIdForImage] = useState<string | null>(null);
  const { impactMedium } = useHapticFeedback();
  const [sidebarWidth, setSidebarWidth] = useState(() => { const stored = localStorage.getItem('admin-sidebar-width'); return stored ? Math.max(200, Math.min(parseInt(stored, 10), 800)) : 308; });
  const isResizing = useRef(false);

  const handleSidebarMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); isResizing.current = true; document.body.style.cursor = 'col-resize';
    const startX = e.clientX; const startWidth = sidebarWidth;
    const handleMouseMove = (moveEvent: MouseEvent) => { if (!isResizing.current) return; setSidebarWidth(Math.max(200, Math.min(startWidth + moveEvent.clientX - startX, 800))); };
    const handleMouseUp = () => { isResizing.current = false; document.body.style.cursor = ''; document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); };
    document.addEventListener('mousemove', handleMouseMove); document.addEventListener('mouseup', handleMouseUp);
  }, [sidebarWidth]);

  useEffect(() => { localStorage.setItem('admin-sidebar-width', String(Math.round(sidebarWidth))); }, [sidebarWidth]);

  const refreshDrafts = async () => { const drafts = await getImportDrafts(); setImportDrafts(drafts); };
  useEffect(() => { refreshDrafts(); const interval = setInterval(refreshDrafts, 10000); return () => clearInterval(interval); }, []);

  const refreshData = async () => { const [cats, supps, arts] = await Promise.all([ getCategoriesList('own'), getSuppliersList(), getArticlesList('own') ]); setCategories(cats); setSuppliers(supps); setArticlesAdmin(arts); };
  useEffect(() => { refreshData(); }, []);

  const handleAddMainCategory = async () => { if (!newMainCategoryName.trim()) return; const nextOrder = categories.filter(c => !c.parentId).length; const newCat = await addCategory({ name: newMainCategoryName.trim(), order: nextOrder, source: 'own' }); if (newCat) { setNewMainCategoryName(''); toast({ title: 'Hauptgruppe erstellt' }); refreshData(); } };
  const handleSelectCategory = (id: string) => { setActiveCategoryId(id); setIsCategorySheetOpen(false); };
  const toggleCategoryExpansion = (id: string, e: React.MouseEvent) => { e.stopPropagation(); const next = new Set(expandedCategories); if (next.has(id)) next.delete(id); else next.add(id); setExpandedCategories(next); };

  const handleAddNewArticleToCategory = async (catId: string, data: any) => { const newArt = await addArticle({ ...data, categoryId: catId, order: 0, source: 'own' }); if (newArt) { toast({ title: 'Artikel hinzugefügt' }); refreshData(); } };
  const handleUpdateExistingArticle = async (id: string, data: any) => { const success = await updateArticle(id, data); if (success) { toast({ title: 'Artikel aktualisiert' }); refreshData(); } };
  const handleReorderArticlesInCategory = async (catId: string, reordered: Article[]) => { const updates = reordered.map((a, i) => ({ id: a.id, order: i })); await batchUpdateArticles(updates); refreshData(); };
  const handleDeleteArticles = async (ids: string[]) => { const success = await deleteArticles(ids); if (success) { toast({ title: 'Artikel gelöscht' }); refreshData(); } };
  const handleAssignSupplierToArticles = async (ids: string[], supplierId: string | undefined) => { const updates = ids.map(id => ({ id, supplierId: supplierId || null })); await batchUpdateArticles(updates); refreshData(); };
  const handleAssignImageToArticles = async (ids: string[], imageUrl: string | null) => { const updates = ids.map(id => ({ id, imageUrl })); await batchUpdateArticles(updates); refreshData(); };

  const handleReorderCategory = async (activeId: string, overId: string) => {
    const activeCat = categories.find(c => c.id === activeId); const overCat = categories.find(c => c.id === overId);
    if (!activeCat || !overCat || activeCat.parentId !== overCat.parentId) return;
    const siblings = categories.filter(c => c.parentId === activeCat.parentId).sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
    const oldIndex = siblings.findIndex(s => s.id === activeId); const newIndex = siblings.findIndex(s => s.id === overId);
    const nextSiblings = [...siblings]; const [moved] = nextSiblings.splice(oldIndex, 1); nextSiblings.splice(newIndex, 0, moved);
    const updates = nextSiblings.map((s, i) => ({ id: s.id, order: i })); await batchUpdateCategories(updates); refreshData();
  };

  const handleSaveEditCategory = async () => { if (!inlineEditingCategoryId || !inlineEditedCategoryName.trim()) return; const success = await updateCategory(inlineEditingCategoryId, { name: inlineEditedCategoryName.trim() }); if (success) { setInlineEditingCategoryId(null); toast({ title: 'Erfolg' }); refreshData(); } };
  
  // Startet den Inline-Bestätigungsdialog für Kategorien
  const handleInitiateDeleteCategory = (id: string) => { setDeletingCategoryId(id); };
  
  // Führt das tatsächliche Löschen der Kategorie (inkl. Unterkategorien und Artikeln) durch
  const handleExecuteDeleteCategory = async (id: string) => {
    const { deleteCategoryWithChildren } = await import('@/lib/catalog-storage');
    const success = await deleteCategoryWithChildren(id);
    if (success) {
      toast({ title: 'Kategorie gelöscht' });
      setDeletingCategoryId(null);
      refreshData();
    } else {
      toast({ title: 'Fehler beim Löschen', variant: 'destructive' });
    }
  };

  const confirmDeleteItem = async () => { 
    if (!itemToDelete) return; 
    // Fallback falls es doch mal über das Modal kommen sollte (wird aber jetzt inline gemacht)
    if (itemToDelete.type === 'category') { 
      const { deleteCategoryWithChildren } = await import('@/lib/catalog-storage'); 
      const success = await deleteCategoryWithChildren(itemToDelete.id); 
      if (success) refreshData(); 
    } 
    setIsDeleteDialogOpen(false); setItemToDelete(null); 
  };
  
  const handleSaveNewSubCategory = async () => { if (!inlineCreateParentId || !inlineNewSubCategoryName.trim()) return; const siblings = categories.filter(c => c.parentId === inlineCreateParentId); const nextOrder = siblings.length; const newCat = await addCategory({ name: inlineNewSubCategoryName.trim(), parentId: inlineCreateParentId, order: nextOrder, source: 'own' }); if (newCat) { setInlineCreateParentId(null); setInlineNewSubCategoryName(''); refreshData(); } };

  const handleCategoryUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeCategoryIdForImage) return;

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 120;
            let width = img.width;
            let height = img.height;
            if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } }
            else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
          };
          img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
      });

      const base64 = await base64Promise;
      const { updateCategoryImage } = await import('@/lib/catalog-storage');
      const success = await updateCategoryImage(activeCategoryIdForImage, base64);
      if (success) {
        impactMedium();
        toast({ title: "Kategoriebild aktualisiert" });
        refreshData();
      }
    } catch (err) {
      toast({ title: "Fehler beim Upload", variant: "destructive" });
    }
  };

  const handleCategoryPasteImage = async (categoryId: string) => {
    try {
      const items = await navigator.clipboard.read();
      let blob: Blob | null = null;
      for (const item of items) {
        const imageType = item.types.find(type => type.startsWith('image/'));
        if (imageType) {
          blob = await item.getType(imageType);
          break;
        }
      }

      if (!blob) {
        toast({ title: "Kein Bild in der Zwischenablage", variant: "destructive" });
        return;
      }

      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 120;
            let width = img.width;
            let height = img.height;
            if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } }
            else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
          };
          img.src = event.target?.result as string;
        };
        reader.readAsDataURL(blob);
      });

      const base64 = await base64Promise;
      const { updateCategoryImage } = await import('@/lib/catalog-storage');
      const success = await updateCategoryImage(categoryId, base64);
      if (success) {
        impactMedium();
        toast({ title: "Bild eingefügt" });
        refreshData();
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Fehler beim Zugriff auf Zwischenablage", variant: "destructive" });
    }
  };

  const renderAdminActions = (category: Category) => (
    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical size={14} /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => { setActiveCategoryIdForImage(category.id); categoryImageInputRef.current?.click(); }} className="gap-2"><ImagePlus size={14} /> Bild hochladen</DropdownMenuItem>
      <DropdownMenuItem onClick={() => handleCategoryPasteImage(category.id)} className="gap-2"><ClipboardPaste size={14} /> Bild einfügen</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => { setInlineCreateParentId(category.id); setInlineNewSubCategoryName(''); }} className="gap-2"><PlusCircle size={14} /> Untergruppe</DropdownMenuItem>
      <DropdownMenuItem onClick={() => { setInlineEditingCategoryId(category.id); setInlineEditedCategoryName(category.name); }} className="gap-2"><Edit3 size={14} /> Umbenennen</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => handleInitiateDeleteCategory(category.id)} className="gap-2 text-red-400"><Trash2 size={14} /> Löschen</DropdownMenuItem>
    </DropdownMenuContent></DropdownMenu>
  );

  const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = async (e) => {
      const text = e.target?.result as string; const { catalog, error } = parseCsvToCatalog(text);
      if (error || !catalog) { toast({ title: 'Fehler' }); return; }
      const draftId = await createImportDraft(file.name, null); if (draftId) { await updateImportDraftSuccess(draftId, catalog); refreshDrafts(); }
    };
    reader.readAsText(file); if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirmReviewImport = async (id: string, data: any, targetId: string | null, supplierId: string | null, importMode?: string) => {
    if ((importMode === 'add_to_existing' || importMode === 'replace_all') && targetId) {
      if (importMode === 'replace_all') await supabase.from('articles').delete().eq('category_id', targetId);
      const allArts = data.flatMap((c: any) => c.articles || []);
      const inserts = allArts.map((art: any, idx: number) => ({ name: art.name, article_number: art.articleNumber, unit: art.unit, category_id: targetId, supplier_id: art.supplierId || (supplierId === 'none' ? null : supplierId), order: idx, source: 'own' }));
      if (inserts.length > 0) await supabase.from('articles').insert(inserts);
    } else {
      const catalogData: any[] = [];
      data.forEach((flatCat: any) => {
        const parts = flatCat.categoryName.split('>').map((p: string) => p.trim()).filter(Boolean); if (parts.length === 0) return;
        let current = catalogData; let target: any = null;
        for (let i = 0; i < parts.length; i++) {
          let found = current.find((c: any) => c.categoryName === parts[i]);
          if (!found) { found = { categoryName: parts[i], articles: [], subCategories: [] }; current.push(found); }
          target = found; current = found.subCategories;
        }
        if (target) target.articles.push(...(flatCat.articles || []));
      });
      await batchAddCatalog(catalogData, categories, targetId, supplierId, 'own');
    }
    await markImportDraftCompleted(id); setReviewingDraft(null); refreshData(); refreshDrafts();
  };

  return (
    <motion.div className="h-full flex flex-col relative overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="relative z-10 flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-1 min-h-0 overflow-hidden relative">
          <div className="hidden xl:block relative shrink-0 h-full border-r" style={{ width: `${sidebarWidth}px` }}>
            <aside className="absolute inset-0 flex flex-col bg-card">
              <div className="absolute top-0 bottom-0 right-0 w-1.5 cursor-col-resize z-30" onMouseDown={handleSidebarMouseDown} />
              <div className="p-4 border-b bg-muted/30"><div className="flex bg-background border rounded-xl p-1"><button onClick={() => setView('catalog')} className={cn("flex-1 px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all", view === 'catalog' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground")}>Eigener Katalog</button><button onClick={() => setView('wholesale')} className={cn("flex-1 px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all", view === 'wholesale' ? "bg-amber-500 text-white shadow-sm" : "text-muted-foreground")}>Großhändler Suche</button></div></div>
              {view === 'catalog' ? (
                <>
                  <div className="p-4 border-b shrink-0"><p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-2 flex items-center gap-2"><ListPlus size={14} /> Hauptgruppen</p><div className="flex gap-2"><Input value={newMainCategoryName} onChange={e => setNewMainCategoryName(e.target.value)} placeholder="Neue Gruppe..." className="h-9 text-xs flex-1" onKeyDown={e => e.key === 'Enter' && handleAddMainCategory()} /><Button onClick={handleAddMainCategory} className="h-9 w-9 p-0"><PlusCircle size={16} /></Button></div></div>
                  <div className="flex-1 overflow-y-auto py-2"><CategoryTree categories={categories} activeCategoryId={activeCategoryId} expandedCategories={expandedCategories} onSelectCategory={handleSelectCategory} onToggleExpansion={toggleCategoryExpansion} renderActions={renderAdminActions} onReorderCategory={handleReorderCategory} inlineEditingCategoryId={inlineEditingCategoryId} editedCategoryName={inlineEditedCategoryName} onEditedCategoryNameChange={setInlineEditedCategoryName} onSaveEdit={handleSaveEditCategory} deletingCategoryId={deletingCategoryId} onConfirmDeleteCategory={handleExecuteDeleteCategory} onCancelDeleteCategory={() => setDeletingCategoryId(null)} onCancelEdit={() => setInlineEditingCategoryId(null)} inlineCreateParentId={inlineCreateParentId} newSubCategoryName={inlineNewSubCategoryName} onNewSubCategoryNameChange={setInlineNewSubCategoryName} onSaveNewSubCategory={handleSaveNewSubCategory} onCancelNewSubCategory={() => setInlineCreateParentId(null)} /></div>
                </>
              ) : (
                <div className="flex-1 p-6 flex flex-col items-center justify-center text-center space-y-4 opacity-60"><div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500"><Search size={32} /></div><p className="text-xs font-medium text-muted-foreground">Datanorm-Suche aktiv</p></div>
              )}
              <div className="p-4 border-t bg-muted/20 space-y-2 shrink-0">
                <p className="text-[9px] font-bold uppercase text-muted-foreground flex items-center gap-1.5"><Sparkles size={10} className="text-emerald-400" /> KI-Management</p>
                <div onClick={() => setIsDraftsDialogOpen(true)} className="p-2 border rounded-lg bg-background cursor-pointer hover:bg-muted text-xs font-semibold flex justify-between items-center relative overflow-hidden group">
                  <span className="flex items-center gap-2">KI-Scans prüfen</span>
                  
                  <div className="flex gap-1.5">
                    {/* Zeige laufende Scans an (blinkend) */}
                    {importDrafts.filter(d => d.status === 'processing').length > 0 && (
                      <Badge variant="secondary" className="text-[10px] bg-blue-500/20 text-blue-400 border-blue-500/30 animate-pulse flex items-center gap-1">
                        <Loader2 size={10} className="animate-spin" /> 
                        {importDrafts.filter(d => d.status === 'processing').length} aktiv
                      </Badge>
                    )}
                    
                    {/* Zeige fertige Scans an, die zur Überprüfung bereitstehen */}
                    {importDrafts.filter(d => d.status === 'ready_for_review').length > 0 && (
                      <Badge variant="default" className="text-[10px] bg-emerald-500 hover:bg-emerald-600 text-white">
                        {importDrafts.filter(d => d.status === 'ready_for_review').length} bereit
                      </Badge>
                    )}
                    
                    {/* Fallback: Keine Scans */}
                    {importDrafts.filter(d => d.status === 'processing' || d.status === 'ready_for_review').length === 0 && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground border-border">
                        0
                      </Badge>
                    )}
                  </div>
                </div>
                <div onClick={() => fileInputRef.current?.click()} className="p-3 border rounded-lg bg-background cursor-pointer hover:bg-muted flex items-center gap-2 text-[10px] font-bold w-full"><FileUp size={14} className="text-emerald-400" /> CSV Katalog-Import</div>
                <Button onClick={() => setIsSupplierManagementDialogOpen(true)} variant="ghost" className="w-full justify-start h-8 text-[10px] font-bold uppercase"><FolderPlus size={12} className="mr-2 text-teal-400" /> Stammdaten</Button>
              </div>
            </aside>
          </div>
          <div className="flex-1 min-w-0 overflow-y-auto bg-background p-4 lg:p-6">
            {view === 'wholesale' ? (
              <WholesaleCatalogPanel ownCategories={categories} onArticlesCopied={refreshData} />
            ) : activeCategoryId ? (
              <ArticleManagementPanel categoryName={categories.find(c => c.id === activeCategoryId)?.name || ''} categoryId={activeCategoryId} articles={articlesAdmin.filter(a => a.categoryId === activeCategoryId)} allArticles={articlesAdmin} onAddNewArticle={data => handleAddNewArticleToCategory(activeCategoryId, data)} onUpdateExistingArticle={handleUpdateExistingArticle} onReorderArticles={handleReorderArticlesInCategory} onDeleteArticles={handleDeleteArticles} onAssignSupplier={handleAssignSupplierToArticles} allCategories={categories} suppliers={suppliers} onAssignImage={handleAssignImageToArticles} onNavigateCategory={() => {}} onDataChanged={refreshData} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50"><Package size={48} className="mb-4" /><p>Wähle eine Gruppe aus</p></div>
            )}
          </div>
        </div>
      </div>
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Löschen?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Nein</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteItem} className="bg-red-500">Ja, Löschen</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <SupplierManagementDialog isOpen={isSupplierManagementDialogOpen} onClose={() => setIsSupplierManagementDialogOpen(false)} suppliers={suppliers} onAddSupplier={refreshData} onUpdateSupplier={refreshData} onDeleteSupplier={refreshData} />
      <ImportDraftsDialog isOpen={isDraftsDialogOpen} onClose={() => setIsDraftsDialogOpen(false)} onOpenDraft={d => { setIsDraftsDialogOpen(false); setReviewingDraft(d); }} />
      <ImportReviewDialog draft={reviewingDraft} isOpen={!!reviewingDraft} onClose={() => setReviewingDraft(null)} onSaveDraft={(id, data, sid) => updateImportDraftData(id, data, sid)} onConfirmImport={handleConfirmReviewImport} categories={categories} suppliers={suppliers} articles={articlesAdmin} defaultTargetCategoryId={activeCategoryId || ''} />
      <input type="file" ref={fileInputRef} onChange={handleCsvUpload} accept=".csv" className="hidden" />
      <input type="file" ref={categoryImageInputRef} onChange={handleCategoryUploadImage} accept="image/*" className="hidden" />
    </motion.div>
  );
};

export default AdminPage;
