"use client";

import * as React from 'react';
import type { Article, Category } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, Search, LayoutGrid } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CategoryFilterProps {
  articles: Article[];
  categories: Category[];
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string) => void;
  expandedCategories: Set<string>;
  onToggleExpand: (categoryId: string) => void;
  onOpenSearchDialog: () => void;
}

const CategoryFilter: React.FC<CategoryFilterProps> = ({
  articles,
  categories,
  selectedCategoryId,
  onSelectCategory,
  expandedCategories,
  onToggleExpand,
  onOpenSearchDialog,
}) => {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const getDescendantCategoryIds = React.useCallback((categoryId: string, allCategories: Category[]): string[] => {
    let ids: string[] = [];
    const children = allCategories.filter(cat => cat.parentId === categoryId);
    for (const child of children) {
      ids.push(child.id);
      ids = [...ids, ...getDescendantCategoryIds(child.id, allCategories)];
    }
    return ids;
  }, []);

  const previewImages = React.useMemo(() => {
    const imageMap = new Map<string, string | null>();
    if (!categories || !articles) return imageMap;
    
    for (const category of categories) {
      // Prioritize the category's own image
      if (category.imageUrl) {
        imageMap.set(category.id, category.imageUrl);
        continue;
      }

      const allDescendantIds = getDescendantCategoryIds(category.id, categories);
      const allCategoryIds = [category.id, ...allDescendantIds];
      const articleWithImage = articles.find(art => allCategoryIds.includes(art.categoryId) && art.imageUrl);
      imageMap.set(category.id, articleWithImage?.imageUrl || null);
    }
    return imageMap;
  }, [articles, categories, getDescendantCategoryIds]);

  const renderCategoryButtons = (currentParentId: string | null, level: number): JSX.Element[] => {
    return categories
      .filter(cat => cat.parentId === currentParentId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map(category => {
        const hasChildren = categories.some(subCat => subCat.parentId === category.id);
        const isExpanded = expandedCategories.has(category.id);
        const isSelected = selectedCategoryId === category.id;
        const previewImageUrl = previewImages.get(category.id);

        return (
          <React.Fragment key={category.id}>
            <div className="flex items-center gap-1 group" style={{ paddingLeft: `${level * 1}rem` }}>
              <div className="flex items-center w-full">
                {hasChildren ? (
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggleExpand(category.id); }}
                        className="h-8 w-8 shrink-0 flex items-center justify-center text-white/50 hover:text-emerald-400 transition-colors"
                    >
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                ) : (
                    <div className="w-8 shrink-0 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-white/10 group-hover:bg-emerald-500/40 transition-colors" />
                    </div>
                )}

                <button
                    data-category-button-id={category.id}
                    onClick={() => {
                        onSelectCategory(category.id);
                        if (hasChildren && !isExpanded) onToggleExpand(category.id);
                    }}
                    className={cn(
                        "flex-grow text-left px-3 py-2 rounded-xl transition-all duration-300 flex items-center gap-3 overflow-hidden border",
                        isSelected 
                            ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.1)]" 
                            : "bg-white/5 border-transparent text-white/60 hover:bg-white/10 hover:text-white"
                    )}
                >
                    {previewImageUrl ? (
                        <div className="relative w-6 h-6 shrink-0 rounded-lg overflow-hidden border border-white/10">
                            <img src={previewImageUrl} alt="" className="w-full h-full object-contain p-1" />
                        </div>
                    ) : (
                        <LayoutGrid size={14} className={cn("shrink-0", isSelected ? "text-emerald-400" : "text-white/50")} />
                    )}
                    <span className="truncate text-sm font-medium">{category.name}</span>
                </button>
              </div>
            </div>
            {hasChildren && isExpanded && (
              <div className="mt-1 space-y-1">
                {renderCategoryButtons(category.id, level + 1)}
              </div>
            )}
          </React.Fragment>
        );
      });
  };

  return (
    <div className="h-full flex flex-col p-6 space-y-8">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight text-gradient">Katalog</h2>
        <Button
            onClick={onOpenSearchDialog}
            className="w-full glass-input justify-start gap-3 h-12 hover:bg-white/10 transition-colors group"
        >
            <Search size={18} className="text-white/50 group-hover:text-emerald-400 transition-colors" />
            <span className="text-white/40 group-hover:text-white transition-colors">Suchen...</span>
        </Button>
      </div>

      <div className="flex-grow flex flex-col min-h-0">
        <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/50 mb-4 px-2">Kategorien</h3>
        <ScrollArea className="flex-grow -mx-2 px-2 no-scrollbar">
            <div className="space-y-1.5 pb-20" ref={scrollContainerRef}>
                {renderCategoryButtons(null, 0)}
            </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default CategoryFilter;
