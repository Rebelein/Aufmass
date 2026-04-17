import type { Category } from '@/lib/data';
import { cn } from '@/lib/utils';
import { Package, FolderPlus, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface CategoryTreeProps {
  categories: Category[];
  activeCategoryId: string | null;
  expandedCategories: Set<string>;
  /** Additional category IDs to force-expand (e.g. from search) */
  forceExpandedIds?: string[];
  onSelectCategory: (categoryId: string) => void;
  onToggleExpansion: (categoryId: string, e: React.MouseEvent) => void;
  /** Optional render function for additional actions per category (e.g. admin context menu) */
  renderActions?: (category: Category, meta: { isFirst: boolean; isLast: boolean }) => React.ReactNode;
}

export function CategoryTree({
  categories,
  activeCategoryId,
  expandedCategories,
  forceExpandedIds = [],
  onSelectCategory,
  onToggleExpansion,
  renderActions,
}: CategoryTreeProps) {

  const renderTree = (parentId: string | null = null, depth = 0): JSX.Element => {
    const columnCategories = categories
      .filter(category => category.parentId === parentId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    
    if (columnCategories.length === 0 && parentId === null) {
      return (
        <div className="py-16 text-center space-y-4">
          <p className="text-white/60 font-medium text-xs">Keine Kategorien vorhanden</p>
        </div>
      );
    }

    if (columnCategories.length === 0) return <></>;

    return (
      <ul className={cn("space-y-1", depth === 0 ? "px-2" : "pl-4 pr-0 mt-1")}>
        {columnCategories.map((category, index) => {
          const hasChildren = categories.some(subCat => subCat.parentId === category.id);
          const isSelected = activeCategoryId === category.id;
          const isExpanded = expandedCategories.has(category.id) || forceExpandedIds.includes(category.id);
          const isFirst = index === 0;
          const isLast = index === columnCategories.length - 1;
          
          return (
            <li key={category.id} className="group/item">
              <div 
                className={cn(
                  "flex justify-between items-start p-2.5 rounded-xl cursor-pointer transition-all duration-200 border",
                  isSelected && !hasChildren
                    ? "bg-primary/10 border-primary/20 text-primary shadow-sm" 
                    : "bg-transparent border-transparent hover:bg-white/[0.04] hover:border-white/10 text-white/70 hover:text-white",
                  isSelected && hasChildren && "border-white/10 bg-white/[0.04]"
                )}
                onClick={(e) => {
                  if (hasChildren) {
                    onToggleExpansion(category.id, e);
                  } else {
                    onSelectCategory(category.id);
                  }
                }}
              >
                <div className="flex items-center flex-grow gap-2.5 min-w-0 pr-2">
                  <div className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors overflow-hidden",
                      isSelected && !hasChildren ? "bg-primary/20 text-primary" : "bg-white/5 text-white/40 group-hover/item:bg-white/10 group-hover/item:text-white/70"
                  )}>
                      {category.imageUrl ? (
                        <img src={category.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        hasChildren ? <FolderPlus size={14} /> : <Package size={14} />
                      )}
                  </div>
                  <span className={cn(
                      "font-semibold whitespace-normal break-words transition-colors text-sm leading-tight"
                  )}>
                      {category.name}
                  </span>
                  {hasChildren && (
                    <ChevronRight size={14} className={cn("ml-auto shrink-0 transition-transform", isExpanded && "rotate-90", isSelected ? "text-primary" : "text-white/20")} />
                  )}
                </div>

                {/* Optional actions (admin mode) */}
                {renderActions && (
                  <div className="shrink-0 flex items-start" onClick={e => e.stopPropagation()}>
                    {renderActions(category, { isFirst, isLast })}
                  </div>
                )}
              </div>
              <AnimatePresence initial={false}>
                {hasChildren && isExpanded && (
                  <motion.div
                    key="content"
                    initial="collapsed"
                    animate="open"
                    exit="collapsed"
                    variants={{
                      open: { opacity: 1, height: "auto" },
                      collapsed: { opacity: 0, height: 0 }
                    }}
                    transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                    className="overflow-hidden"
                  >
                    {renderTree(category.id, depth + 1)}
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
    );
  };

  return renderTree();
}
