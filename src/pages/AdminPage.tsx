import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusCircle, Trash2, Edit3, ChevronDown, ChevronRight, ArrowUp, ArrowDown, GripVertical, PackagePlus, ListPlus, Settings2, FolderPlus, Sparkles } from 'lucide-react';
import type { Category, Article, Supplier } from '@/lib/data';
import { subscribeToCategories, addCategory, updateCategory, batchUpdateCategories, subscribeToArticles, batchUpdateArticles, subscribeToSuppliers, addSupplier, updateSupplier, deleteSupplier, deleteArticles, addArticle, updateArticle, getCategoriesList, getArticlesList, getSuppliersList } from '@/lib/catalog-storage';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import ArticleManagementDialog from '@/components/dialogs/ArticleManagementDialog';
import SupplierManagementDialog from '@/components/dialogs/SupplierManagementDialog';

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
  const [isArticleManagementDialogOpen, setIsArticleManagementDialogOpen] = useState(false);
  const [managingCategoryDetails, setManagingCategoryDetails] = useState<{ id: string; name: string } | null>(null);
  const [isSupplierManagementDialogOpen, setIsSupplierManagementDialogOpen] = useState(false);
  const [isEditCategoryDialogOpen, setIsEditCategoryDialogOpen] = useState(false);
  const [editingCategoryData, setEditingCategoryData] = useState<{ id: string; name: string } | null>(null);
  const [editedCategoryName, setEditedCategoryName] = useState('');

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

  const handleAddNewArticleToCategory = async (newArticleData: any) => {
    if (!managingCategoryDetails) return;
    const articlesInThisCategory = articlesAdmin.filter(art => art.categoryId === managingCategoryDetails.id);
    const newOrder = articlesInThisCategory.length > 0 ? Math.max(...articlesInThisCategory.map(art => art.order ?? -1)) + 1 : 0;
    await addArticle({ ...newArticleData, categoryId: managingCategoryDetails.id, order: newOrder });
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

  const renderCategories = (parentId: string | null = null, level = 0): JSX.Element[] => {
    return categories.filter(category => category.parentId === parentId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).flatMap((category, index, filteredArray) => {
      const children = categories.filter(subCat => subCat.parentId === category.id);
      const isExpanded = expandedCategories.has(category.id);
      const isFirst = index === 0;
      const isLast = index === filteredArray.length - 1;
      return [
        <li key={category.id} className='ios-card flex justify-between items-center p-4 mb-2'
          style={{ marginLeft: `${level * 1.5}rem`}}>
          <div className="flex items-center flex-grow gap-3 min-w-0">
            <GripVertical className="h-5 w-5 text-white/30 shrink-0" />
            {children.length > 0 ? (
              <button onClick={() => setExpandedCategories(prev => {
                const next = new Set(prev);
                if (next.has(category.id)) next.delete(category.id); else next.add(category.id);
                return next;
              })} className="h-9 w-9 flex items-center justify-center text-emerald-400 hover:text-emerald-300 transition-colors rounded-lg hover:bg-white/10">
                {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              </button>
            ) : <div className="w-9"></div>}
            <span className="font-semibold text-white truncate group-hover:text-emerald-300 transition-colors">{category.name}</span>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" onClick={() => handleMoveCategory(category.id, 'up')} disabled={isFirst}
              className="h-9 w-9 text-white/40 hover:text-emerald-400 hover:bg-white/10 rounded-lg"><ArrowUp size={16} /></Button>
            <Button variant="ghost" size="icon" onClick={() => handleMoveCategory(category.id, 'down')} disabled={isLast}
              className="h-9 w-9 text-white/40 hover:text-emerald-400 hover:bg-white/10 rounded-lg"><ArrowDown size={16} /></Button>
            <Button variant="ghost" size="icon" onClick={() => { setSubCategoryParent({ id: category.id, name: category.name }); setNewSubCategoryName(''); setIsAddSubCategoryDialogOpen(true); }}
              className="h-9 w-9 text-white/40 hover:text-orange-400 hover:bg-white/10 rounded-lg"><PackagePlus size={16} /></Button>
            <Button variant="ghost" size="icon" onClick={() => { setManagingCategoryDetails({ id: category.id, name: category.name }); setIsArticleManagementDialogOpen(true); }}
              className="h-9 w-9 text-white/40 hover:text-green-400 hover:bg-white/10 rounded-lg"><ListPlus size={16} /></Button>
            <Button variant="ghost" size="icon" onClick={() => { setEditingCategoryData({ id: category.id, name: category.name }); setEditedCategoryName(category.name); setIsEditCategoryDialogOpen(true); }}
              className="h-9 w-9 text-white/40 hover:text-blue-400 hover:bg-white/10 rounded-lg"><Edit3 size={16} /></Button>
            <Button variant="ghost" size="icon" onClick={() => { setItemToDelete({id: category.id, type: 'category'}); setIsDeleteDialogOpen(true); }}
              className="h-9 w-9 text-white/40 hover:text-red-400 hover:bg-white/10 rounded-lg"><Trash2 size={16} /></Button>
          </div>
        </li>,
        ...(isExpanded ? renderCategories(category.id, level + 1) : [])
      ];
    });
  };

  return (
    <div className="min-h-screen relative">
      {/* Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="orb orb-emerald w-80 h-80 -top-20 -left-20" style={{ animationDelay: '0s' }} />
        <div className="orb orb-teal w-64 h-64 bottom-40 right-10" style={{ animationDelay: '-2s' }} />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto space-y-8 py-6 px-4 animate-in fade-in duration-500">
        <header className="text-center md:text-left space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-white/70">
            <Settings2 className="w-4 h-4 text-emerald-400" />
            <span>Administration</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gradient-white">Verwaltung</h1>
          <p className="text-white/50 text-lg">Katalogstruktur und Stammdaten pflegen</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="md:col-span-1 space-y-4">
            <div className="ios-card p-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-4 flex items-center gap-2">
                <Sparkles size={14} className="text-emerald-400" /> Aktionen
              </h3>
              <Button onClick={() => setIsSupplierManagementDialogOpen(true)} className="w-full ios-button-secondary justify-start gap-3">
                <div className="p-1.5 bg-emerald-500/20 rounded-lg"><FolderPlus size={16} className="text-emerald-400"/></div>
                Großhändler
              </Button>
            </div>
          </div>

          {/* Main Content */}
          <div className="md:col-span-3 space-y-6">
            <div className="ios-card">
              <div className="p-6 border-b border-white/10">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h2 className="text-2xl font-bold text-white">Artikelkatalog</h2>
                  <div className="flex w-full sm:w-auto gap-2">
                    <Input value={newMainCategoryName} onChange={(e) => setNewMainCategoryName(e.target.value)}
                      placeholder="Neue Hauptkategorie..." className="glass-input min-w-[200px]" />
                    <Button onClick={handleAddMainCategory} className="glass-button">
                      <PlusCircle size={18} />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <ul className="space-y-2">
                  {categories.length > 0 ? renderCategories(null) : (
                    <div className="py-16 text-center space-y-4">
                      <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                        <ListPlus size={32} className="text-emerald-400" />
                      </div>
                      <p className="text-white/60 font-medium">Keine Kategorien vorhanden</p>
                    </div>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Dialogs */}
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

        {managingCategoryDetails && (
          <ArticleManagementDialog isOpen={isArticleManagementDialogOpen} onClose={() => { setIsArticleManagementDialogOpen(false); setManagingCategoryDetails(null); }}
            categoryName={managingCategoryDetails.name} categoryId={managingCategoryDetails.id}
            articles={articlesAdmin.filter(art => art.categoryId === managingCategoryDetails.id).sort((a,b) => (a.order ?? 0) - (b.order ?? 0))}
            onAddNewArticle={handleAddNewArticleToCategory} onUpdateExistingArticle={handleUpdateExistingArticle}
            onReorderArticles={handleReorderArticlesInCategory} onDeleteArticles={handleDeleteArticles}
            onAssignSupplier={handleAssignSupplierToArticles} allCategories={categories} suppliers={suppliers}
            onAssignImage={() => {}} onNavigateCategory={() => {}} />
        )}

        <SupplierManagementDialog isOpen={isSupplierManagementDialogOpen} onClose={() => setIsSupplierManagementDialogOpen(false)}
          suppliers={suppliers} onAddSupplier={handleAddSupplierAdmin} onUpdateSupplier={handleUpdateSupplierAdmin} onDeleteSupplier={handleDeleteSupplierAdmin} />
      </div>
    </div>
  );
};

export default AdminPage;
