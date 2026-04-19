import type { Category } from '@/lib/data';
import { cn } from '@/lib/utils';
import { Package, FolderPlus, ChevronRight, Check, X } from 'lucide-react';
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

  /** Inline edit state */
  inlineEditingCategoryId?: string | null;
  editedCategoryName?: string;
  onEditedCategoryNameChange?: (name: string) => void;
  onSaveEdit?: () => void;
  onCancelEdit?: () => void;

  /** Inline create state */
  inlineCreateParentId?: string | null;
  newSubCategoryName?: string;
  onNewSubCategoryNameChange?: (name: string) => void;
  onSaveNewSubCategory?: () => void;
  onCancelNewSubCategory?: () => void;
}

export function CategoryTree({
  categories,
  activeCategoryId,
  expandedCategories,
  forceExpandedIds = [],
  onSelectCategory,
  onToggleExpansion,
  renderActions,
  inlineEditingCategoryId,
  editedCategoryName,
  onEditedCategoryNameChange,
  onSaveEdit,
  onCancelEdit,
  inlineCreateParentId,
  newSubCategoryName,
  onNewSubCategoryNameChange,
  onSaveNewSubCategory,
  onCancelNewSubCategory,
}: CategoryTreeProps) {

  const renderTree = (parentId: string | null = null, depth = 0): JSX.Element => {
    const columnCategories = categories
      .filter(category => category.parentId === parentId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    
    const isAddingHere = inlineCreateParentId !== undefined && inlineCreateParentId !== null && inlineCreateParentId === parentId;

    if (columnCategories.length === 0 && !isAddingHere) {
      if (parentId === null) {
        return (
          <div className="py-16 text-center space-y-4">
            <p className="text-white/60 font-medium text-xs">Keine Kategorien vorhanden</p>
          </div>
        );
      }
      return <></>;
    }

    return (
      <ul className={cn("space-y-1", depth === 0 ? "px-2" : "pl-4 pr-0 mt-1")}>
        {columnCategories.map((category, index) => {
          const isAddingChildToThis = inlineCreateParentId === category.id;
          const hasChildren = categories.some(subCat => subCat.parentId === category.id) || isAddingChildToThis;
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
                  {inlineEditingCategoryId === category.id ? (
                    <div className="flex-1 flex items-center gap-2 min-w-0" onClick={e => e.stopPropagation()}>
                      <input 
                        autoFocus
                        value={editedCategoryName || ''}
                        onChange={e => onEditedCategoryNameChange?.(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') onSaveEdit?.();
                          if (e.key === 'Escape') onCancelEdit?.();
                        }}
                        className="flex-1 bg-black/20 border border-white/20 h-7 px-2 rounded text-sm text-white focus:outline-none focus:border-emerald-500 w-full min-w-0"
                      />
                    </div>
                  ) : (
                    <span className={cn(
                        "font-semibold whitespace-normal break-words transition-colors text-sm leading-tight"
                    )}>
                        {category.name}
                    </span>
                  )}
                  {hasChildren && (
                    <ChevronRight size={14} className={cn("ml-auto shrink-0 transition-transform", isExpanded && "rotate-90", isSelected ? "text-primary" : "text-white/20")} />
                  )}
                </div>

                {/* Optional actions (admin mode) */}
                {inlineEditingCategoryId === category.id ? (
                  <div className="shrink-0 flex items-center gap-1 ml-2" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                     <button type="button" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onSaveEdit?.(); }} onClick={e => e.stopPropagation()} className="p-1 hover:bg-white/10 rounded text-emerald-400" title="Speichern"><Check size={16}/></button>
                     <button type="button" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onCancelEdit?.(); }} onClick={e => e.stopPropagation()} className="p-1 hover:bg-white/10 rounded text-red-400" title="Abbrechen"><X size={16}/></button>
                  </div>
                ) : (
                  renderActions && (
                    <div className="shrink-0 flex items-start" onClick={e => e.stopPropagation()}>
                      {renderActions(category, { isFirst, isLast })}
                    </div>
                  )
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
        {isAddingHere && (
          <li className="group/item mt-1">
            <div className="flex justify-between items-center p-2.5 rounded-xl border border-white/20 bg-white/[0.08]">
               <div className="flex items-center flex-grow gap-2.5 min-w-0 pr-2">
                 <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-white/5 text-white/40">
                    <Package size={14} />
                 </div>
                 <input 
                   autoFocus
                   placeholder="Name..."
                   value={newSubCategoryName || ''}
                   onChange={e => onNewSubCategoryNameChange?.(e.target.value)}
                   onKeyDown={e => {
                     if (e.key === 'Enter') onSaveNewSubCategory?.();
                     if (e.key === 'Escape') onCancelNewSubCategory?.();
                   }}
                   className="flex-1 bg-black/20 border border-white/20 h-7 px-2 rounded text-sm text-white focus:outline-none focus:border-emerald-500 w-full min-w-0"
                 />
               </div>
               <div className="flex items-center gap-1 ml-2 shrink-0" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                 <button type="button" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onSaveNewSubCategory?.(); }} onClick={e => e.stopPropagation()} className="p-1 hover:bg-white/10 rounded text-emerald-400" title="Erstellen"><Check size={16}/></button>
                 <button type="button" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onCancelNewSubCategory?.(); }} onClick={e => e.stopPropagation()} className="p-1 hover:bg-white/10 rounded text-red-400" title="Abbrechen"><X size={16}/></button>
               </div>
            </div>
          </li>
        )}
      </ul>
    );
  };

  return renderTree();
}
