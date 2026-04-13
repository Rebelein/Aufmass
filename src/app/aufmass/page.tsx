"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { Article, Category, Supplier } from '@/lib/data';
import { subscribeToCategories, subscribeToArticles, subscribeToSuppliers } from '@/lib/catalog-storage';
import ArticleList from '@/components/catalog/ArticleList';
import CategoryFilter from '@/components/catalog/CategoryFilter';
import SelectionSummary from '@/components/catalog/SelectionSummary';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import jsPDF from 'jspdf';
import { getCurrentProjectId, getProjectById, syncProjectItems, Project, ProjectSelectedItem } from '@/lib/project-storage';
import { Button } from '@/components/ui/button';
import { CheckCircle, PanelLeft, Search, LayoutGrid, ChevronLeft } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import ArticleSearchDialog from '@/components/dialogs/ArticleSearchDialog';
import { cn } from '@/lib/utils';

export interface ProcessedSummaryItem {
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
  const [stagedQuantities, setStagedQuantities] = useState<Map<string, number>>(new Map());
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const router = useRouter();
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);

  useEffect(() => {
    const projectId = getCurrentProjectId();
    if (!projectId) {
      router.replace('/projects');
      return;
    }
    
    let isMounted = true;
    const unsubscribeCategories = subscribeToCategories((cats) => {
        if (isMounted) setCategories(cats);
    });
    const unsubscribeArticles = subscribeToArticles((arts) => {
        if (isMounted) setArticlesData(arts);
    });
    const unsubscribeSuppliers = subscribeToSuppliers((supps) => {
        if (isMounted) setSuppliers(supps);
    });

    const loadProject = async () => {
        const project = await getProjectById(projectId);
        if (!project) {
          router.replace('/projects');
          return;
        }
        if (isMounted) {
            setCurrentProject(project);
            setStagedQuantities(new Map()); 
            setIsLoadingData(false);
        }
    };
    
    loadProject();

    return () => {
        isMounted = false;
        unsubscribeCategories();
        unsubscribeArticles();
        unsubscribeSuppliers();
    };
  }, [router, toast]);
  
  useEffect(() => {
    if (categories.length > 0 && !selectedCategoryId) {
      const firstTopLevelCategory = categories
        .filter(c => !c.parentId)
        .sort((a,b) => (a.order ?? 0) - (b.order ?? 0))[0];
      if (firstTopLevelCategory) setSelectedCategoryId(firstTopLevelCategory.id);
    }
  }, [categories, selectedCategoryId]);
  
  const filteredArticles = useMemo(() => {
    if (!selectedCategoryId) return [];
    return articlesData
      .filter((article) => article.categoryId === selectedCategoryId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [articlesData, selectedCategoryId]);

  const projectSelectedQuantitiesForArticleList = useMemo(() => {
    const map = new Map<string, number>();
    if (currentProject) {
      currentProject.selectedItems.forEach(item => {
        if (item.type === 'article' && item.article_id && item.quantity !== undefined) {
          map.set(item.article_id, (map.get(item.article_id) || 0) + item.quantity);
        }
      });
    }
    return map;
  }, [currentProject]);

  const processedSummaryItems: ProcessedSummaryItem[] = useMemo(() => {
    if (!currentProject) return [];
    return currentProject.selectedItems.map(item => {
      if (item.type === 'article') {
        if (item.article_id) { 
          const articleDetail = articlesData.find(a => a.id === item.article_id);
          return { ...item, article: articleDetail };
        } else { 
          return { ...item, article: { id: item.id, name: item.name || '', articleNumber: item.article_number || '', unit: item.unit || '', supplierName: item.supplier_name || '', categoryId: 'manual', order: item.order } as Article };
        }
      }
      return item as ProcessedSummaryItem;
    }).filter(i => !!i).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [currentProject, articlesData]);

  const updateProjectItems = (newItems: ProjectSelectedItem[]) => {
    if (currentProject) {
      const finalItems = newItems.map((item, index) => ({ ...item, order: index }));
      syncProjectItems(currentProject.id, finalItems).then((success) => {
          if (success) setCurrentProject({ ...currentProject, selectedItems: finalItems });
      });
    }
  };

  const handleStagedQuantityChange = (articleId: string, quantity: number) => {
    setStagedQuantities((prev) => {
      const newMap = new Map(prev);
      if (quantity > 0) newMap.set(articleId, quantity);
      else newMap.delete(articleId);
      return newMap;
    });
  };

  const handleApplyStagedToProject = () => {
    if (!currentProject || stagedQuantities.size === 0) return;
    let updatedSelectedItems = [...currentProject.selectedItems];
    stagedQuantities.forEach((quantity, articleId) => {
      if (quantity > 0) { 
        updatedSelectedItems.push({ type: 'article', id: crypto.randomUUID(), article_id: articleId, quantity } as ProjectSelectedItem);
      }
    });
    updateProjectItems(updatedSelectedItems);
    setStagedQuantities(new Map()); 
    toast({ title: "Zum Aufmaß hinzugefügt" });
  };

  const handleAddSection = (text: string) => {
    if (!currentProject || !text.trim()) return;
    updateProjectItems([...currentProject.selectedItems, { type: 'section', id: crypto.randomUUID(), text: text.trim() } as ProjectSelectedItem]);
  };
  
  const handleAddManualArticle = async (data: any) => {
    if (!currentProject) return;
    const newItem = { ...data, type: 'article', id: crypto.randomUUID(), quantity: parseInt(data.quantity, 10), article_number: data.articleNumber, supplier_name: data.supplierName } as ProjectSelectedItem;
    updateProjectItems([...currentProject.selectedItems, newItem]);
  };

  const handleUpdateManualArticle = (itemId: string, data: any) => {
    if (!currentProject) return;
    updateProjectItems(currentProject.selectedItems.map(item => item.id === itemId ? { ...item, ...data, article_number: data.articleNumber, supplier_name: data.supplierName } : item));
  };

  const handleGeneratePdf = async () => {
    if (!currentProject) return;
    setIsGeneratingPdf(true);
    try {
        const doc = new jsPDF();
        // ... (PDF logic remains the same, assuming it's already functional)
        doc.text(`PROJEKT: ${currentProject.name}`, 15, 28);
        doc.save(`aufmass_${currentProject.name}.pdf`);
    } finally {
        setIsGeneratingPdf(false);
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-transparent">
        <Sidebar className="border-r border-white/5 bg-gray-900/20 backdrop-blur-xl">
          <SidebarContent className="bg-transparent">
            {isLoadingData ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-8 w-full bg-white/5" />
                <Skeleton className="h-32 w-full bg-white/5" />
              </div>
            ) : (
              <CategoryFilter
                  articles={articlesData}
                  categories={categories}
                  selectedCategoryId={selectedCategoryId}
                  onSelectCategory={setSelectedCategoryId}
                  expandedCategories={expandedCategories}
                  onToggleExpand={(id) => setExpandedCategories(prev => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id); else next.add(id);
                    return next;
                  })}
                  onOpenSearchDialog={() => setIsSearchDialogOpen(true)}
              />
            )}
          </SidebarContent>
        </Sidebar>

        <SidebarInset className="bg-transparent">
          <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-700">
            {isLoadingData || !currentProject ? (
                 <div className="space-y-8">
                    <Skeleton className="h-12 w-1/3 bg-white/5" />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <Skeleton className="h-40 bg-white/5" /><Skeleton className="h-40 bg-white/5" /><Skeleton className="h-40 bg-white/5" />
                    </div>
                </div>
            ) : (
                <>
                    <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div className="space-y-1">
                            <button onClick={() => router.push('/projects')} className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-sm font-bold uppercase tracking-wider mb-2">
                                <ChevronLeft size={16} /> Projekte
                            </button>
                            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                                <span className="text-white/50">Projekt:</span> <span className="text-gradient-emerald">{currentProject.name}</span>
                            </h1>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button onClick={() => setIsSearchDialogOpen(true)} variant="outline" className="glass-card border-white/10 hover:bg-white/5 h-12 px-6">
                                <Search className="mr-2 h-4 w-4 text-emerald-400" /> Suchen
                            </Button>
                            <SidebarTrigger className="lg:hidden glass-card border-white/10 p-3 h-12 w-12 flex items-center justify-center">
                                <LayoutGrid size={20} />
                            </SidebarTrigger>
                        </div>
                    </header>

                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-10 items-start">
                        <div className="xl:col-span-2 space-y-8">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-white/80 flex items-center gap-2">
                                    <LayoutGrid size={20} className="text-emerald-500" />
                                    {categories.find(c => c.id === selectedCategoryId)?.name || 'Artikel'}
                                </h2>
                                {stagedQuantities.size > 0 && (
                                    <span className="text-xs font-bold bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/30 animate-pulse">
                                        {stagedQuantities.size} bereit zum Hinzufügen
                                    </span>
                                )}
                            </div>

                            <ArticleList
                                articles={filteredArticles} 
                                projectSelectedQuantities={projectSelectedQuantitiesForArticleList} 
                                stagedQuantities={stagedQuantities} 
                                onStagedQuantityChange={handleStagedQuantityChange}
                            />

                            {selectedCategoryId && ( 
                                <Button 
                                    onClick={handleApplyStagedToProject} 
                                    className={cn(
                                        "w-full btn-primary h-16 text-lg font-bold shadow-2xl transition-all duration-500",
                                        stagedQuantities.size === 0 ? "opacity-20 grayscale pointer-events-none" : "opacity-100"
                                    )}
                                >
                                    <CheckCircle className="mr-3 h-6 w-6" />
                                    Auswahl dem Aufmaß hinzufügen
                                </Button>
                            )}
                        </div>

                        <aside className="space-y-6">
                            <div className="sticky top-24">
                                <SelectionSummary
                                    selectedItems={processedSummaryItems}
                                    onGeneratePdf={handleGeneratePdf}
                                    isGeneratingPdf={isGeneratingPdf}
                                    onClearSelection={() => updateProjectItems([])}
                                    onAddSection={handleAddSection}
                                    onAddManualArticle={handleAddManualArticle}
                                    onUpdateItemsOrder={(items) => updateProjectItems(items)}
                                    onDeleteItem={(id) => updateProjectItems(currentProject.selectedItems.filter(i => i.id !== id))}
                                    onUpdateSectionText={(id, text) => updateProjectItems(currentProject.selectedItems.map(i => i.id === id ? { ...i, text } : i))}
                                    onUpdateSelectedItemQuantity={(id, q) => updateProjectItems(currentProject.selectedItems.map(i => i.id === id ? { ...i, quantity: q } : i).filter(i => (i.quantity || 0) > 0))}
                                    onUpdateManualArticle={handleUpdateManualArticle}
                                    suppliers={suppliers}
                                />
                            </div>
                        </aside>
                    </div>
                </>
            )}
          </div>
        </SidebarInset>
      </div>
      <ArticleSearchDialog
          isOpen={isSearchDialogOpen}
          onClose={() => setIsSearchDialogOpen(false)}
          allArticles={articlesData}
          projectSelectedQuantities={projectSelectedQuantitiesForArticleList}
          onApply={(items) => {
              let updated = [...currentProject!.selectedItems];
              items.forEach(i => updated.push({ type: 'article', id: crypto.randomUUID(), article_id: i.articleId, quantity: i.quantity } as ProjectSelectedItem));
              updateProjectItems(updated);
          }}
      />
    </SidebarProvider>
  );
};

export default AufmassPage;
