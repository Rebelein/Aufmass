import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Article, Category } from '@/lib/data';
import { subscribeToCategories, subscribeToArticles, subscribeToSuppliers, fetchWholesaleArticlesByCategory, searchWholesaleArticles } from '@/lib/catalog-storage';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { getCurrentProjectId, getProjectById, upsertProjectItem, deleteProjectItem, updateProjectItemQuantity, updateProjectItemSupplier, addSection, updateProject, createProjectList, deleteProjectList } from '@/lib/project-storage';
import type { Project, ProjectSelectedItem, ProjectList } from '@/lib/project-storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ResizableSidePanel } from '@/components/ui/ResizableSidePanel';
import { ChevronLeft, FileDown, Menu, Package, Sparkles, FileSpreadsheet, BookMarked, Search, X as CloseIcon, PenLine, Edit3, Sun, Moon, Mic, Copy, FileText, Database, FileUp, CloudOff, ListPlus, LayoutGrid, CheckCircle2, Plus } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn, generateUUID, getInheritedCategoryImageUrl, compareArticleNames } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/use-haptic-feedback';
import { motion, AnimatePresence } from 'framer-motion';
import { CsvExportDialog } from '@/components/dialogs/CsvExportDialog';
import { ProjectImportDialog } from '@/components/dialogs/ProjectImportDialog';
import type { ProcessedSummaryItem } from '@/lib/types';
import { generateAufmassPdf } from '@/lib/pdf-export';
import { generateAngebotPdf } from '@/lib/pdf-export-angebot';
import { ArticleCard } from '@/components/aufmass/ArticleCard';
import { SectionBar } from '@/components/aufmass/SectionBar';
import { SummaryList } from '@/components/aufmass/SummaryList';
import { CategoryTree } from '@/components/catalog/CategoryTree';
import { AngebotTool } from '@/components/aufmass/AngebotTool';
import { useSpeechRecognition } from '@/hooks/use-speech';
import { useOfflineSync } from '@/lib/sync-queue';
import { useSyncStatus } from '@/hooks/use-sync-status';
import { preloadCatalog } from '@/lib/catalog-storage';
import { SpotlightCard } from '@/components/ui/SpotlightCard';
import { ShinyText } from '@/components/ui/ShinyText';
import { MotionNumber } from '@/components/ui/MotionNumber';
import { Magnetic } from '@/components/ui/Magnetic';
import { AnimatedBackground } from '@/components/ui/AnimatedBackground';

const AufmassPage = () => {
  const [articlesData, setArticlesData] = useState<Article[]>([]);
  const [dynamicWholesaleArticles, setDynamicWholesaleArticles] = useState<Article[]>([]);
  const [projectWholesaleArticles, setProjectWholesaleArticles] = useState<Article[]>([]);
  const [isFetchingWholesale, setIsFetchingWholesale] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [wholesaleCategories, setWholesaleCategories] = useState<Category[]>([]);
  const [catalogSource, setCatalogSource] = useState<'own' | 'wholesale'>('own');
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [activeListId, setActiveListId] = useState<string | null>(() => localStorage.getItem('activeListId'));
  const [viewMode, setViewMode] = useState<'aufmass' | 'angebot'>('angebot');
  const [isCategorySheetOpen, setIsCategorySheetOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isCopyMode, setIsCopyMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(() => { const stored = localStorage.getItem('aufmass_sidebar_w'); return stored ? parseInt(stored) : 288; });
  const [summaryWidth, setSummaryWidth] = useState(() => { const stored = localStorage.getItem('aufmass_summary_w'); return stored ? parseInt(stored) : 320; });
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isInfoHubOpen, setIsInfoHubOpen] = useState(false);
  const [isCsvExportDialogOpen, setIsCsvExportDialogOpen] = useState(false);
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [editProjectData, setEditProjectData] = useState({ name: '', client_name: '', address: '', notes: '', start_date: '', end_date: '' });
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

  const { toast } = useToast();
  const navigate = useNavigate();
  const { impactMedium, impactLight } = useHapticFeedback();
  const { status } = useSyncStatus();

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
    const fetchArticles = async () => {
      setIsFetchingWholesale(true);
      try {
        if (debouncedSearchQuery.trim()) {
          const results = await searchWholesaleArticles(debouncedSearchQuery);
          if (isMounted) setDynamicWholesaleArticles(results);
        } else if (activeCategoryId) {
          const subcats = wholesaleCategories.filter(c => c.parentId === activeCategoryId);
          const validIds = [activeCategoryId, ...subcats.map(c => c.id)];
          const results = await fetchWholesaleArticlesByCategory(validIds);
          if (isMounted) setDynamicWholesaleArticles(results);
        } else if (isMounted) setDynamicWholesaleArticles([]);
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

  const activeCategory = useMemo(() => activeCategories.find(c => c.id === activeCategoryId), [activeCategories, activeCategoryId]);

  const toggleCategoryExpansion = (categoryId: string, e: React.MouseEvent) => { e.stopPropagation(); setExpandedCategories(prev => { const next = new Set(prev); if (next.has(categoryId)) next.delete(categoryId); else next.add(categoryId); return next; }); };

  const searchExpandedIds = useMemo(() => { if (!searchQuery.trim()) return []; const ids = new Set<string>(); const resultsToUse = catalogSource === 'own' ? searchResults : dynamicWholesaleArticles; resultsToUse.forEach(art => { let currentId = art.categoryId; while (currentId) { ids.add(currentId); const parentId = activeCategories.find(c => c.id === currentId)?.parentId; if (parentId) ids.add(parentId); currentId = parentId || null; } }); return Array.from(ids); }, [searchResults, dynamicWholesaleArticles, activeCategories, searchQuery, catalogSource]);

  const viewArticles = useMemo(() => { let result = []; if (catalogSource === 'wholesale') { result = dynamicWholesaleArticles; } else if (searchQuery.trim().length > 0) { result = searchResults; } else if (!activeCategoryId) { result = []; } else { const subcats = activeCategories.filter(c => c.parentId === activeCategoryId); const validIds = [activeCategoryId, ...subcats.map(c => c.id)]; result = articlesData.filter(a => a.categoryId && validIds.includes(a.categoryId)); } return [...result].sort((a,b) => compareArticleNames(a.name, b.name)); }, [articlesData, activeCategoryId, searchQuery, searchResults, activeCategories, catalogSource, dynamicWholesaleArticles]);

  const sections = useMemo(() => (currentProject?.selectedItems ?? []).filter(i => {
    const isSection = i.type === 'section';
    if (!isSection) return false;
    if (!currentProject?.lists || currentProject.lists.length === 0) return true;
    return i.list_id === activeListId;
  }).sort((a,b) => (a.order ?? 0) - (b.order ?? 0)), [currentProject, activeListId]);

  const processedSummaryItems: ProcessedSummaryItem[] = useMemo(() => {
    if (!currentProject) return [];
    
    // Filter items by active list if lists exist
    const filteredByList = currentProject.selectedItems.filter(item => {
      if (!currentProject.lists || currentProject.lists.length === 0) return true;
      return item.list_id === activeListId;
    });

    const enrichedItems = filteredByList.map(item => { if (item.type === 'article' && item.article_id) { const articleDetail = articlesData.find(a => a.id === item.article_id) ?? dynamicWholesaleArticles.find(a => a.id === item.article_id) ?? projectWholesaleArticles.find(a => a.id === item.article_id); const allCats = [...categories, ...wholesaleCategories]; const categoryImageUrl = getInheritedCategoryImageUrl(articleDetail?.categoryId, allCats); return { ...item, article: articleDetail, categoryImageUrl }; } return item as ProcessedSummaryItem; });
    return enrichedItems.sort((a, b) => { if (a.type === 'section' || b.type === 'section') return (a.order ?? 0) - (b.order ?? 0); const getCategoryPathOrder = (categoryId?: string): string => { if (!categoryId) return '999999'; const path: number[] = []; let currId: string | undefined | null = categoryId; const allCats = [...categories, ...wholesaleCategories]; while (currId) { const cat = allCats.find(c => c.id === currId); if (!cat) break; path.unshift(cat.order ?? 0); currId = cat.parentId; } return path.map(n => n.toString().padStart(5, '0')).join('-'); }; const pathA = getCategoryPathOrder(a.article?.categoryId); const pathB = getCategoryPathOrder(b.article?.categoryId); if (pathA !== pathB) return pathA.localeCompare(pathB); return compareArticleNames(a.article?.name ?? a.name, b.article?.name ?? b.name); });
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

  const handleDeleteItem = useCallback(async (itemId: string) => { removeLocalItem(itemId); await deleteProjectItem(itemId); }, [removeLocalItem]);

  const handleUpdateQuantity = useCallback(async (itemId: string, newQuantity: number) => { if (newQuantity < 1) return; impactLight(); setCurrentProject(prev => { if (!prev) return prev; return { ...prev, selectedItems: prev.selectedItems.map(i => i.id === itemId ? { ...i, quantity: newQuantity } : i) }; }); const ok = await updateProjectItemQuantity(itemId, newQuantity); if (!ok) toast({ title: 'Fehler', description: 'Menge konnte nicht aktualisiert werden.', variant: 'destructive' }); }, [toast, impactLight]);

  const handleUpdateSupplier = useCallback(async (itemId: string, supplierName: string | null, articleNumber: string | null) => {
    setCurrentProject(prev => {
      if (!prev) return prev;
      return { 
        ...prev, 
        selectedItems: prev.selectedItems.map(i => i.id === itemId ? { ...i, supplier_name: supplierName, article_number: articleNumber } : i) 
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

  const handleSaveProject = async () => { if (!currentProject || !editProjectData.name.trim()) return; const success = await updateProject(currentProject.id, { ...editProjectData, start_date: editProjectData.start_date || null, end_date: editProjectData.end_date || null, }); if (success) { setCurrentProject({ ...currentProject, ...editProjectData }); setIsEditProjectOpen(false); toast({ title: 'Gespeichert' }); } };

  const handleExportCsv = () => { if (!currentProject) return; setIsCsvExportDialogOpen(true); impactMedium(); };

  const handleGeneratePdf = async () => { if (!currentProject) return; const sectionItems = currentProject.selectedItems.filter(i => i.type === 'section').sort((a, b) => a.order - b.order); const articleItems = processedSummaryItems.filter(i => i.type === 'article'); generateAufmassPdf({ projectName: currentProject.name, sectionItems, articleItems }); toast({ title: 'PDF erstellt' }); };

  const handleSelectCategory = (categoryId: string, hasChildren?: boolean) => { setActiveCategoryId(categoryId); if (window.innerWidth < 1024 && !hasChildren) setIsCategorySheetOpen(false); };

  if (isLoadingData || !currentProject) return <div className="flex items-center justify-center min-h-[70vh]"><div className="animate-pulse">Lädt...</div></div>;

  return (
    <motion.div className="flex h-[calc(100vh-3rem)] overflow-hidden relative" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className={cn(
        "hidden lg:block relative shrink-0 h-full border-r transition-all duration-300",
        viewMode === 'angebot' ? "w-0 border-r-0 overflow-hidden" : ""
      )} style={{ width: viewMode === 'angebot' ? 0 : sidebarWidth }}>
        <aside className="absolute inset-0 flex flex-col bg-card w-[inherit]">
          <div className="p-3 border-b shrink-0 space-y-2">
            <div className="flex bg-background border rounded-xl p-1">
              <button onClick={() => setCatalogSource('own')} className={cn("flex-1 px-2 py-1.5 text-[10px] font-bold rounded-lg transition-all", catalogSource === 'own' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground")}>Katalog</button>
              <button onClick={() => setCatalogSource('wholesale')} className={cn("flex-1 px-2 py-1.5 text-[10px] font-bold rounded-lg transition-all", catalogSource === 'wholesale' ? "bg-amber-500 text-white shadow-sm" : "text-muted-foreground")}>Datanorm</button>
            </div>
            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} /><Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Suchen..." className="h-9 pl-8 text-xs bg-background" /></div>
          </div>
          <div className="flex-1 overflow-y-auto py-3">
            <CategoryTree categories={activeCategories} activeCategoryId={activeCategoryId} expandedCategories={expandedCategories} forceExpandedIds={searchExpandedIds} onSelectCategory={handleSelectCategory} onToggleExpansion={toggleCategoryExpansion} />
          </div>
        </aside>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="shrink-0 border-b bg-background/80 backdrop-blur-md flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Button variant="ghost" size="icon" className="lg:hidden text-primary shrink-0" onClick={() => setIsCategorySheetOpen(true)}>
              <Menu size={20} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="shrink-0"><ChevronLeft /></Button>
            <div className="flex items-center gap-4 min-w-0">
              <div className="min-w-0 cursor-pointer group hidden sm:flex flex-col" onClick={handleOpenEditProject}>
                <div className="flex items-center gap-2 overflow-hidden">
                  <ShinyText text={currentProject.name || ''} className="font-bold truncate" />
                  <span className="text-muted-foreground/50 text-sm">/</span>
                  <span className="text-sm font-semibold text-primary truncate group-hover:underline decoration-primary/50 underline-offset-4">
                    {currentProject.lists?.find(l => l.id === activeListId)?.name || 'Lädt...'}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                  {totalArticleCount} Positionen
                </p>
              </div>

              {currentProject.status === 'planning' && (
                <div className="flex bg-muted/50 p-1 rounded-xl border border-border">
                  <button 
                    onClick={() => setViewMode('angebot')}
                    className={cn(
                      "px-3 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5",
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
                      "px-3 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5",
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
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setIsManualDialogOpen(true)} className="text-emerald-400 gap-1.5"><PenLine size={14} /> <span className="hidden sm:inline">Manuell</span></Button>
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={14} />}</Button>
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
                    <ArticleCard key={`${article.id}-${idx}`} article={article} categoryImageUrl={getInheritedCategoryImageUrl(article.categoryId, activeCategories)} quantity={getQuantityInSection(article.id)} onIncrement={() => handleIncrement(article)} onDecrement={() => handleDecrement(article)} onReset={() => handleResetArticle(article)} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      <aside className="hidden xl:flex flex-col shrink-0 border-l bg-muted/10 w-[350px]">
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
              <button onClick={() => setCatalogSource('own')} className={cn("flex-1 px-2 py-1.5 text-[11px] font-bold rounded-lg transition-all", catalogSource === 'own' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>Eigener Katalog</button>
              <button onClick={() => setCatalogSource('wholesale')} className={cn("flex-1 px-2 py-1.5 text-[11px] font-bold rounded-lg transition-all", catalogSource === 'wholesale' ? "bg-amber-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground")}>Datanorm</button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Suchen..." className="h-10 pl-9 text-xs bg-card border-border focus:ring-primary/50" />
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
          <div className="p-6 border-t border-border shrink-0 bg-card grid grid-cols-2 gap-3">
            <Button onClick={handleGeneratePdf} disabled={totalArticleCount === 0} className="w-full h-14 text-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl transition-all">
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
