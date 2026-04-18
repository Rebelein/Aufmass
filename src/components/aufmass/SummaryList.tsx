import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, FolderOpen, Trash2, Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SwipeableItem } from '@/components/catalog/SwipeableItem';
import { motion, AnimatePresence } from 'framer-motion';
import type { ProcessedSummaryItem } from '@/lib/types';
import type { ProjectSelectedItem } from '@/lib/project-storage';

interface SummaryListProps {
  sectionItems: ProjectSelectedItem[];
  articleItems: ProcessedSummaryItem[];
  activeSectionId: string | null;
  onSelectSection: (sectionId: string | null) => void;
  onDeleteItem: (itemId: string) => void;
  onUpdateQuantity: (itemId: string, newQuantity: number) => void;
}

export function SummaryList({
  sectionItems,
  articleItems,
  activeSectionId,
  onSelectSection,
  onDeleteItem,
  onUpdateQuantity,
}: SummaryListProps) {
  // Track which sections are collapsed; default: all expanded
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const toggleCollapse = (sId: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sId)) next.delete(sId); else next.add(sId);
      return next;
    });
  };

  const renderSectionGroup = (sId: string | null, label: string) => {
    const items = articleItems.filter(i => (i as any).section_id === sId);
    if (items.length === 0 && sId !== null) return null;

    const collapseKey = sId ?? '__general__';
    const isCollapsed = collapsedSections.has(collapseKey);
    const isActive = activeSectionId === sId;
    const totalQty = items.reduce((s, i) => s + (i.quantity ?? 0), 0);

    return (
      <div key={collapseKey} className="mb-2">
        {/* Section Header */}
        <div className={cn(
          'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg mb-1 transition-all',
          isActive ? 'bg-emerald-500/12 border border-emerald-500/20' : 'border border-transparent hover:bg-white/5'
        )}>
          {/* Select section (click label area) */}
          <button
            onClick={() => onSelectSection(sId)}
            className="flex items-center gap-2 flex-1 min-w-0 text-left"
          >
            <FolderOpen size={13} className={isActive ? 'text-emerald-400' : 'text-white/40'} />
            <span className={cn(
              'text-xs font-bold uppercase tracking-wider truncate',
              isActive ? 'text-emerald-400' : 'text-white/50'
            )}>
              {label}
            </span>
          </button>

          {/* Badge: article count */}
          {totalQty > 0 && (
            <span className={cn(
              'text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0',
              isActive
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-white/8 text-white/40'
            )}>
              {totalQty}
            </span>
          )}

          {/* Collapse toggle */}
          {items.length > 0 && (
            <button
              onClick={() => toggleCollapse(collapseKey)}
              className="p-0.5 rounded text-white/30 hover:text-white/70 transition-colors shrink-0"
            >
              <motion.div
                animate={{ rotate: isCollapsed ? -90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown size={14} />
              </motion.div>
            </button>
          )}
        </div>

        {/* Article list (collapsible) */}
        <AnimatePresence initial={false}>
          {!isCollapsed && (
            <motion.div
              key="content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              {items.length === 0 ? (
                <p className="text-xs text-white/20 px-3 pb-2">Keine Positionen</p>
              ) : (
                <div className="space-y-0.5 pb-1">
                  <AnimatePresence initial={false}>
                    {items.map(item => {
                      const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
                      const flyX = isDesktop ? -300 : -50;
                      return (
                        <motion.div
                          key={item.id}
                          layout
                          initial={{ opacity: 0, scale: 0.9, x: flyX }}
                          animate={{ opacity: 1, scale: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
                          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                        >
                          <SwipeableItem id={item.id} onDelete={() => onDeleteItem(item.id)}>
                            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] border border-transparent hover:border-white/5 transition-all group">

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <p className="text-white/85 text-[12px] font-medium leading-tight truncate">
                                  {item.article?.name ?? (item as any).name ?? 'Manuell'}
                                </p>
                                <p className="text-[10px] text-white/30 font-mono truncate">
                                  {item.article?.articleNumber ?? (item as any).article_number ?? '—'}
                                </p>
                              </div>

                              {/* Controls */}
                              <div className="flex items-center gap-1 shrink-0">
                                <div className="flex items-center bg-black/30 rounded-md border border-white/5 p-0.5 gap-0.5">
                                  <motion.button
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => onUpdateQuantity(item.id, (item.quantity ?? 1) - 1)}
                                    disabled={(item.quantity ?? 1) <= 1}
                                    className="flex items-center justify-center h-5 w-5 rounded-sm text-white/30 hover:text-white hover:bg-white/10 disabled:opacity-20 transition-colors"
                                  >
                                    <Minus size={10} />
                                  </motion.button>
                                  <motion.span
                                    key={item.quantity}
                                    initial={{ scale: 1.3, opacity: 0.5 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="text-emerald-400 font-bold text-[11px] min-w-[18px] text-center"
                                  >
                                    {item.quantity}
                                  </motion.span>
                                  <motion.button
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => onUpdateQuantity(item.id, (item.quantity ?? 1) + 1)}
                                    className="flex items-center justify-center h-5 w-5 rounded-sm text-white/30 hover:text-white hover:bg-white/10 transition-colors"
                                  >
                                    <Plus size={10} />
                                  </motion.button>
                                </div>
                                <Button
                                  onClick={() => onDeleteItem(item.id)}
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-white/20 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400 hover:bg-red-500/10"
                                >
                                  <Trash2 size={11} />
                                </Button>
                              </div>
                            </div>
                          </SwipeableItem>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="overflow-y-auto flex-1 p-3 space-y-0.5">
      {renderSectionGroup(null, 'Allgemein')}
      {sectionItems.map(s => renderSectionGroup(s.id, s.text ?? 'Abschnitt'))}
      {articleItems.length === 0 && (
        <div className="text-center py-12 text-white/30 text-sm">Keine Artikel im Aufmaß</div>
      )}
    </div>
  );
}
