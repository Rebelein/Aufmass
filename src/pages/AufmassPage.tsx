import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Article, Category } from '@/lib/data';
import { subscribeToCategories, subscribeToArticles, subscribeToSuppliers, fetchWholesaleArticlesByCategory, searchWholesaleArticles } from '@/lib/catalog-storage';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { getCurrentProjectId, getProjectById, upsertProjectItem, deleteProjectItem, updateProjectItemQuantity, updateProjectItemSupplier, addSection, createProjectList } from '@/lib/project-storage';
import type { Project, ProjectSelectedItem } from '@/lib/project-storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronLeft, FileDown, Menu, Package, FileSpreadsheet, BookMarked, Search, PenLine, Sun, Moon, Mic, FileUp, Plus } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn, generateUUID, getInheritedCategoryImageUrl, compareArticleNames } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/use-haptic-feedback';
import { motion, AnimatePresence } from 'framer-motion';
import { CsvExportDialog } from '@/components/dialogs/CsvExportDialog';
import { ProjectImportDialog } from '@/components/dialogs/ProjectImportDialog';
import type { ProcessedSummaryItem } from '@/lib/types';
import { ArticleCard } from '@/components/aufmass/ArticleCard';
import { SectionBar } from '@/components/aufmass/SectionBar';
import { SummaryList } from '@/components/aufmass/SummaryList';
import { CategoryTree } from '@/components/catalog/CategoryTree';
import { AngebotTool } from '@/components/aufmass/AngebotTool';
import { useSpeechRecognition } from '@/hooks/use-speech';
import { useOfflineSync } from '@/lib/sync-queue';
import { ShinyText } from '@/components/ui/ShinyText';
import { ResizeHandle } from '@/components/ui/ResizeHandle';
import { ToastAction } from '@/components/ui/toast';

const AufmassPage = () => {
  const [articlesData, setArticlesData] = useState<Article[]>([]);
  const [dynamicWholesaleArticles, setDynamicWholesaleArticles] = useState<Article[]>([]);
  const [projectWholesaleArticles, setProjectWholesaleArticles] = useState<Article[]>([]);
  const [, setIsFetchingWholesale] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [wholesaleCategories, setWholesaleCategories] = useState<Category[]>([]);
  const [catalogSource, setCatalogSource] = useState<'own' | 'wholesale'>('own');
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [activeListId, setActiveListId] = useState<string | null>(() => localStorage.getItem('activeListId'));
  const [viewMode, setViewMode] = useState<'aufmass' | 'angebot'>('angebot');
  const [isCategorySheetOpen, setIsCategorySheetOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [, setIsOffline] = useState(!navigator.onLine);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(() => { const stored = localStorage.getItem('aufmass_sidebar_w'); return stored ? parseInt(stored) : 288; });
  const [summaryWidth, setSummaryWidth] = useState(() => { const stored = localStorage.getItem('aufmass_summary_w'); return stored ? parseInt(stored) : 320; });
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [, setIsResizingSummary] = useState(false);
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isCsvExportDialogOpen, setIsCsvExportDialogOpen] = useState(false);
  const [, setIsEditProjectOpen] = useState(false);
  const [, setEditProjectData] = useState({ name: '', client_name: '', address: '', notes: '', start_date: '', end_date: '' });
  const [theme, setTheme] = useState<'dark' | 'light'>((localStorage.getItem('theme') as 'dark' | 'light') || 'dark');
  const [manualName, setManualName] = useState('');
  const [manualQty, setManualQty] = useState('1');

  useEffect(() => {
    const handleThemeChange = () => {
      const storedTheme = localStorage.getItem('theme') as 'dark' | 'light';
      if (storedTheme && storedTheme !== theme) {
        setTheme(storedTheme);
      }
    };
    window.addEventListener('theme-change', handleThemeChange);
    return () => window.removeEventListener('theme-change', handleThemeChange);
  }, [theme]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
    window.dispatchEvent(new Event('theme-change'));
  }, [theme]);
  const [manualUnit, setManualUnit] = useState('');
  const [manualArticleNumber, setManualArticleNumber] = useState('');
  const [manualSupplierName, setManualSupplierName] = useState('');

  const { toast } = useToast();
  const navigate = useNavigate();
  const wholesaleFetchSeq = useRef(0);
  const { impactMedium, impactLight } = useHapticFeedback();

  const { isRecording, isProcessing, toggleRecording } = useSpeechRecognition((text) => { setSearchQuery(text); impactLight(); });

  useOfflineSync(() => { toast({ title: 'Online', description: 'Änderungen wurden synchronisiert.' }); setIsOffline(false); });

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  useEffect(() => { const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300); return () => clearTimeout(timer); }, [searchQuery]);

  useEffect(() => {
    if (!currentProject || isLoadingData) return;
    const checkAndCreateInitialList = async () => {
      if ((!currentProject.lists || currentProject.lists.length === 0) && !isLoadingData) {
        const defaultListName = currentProject.status === 'planning' ? 'Angebot 1' : 'Aufmaß Gesamt';
        const defaultListType = currentProject.status === 'planning' ? 'angebot' : 'aufmass';
        const newList = await createProjectList(currentProject.id, defaultListName, defaultListType);
        if (newList) {
          setCurrentProject(prev => prev ? { ...prev, lists: [newList] } : prev);
          setActiveListId(newList.id);
        }
      } else if (!activeListId && currentProject.lists && currentProject.lists.length > 0) {
        setActiveListId(currentProject.lists[0].id);
      }
    };
    checkAndCreateInitialList();
  }, [currentProject?.id, currentProject?.lists?.length, isLoadingData, activeListId]);

  useEffect(() => {
    if (activeListId) {
      localStorage.setItem('activeListId', activeListId);
    } else {
      localStorage.removeItem('activeListId');
    }
  }, [activeListId]);

  const activeCategories = catalogSource === 'own' ? categories : wholesaleCategories;

  const searchResults = useMemo(() => {
    if (catalogSource === 'wholesale') return dynamicWholesaleArticles;
    if (!debouncedSearchQuery.trim()) return [];
    const terms = debouncedSearchQuery.toLowerCase().split(/[\s/,]+/).filter(t => t.length > 0);
    if (terms.length === 0) return [];
    const isSubsequence = (term: string, word: string): boolean => { let ti = 0; for (let wi = 0; wi < word.length && ti < term.length; wi++) { if (word[wi] === term[ti]) ti++; } return ti === term.length; };
    const termMatches = (term: string, text: string): boolean => { if (text.includes(term)) return true; const words = text.split(/[\s,.\-/()]+/).filter(Boolean); return words.some(word => isSubsequence(term, word)); };
    const scored = articlesData.map(article => {
        const text = `${article.name ?? ''} ${article.articleNumber ?? ''}`.toLowerCase();
        let score = 0; let allMatch = true;
        for (const term of terms) { if (text.includes(term)) score += 2; else if (termMatches(term, text)) score += 1; else { allMatch = false; break; } }
        return { article, score, allMatch };
      }).filter(r => r.allMatch).sort((a, b) => b.score - a.score);
    return scored.map(r => r.article);
  }, [debouncedSearchQuery, articlesData, catalogSource, dynamicWholesaleArticles]);

  useEffect(() => {
    if (catalogSource !== 'wholesale') return;
    let isMounted = true;
    const seq = ++wholesaleFetchSeq.current;
    const fetchArticles = async () => {
      setIsFetchingWholesale(true);
      try {
        if (debouncedSearchQuery.trim()) {
          const results = await searchWholesaleArticles(debouncedSearchQuery);
          if (isMounted && seq === wholesaleFetchSeq.current) setDynamicWholesaleArticles(results);
        } else if (activeCategoryId) {
          const subcats = wholesaleCategories.filter(c => c.parentId === activeCategoryId);
          const validIds = [activeCategoryId, ...subcats.map(c => c.id)];
          const results = await fetchWholesaleArticlesByCategory(validIds);
          if (isMounted && seq === wholesaleFetchSeq.current) setDynamicWholesaleArticles(results);
        } else if (isMounted && seq === wholesaleFetchSeq.current) setDynamicWholesaleArticles([]);
      } finally { if (isMounted) setIsFetchingWholesale(false); }
    };
    fetchArticles();
    return () => { isMounted = false; };
  }, [catalogSource, debouncedSearchQuery, activeCategoryId, wholesaleCategories]);

  useEffect(() => {
    if (!currentProject || isLoadingData) return;
    const missingIds = currentProject.selectedItems.filter(i => i.type === 'article' && i.article_id).map(i => i.article_id!).filter(id => !articlesData.find(a => a.id === id) && !projectWholesaleArticles.find(a => a.id === id));
    if (missingIds.length === 0) return;
    let isMounted = true;
    const fetchMissing = async () => {
      const { data, error } = await supabase.from('articles').select('*, categories(name), suppliers(name)').in('id', missingIds);
      if (!error && data && isMounted) {
        setProjectWholesaleArticles(prev => {
          const newMap = new Map(prev.map(a => [a.id, a]));
          data.forEach(art => { const a = { ...art, articleNumber: art.article_number, categoryId: art.category_id, supplierId: art.supplier_id, imageUrl: art.image_url ?? undefined, source: art.source ?? 'own', categoryName: art.categories?.name || '', supplierName: art.suppliers?.name || '' }; newMap.set(a.id, a as Article); });
          return Array.from(newMap.values());
        });
      }
    };
    fetchMissing();
    return () => { isMounted = false; };
  }, [currentProject?.selectedItems, articlesData, isLoadingData, projectWholesaleArticles]);

  const [suppliers, setSuppliers] = useState<any[]>([]);

  useEffect(() => {
    const projectId = getCurrentProjectId();
    if (!projectId) { navigate('/'); return; }
    let isMounted = true;
    const unsubCats = subscribeToCategories(cats => { if (isMounted) setCategories(cats); }, 'own');
    const unsubWCats = subscribeToCategories(cats => { if (isMounted) setWholesaleCategories(cats); }, 'wholesale');
    const unsubArts = subscribeToArticles(arts => { if (isMounted) setArticlesData(arts); }, 'own');
    const unsubWArts = subscribeToArticles(() => {}, 'wholesale');
    const unsubSupps = subscribeToSuppliers(supps => { if (isMounted) setSuppliers(supps); });
    const load = async () => { const project = await getProjectById(projectId); if (!project) { navigate('/'); return; } if (isMounted) { setCurrentProject(project); setIsLoadingData(false); } };
    load();
    return () => { isMounted = false; unsubCats(); unsubWCats(); unsubArts(); unsubWArts(); unsubSupps(); };
  }, [navigate]);

  useEffect(() => { 
    setActiveCategoryId(null);
    const firstCat = (catalogSource === 'own' ? categories : wholesaleCategories).find(c => c.parentId === null);
    setActiveCategoryId(firstCat?.id || null);
  }, [catalogSource, categories, wholesaleCategories]);

  useEffect(() => { if (categories.length > 0 && !activeCategoryId && catalogSource === 'own') { setActiveCategoryId(categories.find(c => c.parentId === null)?.id || null); } }, [categories, activeCategoryId, catalogSource]);

  useEffect(() => { if (currentProject && currentProject.status !== 'planning') { setViewMode('aufmass'); } else if (currentProject && currentProject.status === 'planning' && !viewMode) { setViewMode('angebot'); } }, [currentProject?.status]);

  const toggleCategoryExpansion = (categoryId: string, e: React.MouseEvent) => { e.stopPropagation(); setExpandedCategories(prev => { const next = new Set(prev); if (next.has(categoryId)) next.delete(categoryId); else next.add(categoryId); return next; }); };

  const searchExpandedIds = useMemo(() => { if (!searchQuery.trim()) return []; const ids = new Set<string>(); const resultsToUse = catalogSource === 'own' ? searchResults : dynamicWholesaleArticles; resultsToUse.forEach(art => { let currentId: string | null | undefined = art.categoryId; while (currentId) { ids.add(currentId); const parentId = activeCategories.find(c => c.id === currentId)?.parentId; if (parentId) ids.add(parentId); currentId = parentId || undefined; } }); return Array.from(ids); }, [searchResults, dynamicWholesaleArticles, activeCategories, searchQuery, catalogSource]);

  const viewArticles = useMemo<Article[]>(() => { let result: Article[] = []; if (catalogSource === 'wholesale') { result = dynamicWholesaleArticles; } else if (searchQuery.trim().length > 0) { result = searchResults; } else if (!activeCategoryId) { result = []; } else { const subcats = activeCategories.filter(c => c.parentId === activeCategoryId); const validIds = [activeCategoryId, ...subcats.map(c => c.id)]; result = articlesData.filter(a => a.categoryId && validIds.includes(a.categoryId)); } return [...result].sort((a,b) => compareArticleNames(a.name ?? '', b.name ?? '')); }, [articlesData, activeCategoryId, searchQuery, searchResults, activeCategories, catalogSource, dynamicWholesaleArticles]);

  const sections = useMemo(() => (currentProject?.selectedItems ?? []).filter(i => {
    const isSection = i.type === 'section';
    if (!isSection) return false;
    if (!currentProject?.lists || currentProject.lists.length === 0) return true;
    return i.list_id === activeListId;
  }).sort((a,b) => (a.order ?? 0) - (b.order ?? 0)), [currentProject, activeListId]);

  const processedSummaryItems = useMemo(() => {
    if (!currentProject) return [];
    
    // Filter items by active list if lists exist
    const filteredByList = currentProject.selectedItems.filter(item => {
      if (!currentProject.lists || currentProject.lists.length === 0) return true;
      return item.list_id === activeListId;
    });

    const enrichedItems = filteredByList.map(item => { if (item.type === 'article' && item.article_id) { const articleDetail = articlesData.find(a => a.id === item.article_id) ?? dynamicWholesaleArticles.find(a => a.id === item.article_id) ?? projectWholesaleArticles.find(a => a.id === item.article_id); const allCats = [...categories, ...wholesaleCategories]; const categoryImageUrl = getInheritedCategoryImageUrl(articleDetail?.categoryId, allCats); return { ...item, article: articleDetail, categoryImageUrl }; } return item as ProcessedSummaryItem; });
    return (enrichedItems as ProcessedSummaryItem[]).sort((a, b) => { if (a.type === 'section' || b.type === 'section') return (a.order ?? 0) - (b.order ?? 0); const getCategoryPathOrder = (categoryId?: string): string => { if (!categoryId) return '999999'; const path: number[] = []; let currId: string | undefined | null = categoryId; const allCats = [...categories, ...wholesaleCategories]; while (currId) { const cat = allCats.find(c => c.id === currId); if (!cat) break; path.unshift(cat.order ?? 0); currId = cat.parentId; } return path.map(n => n.toString().padStart(5, '0')).join('-'); }; const pathA = getCategoryPathOrder(a.article?.categoryId); const pathB = getCategoryPathOrder(b.article?.categoryId); if (pathA !== pathB) return pathA.localeCompare(pathB); return compareArticleNames(a.article?.name ?? a.name ?? '', b.article?.name ?? b.name ?? ''); });
  }, [currentProject, articlesData, dynamicWholesaleArticles, projectWholesaleArticles, categories, wholesaleCategories, activeListId]);

  const totalArticleCount = useMemo(() => processedSummaryItems.filter(i => i.type === 'article').reduce((s, i) => s + (i.quantity ?? 0), 0), [processedSummaryItems]);

  const getQuantityInSection = useCallback((articleId: string): number => {
    if (!currentProject) return 0;
    return currentProject.selectedItems.filter(i => 
      i.type === 'article' && 
      i.article_id === articleId && 
      i.section_id === activeSectionId &&
      (!currentProject.lists || currentProject.lists.length === 0 || i.list_id === activeListId)
    ).reduce((s, i) => s + (i.quantity ?? 0), 0);
  }, [currentProject, activeSectionId, activeListId]);

  const getItemInSection = useCallback((articleId: string): ProjectSelectedItem | undefined => {
    if (!currentProject) return undefined;
    return currentProject.selectedItems.find(i => 
      i.type === 'article' && 
      i.article_id === articleId && 
      i.section_id === activeSectionId &&
      (!currentProject.lists || currentProject.lists.length === 0 || i.list_id === activeListId)
    );
  }, [currentProject, activeSectionId, activeListId]);

  const updateLocalItem = useCallback((updatedItem: ProjectSelectedItem) => { setCurrentProject(prev => { if (!prev) return prev; const exists = prev.selectedItems.find(i => i.id === updatedItem.id); if (exists) return { ...prev, selectedItems: prev.selectedItems.map(i => i.id === updatedItem.id ? updatedItem : i) }; return { ...prev, selectedItems: [...prev.selectedItems, updatedItem] }; }); }, []);

  const removeLocalItem = useCallback((itemId: string) => { setCurrentProject(prev => { if (!prev) return prev; return { ...prev, selectedItems: prev.selectedItems.filter(i => i.id !== itemId) }; }); }, []);

  const handleIncrement = useCallback(async (article: Article) => {
    if (!currentProject) return;
    if (currentProject.lists && currentProject.lists.length > 0 && !activeListId) {
      toast({ title: 'Hinweis', description: 'Bitte wählen Sie zuerst eine Liste aus.' });
      return;
    }
    impactMedium();
    const existing = getItemInSection(article.id);
    if (existing) {
      const newQty = (existing.quantity ?? 0) + 1;
      updateLocalItem({ ...existing, quantity: newQty });
      const ok = await updateProjectItemQuantity(existing.id, newQty);
      if (!ok) {
        updateLocalItem(existing);
        toast({ title: 'Fehler', description: 'Menge konnte nicht gespeichert werden.', variant: 'destructive' });
      }
    } else {
      const newItem: ProjectSelectedItem = {
        id: generateUUID(),
        project_id: currentProject.id,
        list_id: activeListId,
        type: 'article',
        order: currentProject.selectedItems.length,
        article_id: article.id,
        quantity: 1,
        section_id: activeSectionId ?? null,
      };
      updateLocalItem(newItem);
      const saved = await upsertProjectItem(newItem);
      if (!saved) {
        removeLocalItem(newItem.id);
        toast({ title: 'Fehler', description: 'Artikel konnte nicht hinzugefügt werden.', variant: 'destructive' });
      }
    }
  }, [currentProject, activeSectionId, activeListId, getItemInSection, updateLocalItem, removeLocalItem, impactMedium, toast]);

  const handleDecrement = useCallback(async (article: Article) => { if (!currentProject) return; impactMedium(); const existing = getItemInSection(article.id); if (!existing) return; if ((existing.quantity ?? 0) <= 1) { removeLocalItem(existing.id); const ok = await deleteProjectItem(existing.id); if (!ok) { updateLocalItem(existing); toast({ title: 'Fehler', description: 'Artikel konnte nicht entfernt werden.', variant: 'destructive' }); } } else { const newQty = (existing.quantity ?? 0) - 1; updateLocalItem({ ...existing, quantity: newQty }); const ok = await updateProjectItemQuantity(existing.id, newQty); if (!ok) { updateLocalItem(existing); toast({ title: 'Fehler', description: 'Menge konnte nicht gespeichert werden.', variant: 'destructive' }); } } }, [currentProject, activeSectionId, getItemInSection, updateLocalItem, removeLocalItem, impactMedium, toast]);

  const handleResetArticle = useCallback(async (article: Article) => { if (!currentProject) return; const existing = getItemInSection(article.id); if (!existing) return; removeLocalItem(existing.id); const ok = await deleteProjectItem(existing.id); if (!ok) { updateLocalItem(existing); toast({ title: 'Fehler', description: 'Konnte nicht zurückgesetzt werden.', variant: 'destructive' }); } }, [currentProject, getItemInSection, removeLocalItem, updateLocalItem, toast]);

  const handleDeleteItem = useCallback(async (itemId: string) => {
    if (!currentProject) return;
    const item = currentProject.selectedItems.find(i => i.id === itemId);
    if (!item) return;
    removeLocalItem(itemId);
    const ok = await deleteProjectItem(itemId);
    const undo = () => {
      updateLocalItem(item);
      upsertProjectItem(item);
    };
    if (!ok) {
      undo();
      toast({ title: 'Fehler', description: 'Position konnte nicht gelöscht werden.', variant: 'destructive' });
      return;
    }
    toast({
      title: 'Position gelöscht',
      action: (
        <ToastAction altText="Löschen rückgängig machen" onClick={undo}>Rückgängig</ToastAction>
      ),
    });
  }, [currentProject, removeLocalItem, updateLocalItem, toast]);

  const handleUpdateQuantity = useCallback(async (itemId: string, newQuantity: number) => { if (newQuantity < 1) return; impactLight(); setCurrentProject(prev => { if (!prev) return prev; return { ...prev, selectedItems: prev.selectedItems.map(i => i.id === itemId ? { ...i, quantity: newQuantity } : i) }; }); const ok = await updateProjectItemQuantity(itemId, newQuantity); if (!ok) toast({ title: 'Fehler', description: 'Menge konnte nicht aktualisiert werden.', variant: 'destructive' }); }, [toast, impactLight]);

  const handleUpdateSupplier = useCallback(async (itemId: string, supplierName: string | null, articleNumber: string | null) => {
    setCurrentProject(prev => {
      if (!prev) return prev;
      return { 
        ...prev, 
        selectedItems: prev.selectedItems.map(i => i.id === itemId ? { ...i, supplier_name: supplierName ?? undefined, article_number: articleNumber ?? undefined } : i) 
      };
    });
    const ok = await updateProjectItemSupplier(itemId, supplierName, articleNumber);
    if (!ok) toast({ title: 'Fehler', description: 'Händler konnte nicht aktualisiert werden.', variant: 'destructive' });
  }, [toast]);

  const handleAddSection = async (sectionName: string) => {
    if (!currentProject || !sectionName.trim()) return;
    const order = currentProject.selectedItems.length;
    const newSec = await addSection(currentProject.id, sectionName, order, activeListId);
    if (newSec) {
      updateLocalItem(newSec);
      setActiveSectionId(newSec.id);
      toast({ title: 'Abschnitt erstellt', description: sectionName });
    }
  };

  const handleUpdateSection = async (sectionId: string, newName: string) => { if (!currentProject) return; const section = currentProject.selectedItems.find(i => i.id === sectionId); if (!section) return; const updatedSection = { ...section, text: newName }; const result = await upsertProjectItem(updatedSection); if (result) { updateLocalItem(result); impactMedium(); } };

  const handleDeleteSection = async (sectionId: string) => { if (!currentProject) return; try { const { error } = await supabase.from('project_items').update({ section_id: null }).eq('section_id', sectionId); if (error) throw error; const success = await deleteProjectItem(sectionId); if (success) { setCurrentProject(prev => { if (!prev) return null; return { ...prev, selectedItems: prev.selectedItems.filter(i => i.id !== sectionId).map(i => i.section_id === sectionId ? { ...i, section_id: null } : i) }; }); if (activeSectionId === sectionId) setActiveSectionId(null); impactMedium(); toast({ title: 'Abschnitt gelöscht' }); } } catch (err) { toast({ title: 'Fehler beim Löschen', variant: 'destructive' }); } };

  const handleAddManualPosition = async () => {
    if (!currentProject || !manualName.trim()) return;
    const newItem: ProjectSelectedItem = {
      id: generateUUID(),
      project_id: currentProject.id,
      list_id: activeListId,
      type: 'article',
      order: currentProject.selectedItems.length,
      article_id: null,
      quantity: parseFloat(manualQty) || 1,
      name: manualName.trim(),
      unit: manualUnit.trim() || undefined,
      article_number: manualArticleNumber.trim() || undefined,
      supplier_name: manualSupplierName.trim() || undefined,
      section_id: activeSectionId ?? null,
    };
    updateLocalItem(newItem);
    const saved = await upsertProjectItem(newItem);
    if (!saved) {
      removeLocalItem(newItem.id);
      toast({ title: 'Fehler', variant: 'destructive' });
      return;
    }
    toast({ title: 'Hinzugefügt' });
    setManualName('');
    setManualQty('1');
    setManualUnit('');
    setManualArticleNumber('');
    setManualSupplierName('');
    setIsManualDialogOpen(false);
  };

  const handleImportItems = async (items: { article: Article, quantity: number }[]) => {
    if (!currentProject) return;
    for (const item of items) {
      const newItem: ProjectSelectedItem = {
        id: generateUUID(),
        project_id: currentProject.id,
        list_id: activeListId,
        type: 'article',
        order: currentProject.selectedItems.length,
        article_id: item.article.id,
        quantity: item.quantity,
        section_id: activeSectionId ?? null
      };
      updateLocalItem(newItem);
      await upsertProjectItem(newItem);
    }
    impactMedium();
  };

  const handleOpenEditProject = () => { if (!currentProject) return; setEditProjectData({ name: currentProject.name || '', client_name: currentProject.client_name || '', address: currentProject.address || '', notes: currentProject.notes || '', start_date: currentProject.start_date || '', end_date: currentProject.end_date || '' }); setIsEditProjectOpen(true); };


  const handleExportCsv = () => { if (!currentProject) return; setIsCsvExportDialogOpen(true); impactMedium(); };

  const handleGeneratePdf = async () => {
    if (!currentProject) return;
    const sectionItems = currentProject.selectedItems.filter(i => i.type === 'section').sort((a, b) => a.order - b.order);
    const articleItems = processedSummaryItems.filter(i => i.type === 'article');
    const { generateAufmassPdf } = await import('@/lib/pdf-export');
    generateAufmassPdf({ projectName: currentProject.name, sectionItems, articleItems });
    toast({ title: 'PDF erstellt' });
  };

  const handleSelectCategory = (categoryId: string, hasChildren?: boolean) => { setActiveCategoryId(categoryId); if (window.innerWidth < 1024 && !hasChildren) setIsCategorySheetOpen(false); };

  if (isLoadingData || !currentProject) return <div className="flex items-center justify-center min-h-[70vh]"><div className="animate-pulse">Lädt…</div></div>;

  return (
    <motion.div className="flex h-full overflow-hidden relative" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className={cn(
        "hidden lg:block relative shrink-0 h-full border-r",
        !isResizingSidebar && "transition-[width] duration-300",
        viewMode === 'angebot' ? "border-r-0 overflow-hidden" : ""
      )} style={{ width: viewMode === 'angebot' ? 0 : sidebarWidth }}>
        <aside className="absolute inset-0 flex flex-col bg-card w-[inherit]">
          <div className="p-3 border-b shrink-0 space-y-2">
            <div className="flex bg-background border rounded-xl p-1">
              <button onClick={() => setCatalogSource('own')} className={cn("flex-1 px-2 py-1.5 text-[10px] font-bold rounded-lg transition-[color,background-color,border-color,fill,stroke,opacity,box-shadow,transform]", catalogSource === 'own' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground")}>Katalog</button>
              <button onClick={() => setCatalogSource('wholesale')} className={cn("flex-1 px-2 py-1.5 text-[10px] font-bold rounded-lg transition-[color,background-color,border-color,fill,stroke,opacity,box-shadow,transform]", catalogSource === 'wholesale' ? "bg-amber-500 text-white shadow-sm" : "text-muted-foreground")}>Datanorm</button>
            </div>
            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} /><Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Suchen…" className="h-9 pl-8 text-xs bg-background" aria-label="Katalog durchsuchen" /></div>
          </div>
          <div className="flex-1 overflow-y-auto py-3">
            <CategoryTree categories={activeCategories} activeCategoryId={activeCategoryId} expandedCategories={expandedCategories} forceExpandedIds={searchExpandedIds} onSelectCategory={handleSelectCategory} onToggleExpansion={toggleCategoryExpansion} />
          </div>
        </aside>

        {/* Drag handle for resizing left sidebar */}
        {viewMode !== 'angebot' && (
          <ResizeHandle
            ariaLabel="Katalog-Seitenleiste in der Breite verändern"
            onStart={() => setIsResizingSidebar(true)}
            onDrag={(delta) => setSidebarWidth(Math.min(Math.max(sidebarWidth + delta, 200), 600))}
            onEnd={(delta) => {
              setIsResizingSidebar(false);
              const finalWidth = Math.min(Math.max(sidebarWidth + delta, 200), 600);
              localStorage.setItem('aufmass_sidebar_w', finalWidth.toString());
            }}
            className="absolute top-0 right-0 w-2 h-full cursor-col-resize group z-50 hover:bg-emerald-500/10 active:bg-emerald-500/20 transition-colors flex items-center justify-center -mr-1"
          >
            <div className="w-0.5 h-10 rounded-full bg-border group-hover:bg-emerald-500/50 transition-colors" />
          </ResizeHandle>
        )}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="shrink-0 border-b bg-background/80 backdrop-blur-md flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Button variant="ghost" size="icon" className="lg:hidden text-primary shrink-0" onClick={() => setIsCategorySheetOpen(true)} aria-label="Katalog öffnen">
              <Menu size={20} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="shrink-0" aria-label="Zurück zur Übersicht"><ChevronLeft /></Button>
            <div className="flex items-center gap-4 min-w-0">
              <button type="button" onClick={handleOpenEditProject} aria-label="Projekt bearbeiten" className="min-w-0 cursor-pointer group hidden sm:flex flex-col text-left">
                <div className="flex items-center gap-2 overflow-hidden">
                  <ShinyText text={currentProject.name || ''} className="font-bold truncate" />
                  <span className="text-muted-foreground/50 text-sm">/</span>
                  <span className="text-sm font-semibold text-primary truncate group-hover:underline decoration-primary/50 underline-offset-4">
                    {currentProject.lists?.find(l => l.id === activeListId)?.name || 'Lädt…'}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                  {totalArticleCount} Positionen
                </p>
              </button>

              {currentProject.status === 'planning' && (
                <div className="flex bg-muted/50 p-1 rounded-xl border border-border">
                  <button 
                    onClick={() => setViewMode('angebot')}
                    className={cn(
                      "px-3 py-1 text-[11px] font-bold rounded-lg transition-[color,background-color,border-color,fill,stroke,opacity,box-shadow,transform] flex items-center gap-1.5",
                      viewMode === 'angebot' 
                        ? "bg-primary text-primary-foreground shadow-sm" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <BookMarked size={14} />
                    <span className="hidden sm:inline">Planung</span>
                  </button>
                  <button 
                    onClick={() => setViewMode('aufmass')}
                    className={cn(
                      "px-3 py-1 text-[11px] font-bold rounded-lg transition-[color,background-color,border-color,fill,stroke,opacity,box-shadow,transform] flex items-center gap-1.5",
                      viewMode === 'aufmass' 
                        ? "bg-primary text-primary-foreground shadow-sm" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Package size={14} />
                    <span className="hidden sm:inline">Material</span>
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={() => setIsSummaryOpen(true)} className="xl:hidden h-8 px-2 gap-1.5 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 mr-1 relative">
              <Package size={15} />
              <span className="font-bold text-xs">{totalArticleCount}</span>
              <span className="sr-only">Zusammenfassung öffnen</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setIsManualDialogOpen(true)} className="text-emerald-400 gap-1.5"><PenLine size={14} /> <span className="hidden sm:inline">Manuell</span></Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleRecording}
              aria-label={isRecording ? 'Sprachaufnahme beenden' : 'Sprachsuche starten'}
              aria-pressed={isRecording}
              className={cn(isRecording && 'text-red-400 bg-red-500/10', isProcessing && 'opacity-60')}
            >
              <Mic size={18} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Helles Design aktivieren' : 'Dunkles Design aktivieren'}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={14} />}
            </Button>
          </div>
        </header>

        <SectionBar sections={sections} activeSectionId={activeSectionId} onSelectSection={setActiveSectionId} onAddSection={handleAddSection} onDeleteSection={handleDeleteSection} onUpdateSection={handleUpdateSection} />

        <main className="flex-1 overflow-y-auto relative bg-background/50">
          <AnimatePresence mode="wait">
            {viewMode === 'angebot' ? (
              <motion.div 
                key="planung-view"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="absolute inset-0 overflow-y-auto p-4"
              >
                <AngebotTool project={currentProject} activeSectionId={activeSectionId} activeListId={activeListId} onUpdateLocalItem={updateLocalItem} onRemoveLocalItem={removeLocalItem} onUpdateProject={updates => setCurrentProject(prev => prev ? { ...prev, ...updates } : prev)} />
              </motion.div>
            ) : (
              <motion.div 
                key="material-view"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="absolute inset-0 overflow-y-auto p-4"
              >
                <div className="flex flex-col gap-3">
                  {viewArticles.map((article, idx) => (
                    <ArticleCard key={`${article.id}-${idx}`} className="cv-auto" article={article} categoryImageUrl={getInheritedCategoryImageUrl(article.categoryId, activeCategories)} quantity={getQuantityInSection(article.id)} onIncrement={() => handleIncrement(article)} onDecrement={() => handleDecrement(article)} onReset={() => handleResetArticle(article)} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      <aside className="hidden xl:flex flex-col shrink-0 border-l bg-muted/10 relative" style={{ width: summaryWidth }}>
        {/* Drag handle for resizing right sidebar */}
        <ResizeHandle
          ariaLabel="Zusammenfassung in der Breite verändern"
          onStart={() => setIsResizingSummary(true)}
          onDrag={(delta) => setSummaryWidth(Math.min(Math.max(summaryWidth - delta, 240), 600))}
          onEnd={(delta) => {
            setIsResizingSummary(false);
            const finalWidth = Math.min(Math.max(summaryWidth - delta, 240), 600);
            localStorage.setItem('aufmass_summary_w', finalWidth.toString());
          }}
          className="absolute top-0 left-0 w-2 h-full cursor-col-resize group z-50 hover:bg-emerald-500/10 active:bg-emerald-500/20 transition-colors flex items-center justify-center -ml-1"
        >
          <div className="w-0.5 h-10 rounded-full bg-border group-hover:bg-emerald-500/50 transition-colors" />
        </ResizeHandle>

        <div className="p-4 border-b shrink-0"><h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Aktuelles Aufmaß</h2></div>
        <SummaryList projectId={currentProject.id} sectionItems={sections} articleItems={processedSummaryItems.filter(i => i.type === 'article')} activeSectionId={activeSectionId} onSelectSection={setActiveSectionId} onDeleteItem={handleDeleteItem} onUpdateQuantity={handleUpdateQuantity} />
        <div className="p-4 border-t bg-card space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={handleGeneratePdf} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold h-10"><FileDown size={16} className="mr-2" /> PDF</Button>
            <Button onClick={handleExportCsv} variant="outline" className="h-10 border-border"><FileSpreadsheet size={16} className="mr-2" /> CSV</Button>
          </div>
          <Button onClick={() => setIsImportDialogOpen(true)} variant="outline" className="w-full h-10 border-dashed border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 gap-2">
            <FileUp size={16} /> PDF / CSV Importieren
          </Button>
        </div>
      </aside>

      <CsvExportDialog isOpen={isCsvExportDialogOpen} onClose={() => setIsCsvExportDialogOpen(false)} projectItems={processedSummaryItems} projectName={currentProject.name} />
      <ProjectImportDialog isOpen={isImportDialogOpen} onClose={() => setIsImportDialogOpen(false)} onImportItems={handleImportItems} />

      {/* Manueller Artikel Dialog */}
      <Dialog open={isManualDialogOpen} onOpenChange={(open) => {
        setIsManualDialogOpen(open);
        if (!open) { setManualName(''); setManualQty('1'); setManualUnit(''); setManualArticleNumber(''); setManualSupplierName(''); }
      }}>
        <DialogContent className="sm:max-w-md bg-card border border-border rounded-2xl shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border bg-muted/30">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
              <PenLine size={18} className="text-emerald-400" />
              Manuellen Artikel hinzufügen
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 py-5 space-y-4">
            {/* Artikelname */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Artikelname *</Label>
              <Input
                autoFocus
                placeholder="z. B. Unterputzdose 60mm"
                value={manualName}
                onChange={e => setManualName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && manualName.trim() && handleAddManualPosition()}
                className="h-10 bg-background border-border focus:border-emerald-500 focus:ring-emerald-500/20"
              />
            </div>
            {/* Menge + Einheit */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Menge</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="1"
                  value={manualQty}
                  onChange={e => setManualQty(e.target.value)}
                  className="h-10 bg-background border-border focus:border-emerald-500 focus:ring-emerald-500/20"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Einheit</Label>
                <Input
                  placeholder="z. B. Stk, m, m²"
                  value={manualUnit}
                  onChange={e => setManualUnit(e.target.value)}
                  className="h-10 bg-background border-border focus:border-emerald-500 focus:ring-emerald-500/20"
                />
              </div>
            </div>
            {/* Artikelnummer */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Artikelnummer</Label>
              <Input
                placeholder="z. B. 4013295"
                value={manualArticleNumber}
                onChange={e => setManualArticleNumber(e.target.value)}
                className="h-10 bg-background border-border focus:border-emerald-500 focus:ring-emerald-500/20"
              />
            </div>
            {/* Großhändler */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Großhändler</Label>
              <Input
                placeholder="z. B. Sonepar, Rexel, Hagemeyer"
                value={manualSupplierName}
                onChange={e => setManualSupplierName(e.target.value)}
                className="h-10 bg-background border-border focus:border-emerald-500 focus:ring-emerald-500/20"
              />
            </div>
          </div>
          <DialogFooter className="px-6 pb-6 flex gap-3">
            <Button variant="outline" onClick={() => setIsManualDialogOpen(false)} className="flex-1 h-11 border-border rounded-xl">
              Abbrechen
            </Button>
            <Button
              onClick={handleAddManualPosition}
              disabled={!manualName.trim()}
              className="flex-1 h-11 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-[color,background-color,border-color,fill,stroke,opacity,box-shadow,transform] disabled:opacity-50"
            >
              <Plus size={16} className="mr-1.5" /> Hinzufügen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mobiler Katalog (Sheet) */}
      <Sheet open={isCategorySheetOpen} onOpenChange={setIsCategorySheetOpen}>
        <SheetContent side="left" className="w-[300px] sm:w-[350px] p-0 flex flex-col bg-card border-r border-border">
          <SheetHeader className="p-4 border-b shrink-0 text-left bg-muted/30">
            <SheetTitle className="flex items-center gap-2 text-primary font-bold">
              <Menu size={18} /> Katalog
            </SheetTitle>
          </SheetHeader>
          <div className="p-3 border-b shrink-0 space-y-3 bg-background">
            <div className="flex bg-muted/50 border border-border rounded-xl p-1">
              <button onClick={() => setCatalogSource('own')} className={cn("flex-1 px-2 py-1.5 text-[11px] font-bold rounded-lg transition-[color,background-color,border-color,fill,stroke,opacity,box-shadow,transform]", catalogSource === 'own' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>Eigener Katalog</button>
              <button onClick={() => setCatalogSource('wholesale')} className={cn("flex-1 px-2 py-1.5 text-[11px] font-bold rounded-lg transition-[color,background-color,border-color,fill,stroke,opacity,box-shadow,transform]", catalogSource === 'wholesale' ? "bg-amber-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground")}>Datanorm</button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Suchen…" className="h-10 pl-9 text-xs bg-card border-border focus:ring-primary/50" aria-label="Katalog durchsuchen" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-3 bg-card">
            <CategoryTree categories={activeCategories} activeCategoryId={activeCategoryId} expandedCategories={expandedCategories} forceExpandedIds={searchExpandedIds} onSelectCategory={handleSelectCategory} onToggleExpansion={toggleCategoryExpansion} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Mobile Bottom Summary Sheet */}
      <Sheet open={isSummaryOpen} onOpenChange={setIsSummaryOpen}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-[2.5rem] border-t border-border bg-background/95 backdrop-blur-xl flex flex-col p-0">
          <SheetHeader className="p-6 pb-4 border-b border-border shrink-0">
            <SheetTitle className="text-left text-xl text-primary font-bold">Aktuelles Aufmaß</SheetTitle>
          </SheetHeader>
          <SummaryList
            projectId={currentProject.id}
            sectionItems={sections}
            articleItems={processedSummaryItems.filter(i => i.type === 'article')}
            activeSectionId={activeSectionId}
            onSelectSection={setActiveSectionId}
            onDeleteItem={handleDeleteItem}
            onUpdateQuantity={handleUpdateQuantity}
            onUpdateSupplier={handleUpdateSupplier}
            suppliers={suppliers}
          />
          <div className="p-6 pt-3 border-t border-border shrink-0 bg-card grid grid-cols-2 gap-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <Button onClick={handleGeneratePdf} disabled={totalArticleCount === 0} className="w-full h-14 text-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl transition-[color,background-color,border-color,fill,stroke,opacity,box-shadow,transform]">
              <FileDown size={20} className="mr-2 opacity-70" /> PDF
            </Button>
            <Button onClick={handleExportCsv} disabled={totalArticleCount === 0} className="w-full h-14 bg-card hover:bg-accent text-accent-foreground border border-border rounded-xl transition-colors">
              <FileSpreadsheet size={16} className="mr-2 opacity-50" /> CSV
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </motion.div>
  );
};

export default AufmassPage;
