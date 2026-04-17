import { Button } from '@/components/ui/button';
import { FolderOpen, Trash2, Plus, Minus } from 'lucide-react';
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

  const renderSectionGroup = (sId: string | null, label: string) => {
    const items = articleItems.filter(i => (i as any).section_id === sId);
    if (items.length === 0 && sId !== null) return null;
    return (
      <div key={sId ?? 'general'} className="mb-4">
        <button
          onClick={() => onSelectSection(sId)}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left mb-2 transition-colors',
            activeSectionId === sId ? 'bg-emerald-500/15 text-emerald-400' : 'text-white/50 hover:bg-white/5 hover:text-white/80'
          )}
        >
          <FolderOpen size={14} />
          <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
        </button>
        {items.length === 0 ? (
          <p className="text-xs text-white/20 px-3 mb-2">Keine Positionen</p>
        ) : (
          <div className="space-y-1">
            <AnimatePresence initial={false}>
              {items.map(item => {
                // Detect if it's desktop to determine fly-in distance (from catalog in center)
                const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
                const flyX = isDesktop ? -300 : -50;
                
                return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8, x: flyX, rotate: -2 }}
                  animate={{ opacity: 1, scale: 1, x: 0, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
                  transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                >
                  <SwipeableItem id={item.id} onDelete={() => onDeleteItem(item.id)}>
                    <div className="flex items-center justify-between gap-3 px-3 py-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{item.article?.name ?? (item as any).name ?? 'Manuell'}</p>
                        <p className="text-xs text-white/30 font-mono">{item.article?.articleNumber ?? (item as any).article_number ?? '—'}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Button onClick={() => onDeleteItem(item.id)} variant="ghost" size="icon" className="h-7 w-7 text-white/20 hover:text-red-400">
                          <Trash2 size={13} />
                        </Button>
                        
                        <div className="flex items-center bg-white/5 rounded-lg p-0.5">
                          <motion.button 
                            whileTap={{ scale: 0.9 }}
                            onClick={() => onUpdateQuantity(item.id, (item.quantity ?? 1) - 1)}
                            disabled={(item.quantity ?? 1) <= 1}
                            className="flex items-center justify-center h-7 w-7 rounded-md text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50 transition-colors"
                          >
                            <Minus size={14} />
                          </motion.button>
                          <motion.span 
                            key={item.quantity} // changing key causes remount for number pop effect
                            initial={{ scale: 1.5, opacity: 0.5 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="text-white font-bold text-sm min-w-[2rem] text-center"
                          >
                            {item.quantity}
                          </motion.span>
                          <motion.button 
                            whileTap={{ scale: 0.9 }}
                            onClick={() => onUpdateQuantity(item.id, (item.quantity ?? 1) + 1)}
                            className="flex items-center justify-center h-7 w-7 rounded-md text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                          >
                            <Plus size={14} />
                          </motion.button>
                        </div>
                      </div>
                    </div>
                  </SwipeableItem>
                </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

        )}
      </div>
    );
  };

  return (
    <div className="overflow-y-auto flex-1 p-4 space-y-1">
      {renderSectionGroup(null, 'Allgemein')}
      {sectionItems.map(s => renderSectionGroup(s.id, s.text ?? 'Abschnitt'))}
      {articleItems.length === 0 && (
        <div className="text-center py-12 text-white/30 text-sm">Keine Artikel im Aufmaß</div>
      )}
    </div>
  );
}
