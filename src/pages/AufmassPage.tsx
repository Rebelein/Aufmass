import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Article, Category } from '@/lib/data';
import { subscribeToCategories, subscribeToArticles, subscribeToSuppliers, fetchWholesaleArticlesByCategory, searchWholesaleArticles } from '@/lib/catalog-storage';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  getCurrentProjectId, getProjectById,
  upsertProjectItem, deleteProjectItem, updateProjectItemQuantity, addSection, updateProject
} from '@/lib/project-storage';
import type { Project, ProjectSelectedItem } from '@/lib/project-storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ResizableSidePanel } from '@/components/ui/ResizableSidePanel';
import {
  ChevronLeft, FileDown, Menu, Package, Sparkles,
  FileSpreadsheet, BookMarked, Search, X as CloseIcon,
  PenLine, Edit3, Sun, Moon, Mic, Copy, ImagePlus, FileText, Database
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn, generateUUID } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/use-haptic-feedback';
import { motion, AnimatePresence } from 'framer-motion';
import { CsvExportDialog } from '@/components/dialogs/CsvExportDialog';
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
import { CloudOff } from 'lucide-react';
import { preloadCatalog } from '@/lib/catalog-storage';

// --- Main Page ---

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
  const [viewMode, setViewMode] = useState<'aufmass' | 'angebot'>('angebot');
  const [isCategorySheetOpen, setIsCategorySheetOpen] = useState(false);
  const [isCatalogDrawerOpen, setIsCatalogDrawerOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isCopyMode, setIsCopyMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);

  useOfflineSync(() => {
    toast({ title: 'Online', description: 'Änderungen wurden synchronisiert.' });
    setIsOffline(false);
  });

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const stored = localStorage.getItem('aufmass_sidebar_w');
    return stored ? parseInt(stored) : 288;
  });
  const [summaryWidth, setSummaryWidth] = useState(() => {
    const stored = localStorage.getItem('aufmass_summary_w');
    return stored ? parseInt(stored) : 320;
  });
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [isInfoHubOpen, setIsInfoHubOpen] = useState(false);
  const [isCsvExportDialogOpen, setIsCsvExportDialogOpen] = useState(false);
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [editProjectData, setEditProjectData] = useState({ name: '', client_name: '', address: '', notes: '', start_date: '', end_date: '' });
  const [theme, setTheme] = useState<'dark' | 'light'>((localStorage.getItem('theme') as 'dark' | 'light') || 'dark');
  const [manualName, setManualName] = useState('');
  const [manualQty, setManualQty] = useState('1');
  const [manualUnit, setManualUnit] = useState('');
  const [manualArticleNumber, setManualArticleNumber] = useState('');

  const { toast } = useToast();
  const navigate = useNavigate();
  const { impactMedium, impactLight } = useHapticFeedback();
  const { status, hideStatus } = useSyncStatus();

  const { isRecording, isProcessing, toggleRecording } = useSpeechRecognition((text) => {
    setSearchQuery(text);
    impactLight();
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);
  // Aktive Daten je nach Quelle (own ist client-side)
  const activeCategories = catalogSource === 'own' ? categories : wholesaleCategories;

  // Smart abbreviation-aware search for Monteur workflow
  // Each term must match somewhere: first tries substring, then subsequence per word
  // e.g. "ff üg ag" → FlowFit (ff subsequence), Übergang (üg), Außengewinde (ag)
  const searchResults = useMemo(() => {
    if (catalogSource === 'wholesale') return dynamicWholesaleArticles;
    if (!debouncedSearchQuery.trim()) return [];
    
    const terms = debouncedSearchQuery.toLowerCase()
      .split(/[\s/,]+/)
      .filter(t => t.length > 0);
    if (terms.length === 0) return [];

    // Check if term appears as a subsequence in word
    const isSubsequence = (term: string, word: string): boolean => {
      let ti = 0;
      for (let wi = 0; wi < word.length && ti < term.length; wi++) {
        if (word[wi] === term[ti]) ti++;
      }
      return ti === term.length;
    };

    // Check if a single term matches the article text
    const termMatches = (term: string, text: string): boolean => {
      // Pass 1: exact substring (fastest, highest quality)
      if (text.includes(term)) return true;
      // Pass 2: subsequence match per word (for abbreviations)
      const words = text.split(/[\s,.\-/()]+/).filter(Boolean);
      return words.some(word => isSubsequence(term, word));
    };
    
    // Score articles for sorting: more substring hits = higher relevance
    const scored = articlesData
      .map(article => {
        const text = `${article.name ?? ''} ${article.articleNumber ?? ''}`.toLowerCase();
        let score = 0;
        let allMatch = true;
        for (const term of terms) {
          if (text.includes(term)) {
            score += 2; // exact substring = best
          } else if (termMatches(term, text)) {
            score += 1; // subsequence = good
          } else {
            allMatch = false;
            break;
          }
        }
        return { article, score, allMatch };
      })
      .filter(r => r.allMatch)
      .sort((a, b) => b.score - a.score);

    return scored.map(r => r.article);
  }, [debouncedSearchQuery, articlesData, catalogSource, dynamicWholesaleArticles]);

  // Load wholesale articles dynamically
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
        } else {
          if (isMounted) setDynamicWholesaleArticles([]);
        }
      } finally {
        if (isMounted) setIsFetchingWholesale(false);
      }
    };

    fetchArticles();
    return () => { isMounted = false; };
  }, [catalogSource, debouncedSearchQuery, activeCategoryId, wholesaleCategories]);

  // Load missing wholesale articles for project summary
  useEffect(() => {
    if (!currentProject || isLoadingData) return;
    const missingIds = currentProject.selectedItems
      .filter(i => i.type === 'article' && i.article_id)
      .map(i => i.article_id!)
      .filter(id => !articlesData.find(a => a.id === id) && !projectWholesaleArticles.find(a => a.id === id));
    
    if (missingIds.length === 0) return;

    let isMounted = true;
    const fetchMissing = async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('*, categories(name), suppliers(name)')
        .in('id', missingIds);
        
      if (!error && data && isMounted) {
        setProjectWholesaleArticles(prev => {
          const newMap = new Map(prev.map(a => [a.id, a]));
          data.forEach(art => {
            const a = {
              ...art,
              articleNumber: art.article_number,
              categoryId: art.category_id,
              supplierId: art.supplier_id,
              imageUrl: art.image_url ?? undefined,
              source: art.source ?? 'own',
              categoryName: art.categories?.name || '',
              supplierName: art.suppliers?.name || ''
            };
            newMap.set(a.id, a as Article);
          });
          return Array.from(newMap.values());
        });
      }
    };
    fetchMissing();
    return () => { isMounted = false; };
  }, [currentProject?.selectedItems, articlesData, isLoadingData, projectWholesaleArticles]);

  // Load project & catalog
  useEffect(() => {
    const projectId = getCurrentProjectId();
    if (!projectId) { navigate('/'); return; }

    let isMounted = true;
    const unsubCats = subscribeToCategories(cats => { if (isMounted) setCategories(cats); }, 'own');
    const unsubWCats = subscribeToCategories(cats => { if (isMounted) setWholesaleCategories(cats); }, 'wholesale');
    const unsubArts = subscribeToArticles(arts => { if (isMounted) setArticlesData(arts); }, 'own');
    const unsubWArts = subscribeToArticles(() => {}, 'wholesale'); // Wholesale-Artikel werden dynamisch pro Kategorie geladen
    const unsubSupps = subscribeToSuppliers(() => {});

    const load = async () => {
      const project = await getProjectById(projectId);
      if (!project) { navigate('/'); return; }
      if (isMounted) { setCurrentProject(project); setIsLoadingData(false); }
    };
    load();

    return () => {
      isMounted = false;
      unsubCats(); unsubWCats(); unsubArts(); unsubWArts(); unsubSupps();
    };
  }, [navigate]);

  // Auto-select first category when source changes
  useEffect(() => {
    setActiveCategoryId(null);
    setTimeout(() => {
      setActiveCategoryId(activeCategories.find(c => c.parentId === null)?.id || null);
    }, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogSource]);

  useEffect(() => {
    if (categories.length > 0 && !activeCategoryId && catalogSource === 'own') {
      setActiveCategoryId(categories.find(c => c.parentId === null)?.id || null);
    }
  }, [categories, activeCategoryId, catalogSource]);

    // Force view mode if not in planning
    useEffect(() => {
      if (currentProject && currentProject.status !== 'planning') {
        setViewMode('aufmass');
      } else if (currentProject && currentProject.status === 'planning' && !viewMode) {
        setViewMode('angebot');
      }
    }, [currentProject?.status]);

  const activeCategory = useMemo(() =>
    activeCategories.find(c => c.id === activeCategoryId), [activeCategories, activeCategoryId]);

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
    const resultsToUse = catalogSource === 'own' ? searchResults : dynamicWholesaleArticles;
    resultsToUse.forEach(art => {
      let currentId = art.categoryId;
      while (currentId) {
        ids.add(currentId);
        const parentId = activeCategories.find(c => c.id === currentId)?.parentId;
        if (parentId) ids.add(parentId);
        currentId = parentId || null;
      }
    });
    return Array.from(ids);
  }, [searchResults, dynamicWholesaleArticles, activeCategories, searchQuery, catalogSource]);

  const viewArticles = useMemo(() => {
    let result = [];
    if (catalogSource === 'wholesale') {
      result = dynamicWholesaleArticles;
    } else if (searchQuery.trim().length > 0) {
      result = searchResults;
    } else if (!activeCategoryId) {
      result = [];
    } else {
      const subcats = activeCategories.filter(c => c.parentId === activeCategoryId);
      const validIds = [activeCategoryId, ...subcats.map(c => c.id)];
      result = articlesData.filter(a => a.categoryId && validIds.includes(a.categoryId));
    }

    return [...result].sort((a,b) => (a.name || '').replace(/\s+/g, ' ').trim().localeCompare((b.name || '').replace(/\s+/g, ' ').trim(), undefined, { numeric: true, sensitivity: 'base' }));
  }, [articlesData, activeCategoryId, searchQuery, searchResults, activeCategories, catalogSource, dynamicWholesaleArticles]);
  const sections = useMemo(() =>
    (currentProject?.selectedItems ?? []).filter(i => i.type === 'section')
      .sort((a,b) => (a.order ?? 0) - (b.order ?? 0)),
    [currentProject]);

  const processedSummaryItems: ProcessedSummaryItem[] = useMemo(() => {
    if (!currentProject) return [];
    
    // 1. Enrich items with article data
    const enrichedItems = currentProject.selectedItems.map(item => {
      if (item.type === 'article' && item.article_id) {
        const articleDetail = articlesData.find(a => a.id === item.article_id)
          ?? dynamicWholesaleArticles.find(a => a.id === item.article_id)
          ?? projectWholesaleArticles.find(a => a.id === item.article_id);
        const allCats = [...categories, ...wholesaleCategories];
        const categoryImageUrl = articleDetail?.categoryId
          ? allCats.find(c => c.id === articleDetail.categoryId)?.imageUrl
          : undefined;
        return { ...item, article: articleDetail, categoryImageUrl };
      }
      return item as ProcessedSummaryItem;
    });

    // 2. Sorting logic
    return enrichedItems.sort((a, b) => {
      // Sections should maintain their absolute order relative to each other if they were mixed,
      // but in this app sections are grouped separately in SummaryList.
      // However, SummaryList uses this array, so we must be careful.
      // The user wants items WITHIN sections to be sorted logically.
      
      // If one is a section and they are in the same project, we might want to keep original order
      // But SummaryList filters by section_id, so the global order of this array doesn't 
      // strictly matter for the section grouping, but it does for the "Allgemein" group.

      if (a.type === 'section' || b.type === 'section') {
        return (a.order ?? 0) - (b.order ?? 0);
      }

      // Both are articles. Sort by category hierarchy, then article order, then name.
      const getCategoryPathOrder = (categoryId?: string): string => {
        if (!categoryId) return '999999';
        const path: number[] = [];
        let currId: string | undefined | null = categoryId;
        const allCats = [...categories, ...wholesaleCategories];
        while (currId) {
          const cat = allCats.find(c => c.id === currId);
          if (!cat) break;
          path.unshift(cat.order ?? 0);
          currId = cat.parentId;
        }
        return path.map(n => n.toString().padStart(5, '0')).join('-');
      };

      const pathA = getCategoryPathOrder(a.article?.categoryId);
      const pathB = getCategoryPathOrder(b.article?.categoryId);

      if (pathA !== pathB) return pathA.localeCompare(pathB);

      // Same category path, sort naturally by name
      const nameA = (a.article?.name ?? a.name ?? '').replace(/\s+/g, ' ').trim();
      const nameB = (b.article?.name ?? b.name ?? '').replace(/\s+/g, ' ').trim();
      return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [currentProject, articlesData, dynamicWholesaleArticles, projectWholesaleArticles, categories, wholesaleCategories]);

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

  const handleUpdateSection = async (sectionId: string, newName: string) => {
    if (!currentProject) return;
    const section = currentProject.selectedItems.find(i => i.id === sectionId);
    if (!section) return;
    
    const updatedSection = { ...section, text: newName };
    const result = await upsertProjectItem(updatedSection);
    if (result) {
      updateLocalItem(result);
      impactMedium();
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (!currentProject) return;
    
    try {
      // 1. In der Datenbank alle Items dieses Abschnitts auf "Allgemein" setzen
      const { error } = await supabase
        .from('project_items')
        .update({ section_id: null })
        .eq('section_id', sectionId);
      
      if (error) throw error;

      // 2. Den Abschnitt selbst löschen
      const success = await deleteProjectItem(sectionId);
      if (success) {
        // Lokalen Status aktualisieren
        setCurrentProject(prev => {
          if (!prev) return null;
          return {
            ...prev,
            selectedItems: prev.selectedItems
              .filter(i => i.id !== sectionId) // Abschnitt entfernen
              .map(i => i.section_id === sectionId ? { ...i, section_id: null } : i) // Items aktualisieren
          };
        });
        
        if (activeSectionId === sectionId) {
          setActiveSectionId(null);
        }
        
        impactMedium();
        toast({ title: 'Abschnitt gelöscht' });
      }
    } catch (err) {
      console.error('Fehler beim Löschen des Abschnitts:', err);
      toast({ title: 'Fehler beim Löschen', variant: 'destructive' });
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

  // Open Edit Project
  const handleOpenEditProject = () => {
    if (!currentProject) return;
    setEditProjectData({
      name: currentProject.name || '',
      client_name: currentProject.client_name || '',
      address: currentProject.address || '',
      notes: currentProject.notes || '',
      start_date: currentProject.start_date || '',
      end_date: currentProject.end_date || ''
    });
    setIsEditProjectOpen(true);
  };

  // Save Edit Project
  const handleSaveProject = async () => {
    if (!currentProject || !editProjectData.name.trim()) return;
    const success = await updateProject(currentProject.id, {
      ...editProjectData,
      start_date: editProjectData.start_date || null,
      end_date: editProjectData.end_date || null,
    });
    if (success) {
      setCurrentProject({ ...currentProject, ...editProjectData });
      setIsEditProjectOpen(false);
      toast({ title: 'Baustelle aktualisiert', description: 'Die Projektdaten wurden gespeichert.' });
    } else {
      toast({ title: 'Fehler', description: 'Projektdaten konnten nicht gespeichert werden.', variant: 'destructive' });
    }
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
        "hidden lg:block relative shrink-0 h-full",
        viewMode === 'angebot' && "w-[240px]"
      )}
        style={viewMode !== 'angebot' ? { width: sidebarWidth } : undefined}
      >
        
        {/* Drag handle for sidebar */}
        {viewMode === 'aufmass' && (
          <div
            className="absolute top-0 bottom-0 right-0 w-1.5 cursor-col-resize z-30 group hover:bg-emerald-500/30 active:bg-emerald-500/40 transition-colors"
            onMouseDown={(e) => {
              e.preventDefault();
              const startX = e.clientX;
              const startW = sidebarWidth;
              const onMove = (ev: MouseEvent) => {
                const newW = Math.max(200, Math.min(500, startW + ev.clientX - startX));
                setSidebarWidth(newW);
              };
              const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                localStorage.setItem('aufmass_sidebar_w', String(sidebarWidth));
              };
              document.body.style.cursor = 'col-resize';
              document.body.style.userSelect = 'none';
              document.addEventListener('mousemove', onMove);
              document.addEventListener('mouseup', onUp);
            }}
          />
        )}
        
        {/* Drawer: KATEGORIEN */}
        <aside className={cn(
          "absolute top-0 bottom-0 left-0 w-full flex flex-col border-r border-white/10 bg-black/20 backdrop-blur-[60px] shadow-[inset_1px_0_0_rgba(255,255,255,0.05),10px_0_30px_rgba(0,0,0,0.5)] z-20"
        )}>
          {viewMode === 'aufmass' ? (
            <>
              <div className="p-3 border-b border-white/5 bg-white/[0.02] shrink-0 space-y-2">
                {catalogSource === 'wholesale' && (
                  <p className="text-[10px] text-amber-400/70 text-center">Großhändler-Katalog aktiv</p>
                )}
                <div className="relative group">
                  <Search className={cn('absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-300', searchQuery ? 'text-emerald-400' : 'text-white/30')} size={14} />
                  <Input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Artikel oder Nummer suchen..."
                    className="h-9 pl-8 pr-16 text-xs glass-input border-white/5 group-hover:border-emerald-500/20 transition-all"
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    {searchQuery && (
                      <button onClick={() => { setSearchQuery(''); impactLight(); }} className="p-1.5 rounded text-white/30 hover:text-white hover:bg-white/10 transition-all">
                        <CloseIcon size={12} />
                      </button>
                    )}
                    <button 
                      onClick={toggleRecording} 
                      className={cn("p-1.5 rounded transition-all relative", isRecording ? "text-emerald-400 bg-emerald-500/20" : "text-white/30 hover:text-white hover:bg-white/10")}
                      title="Spracheingabe"
                    >
                      <Mic size={12} className={cn(isRecording && "animate-pulse")} />
                      {isProcessing && <div className="absolute inset-0 border-2 border-emerald-400/50 border-t-emerald-400 rounded animate-spin" />}
                    </button>
                  </div>
                </div>
              </div>
              {debouncedSearchQuery.trim() ? (
                <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
                  <p className="text-[10px] text-white/30 px-2 mb-1 uppercase tracking-wider">Suchergebnisse</p>
                  {searchResults.slice(0, 10).map(article => {
                    const qty = getQuantityInSection(article.id);
                    const item = getItemInSection(article.id);
                    const isFromAngebot = item?.is_from_angebot || false;
                    const cat = activeCategories.find(c => c.id === article.categoryId);
                    return (
                      <button
                        key={article.id}
                        onClick={() => {
                          setActiveCategoryId(article.categoryId);
                          // expand parent chain
                          let currId: string | null | undefined = article.categoryId;
                          const toExpand: string[] = [];
                          while (currId) {
                            const parent = activeCategories.find(c => c.id === currId);
                            if (parent?.parentId) { toExpand.push(parent.parentId); currId = parent.parentId; } else break;
                          }
                          if (toExpand.length > 0) {
                            setExpandedCategories(prev => {
                              const next = new Set(prev);
                              toExpand.forEach(id => next.add(id));
                              return next;
                            });
                          }
                          setSearchQuery('');
                        }}
                        className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/[0.06] transition-all text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                          {article.imageUrl || cat?.imageUrl
                            ? <img src={article.imageUrl || cat?.imageUrl} alt="" className="w-full h-full object-contain p-1" />
                            : <Package size={12} className="text-white/15" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[12px] text-white/85 font-medium leading-tight truncate">{article.name}</p>
                            {isFromAngebot && (
                              <span className="shrink-0 text-[8px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1 py-0.5 rounded shadow-sm" title="Ursprünglich aus Angebot übernommen">Angebot</span>
                            )}
                          </div>
                          <p className="text-[10px] text-white/30 font-mono truncate">{article.articleNumber}</p>
                        </div>
                        {qty > 0 && (
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded shrink-0">{qty}×</span>
                        )}
                      </button>
                    );
                  })}
                  {searchResults.length === 0 && (
                    <p className="text-xs text-white/20 text-center py-6">Keine Treffer</p>
                  )}
                  {searchResults.length > 10 && (
                    <p className="text-[10px] text-white/25 text-center py-1">+{searchResults.length - 10} weitere</p>
                  )}
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto py-3">
                  <CategoryTree
                    categories={activeCategories}
                    activeCategoryId={activeCategoryId}
                    expandedCategories={expandedCategories}
                    forceExpandedIds={searchExpandedIds}
                    onSelectCategory={handleSelectCategory}
                    onToggleExpansion={toggleCategoryExpansion}
                  />
                </div>
              )}
              <div className="p-3 border-t border-white/5 bg-white/[0.01] shrink-0 flex flex-col gap-1">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => { setActiveCategoryId(null); setExpandedCategories(new Set()); setSearchQuery(''); }}
                  disabled={!activeCategoryId && expandedCategories.size === 0 && !searchQuery}
                  className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8"
                >
                  <CloseIcon size={14} className="mr-2 opacity-70" /> Filter zurücksetzen
                </Button>
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
                      "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors", 
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
      <div className={cn("flex-1 flex flex-col overflow-hidden z-20 min-w-0", viewMode === 'angebot' && "bg-black/10")}>
        {/* Page header – Unified global/local header */}
        <header className="shrink-0 border-b border-white/10 bg-black/10 backdrop-blur-[40px] shadow-[inset_0_-1px_0_rgba(255,255,255,0.05)] relative z-30">
          <div className="flex items-center justify-between px-4 h-14 md:h-16 gap-3">
            {/* Left: back, logo + project name/edit */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => navigate('/')}
                className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all shrink-0"
              >
                <ChevronLeft size={20} />
              </button>
              
              <Sheet open={isCategorySheetOpen} onOpenChange={setIsCategorySheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="lg:hidden p-1.5 shrink-0 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all">
                    <Menu size={20} className="text-emerald-400" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" onOpenAutoFocus={(e) => { e.preventDefault(); }} className="w-[85vw] sm:w-[400px] rounded-r-3xl border-r border-white/10 bg-black/20 backdrop-blur-[60px] flex flex-col p-0 shadow-[inset_1px_0_0_rgba(255,255,255,0.05)]">
                  {/* Dummy button to catch focus and prevent mobile keyboard from opening */}
                  <button autoFocus className="sr-only" aria-hidden="true" />
                  {viewMode === 'aufmass' ? (
                    <>
                      <SheetHeader className="p-5 pb-3 border-b border-white/5 shrink-0">
                        <SheetTitle className="text-left text-xl text-gradient-emerald flex items-center gap-2">
                          <BookMarked size={20} className="text-emerald-400" /> Artikelkatalog
                        </SheetTitle>
                        {catalogSource === 'wholesale' && (
                          <p className="text-[10px] text-amber-400/70 text-left mt-2">Großhändler-Katalog aktiv</p>
                        )}
                        <div className="relative group mt-3">
                          <Search className={cn('absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-300', searchQuery ? 'text-emerald-400' : 'text-white/30')} size={14} />
                          <Input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Artikel oder Nummer suchen..."
                            className="h-9 pl-8 pr-16 text-xs glass-input border-white/5 group-hover:border-emerald-500/20 transition-all"
                          />
                          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                            {searchQuery && (
                              <button onClick={() => { setSearchQuery(''); impactLight(); }} className="p-1.5 rounded text-white/30 hover:text-white hover:bg-white/10 transition-all">
                                <CloseIcon size={12} />
                              </button>
                            )}
                            <button 
                              onClick={toggleRecording} 
                              className={cn("p-1.5 rounded transition-all relative", isRecording ? "text-emerald-400 bg-emerald-500/20" : "text-white/30 hover:text-white hover:bg-white/10")}
                              title="Spracheingabe"
                            >
                              <Mic size={12} className={cn(isRecording && "animate-pulse")} />
                              {isProcessing && <div className="absolute inset-0 border-2 border-emerald-400/50 border-t-emerald-400 rounded animate-spin" />}
                            </button>
                          </div>
                        </div>
                      </SheetHeader>
                      {debouncedSearchQuery.trim() ? (
                        <div className="flex-1 overflow-y-auto py-2 px-4 space-y-1">
                          <p className="text-[10px] text-white/30 px-2 mb-1 uppercase tracking-wider">Suchergebnisse</p>
                          {searchResults.slice(0, 10).map(article => {
                            const qty = getQuantityInSection(article.id);
                            const item = getItemInSection(article.id);
                            const isFromAngebot = item?.is_from_angebot || false;
                            const cat = activeCategories.find(c => c.id === article.categoryId);
                            return (
                              <button
                                key={article.id}
                                onClick={() => {
                                  setActiveCategoryId(article.categoryId);
                                  let currId: string | null | undefined = article.categoryId;
                                  const toExpand: string[] = [];
                                  while (currId) {
                                    const parent = activeCategories.find(c => c.id === currId);
                                    if (parent?.parentId) { toExpand.push(parent.parentId); currId = parent.parentId; } else break;
                                  }
                                  if (toExpand.length > 0) {
                                    setExpandedCategories(prev => {
                                      const next = new Set(prev);
                                      toExpand.forEach(id => next.add(id));
                                      return next;
                                    });
                                  }
                                  setSearchQuery('');
                                  setIsCategorySheetOpen(false);
                                }}
                                className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/[0.06] transition-all text-left"
                              >
                                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                                  {article.imageUrl || cat?.imageUrl
                                    ? <img src={article.imageUrl || cat?.imageUrl} alt="" className="w-full h-full object-contain p-1" />
                                    : <Package size={12} className="text-white/15" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-[12px] text-white/85 font-medium leading-tight truncate">{article.name}</p>
                                    {isFromAngebot && (
                                      <span className="shrink-0 text-[8px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1 py-0.5 rounded shadow-sm" title="Ursprünglich aus Angebot übernommen">Angebot</span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-white/30 font-mono truncate">{article.articleNumber}</p>
                                </div>
                                {qty > 0 && (
                                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded shrink-0">{qty}×</span>
                                )}
                              </button>
                            );
                          })}
                          {searchResults.length === 0 && (
                            <p className="text-xs text-white/20 text-center py-6">Keine Treffer</p>
                          )}
                          {searchResults.length > 10 && (
                            <p className="text-[10px] text-white/25 text-center py-1">+{searchResults.length - 10} weitere</p>
                          )}
                        </div>
                      ) : (
                        <div className="overflow-y-auto p-4 flex-1 space-y-6">
                          <div>
                            <CategoryTree
                              categories={activeCategories}
                              activeCategoryId={activeCategoryId}
                              expandedCategories={expandedCategories}
                              forceExpandedIds={searchExpandedIds}
                              onSelectCategory={(id) => { handleSelectCategory(id); setIsCategorySheetOpen(false); }}
                              onToggleExpansion={toggleCategoryExpansion}
                            />
                          </div>
                        </div>
                      )}
                      <div className="p-4 border-t border-white/5 bg-white/[0.02] flex flex-col gap-2">
                        <Button 
                          variant="ghost" 
                          onClick={() => { setActiveCategoryId(null); setExpandedCategories(new Set()); setSearchQuery(''); setIsCategorySheetOpen(false); }}
                          disabled={!activeCategoryId && expandedCategories.size === 0 && !searchQuery}
                          className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <CloseIcon size={16} className="mr-2 opacity-70" /> Filter zurücksetzen
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <SheetHeader className="p-5 pb-3 border-b border-white/5 shrink-0 space-y-3">
                        <SheetTitle className="text-left text-xl text-emerald-400 flex items-center gap-2">
                          <BookMarked size={20} className="text-emerald-400" /> Projekt-Struktur
                        </SheetTitle>
                        <Button onClick={() => {
                           const name = "Neuer Bauabschnitt";
                           const order = currentProject?.selectedItems?.length || 0;
                           if (currentProject) {
                             addSection(currentProject.id, name, order).then(res => {
                               if (res) { updateLocalItem(res); setActiveSectionId(res.id); setIsCategorySheetOpen(false); }
                             });
                           }
                        }} className="w-full bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 h-9">
                          Abschnitt hinzufügen
                        </Button>
                      </SheetHeader>
                      <div className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
                        {sections.map(s => (
                          <button 
                            key={s.id}
                            onClick={() => { setActiveSectionId(s.id); setIsCategorySheetOpen(false); }}
                            className={cn(
                              "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors", 
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
                    </>
                  )}
                </SheetContent>
              </Sheet>
              
              <div className="hidden sm:flex w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 items-center justify-center shadow-md shrink-0">
                <BookMarked size={15} className="text-white" />
              </div>
              
              <div className="min-w-0 flex flex-col">
                <div className="flex items-center gap-1.5 cursor-pointer hover:bg-white/5 p-1 -ml-1 rounded-md" onClick={handleOpenEditProject}>
                  <h1 className="font-semibold text-white text-sm md:text-base truncate">{currentProject.name}</h1>
                  <Edit3 size={14} className="text-emerald-400 shrink-0" />
                  {isOffline && (
                    <span className="shrink-0 flex items-center gap-1 bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ml-1">
                      <CloudOff size={10} /> Offline
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-white/40 leading-tight">{totalArticleCount} Artikel verplant</p>
              </div>
            </div>

            {/* Center: Mode Switch (only visible if planning, desktop) */}
            {currentProject.status === 'planning' && (
              <div className="hidden xl:flex items-center bg-white/5 p-1 rounded-xl mx-auto absolute left-1/2 -translate-x-1/2">
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

            {/* Right: manual position + theme */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Mobile Summary Trigger in Header */}
              <Sheet open={isSummaryOpen} onOpenChange={setIsSummaryOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="xl:hidden h-8 px-2 gap-1.5 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 mr-1 relative">
                    <Package size={15} />
                    <span className="font-bold text-xs">{totalArticleCount}</span>
                  </Button>
                </SheetTrigger>
                {/* Content rendering is kept further down... */}
              </Sheet>

              <div className="relative group/sync">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => preloadCatalog(true)}
                  className={cn(
                    "h-8 w-8 rounded-full transition-all relative",
                    status.isVisible && !status.isInitialSync ? "text-emerald-400 bg-emerald-500/10" : "text-white/40 hover:text-emerald-400 hover:bg-white/10"
                  )}
                  title="Datenbank manuell synchronisieren"
                >
                  <Database size={15} className={cn(status.isVisible && !status.isInitialSync && status.changesCount === 0 && "animate-spin")} />
                  
                  {/* Subtle status dot */}
                  <AnimatePresence>
                    {status.isVisible && !status.isInitialSync && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className={cn(
                          "absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background",
                          status.changesCount > 0 ? "bg-emerald-500" : "bg-blue-500"
                        )}
                      />
                    )}
                  </AnimatePresence>
                </Button>
              </div>

              {viewMode === 'aufmass' && (
                <Button
                  onClick={() => { setIsCopyMode(!isCopyMode); impactLight(); }}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-8 px-2.5 gap-1.5 transition-all border",
                    isCopyMode 
                      ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border-blue-500/30 shadow-inner" 
                      : "text-white/50 hover:text-white hover:bg-white/10 border-transparent"
                  )}
                  title="Kopiermodus (Tablet Split-Screen)"
                >
                  <Copy size={15} />
                  <span className="hidden xl:inline text-xs">Kopiermodus</span>
                </Button>
              )}
              <Button
                onClick={() => setIsInfoHubOpen(true)}
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 text-white/50 hover:text-emerald-400 hover:bg-emerald-500/10 gap-1.5 transition-all"
                title="Info-Hub (Dokumente)"
              >
                <FileText size={15} />
                <span className="hidden xl:inline text-xs">Info</span>
              </Button>
              <div className="w-px h-4 bg-white/10 mx-1 hidden sm:block" />
              <Button
                onClick={() => setIsManualDialogOpen(true)}
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 text-white/50 hover:text-emerald-400 hover:bg-emerald-500/10 gap-1.5 transition-all"
                title="Manuelle Position"
              >
                <PenLine size={15} />
                <span className="hidden xl:inline text-xs">Manuell</span>
              </Button>
              <div className="w-px h-4 bg-white/10 mx-1 hidden sm:block" />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="h-8 w-8 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-all"
              >
                {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              </Button>
            </div>
          </div>
        </header>

        {/* Mobile: Mode Switch */}
        {currentProject.status === 'planning' && (
          <div className="xl:hidden flex items-center bg-white/[0.02] p-1.5 border-b border-white/5 shrink-0 gap-1.5 overflow-x-auto no-scrollbar">
            <button 
              onClick={() => setViewMode('angebot')}
              className={cn("flex-1 px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap", viewMode === 'angebot' ? "bg-white text-black shadow-sm" : "bg-white/5 text-white/60 hover:text-white")}
            >
              📸 Struktur & Notizen
            </button>
            <button 
              onClick={() => setViewMode('aufmass')}
              className={cn("flex-1 px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap", viewMode === 'aufmass' ? "bg-white text-black shadow-sm" : "bg-white/5 text-white/60 hover:text-white")}
            >
              🛒 Material
            </button>
          </div>
        )}

        {/* Section Bar - ALWAYS VISIBLE OVER BOTH MODES */}
        <SectionBar
          sections={sections}
          activeSectionId={activeSectionId}
          onSelectSection={setActiveSectionId}
          onAddSection={handleAddSection}
          onDeleteSection={handleDeleteSection}
          onUpdateSection={handleUpdateSection}
        />

        {viewMode === 'aufmass' ? (
          <>
        {/* Category label */}
        {activeCategory && !searchQuery && (
          <div className="px-4 py-2 border-b border-white/5 shrink-0">
            <p className="text-xs text-white/40 uppercase tracking-wider">{activeCategory.name}</p>
          </div>
        )}

        {/* Article List */}
        <main className="flex-1 overflow-y-auto p-4 pb-24 lg:pb-4">
          <div className="flex flex-col gap-3 max-w-none">
            {isFetchingWholesale ? (
              <div className="col-span-full text-center py-20 ios-card">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center animate-pulse mx-auto mb-4">
                   <Package size={24} className="text-emerald-400" />
                </div>
                <p className="text-white/40 font-medium">Artikel werden geladen...</p>
              </div>
            ) : viewArticles.length === 0 ? (
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
                const item = getItemInSection(article.id);
                const isFromAngebot = item?.is_from_angebot || false;
                const cat = activeCategories.find(c => c.id === article.categoryId);
                return (
                  <ArticleCard
                    key={article.id}
                    article={article}
                    quantity={qty}
                    onIncrement={() => handleIncrement(article)}
                    onDecrement={() => handleDecrement(article)}
                    onReset={() => handleResetArticle(article)}
                    categoryImageUrl={cat?.imageUrl}
                    isFromAngebot={isFromAngebot}
                    copyMode={isCopyMode}
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
      <aside className="hidden xl:flex flex-col shrink-0 border-l border-white/10 bg-background/60 backdrop-blur-xl z-10 relative"
        style={{ width: summaryWidth }}
      >
        {/* Drag handle for summary panel */}
        <div
          className="absolute top-0 bottom-0 left-0 w-1.5 cursor-col-resize z-30 group hover:bg-emerald-500/30 active:bg-emerald-500/40 transition-colors"
          onMouseDown={(e) => {
            e.preventDefault();
            const startX = e.clientX;
            const startW = summaryWidth;
            const onMove = (ev: MouseEvent) => {
              const newW = Math.max(250, Math.min(600, startW - (ev.clientX - startX)));
              setSummaryWidth(newW);
            };
            const onUp = () => {
              document.removeEventListener('mousemove', onMove);
              document.removeEventListener('mouseup', onUp);
              document.body.style.cursor = '';
              document.body.style.userSelect = '';
              localStorage.setItem('aufmass_summary_w', String(summaryWidth));
            };
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
          }}
        />
        <div className="p-4 border-b border-white/5 shrink-0">
          <h2 className="text-sm font-bold text-white/60 uppercase tracking-wider">Aufmaß</h2>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{totalArticleCount} <span className="text-sm font-normal text-white/40">Artikel</span></p>
        </div>
        <SummaryList
                projectId={currentProject.id}
                sectionItems={currentProject?.selectedItems.filter(i => i.type === 'section').sort((a, b) => a.order - b.order) ?? []}
                articleItems={processedSummaryItems.filter(i => i.type === 'article')}
                activeSectionId={activeSectionId}
                onSelectSection={setActiveSectionId}
                onDeleteItem={handleDeleteItem}
                onUpdateQuantity={handleUpdateQuantity}
              />
        <div className="p-4 border-t border-white/5 bg-white/[0.02] space-y-2 shrink-0">
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={handleGeneratePdf} disabled={totalArticleCount === 0} className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold shadow-[0_0_20px_rgba(16,185,129,0.3)] border-0 h-10 rounded-xl transition-all">
              <FileDown size={16} className="mr-2 opacity-70" /> PDF
            </Button>
            <Button onClick={handleExportCsv} disabled={totalArticleCount === 0} className="w-full bg-white/5 hover:bg-white/15 text-white/90 border border-white/10 h-10 rounded-xl transition-colors">
              <FileSpreadsheet size={16} className="mr-2 opacity-50" /> CSV
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Summary Sheet content is triggered from header now */}
      <Sheet open={isSummaryOpen} onOpenChange={setIsSummaryOpen}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-[2.5rem] border-t border-white/10 bg-background/95 backdrop-blur-xl flex flex-col p-0">
          <SheetHeader className="p-6 pb-4 border-b border-white/5 shrink-0">
            <SheetTitle className="text-left text-xl text-gradient-emerald">Aktuelles Aufmaß</SheetTitle>
          </SheetHeader>
          <SummaryList
                projectId={currentProject.id}
                sectionItems={currentProject?.selectedItems.filter(i => i.type === 'section').sort((a, b) => a.order - b.order) ?? []}
                articleItems={processedSummaryItems.filter(i => i.type === 'article')}
                activeSectionId={activeSectionId}
                onSelectSection={setActiveSectionId}
                onDeleteItem={handleDeleteItem}
                onUpdateQuantity={handleUpdateQuantity}
              />
          <div className="p-6 border-t border-white/5 shrink-0 bg-white/[0.02] grid grid-cols-2 gap-3">
            <Button onClick={handleGeneratePdf} disabled={totalArticleCount === 0} className="h-14 text-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold shadow-[0_0_30px_rgba(16,185,129,0.3)] border-0 rounded-2xl transition-all">
              <FileDown size={20} className="mr-2 opacity-70" /> PDF
            </Button>
            <Button onClick={handleExportCsv} disabled={totalArticleCount === 0} className="h-14 text-lg bg-white/5 hover:bg-white/15 text-white/90 border border-white/10 rounded-2xl transition-colors">
              <FileSpreadsheet size={20} className="mr-2 opacity-50" /> CSV
            </Button>
          </div>
        </SheetContent>
      </Sheet>
        </>
      )}

      {/* Info Hub Sheet */}
      <Sheet open={isInfoHubOpen} onOpenChange={setIsInfoHubOpen}>
        <SheetContent side="right" onOpenAutoFocus={(e) => e.preventDefault()} className="w-[85vw] sm:w-[500px] border-l border-white/10 bg-black/20 backdrop-blur-[60px] flex flex-col p-0 shadow-[inset_1px_0_0_rgba(255,255,255,0.05)]">
          <SheetHeader className="p-6 pb-4 border-b border-white/5 shrink-0">
            <SheetTitle className="text-left text-xl text-gradient-emerald flex items-center gap-2">
              <FileText size={20} className="text-emerald-400" /> Info-Hub
            </SheetTitle>
            <p className="text-sm text-white/50 text-left">
              Technische Dokumente und Baustellenskizzen
            </p>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-6 flex flex-col space-y-6">
            {(() => {
              const docs = currentProject?.documents || [];
              const sketches = currentProject?.selectedItems
                .filter(item => item.images && item.images.length > 0)
                .flatMap(item => item.images!.map(img => ({ url: img, name: item.name || item.text || 'Skizze' }))) || [];
                
              const hasContent = docs.length > 0 || sketches.length > 0;

              if (!hasContent) {
                return (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-white/5 border-2 border-dashed border-white/10 flex items-center justify-center mb-4">
                      <FileText size={24} className="text-white/20" />
                    </div>
                    <p className="text-center text-white/40 text-sm max-w-[250px]">
                      Noch keine Dokumente (PDFs, Datenblätter) oder Skizzen für dieses Projekt hinterlegt.
                    </p>
                    {/* File upload would normally be handled here, simplified for now */}
                  </div>
                );
              }

              return (
                <>
                  {docs.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider">Dokumente</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {docs.map((docUrl, idx) => (
                          <a key={idx} href={docUrl} target="_blank" rel="noopener noreferrer" className="group relative aspect-video rounded-xl overflow-hidden border border-white/10 bg-white/5 hover:border-emerald-500/50 transition-colors flex items-center justify-center">
                            <FileText size={32} className="text-white/20 group-hover:text-emerald-400 transition-colors" />
                            <div className="absolute inset-x-0 bottom-0 p-2 bg-black/60 backdrop-blur-md">
                              <p className="text-xs text-white truncate">Dokument {idx + 1}</p>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {sketches.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider">Skizzen & Fotos</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {sketches.map((sketch, idx) => (
                          <a key={idx} href={sketch.url} target="_blank" rel="noopener noreferrer" className="group relative aspect-video rounded-xl overflow-hidden border border-white/10 bg-white/5 hover:border-emerald-500/50 transition-colors flex items-center justify-center">
                            <img src={sketch.url} alt={sketch.name} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="absolute inset-x-0 bottom-0 p-2 bg-black/60 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity">
                              <p className="text-xs text-white truncate">{sketch.name}</p>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
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
              <Input value={manualName} onChange={e => setManualName(e.target.value)} className="glass-input" placeholder="z.B. Sonderteil Bogen 90°" />
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
      {/* Edit Project Dialog (Side Panel) */}
      <ResizableSidePanel
        isOpen={isEditProjectOpen}
        onClose={() => setIsEditProjectOpen(false)}
        title="Baustelle bearbeiten"
        storageKey="edit-project"
        defaultWidth={500}
        minWidth={400}
        maxWidth={800}
      >
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 flex items-center gap-2 mb-4">
                Grunddaten
              </p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name" className="text-white/70">Projektname / Bauvorhaben <span className="text-red-400">*</span></Label>
                  <Input
                    id="edit-name"
                    value={editProjectData.name}
                    onChange={(e) => setEditProjectData({ ...editProjectData, name: e.target.value })}
                    className="glass-input h-11"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-client" className="text-white/70">Auftraggeber (Optional)</Label>
                    <Input
                      id="edit-client"
                      value={editProjectData.client_name}
                      onChange={(e) => setEditProjectData({ ...editProjectData, client_name: e.target.value })}
                      className="glass-input h-11"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 flex items-center gap-2 mb-4 mt-8">
                Zeitraum & Standort
              </p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-address" className="text-white/70">Adresse / Ort (Optional)</Label>
                  <Input
                    id="edit-address"
                    value={editProjectData.address}
                    onChange={(e) => setEditProjectData({ ...editProjectData, address: e.target.value })}
                    className="glass-input h-11"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-start" className="text-white/70">Startdatum</Label>
                    <Input
                      id="edit-start"
                      type="date"
                      value={editProjectData.start_date || ''}
                      onChange={(e) => setEditProjectData({ ...editProjectData, start_date: e.target.value })}
                      className="glass-input h-11 [color-scheme:dark]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-end" className="text-white/70">Enddatum</Label>
                    <Input
                      id="edit-end"
                      type="date"
                      value={editProjectData.end_date || ''}
                      onChange={(e) => setEditProjectData({ ...editProjectData, end_date: e.target.value })}
                      className="glass-input h-11 [color-scheme:dark]"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 flex items-center gap-2 mb-4 mt-8">
                Extras
              </p>
              <div className="space-y-2">
                <Label htmlFor="edit-notes" className="text-white/70">Interne Bemerkung (Optional)</Label>
                <Textarea
                  id="edit-notes"
                  value={editProjectData.notes}
                  onChange={(e) => setEditProjectData({ ...editProjectData, notes: e.target.value })}
                  className="glass-input min-h-[100px] resize-y"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 p-4 border-t border-white/5 bg-background/50 backdrop-blur-md flex justify-between gap-3">
          <Button variant="ghost" onClick={() => setIsEditProjectOpen(false)} className="text-white/60 flex-1 sm:flex-none">
            Abbrechen
          </Button>
          <Button onClick={handleSaveProject} disabled={!editProjectData.name.trim()} className="bg-emerald-500 hover:bg-emerald-600 text-white flex-1 sm:flex-none shadow-lg shadow-emerald-900/20">
            Speichern
          </Button>
        </div>
      </ResizableSidePanel>
    </motion.div>
  );
};

export default AufmassPage;
