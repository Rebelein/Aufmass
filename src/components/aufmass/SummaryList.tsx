import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, FolderOpen, Trash2, Plus, Minus, Package, Copy, Check, RotateCcw, ArrowDownAZ } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SwipeableItem } from '@/components/catalog/SwipeableItem';
import { motion, AnimatePresence } from 'framer-motion';
import type { ProcessedSummaryItem } from '@/lib/types';
import type { ProjectSelectedItem } from '@/lib/project-storage';
import { useHapticFeedback } from '@/hooks/use-haptic-feedback';

interface SummaryListProps {
  projectId: string;
  sectionItems: ProjectSelectedItem[];
  articleItems: ProcessedSummaryItem[];
  activeSectionId: string | null;
  onSelectSection: (sectionId: string | null) => void;
  onDeleteItem: (itemId: string) => void;
  onUpdateQuantity: (itemId: string, newQuantity: number) => void;
}

const STORAGE_KEY_PREFIX = 'aufmass_copied_';

export function SummaryList({
  projectId,
  sectionItems,
  articleItems,
  activeSectionId,
  onSelectSection,
  onDeleteItem,
  onUpdateQuantity,
}: SummaryListProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [copiedItems, setCopiedItems] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PREFIX + projectId);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });
  const [animatingItem, setAnimatingItem] = useState<string | null>(null);
  const [sortBySupplier, setSortBySupplier] = useState<Set<string>>(new Set());
  const { impactLight } = useHapticFeedback();

  // Persist copiedItems to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PREFIX + projectId, JSON.stringify(Array.from(copiedItems)));
    } catch { /* storage full or unavailable */ }
  }, [copiedItems, projectId]);

  const toggleCollapse = (sId: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sId)) next.delete(sId); else next.add(sId);
      return next;
    });
  };

  const handleCopyArticleNumber = useCallback(async (itemId: string, articleNumber: string) => {
    try {
      await navigator.clipboard.writeText(articleNumber);
      impactLight();
      setAnimatingItem(itemId);
      setCopiedItems(prev => new Set(prev).add(itemId));
      setTimeout(() => setAnimatingItem(null), 1500);
    } catch {
      // clipboard fails silently
    }
  }, [impactLight]);

  const handleResetSectionCopied = useCallback((sectionId: string | null) => {
    const sectionItemIds = new Set(
      articleItems
        .filter(i => (i as any).section_id === sectionId)
        .map(i => i.id)
    );
    setCopiedItems(prev => {
      const next = new Set(prev);
      sectionItemIds.forEach(id => next.delete(id));
      return next;
    });
    impactLight();
  }, [articleItems, impactLight]);

  const renderSectionGroup = (sId: string | null, label: string) => {
    const items = articleItems.filter(i => (i as any).section_id === sId);
    if (items.length === 0 && sId !== null) return null;

    const collapseKey = sId ?? '__general__';
    const isCollapsed = collapsedSections.has(collapseKey);
    const isActive = activeSectionId === sId;
    const totalQty = items.reduce((s, i) => s + (i.quantity ?? 0), 0);
    const copiedCount = items.filter(i => copiedItems.has(i.id)).length;
    const isSortedBySupplier = sortBySupplier.has(collapseKey);

    // Sort items by supplier if enabled
    const sortedItems = isSortedBySupplier
      ? [...items].sort((a, b) => {
          const sA = (a.article?.supplierName ?? (a as any).supplier_name ?? 'ZZZ').toLowerCase();
          const sB = (b.article?.supplierName ?? (b as any).supplier_name ?? 'ZZZ').toLowerCase();
          if (sA !== sB) return sA.localeCompare(sB);
          const nA = (a.article?.name ?? (a as any).name ?? '').replace(/\s+/g, ' ').trim();
          const nB = (b.article?.name ?? (b as any).name ?? '').replace(/\s+/g, ' ').trim();
          return nA.localeCompare(nB, undefined, { numeric: true, sensitivity: 'base' });
        })
      : items;

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

          {/* Copied progress badge */}
          {copiedCount > 0 && (
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400/80 shrink-0">
              {copiedCount}/{items.length} ✓
            </span>
          )}

          {/* Reset copied marks for this section */}
          {copiedCount > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); handleResetSectionCopied(sId); }}
              className="p-1 rounded-md text-white/25 hover:text-amber-400 hover:bg-amber-500/10 transition-all shrink-0"
              title={`Kopier-Markierungen in "${label}" zurücksetzen`}
            >
              <RotateCcw size={12} />
            </button>
          )}

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

          {/* Sort by supplier toggle */}
          {items.length > 1 && (
            <button
              onClick={() => setSortBySupplier(prev => {
                const next = new Set(prev);
                if (next.has(collapseKey)) next.delete(collapseKey); else next.add(collapseKey);
                return next;
              })}
              className={cn(
                'p-1 rounded-md transition-all shrink-0',
                isSortedBySupplier
                  ? 'text-cyan-400 bg-cyan-500/10'
                  : 'text-white/25 hover:text-white/60 hover:bg-white/5'
              )}
              title={isSortedBySupplier ? 'Standard-Sortierung' : 'Nach Großhändler sortieren'}
            >
              <ArrowDownAZ size={12} />
            </button>
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
                    {sortedItems.map((item, idx) => {
                      const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
                      const flyX = isDesktop ? -300 : -50;
                      const articleNumber = item.article?.articleNumber ?? (item as any).article_number;
                      const supplierName = item.article?.supplierName ?? (item as any).supplier_name;
                      const imageUrl = item.images?.[0] || item.article?.imageUrl || (item as any).categoryImageUrl;
                      const isCopied = copiedItems.has(item.id);
                      const isAnimating = animatingItem === item.id;

                      // Show supplier divider when sorting by supplier
                      const prevSupplier = idx > 0
                        ? (sortedItems[idx - 1].article?.supplierName ?? (sortedItems[idx - 1] as any).supplier_name ?? '')
                        : null;
                      const currentSupplier = supplierName ?? '';
                      const showSupplierDivider = isSortedBySupplier && currentSupplier !== prevSupplier;

                      return (
                        <div key={item.id}>
                          {showSupplierDivider && (
                            <div className="flex items-center gap-2 px-2 pt-2 pb-1">
                              <div className="h-px flex-1 bg-cyan-500/20" />
                              <span className="text-[9px] font-bold uppercase tracking-widest text-cyan-400/70">
                                {currentSupplier || 'Ohne Zuordnung'}
                              </span>
                              <div className="h-px flex-1 bg-cyan-500/20" />
                            </div>
                          )}
                          <motion.div
                            layout
                            initial={{ opacity: 0, scale: 0.9, x: flyX }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
                            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                          >
                          <SwipeableItem id={item.id} onDelete={() => onDeleteItem(item.id)}>
                            <div className={cn(
                              "relative flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] transition-all group",
                              isCopied 
                                ? "border border-emerald-500/30 bg-emerald-500/[0.03]"
                                : "border border-transparent hover:border-white/5"
                            )}>
                              {/* Copy animation overlay */}
                              <AnimatePresence>
                                {isAnimating && (
                                  <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 z-10 bg-emerald-500/10 backdrop-blur-[2px] flex items-center justify-center rounded-lg pointer-events-none"
                                  >
                                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                                      <Check size={22} className="text-emerald-400" strokeWidth={3} />
                                    </motion.div>
                                  </motion.div>
                                )}
                              </AnimatePresence>

                              {/* Article Image */}
                              <div className="w-8 h-8 rounded-md bg-white/5 flex items-center justify-center overflow-hidden shrink-0 border border-white/10">
                                {imageUrl
                                  ? <img src={imageUrl} alt="" className="w-full h-full object-contain p-0.5" />
                                  : <Package size={12} className="text-white/15" />}
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <p className="text-white/85 text-[12px] font-medium leading-tight">
                                  {item.article?.name ?? (item as any).name ?? 'Manuell'}
                                </p>
                                {articleNumber && (
                                  <button
                                    onClick={() => handleCopyArticleNumber(item.id, articleNumber)}
                                    className={cn(
                                      'flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded transition-all active:scale-95',
                                      isCopied
                                        ? 'bg-emerald-500/15 text-emerald-400'
                                        : 'bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70'
                                    )}
                                  >
                                    <span className="text-[10px] font-mono font-medium">{articleNumber}</span>
                                    {isCopied
                                      ? <Check size={9} className="text-emerald-400" strokeWidth={3} />
                                      : <Copy size={9} className="opacity-40" />}
                                  </button>
                                )}
                                {supplierName && (
                                  <span className="text-[9px] text-cyan-400/50 font-medium truncate block" title={supplierName}>
                                    {supplierName}
                                  </span>
                                )}
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
                        </div>
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
