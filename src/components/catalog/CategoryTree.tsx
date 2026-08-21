import type { Category } from '@/lib/data';
import { cn } from '@/lib/utils';
import { Package, FolderPlus, ChevronRight, Check, X, GripVertical, Trash2, Loader2, ChevronLeft, FolderOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DndContext, closestCenter, KeyboardSensor, TouchSensor, MouseSensor, useSensor, useSensors, type DragEndEvent, DragOverlay } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState, useCallback, useEffect, useMemo } from 'react';

export interface CategoryTreeProps {
  categories: Category[];
  activeCategoryId: string | null;
  expandedCategories: Set<string>;
  forceExpandedIds?: string[];
  onSelectCategory: (categoryId: string, hasChildren?: boolean) => void;
  onToggleExpansion: (categoryId: string, e: React.MouseEvent) => void;
  renderActions?: (category: Category, meta: { isFirst: boolean; isLast: boolean }) => React.ReactNode;
  
  onReorderCategory?: (activeId: string, overId: string) => void;

  inlineEditingCategoryId?: string | null;
  editedCategoryName?: string;
  onEditedCategoryNameChange?: (name: string) => void;
  onSaveEdit?: () => void;
  onCancelEdit?: () => void;

  inlineCreateParentId?: string | null;
  newSubCategoryName?: string;
  onNewSubCategoryNameChange?: (name: string) => void;
  onSaveNewSubCategory?: () => void;
  onCancelNewSubCategory?: () => void;

  deletingCategoryId?: string | null;
  onConfirmDeleteCategory?: (categoryId: string) => void;
  onCancelDeleteCategory?: () => void;

  showCheckboxes?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (categoryId: string) => void;

  updatingIds?: Set<string>;
}

interface CategoryWithMeta extends Category {
  hasChildren: boolean;
  isDeepestExpanded: boolean;
}

const SortableCategoryItem = ({ 
  id, 
  category, 
  index, 
  siblingCount,
  activeCategoryId, 
  renderActions, 
  onReorderCategory, 
  inlineEditingCategoryId, 
  editedCategoryName, 
  onEditedCategoryNameChange, 
  onSaveEdit, 
  onCancelEdit,
  deletingCategoryId,
  onConfirmDeleteCategory,
  onCancelDeleteCategory,
  showCheckboxes,
  selectedIds,
  onToggleSelect,
  updatingIds,
  onClick
}: { 
  id: string, 
  category: CategoryWithMeta, 
  index: number, 
  siblingCount: number,
  activeCategoryId: string | null, 
  renderActions: CategoryTreeProps['renderActions'], 
  onReorderCategory: CategoryTreeProps['onReorderCategory'], 
  inlineEditingCategoryId: string | null | undefined, 
  editedCategoryName: string | undefined, 
  onEditedCategoryNameChange: ((name: string) => void) | undefined, 
  onSaveEdit: (() => void) | undefined, 
  onCancelEdit: (() => void) | undefined,
  deletingCategoryId: string | null | undefined,
  onConfirmDeleteCategory: ((categoryId: string) => void) | undefined,
  onCancelDeleteCategory: (() => void) | undefined,
  showCheckboxes?: boolean,
  selectedIds?: Set<string>,
  onToggleSelect?: (categoryId: string) => void,
  updatingIds?: Set<string>,
  onClick: () => void
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.3 : 1,
  };

  const isSelected = activeCategoryId === category.id;
  const isFirst = index === 0;
  const isLast = index === siblingCount - 1;
  const hasChildren = category.hasChildren;
  const isDeleting = deletingCategoryId === category.id;

  return (
    <li ref={setNodeRef} style={style} className="group/item relative list-none mb-1">
      {isDeleting ? (
        /* Inline Delete Confirmation */
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.15 }}
          className="flex items-center gap-2 p-2 rounded-xl border border-red-500/30 bg-red-950/40 backdrop-blur-sm ml-0"
          onClick={e => e.stopPropagation()}
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-red-500/20 text-red-400">
            <Trash2 size={14} />
          </div>
          <span className="flex-1 text-xs font-semibold text-red-300 truncate min-w-0">
            {category.name} löschen?
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onConfirmDeleteCategory?.(category.id)}
              className="px-2.5 py-1 rounded-lg bg-red-500/90 hover:bg-red-500 text-destructive-foreground text-xs font-bold transition-colors cursor-pointer"
            >
              Löschen
            </button>
            <button
              type="button"
              onClick={() => onCancelDeleteCategory?.()}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-accent-foreground transition-colors cursor-pointer"
              title="Abbrechen"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      ) : (
        /* Normal Category Row */
        <div 
          className={cn(
            "flex justify-between items-center p-2.5 min-h-[44px] rounded-xl cursor-pointer transition-all duration-200 border",
            onReorderCategory ? "pl-1" : "",
            isSelected
              ? "bg-primary/10 border-primary/20 text-primary shadow-sm font-semibold" 
              : "bg-transparent border-transparent hover:bg-muted hover:border-border text-muted-foreground hover:text-accent-foreground"
          )}
          role="button"
          tabIndex={0}
          aria-current={isSelected ? 'true' : undefined}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onClick();
            }
          }}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          <div className="flex items-center flex-grow gap-2 min-w-0 pr-2">
            {onReorderCategory && (
              <div 
                className="w-7 h-7 flex items-center justify-center cursor-grab active:cursor-grabbing text-muted-foreground hover:text-emerald-400/70 transition-colors shrink-0 mr-1" 
                {...attributes} 
                {...listeners}
                onClick={e => e.stopPropagation()}
              >
                <GripVertical size={14} />
              </div>
            )}

            {showCheckboxes && (
              <input
                type="checkbox"
                checked={selectedIds?.has(category.id) || false}
                onChange={(e) => {
                  e.stopPropagation();
                  onToggleSelect?.(category.id);
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-4 h-4 rounded border border-border bg-background text-primary focus:ring-primary shrink-0 mr-2 cursor-pointer accent-emerald-500"
              />
            )}

            <div className={cn(
                "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors overflow-hidden",
                isSelected ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground group-hover/item:bg-muted group-hover/item:text-muted-foreground"
            )}>
                {updatingIds?.has(category.id) ? (
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                ) : category.imageUrl ? (
                  <img src={category.imageUrl} alt="" className="w-full h-full object-contain p-0.5" />
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
                  className="flex-1 bg-muted border border-input h-7 px-2 rounded text-sm text-foreground focus:outline-none focus:border-emerald-500 w-full min-w-0"
                />
              </div>
            ) : (
              <span className={cn(
                  "whitespace-normal break-words transition-colors text-sm leading-tight",
                  isSelected ? "text-primary" : "text-foreground/90"
              )}>
                  {category.name}
              </span>
            )}
            {hasChildren && (
              <ChevronRight size={14} className={cn("ml-auto shrink-0 transition-transform text-muted-foreground", isSelected && "text-primary")} />
            )}
          </div>

          {inlineEditingCategoryId === category.id ? (
            <div className="shrink-0 flex items-center gap-1 ml-2" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
               <button type="button" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onSaveEdit?.(); }} onClick={e => e.stopPropagation()} className="p-1 hover:bg-muted rounded text-emerald-400 cursor-pointer" title="Speichern"><Check size={16}/></button>
               <button type="button" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onCancelEdit?.(); }} onClick={e => e.stopPropagation()} className="p-1 hover:bg-muted rounded text-red-400 cursor-pointer" title="Abbrechen"><X size={16}/></button>
            </div>
          ) : (
            renderActions && (
              <div className="shrink-0 flex items-start" onClick={e => e.stopPropagation()}>
                {renderActions(category, { isFirst, isLast })}
              </div>
            )
          )}
        </div>
      )}
    </li>
  );
};

const DragOverlayContent = ({ category }: { category: CategoryWithMeta }) => (
  <div className="flex items-center gap-2.5 p-2.5 rounded-xl border border-emerald-500/40 bg-background backdrop-blur-md shadow-2xl text-foreground max-w-[280px]">
    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-emerald-500/20 text-emerald-400">
      {category.hasChildren ? <FolderPlus size={14} /> : <Package size={14} />}
    </div>
    <span className="font-semibold text-sm leading-tight truncate">{category.name}</span>
  </div>
);

export function CategoryTree(props: CategoryTreeProps) {
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [prevDepth, setPrevDepth] = useState(0);
  const [slideDirection, setSlideDirection] = useState<'forward' | 'backward'>('forward');

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Compute navigation path
  const path = useMemo(() => {
    const p: Category[] = [];
    let currentId = currentParentId;
    while (currentId) {
      const cat = props.categories.find(c => c.id === currentId);
      if (cat) {
        p.unshift(cat);
        currentId = cat.parentId || null;
      } else {
        break;
      }
    }
    return p;
  }, [currentParentId, props.categories]);

  // Track page navigation direction for slide animations
  useEffect(() => {
    const currentDepth = path.length;
    if (currentDepth > prevDepth) {
      setSlideDirection('forward');
    } else if (currentDepth < prevDepth) {
      setSlideDirection('backward');
    }
    setPrevDepth(currentDepth);
  }, [path.length, prevDepth]);

  // Synchronize internal currentParentId with external activeCategoryId
  useEffect(() => {
    if (props.activeCategoryId) {
      const activeCat = props.categories.find(c => c.id === props.activeCategoryId);
      if (activeCat) {
        const parentId = activeCat.parentId || null;
        if (props.activeCategoryId !== currentParentId && parentId !== currentParentId) {
          setCurrentParentId(parentId);
        }
      }
    }
  }, [props.activeCategoryId, props.categories]);

  // Reset currentParentId if parent category no longer exists (e.g. deleted)
  useEffect(() => {
    if (currentParentId !== null) {
      const parentExists = props.categories.some(c => c.id === currentParentId);
      if (!parentExists) {
        setCurrentParentId(null);
      }
    }
  }, [props.categories, currentParentId]);

  // Automatically navigate to parent if inline creation is triggered from external action
  useEffect(() => {
    if (props.inlineCreateParentId) {
      setCurrentParentId(props.inlineCreateParentId);
    }
  }, [props.inlineCreateParentId]);

  const handleDragStart = useCallback((event: { active: { id: string | number } }) => {
    setActiveDragId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (over && active.id !== over.id) {
      const activeCategory = props.categories.find(c => c.id === active.id);
      const overCategory = props.categories.find(c => c.id === over.id);
      
      if (activeCategory && overCategory && activeCategory.parentId === overCategory.parentId) {
        props.onReorderCategory?.(active.id as string, over.id as string);
      }
    }
  }, [props.onReorderCategory, props.categories]);

  const handleDragCancel = useCallback(() => {
    setActiveDragId(null);
  }, []);

  const handleCategoryClick = (category: Category, hasChildren: boolean) => {
    props.onSelectCategory(category.id, hasChildren);
    if (hasChildren) {
      setCurrentParentId(category.id);
    }
  };

  const activeDragCategory = activeDragId 
    ? props.categories.find(c => c.id === activeDragId) 
    : null;

  const visibleCategories = useMemo(() => {
    return props.categories
      .filter(category => category.parentId === currentParentId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [props.categories, currentParentId]);

  const isAddingHere = props.inlineCreateParentId !== undefined && props.inlineCreateParentId !== null && props.inlineCreateParentId === currentParentId;

  const breadcrumbs = (
    <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 text-xs border-b border-border/40 bg-muted/20 shrink-0">
      <button
        onClick={() => {
          setCurrentParentId(null);
          const firstRoot = props.categories.find(c => c.parentId === null);
          if (firstRoot) props.onSelectCategory(firstRoot.id, props.categories.some(c => c.parentId === firstRoot.id));
        }}
        className={cn(
          "hover:text-primary transition-colors font-semibold flex items-center gap-1 cursor-pointer",
          currentParentId === null ? "text-primary font-bold" : "text-muted-foreground"
        )}
      >
        <FolderOpen size={13} className="text-primary/70 shrink-0" />
        Katalog
      </button>
      {path.map((cat, idx) => (
        <div key={cat.id} className="flex items-center gap-1 min-w-0">
          <ChevronRight size={12} className="text-muted-foreground/45 shrink-0" />
          <button
            onClick={() => {
              setCurrentParentId(cat.id);
              props.onSelectCategory(cat.id, props.categories.some(c => c.parentId === cat.id));
            }}
            className={cn(
              "hover:text-primary transition-colors font-semibold truncate max-w-[100px] cursor-pointer",
              idx === path.length - 1 ? "text-primary font-bold" : "text-muted-foreground"
            )}
          >
            {cat.name}
          </button>
        </div>
      ))}
    </div>
  );

  const backButton = currentParentId !== null && (
    <button
      onClick={() => {
        const currentCategory = props.categories.find(c => c.id === currentParentId);
        const parentId = currentCategory ? currentCategory.parentId : null;
        setCurrentParentId(parentId || null);
        if (currentCategory) {
          props.onSelectCategory(currentCategory.id, true);
        }
      }}
      className="w-full flex items-center gap-2 p-2 rounded-xl text-left text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent hover:border-border/40 transition-[color,background-color,border-color,fill,stroke,opacity,box-shadow,transform] duration-200 cursor-pointer"
    >
      <ChevronLeft size={16} className="text-primary shrink-0" />
      <span className="truncate">Zurück zu {(() => {
        const parentId = props.categories.find(c => c.id === currentParentId)?.parentId;
        const parentName = parentId ? props.categories.find(c => c.id === parentId)?.name : "Hauptkatalog";
        return parentName;
      })()}</span>
    </button>
  );

  const listContent = (
    <div className="flex-grow flex flex-col min-h-0 overflow-hidden relative">
      {breadcrumbs}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        {backButton}
        
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={currentParentId || 'root'}
            initial={{ opacity: 0, x: slideDirection === 'forward' ? 30 : -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: slideDirection === 'forward' ? -30 : 30 }}
            transition={{ type: 'tween', ease: 'easeInOut', duration: 0.2 }}
            className="w-full flex flex-col"
          >
            {visibleCategories.length === 0 && !isAddingHere ? (
              <div className="py-12 text-center">
                <p className="text-muted-foreground font-medium text-xs">Keine Untergruppen vorhanden</p>
              </div>
            ) : (
              <ul className="space-y-1 relative">
                {visibleCategories.map((category, index) => {
                  const hasChildren = props.categories.some(c => c.parentId === category.id);
                  const categoryWithMeta = { ...category, hasChildren, isDeepestExpanded: false };
                  return (
                    <SortableCategoryItem
                      key={category.id}
                      id={category.id}
                      category={categoryWithMeta}
                      index={index}
                      siblingCount={visibleCategories.length}
                      activeCategoryId={props.activeCategoryId}
                      renderActions={props.renderActions}
                      onReorderCategory={props.onReorderCategory}
                      inlineEditingCategoryId={props.inlineEditingCategoryId}
                      editedCategoryName={props.editedCategoryName}
                      onEditedCategoryNameChange={props.onEditedCategoryNameChange}
                      onSaveEdit={props.onSaveEdit}
                      onCancelEdit={props.onCancelEdit}
                      deletingCategoryId={props.deletingCategoryId}
                      onConfirmDeleteCategory={props.onConfirmDeleteCategory}
                      onCancelDeleteCategory={props.onCancelDeleteCategory}
                      showCheckboxes={props.showCheckboxes}
                      selectedIds={props.selectedIds}
                      onToggleSelect={props.onToggleSelect}
                      updatingIds={props.updatingIds}
                      onClick={() => handleCategoryClick(category, hasChildren)}
                    />
                  );
                })}
                
                {isAddingHere && (
                  <li className="mt-1 list-none relative">
                    <div className="flex justify-between items-center p-2.5 rounded-xl border border-input bg-muted">
                       <div className="flex items-center flex-grow gap-2.5 min-w-0 pr-2">
                         <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-muted text-muted-foreground">
                            <Package size={14} />
                         </div>
                         <input 
                           autoFocus
                           placeholder="Name…"
                           value={props.newSubCategoryName || ''}
                           onChange={e => props.onNewSubCategoryNameChange?.(e.target.value)}
                           onKeyDown={e => {
                             if (e.key === 'Enter') props.onSaveNewSubCategory?.();
                             if (e.key === 'Escape') props.onCancelNewSubCategory?.();
                           }}
                           className="flex-1 bg-muted border border-input h-7 px-2 rounded text-sm text-foreground focus:outline-none focus:border-emerald-500 w-full min-w-0"
                         />
                       </div>
                       <div className="flex items-center gap-1 ml-2 shrink-0">
                         <button type="button" onClick={() => props.onSaveNewSubCategory?.()} className="p-1 hover:bg-muted rounded text-emerald-400 cursor-pointer" title="Erstellen"><Check size={16}/></button>
                         <button type="button" onClick={() => props.onCancelNewSubCategory?.()} className="p-1 hover:bg-muted rounded text-red-400 cursor-pointer" title="Abbrechen"><X size={16}/></button>
                       </div>
                    </div>
                  </li>
                )}
              </ul>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );

  if (props.onReorderCategory) {
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext id={`sortable-context-${currentParentId ?? 'root'}`} items={visibleCategories.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {listContent}
        </SortableContext>
        <DragOverlay dropAnimation={{
          duration: 200,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        }}>
          {activeDragCategory ? (
            <DragOverlayContent category={{ ...activeDragCategory, hasChildren: props.categories.some(c => c.parentId === activeDragCategory.id), isDeepestExpanded: false }} />
          ) : null}
        </DragOverlay>
      </DndContext>
    );
  }

  return listContent;
}
