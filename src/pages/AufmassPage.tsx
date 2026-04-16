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
  ChevronLeft, Plus, Minus, FileDown, Menu, Check, Package, Sparkles,
  Copy, FileSpreadsheet, BookMarked, Search, X as CloseIcon, Trash2,
  FolderOpen, PenLine, ChevronRight, FolderPlus
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import { useHapticFeedback } from '@/hooks/use-haptic-feedback';
import { SwipeableItem } from '@/components/catalog/SwipeableItem';
import Fuse from 'fuse.js';

// --- Types ---

interface ProcessedSummaryItem extends ProjectSelectedItem {
  article?: Partial<Omit<Article, 'price'>>;
}

// --- Main Page ---

const AufmassPage = () => {
  const [articlesData, setArticlesData] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isCategorySheetOpen, setIsCategorySheetOpen] = useState(false);
  const [isCatalogDrawerOpen, setIsCatalogDrawerOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMainCategoryId, setSelectedMainCategoryId] = useState<string | null>(null);
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string | null>(null);
  const activeCategoryId = selectedSubCategoryId || selectedMainCategoryId;
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [isAddingSectionOpen, setIsAddingSectionOpen] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
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
    if (!projectId) { navigate('/projects'); return; }

    let isMounted = true;
    const unsubCats = subscribeToCategories(cats => { if (isMounted) setCategories(cats); });
    const unsubArts = subscribeToArticles(arts => { if (isMounted) setArticlesData(arts); });
    const unsubSupps = subscribeToSuppliers(() => {});

    const load = async () => {
      const project = await getProjectById(projectId);
      if (!project) { navigate('/projects'); return; }
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
    if (categories.length > 0 && !selectedMainCategoryId) {
      setSelectedMainCategoryId(categories.find(c => c.parentId === null)?.id || null);
    }
  }, [categories, selectedMainCategoryId]);

  const activeCategory = useMemo(() =>
    categories.find(c => c.id === activeCategoryId), [categories, activeCategoryId]);

  // Expand category hierarchy logic mostly handles finding subsets based on search.
  const expandedCategoryIds = useMemo(() => {
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
        id: crypto.randomUUID(),
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

  // Add section
  const handleAddSection = async () => {
    if (!currentProject || !newSectionName.trim()) return;
    const order = currentProject.selectedItems.length;
    const newSec = await addSection(currentProject.id, newSectionName, order);
    if (newSec) {
      updateLocalItem(newSec);
      setActiveSectionId(newSec.id);
      toast({ title: 'Abschnitt erstellt', description: newSectionName });
    }
    setNewSectionName('');
    setIsAddingSectionOpen(false);
  };

  // Add manual position
  const handleAddManualPosition = async () => {
    if (!currentProject || !manualName.trim()) return;
    const newItem: ProjectSelectedItem = {
      id: crypto.randomUUID(),
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
    const sectionItems = currentProject.selectedItems.filter(i => i.type === 'section').sort((a, b) => a.order - b.order);
    const articleItems = processedSummaryItems.filter(i => i.type === 'article');

    let csv = '';
    const exportSection = (sId: string | null, label: string) => {
      const items = articleItems.filter(i => i.section_id === sId);
      if (items.length === 0) return;
      csv += `"${label}"\n`;
      csv += 'Menge;Artikelnummer;Bezeichnung\n';
      items.forEach(i => {
        const qty = i.quantity ?? 0;
        const artNum = i.article?.articleNumber ?? i.article_number ?? '';
        const name = i.article?.name ?? i.name ?? '';
        csv += `${qty};"${artNum}";"${name}"\n`;
      });
      csv += '\n';
    };

    // Per-section breakdown
    exportSection(null, 'Allgemein');
    sectionItems.forEach(s => exportSection(s.id, s.text ?? 'Abschnitt'));

    // Total summary (aggregated across all sections)
    if (sectionItems.length > 0) {
      csv += `"=== GESAMTÜBERSICHT ==="\n`;
      csv += 'Menge Gesamt;Artikelnummer;Bezeichnung\n';
      const totals = new Map<string, { name: string; artNum: string; qty: number }>();
      articleItems.forEach(i => {
        const key = i.article?.articleNumber ?? i.article_number ?? i.article?.name ?? i.name ?? i.id;
        const existing = totals.get(key);
        const qty = i.quantity ?? 0;
        const name = i.article?.name ?? i.name ?? 'Manuell';
        const artNum = i.article?.articleNumber ?? i.article_number ?? '';
        if (existing) {
          totals.set(key, { ...existing, qty: existing.qty + qty });
        } else {
          totals.set(key, { name, artNum, qty });
        }
      });
      totals.forEach(v => {
        csv += `${v.qty};"${v.artNum}";"${v.name}"\n`;
      });
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `aufmass_${currentProject.name}.csv`);
    link.click();
    impactMedium();
    toast({ title: 'CSV exportiert' });
  };

  // Export PDF
  const handleGeneratePdf = async () => {
    if (!currentProject) return;
    const sectionItems = currentProject.selectedItems.filter(i => i.type === 'section').sort((a, b) => a.order - b.order);
    const articleItems = processedSummaryItems.filter(i => i.type === 'article');

    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(`Projekt: ${currentProject.name}`, 15, 20);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150);
    doc.text(`Erstellt: ${new Date().toLocaleDateString('de-DE')}`, 15, 28);
    doc.setTextColor(0);
    let y = 40;

    const checkNewPage = () => { if (y > 270) { doc.addPage(); y = 20; } };

    const renderSection = (sId: string | null, label: string) => {
      const items = articleItems.filter(i => i.section_id === sId);
      if (items.length === 0) return;
      checkNewPage();
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(label, 15, y); y += 7;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      items.forEach(i => {
        checkNewPage();
        const name = i.article?.name ?? i.name ?? 'Manuell';
        const qty = i.quantity ?? 0;
        const artNum = i.article?.articleNumber ?? i.article_number ?? '';
        const unit = i.article?.unit ?? i.unit ?? '';
        doc.text(`${qty}${unit ? ' ' + unit : 'x'}`, 20, y);
        doc.text(`${name}${artNum ? '  (' + artNum + ')' : ''}`, 45, y);
        y += 6;
      });
      y += 4;
    };

    // Per-section breakdown
    renderSection(null, 'Allgemein');
    sectionItems.forEach(s => renderSection(s.id, s.text ?? 'Abschnitt'));

    // Total summary page (only if there are sections)
    if (sectionItems.length > 0 && articleItems.length > 0) {
      doc.addPage();
      y = 20;
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Gesamtübersicht', 15, y); y += 10;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120);
      doc.text('Alle Abschnitte aufsummiert – für die Bestellung', 15, y); y += 8;
      doc.setTextColor(0);
      doc.setFontSize(10);

      const totals = new Map<string, { name: string; artNum: string; unit: string; qty: number }>();
      articleItems.forEach(i => {
        const key = i.article?.articleNumber ?? i.article_number ?? i.article?.name ?? i.name ?? i.id;
        const existing = totals.get(key);
        const qty = i.quantity ?? 0;
        if (existing) {
          totals.set(key, { ...existing, qty: existing.qty + qty });
        } else {
          totals.set(key, {
            name: i.article?.name ?? i.name ?? 'Manuell',
            artNum: i.article?.articleNumber ?? i.article_number ?? '',
            unit: i.article?.unit ?? i.unit ?? '',
            qty,
          });
        }
      });

      totals.forEach(v => {
        checkNewPage();
        doc.setFont('helvetica', 'bold');
        doc.text(`${v.qty}${v.unit ? ' ' + v.unit : 'x'}`, 20, y);
        doc.setFont('helvetica', 'normal');
        doc.text(`${v.name}${v.artNum ? '  (' + v.artNum + ')' : ''}`, 45, y);
        y += 6;
      });
    }

    doc.save(`aufmass_${currentProject.name}.pdf`);
    toast({ title: 'PDF erstellt' });
  };

  // Category column rendering for sidebar
  const renderCategoryColumn = (parentId: string | null = null, isSubColumn = false): JSX.Element => {
    const columnCategories = categories.filter(category => category.parentId === parentId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    
    if (columnCategories.length === 0) {
      if (parentId === null) {
        return (
          <div className="py-16 text-center space-y-4">
            <p className="text-white/60 font-medium text-xs">Keine Kategorien vorhanden</p>
          </div>
        );
      } else {
        return (
           <div className="py-6 text-center px-4">
             <p className="text-white/40 text-[10px] font-medium mb-3">Keine Unterkategorien</p>
           </div>
        );
      }
    }

    return (
      <ul className="space-y-1.5 px-2">
        {columnCategories.map((category) => {
          const hasChildren = categories.some(subCat => subCat.parentId === category.id);
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
                    setSelectedSubCategoryId(null);
                  }
                  if (window.innerWidth < 1024 && (!hasChildren || isSubColumn)) {
                    // Mobile dismiss logic, we can keep using original states
                    // Actually, we don't need 'setIsCatalogDrawerOpen' here as we removed it for desktop
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
              </div>
            </li>
          );
        })}
      </ul>
    );
  };

  // Summary list component (shared between bottom sheet + right panel)
  const SummaryList = () => {
    const sectionItems = currentProject?.selectedItems.filter(i => i.type === 'section').sort((a, b) => a.order - b.order) ?? [];
    const articleItems = processedSummaryItems.filter(i => i.type === 'article');

    const renderSectionGroup = (sId: string | null, label: string) => {
      const items = articleItems.filter(i => i.section_id === sId);
      if (items.length === 0 && sId !== null) return null;
      return (
        <div key={sId ?? 'general'} className="mb-4">
          <button
            onClick={() => setActiveSectionId(sId)}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left mb-2 transition-colors',
              activeSectionId === sId ? 'bg-emerald-500/15 text-emerald-400' : 'text-white/50 hover:bg-white/5 hover:text-white/80'
            )}
          >
            <FolderOpen size={14} />
            <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
          </button>
          {items.length === 0 ? (
            <p className="text-xs text-white/20 px-3 mb-2">Keine Positionen</p>
          ) : (
            <div className="space-y-1">
              {items.map(item => (
                <SwipeableItem key={item.id} id={item.id} onDelete={() => handleDeleteItem(item.id)}>
                  <div className="flex items-center justify-between gap-3 px-3 py-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{item.article?.name ?? item.name ?? 'Manuell'}</p>
                      <p className="text-xs text-white/30 font-mono">{item.article?.articleNumber ?? item.article_number ?? '—'}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button onClick={() => handleDeleteItem(item.id)} variant="ghost" size="icon" className="h-7 w-7 text-white/20 hover:text-red-400">
                        <Trash2 size={13} />
                      </Button>
                      <span className="text-white font-bold text-sm min-w-[2rem] text-center">{item.quantity}</span>
                    </div>
                  </div>
                </SwipeableItem>
              ))}
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="overflow-y-auto flex-1 p-4 space-y-1">
        {renderSectionGroup(null, 'Allgemein')}
        {sectionItems.map(s => renderSectionGroup(s.id, s.text ?? 'Abschnitt'))}
        {articleItems.length === 0 && (
          <div className="text-center py-12 text-white/30 text-sm">Keine Artikel im Aufmaß</div>
        )}
      </div>
    );
  };

  // Section selector bar
  const SectionBar = () => (
    <div className="flex items-center gap-2 px-4 py-3 overflow-x-auto border-b border-white/5 shrink-0">
      <button
        onClick={() => setActiveSectionId(null)}
        className={cn(
          'shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap',
          activeSectionId === null
            ? 'bg-emerald-500 text-white shadow-lg'
            : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
        )}
      >
        Allgemein
      </button>
      {sections.map(sec => (
        <button
          key={sec.id}
          onClick={() => setActiveSectionId(sec.id)}
          className={cn(
            'shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap',
            activeSectionId === sec.id
              ? 'bg-emerald-500 text-white shadow-lg'
              : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
          )}
        >
          {sec.text}
        </button>
      ))}
      {isAddingSectionOpen ? (
        <div className="flex items-center gap-2 shrink-0">
          <Input
            value={newSectionName}
            onChange={e => setNewSectionName(e.target.value)}
            placeholder="Abschnitt Name..."
            className="h-8 w-36 glass-input text-sm"
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleAddSection(); if (e.key === 'Escape') setIsAddingSectionOpen(false); }}
          />
          <Button onClick={handleAddSection} size="sm" className="h-8 glass-button px-3">OK</Button>
          <Button onClick={() => setIsAddingSectionOpen(false)} size="sm" variant="ghost" className="h-8 px-2 text-white/50">✕</Button>
        </div>
      ) : (
        <button
          onClick={() => setIsAddingSectionOpen(true)}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-white/5 text-emerald-400 hover:bg-emerald-500/10 transition-all whitespace-nowrap border border-emerald-500/20"
        >
          <Plus size={14} /> Abschnitt
        </button>
      )}
    </div>
  );

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
    <div className="flex h-[calc(100vh-3rem)] overflow-hidden relative">
      {/* Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="orb orb-emerald w-64 h-64 -top-10 right-20" style={{ animationDelay: '0s' }} />
        <div className="orb orb-teal w-48 h-48 bottom-40 -left-10" style={{ animationDelay: '-2s' }} />
      </div>

      {/* ===== STAGGERED DRAWER CONTAINER (Desktop/Tablet Landscape) ===== */}
      <div className={cn(
        "hidden lg:block relative shrink-0 transition-[width] duration-300 h-full",
        selectedMainCategoryId ? "w-[344px] xl:w-[364px]" : "w-[288px] xl:w-[308px]" // 56px offset
      )}>
        
        {/* Drawer 1: HAUPTGRUPPEN */}
        <aside className={cn(
          "absolute top-0 bottom-0 left-0 w-[288px] xl:w-[308px] flex flex-col border-r border-white/5 bg-slate-900/95 shadow-[10px_0_30px_rgba(0,0,0,0.5)] transition-[z-index] duration-0 delay-75",
          "hover:z-50 hover:delay-0 group/haupt",
          selectedMainCategoryId ? "z-10" : "z-20"
        )}>
          <div className="p-4 border-b border-white/5 bg-white/[0.02] shrink-0">
             <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
               <BookMarked size={14} /> Artikelkatalog
             </h2>
          </div>
          <div className="flex-1 overflow-y-auto py-3">
             {renderCategoryColumn(null, false)}
          </div>
        </aside>

        {/* Drawer 2: UNTERGRUPPEN */}
        {selectedMainCategoryId && (
          <aside className={cn(
            "absolute top-0 bottom-0 left-[56px] w-[288px] xl:w-[308px] flex flex-col border-l border-r border-teal-500/30 bg-slate-900/95 backdrop-blur shadow-[-20px_0_40px_rgba(0,0,0,0.6)] transition-[z-index] duration-0 delay-75 animate-in slide-in-from-left-4 fade-in duration-300",
            "hover:z-50 z-20 hover:delay-0 group/unter"
          )}>
            <div className="px-4 py-3 border-b border-white/5 bg-white/[0.01] flex items-center justify-between shrink-0 h-[53px]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-teal-400/80">Untergruppen</p>
            </div>
            <div className="flex-1 overflow-y-auto py-3">
              {renderCategoryColumn(selectedMainCategoryId, true)}
            </div>
          </aside>
        )}
      </div>

      {/* ===== CENTER: Main Content ===== */}
      <div className="flex-1 flex flex-col overflow-hidden z-20 min-w-0">
        {/* Page header – slim, no duplicate back-button on desktop */}
        <header className="shrink-0 border-b border-white/5 bg-slate-900/40 backdrop-blur-sm">
          <div className="flex items-center justify-between px-4 h-12 gap-3">
            {/* Left: back (mobile only) + project name */}
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => navigate('/projects')}
                className="xl:hidden p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all shrink-0"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="min-w-0">
                <h1 className="font-semibold text-white text-sm truncate">{currentProject.name}</h1>
                <p className="text-[11px] text-white/40 leading-tight">{totalArticleCount} Artikel erfasst</p>
              </div>
            </div>
            {/* Right: catalog (mobile/tablet) + manual position button */}
            <div className="flex items-center gap-1.5">
              <Sheet open={isCategorySheetOpen} onOpenChange={setIsCategorySheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="xl:hidden h-8 px-2.5 text-white/50 hover:text-white hover:bg-white/10 gap-1.5">
                    <Menu size={15} className="text-emerald-400" />
                    <span className="hidden sm:inline text-xs">Katalog</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[85vw] sm:w-[400px] rounded-r-3xl border-r border-white/10 bg-slate-900/95 backdrop-blur-xl flex flex-col p-0">
                  <SheetHeader className="p-6 pb-4 border-b border-white/5 shrink-0">
                    <SheetTitle className="text-left text-xl text-gradient-emerald flex items-center gap-2">
                      <BookMarked size={20} className="text-emerald-400" /> Artikelkatalog
                    </SheetTitle>
                  </SheetHeader>
                  <div className="overflow-y-auto p-4 flex-1 space-y-6">
                    <div>
                      {renderCategoryColumn(null, false)}
                    </div>
                    {selectedMainCategoryId && (
                      <div className="pt-4 border-t border-white/10 relative">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-teal-400/80 mb-3 ml-2">Untergruppen</p>
                        {renderCategoryColumn(selectedMainCategoryId, true)}
                      </div>
                    )}
                  </div>
                  <div className="p-6 border-t border-white/5 bg-white/[0.02]">
                    <Button variant="ghost" onClick={() => { setSelectedMainCategoryId(null); setSelectedSubCategoryId(null); setIsCategorySheetOpen(false); }} className="w-full text-white/50 hover:text-white">
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

        {/* Section Bar */}
        <SectionBar />

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
      </div>

      {/* ===== RIGHT PANEL: Summary (Tablet landscape+ = permanent, Mobile = BottomSheet) ===== */}
      {/* Desktop/Tablet permanent panel */}
      <aside className="hidden lg:flex flex-col w-80 xl:w-96 shrink-0 border-l border-white/10 bg-slate-900/60 backdrop-blur-xl z-10">
        <div className="p-4 border-b border-white/5 shrink-0">
          <h2 className="text-sm font-bold text-white/60 uppercase tracking-wider">Aufmaß</h2>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{totalArticleCount} <span className="text-sm font-normal text-white/40">Artikel</span></p>
        </div>
        <SummaryList />
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
        <SheetContent side="bottom" className="h-[85vh] rounded-t-[2.5rem] border-t border-white/10 bg-slate-900/95 backdrop-blur-xl flex flex-col p-0">
          <SheetHeader className="p-6 pb-4 border-b border-white/5 shrink-0">
            <SheetTitle className="text-left text-xl text-gradient-emerald">Aktuelles Aufmaß</SheetTitle>
          </SheetHeader>
          <SummaryList />
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
        <DialogContent className="ios-card border border-white/10 bg-slate-900/95 sm:max-w-md">
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
    </div>
  );
};

// --- ArticleCard Component ---

interface ArticleCardProps {
  article: Article;
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onReset: () => void;
  categoryImageUrl?: string;
}

function ArticleCard({ article, quantity, onIncrement, onDecrement, onReset, categoryImageUrl }: ArticleCardProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const { impactLight } = useHapticFeedback();

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!article.articleNumber) return;
    await navigator.clipboard.writeText(article.articleNumber);
    setCopied(true);
    impactLight();
    toast({ title: 'Artikelnummer kopiert', description: article.articleNumber });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="ios-card overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Image */}
          <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
            {categoryImageUrl
              ? <img src={categoryImageUrl} alt="" className="w-full h-full object-cover" />
              : <Package size={20} className="text-white/10" />}
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-white leading-tight line-clamp-2 flex-1">{article.name}</h3>
              {quantity > 0 && (
                <div className="shrink-0 bg-gradient-to-br from-emerald-500 to-teal-500 text-white text-sm font-bold px-2.5 py-1 rounded-lg shadow-lg">
                  {quantity}×
                </div>
              )}
            </div>
            {article.articleNumber && (
              <div className="flex items-center gap-1.5 mt-1">
                <p className="text-xs text-white/40 font-mono">Art.-Nr: {article.articleNumber}</p>
                <button
                  onClick={handleCopy}
                  className={cn('p-1 rounded-md transition-all', copied ? 'text-emerald-400 bg-emerald-500/10' : 'text-white/20 hover:text-white hover:bg-white/10')}
                >
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                </button>
              </div>
            )}
            {article.unit && <p className="text-xs text-white/30 mt-0.5">Einheit: {article.unit}</p>}
          </div>
        </div>

        {/* Action Row */}
        <div className="flex items-center gap-2 mt-4">
          <Button
            onClick={onDecrement}
            size="icon"
            disabled={quantity <= 0}
            className="h-11 w-11 rounded-xl ios-button-secondary shrink-0 disabled:opacity-50"
            aria-label="Minus"
          >
            <Minus size={20} />
          </Button>
          <div className="flex-1 flex items-center justify-center h-11 glass-input rounded-xl font-bold text-white text-xl">
            {quantity}
          </div>
          <Button
            onClick={onIncrement}
            size="icon"
            className="h-11 w-11 rounded-xl ios-button shrink-0"
            aria-label="Plus"
          >
            <Plus size={20} />
          </Button>
          <Button
            onClick={onReset}
            size="icon"
            variant="ghost"
            disabled={quantity <= 0}
            className="h-11 w-11 rounded-xl text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0 disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-white/20"
            aria-label="Entfernen"
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AufmassPage;
