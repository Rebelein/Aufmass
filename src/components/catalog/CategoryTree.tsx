import type { Category } from '@/lib/data';
import { cn } from '@/lib/utils';
import { Package, FolderPlus, ChevronRight, Check, X, GripVertical, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DndContext, closestCenter, KeyboardSensor, TouchSensor, MouseSensor, useSensor, useSensors, type DragEndEvent, DragOverlay } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState, useCallback } from 'react';

export interface CategoryTreeProps {
  categories: Category[];
  activeCategoryId: string | null;
  expandedCategories: Set<string>;
  forceExpandedIds?: string[];
  onSelectCategory: (categoryId: string) => void;
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
  expandedCategories, 
  forceExpandedIds, 
  onSelectCategory, 
  onToggleExpansion, 
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
  depth,
  children
}: { 
  id: string, 
  category: CategoryWithMeta, 
  index: number, 
  siblingCount: number,
  activeCategoryId: string | null, 
  expandedCategories: Set<string>, 
  forceExpandedIds: string[], 
  onSelectCategory: (id: string) => void, 
  onToggleExpansion: (id: string, e: React.MouseEvent) => void, 
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
  depth: number,
  children: React.ReactNode 
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.3 : 1,
  };

  const isSelected = activeCategoryId === category.id;
  const isExpanded = expandedCategories.has(category.id) || forceExpandedIds.includes(category.id);
  const isFirst = index === 0;
  const isLast = index === siblingCount - 1;
  const hasChildren = category.hasChildren;
  const isDeepestExpanded = category.isDeepestExpanded;
  const isDeleting = deletingCategoryId === category.id;

  return (
    <li ref={setNodeRef} style={style} className="group/item relative list-none mb-1">
      {depth > 0 && (
        <div className="absolute -left-[14px] top-[22px] w-[14px] h-[2px] bg-border/40 pointer-events-none rounded-r-full" />
      )}
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
              className="px-2.5 py-1 rounded-lg bg-red-500/90 hover:bg-red-500 text-destructive-foreground text-xs font-bold transition-colors"
            >
              Löschen
            </button>
            <button
              type="button"
              onClick={() => onCancelDeleteCategory?.()}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-accent-foreground transition-colors"
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
            isDeepestExpanded && "sticky top-0 z-10 bg-background backdrop-blur-md border-border text-foreground shadow-lg",
            isSelected
              ? "bg-primary/10 border-primary/20 text-primary shadow-sm" 
              : !isDeepestExpanded && isExpanded
                ? "border-border bg-muted text-foreground" 
                : !isDeepestExpanded && "bg-transparent border-transparent hover:bg-muted hover:border-border text-muted-foreground hover:text-accent-foreground"
          )}
          onClick={(e) => {
            onSelectCategory(category.id);
            if (hasChildren) {
              onToggleExpansion(category.id, e);
            }
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

            <div className={cn(
                "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors overflow-hidden",
                isSelected ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground group-hover/item:bg-muted group-hover/item:text-muted-foreground"
            )}>
                {category.imageUrl ? (
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
                  "font-semibold whitespace-normal break-words transition-colors text-sm leading-tight"
              )}>
                  {category.name}
              </span>
            )}
            {hasChildren && (
              <ChevronRight size={14} className={cn("ml-auto shrink-0 transition-transform", isExpanded && "rotate-90", isSelected ? "text-primary" : "text-muted-foreground")} />
            )}
          </div>

          {inlineEditingCategoryId === category.id ? (
            <div className="shrink-0 flex items-center gap-1 ml-2" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
               <button type="button" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onSaveEdit?.(); }} onClick={e => e.stopPropagation()} className="p-1 hover:bg-muted rounded text-emerald-400" title="Speichern"><Check size={16}/></button>
               <button type="button" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onCancelEdit?.(); }} onClick={e => e.stopPropagation()} className="p-1 hover:bg-muted rounded text-red-400" title="Abbrechen"><X size={16}/></button>
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
      {children}
    </li>
  );
};

/** A drag overlay label shown while dragging a category */
const DragOverlayContent = ({ category }: { category: CategoryWithMeta }) => (
  <div className="flex items-center gap-2.5 p-2.5 rounded-xl border border-emerald-500/40 bg-background backdrop-blur-md shadow-2xl text-foreground max-w-[280px]">
    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-emerald-500/20 text-emerald-400">
      {category.hasChildren ? <FolderPlus size={14} /> : <Package size={14} />}
    </div>
    <span className="font-semibold text-sm leading-tight truncate">{category.name}</span>
  </div>
);

/**
 * A group for one level of siblings.
 * Uses SortableContext to define sortable items for this level.
 */
const SortableSiblingGroup = ({
  parentId,
  categories,
  activeCategoryId,
  expandedCategories,
  forceExpandedIds,
  onSelectCategory,
  onToggleExpansion,
  renderActions,
  onReorderCategory,
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
  deletingCategoryId,
  onConfirmDeleteCategory,
  onCancelDeleteCategory,
  depth,
}: {
  parentId: string | null;
  categories: Category[];
  depth: number;
} & Omit<CategoryTreeProps, 'categories'>) => {

  const columnCategories = categories
    .filter(category => category.parentId === parentId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const isAddingHere = inlineCreateParentId !== undefined && inlineCreateParentId !== null && inlineCreateParentId === parentId;

  if (columnCategories.length === 0 && !isAddingHere) {
    if (parentId === null) {
      return (
        <div className="py-16 text-center space-y-4">
          <p className="text-muted-foreground font-medium text-xs">Keine Kategorien vorhanden</p>
        </div>
      );
    }
    return <></>;
  }

  const content = (
    <ul className={cn("space-y-1 relative", depth === 0 ? "px-2" : "ml-[22px] pl-3 border-l-2 border-border/30 mt-1")}>
      {columnCategories.map((category, index) => {
        const isAddingChildToThis = inlineCreateParentId === category.id;
        const hasChildren = categories.some(subCat => subCat.parentId === category.id) || isAddingChildToThis;
        const isExpanded = expandedCategories.has(category.id) || (forceExpandedIds || []).includes(category.id);

        const hasExpandedChild = isExpanded && hasChildren && categories
          .filter(c => c.parentId === category.id)
          .some(child => {
            const childHasKids = categories.some(sc => sc.parentId === child.id);
            const childIsExpanded = expandedCategories.has(child.id) || (forceExpandedIds || []).includes(child.id);
            return childHasKids && childIsExpanded;
          });
        const isDeepestExpanded = isExpanded && hasChildren && !hasExpandedChild;
        
        const categoryWithMeta: CategoryWithMeta = { ...category, hasChildren, isDeepestExpanded };
        
        return (
          <SortableCategoryItem 
            key={category.id} 
            id={category.id}
            category={categoryWithMeta}
            index={index}
            siblingCount={columnCategories.length}
            activeCategoryId={activeCategoryId}
            expandedCategories={expandedCategories}
            forceExpandedIds={forceExpandedIds || []}
            onSelectCategory={onSelectCategory}
            onToggleExpansion={onToggleExpansion}
            renderActions={renderActions}
            onReorderCategory={onReorderCategory}
            inlineEditingCategoryId={inlineEditingCategoryId}
            editedCategoryName={editedCategoryName}
            onEditedCategoryNameChange={onEditedCategoryNameChange}
            onSaveEdit={onSaveEdit}
            onCancelEdit={onCancelEdit}
            deletingCategoryId={deletingCategoryId}
            onConfirmDeleteCategory={onConfirmDeleteCategory}
            onCancelDeleteCategory={onCancelDeleteCategory}
            depth={depth}
          >
            <AnimatePresence initial={false}>
              {hasChildren && isExpanded && (
                <motion.div
                  key="content"
                  initial="collapsed"
                  animate="open"
                  exit="collapsed"
                  variants={{
                    open: { opacity: 1, height: "auto", transitionEnd: { overflow: "visible" } },
                    collapsed: { opacity: 0, height: 0, overflow: "hidden" }
                  }}
                  transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                >
                  <SortableSiblingGroup
                    parentId={category.id}
                    categories={categories}
                    activeCategoryId={activeCategoryId}
                    expandedCategories={expandedCategories}
                    forceExpandedIds={forceExpandedIds}
                    onSelectCategory={onSelectCategory}
                    onToggleExpansion={onToggleExpansion}
                    renderActions={renderActions}
                    onReorderCategory={onReorderCategory}
                    inlineEditingCategoryId={inlineEditingCategoryId}
                    editedCategoryName={editedCategoryName}
                    onEditedCategoryNameChange={onEditedCategoryNameChange}
                    onSaveEdit={onSaveEdit}
                    onCancelEdit={onCancelEdit}
                    inlineCreateParentId={inlineCreateParentId}
                    newSubCategoryName={newSubCategoryName}
                    onNewSubCategoryNameChange={onNewSubCategoryNameChange}
                    onSaveNewSubCategory={onSaveNewSubCategory}
                    onCancelNewSubCategory={onCancelNewSubCategory}
                    deletingCategoryId={deletingCategoryId}
                    onConfirmDeleteCategory={onConfirmDeleteCategory}
                    onCancelDeleteCategory={onCancelDeleteCategory}
                    depth={depth + 1}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </SortableCategoryItem>
        );
      })}
      {isAddingHere && (
        <li className="group/item mt-1 list-none relative">
          {depth > 0 && (
            <div className="absolute -left-[14px] top-[22px] w-[14px] h-[2px] bg-border/40 pointer-events-none rounded-r-full" />
          )}
          <div className="flex justify-between items-center p-2.5 rounded-xl border border-input bg-muted ml-0">
             <div className="flex items-center flex-grow gap-2.5 min-w-0 pr-2">
               <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-muted text-muted-foreground">
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
                 className="flex-1 bg-muted border border-input h-7 px-2 rounded text-sm text-foreground focus:outline-none focus:border-emerald-500 w-full min-w-0"
               />
             </div>
             <div className="flex items-center gap-1 ml-2 shrink-0" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
               <button type="button" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onSaveNewSubCategory?.(); }} onClick={e => e.stopPropagation()} className="p-1 hover:bg-muted rounded text-emerald-400" title="Erstellen"><Check size={16}/></button>
               <button type="button" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onCancelNewSubCategory?.(); }} onClick={e => e.stopPropagation()} className="p-1 hover:bg-muted rounded text-red-400" title="Abbrechen"><X size={16}/></button>
             </div>
          </div>
        </li>
      )}
    </ul>
  );

  // If reordering is enabled, wrap this sibling level in its own SortableContext
  if (onReorderCategory) {
    return (
      <SortableContext id={`sortable-context-${parentId ?? 'root'}`} items={columnCategories.map(c => c.id)} strategy={verticalListSortingStrategy}>
        {content}
      </SortableContext>
    );
  }

  return content;
};

export function CategoryTree(props: CategoryTreeProps) {
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

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

  const handleDragStart = useCallback((event: { active: { id: string | number } }) => {
    setActiveDragId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (over && active.id !== over.id) {
      // Check if they are in the same parent group (siblings)
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

  const activeDragCategory = activeDragId 
    ? props.categories.find(c => c.id === activeDragId) 
    : null;

  const content = (
    <SortableSiblingGroup
      {...props}
      parentId={null}
      depth={0}
    />
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
        {content}
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

  return content;
}
