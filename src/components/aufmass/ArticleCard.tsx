import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Article } from '@/lib/data';
import { Package, Plus, Minus, Trash2, Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useHapticFeedback } from '@/hooks/use-haptic-feedback';
import { motion, AnimatePresence } from 'framer-motion';

export interface ArticleCardProps {
  article: Article;
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onReset: () => void;
  categoryImageUrl?: string;
}

export function ArticleCard({ article, quantity, onIncrement, onDecrement, onReset, categoryImageUrl }: ArticleCardProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const { impactLight } = useHapticFeedback();

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!article.articleNumber) return;
    await navigator.clipboard.writeText(article.articleNumber);
    setCopied(true);
    impactLight();
    toast({ title: 'Artikelnummer kopiert', description: article.articleNumber });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div 
      whileHover={{ scale: 1.01 }}
      className="ios-card overflow-hidden group"
    >
      <div className="p-2 sm:p-3 flex items-center gap-3">
        {/* Image */}
        <div className="w-12 h-12 rounded-xl bg-white/5 flex flex-col border border-white/10 items-center justify-center overflow-hidden shrink-0 shadow-inner">
          {article.imageUrl
            ? <img src={article.imageUrl} alt="" className="w-full h-full object-cover" />
            : categoryImageUrl
              ? <img src={categoryImageUrl} alt="" className="w-full h-full object-cover" />
              : <Package size={18} className="text-white/10" />}
        </div>
        {/* Info */}
        <div className="flex-1 min-w-0 py-0.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-white/90 text-sm leading-tight flex-1" title={article.name}>{article.name}</h3>
            <AnimatePresence>
              {quantity > 0 && (
                <motion.div 
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="shrink-0 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-1.5 py-0.5 rounded"
                >
                  {quantity}×
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {article.articleNumber && (
              <div className="flex items-center gap-1">
                <p className="text-[10px] sm:text-xs text-white/40 font-mono">Art.-Nr: {article.articleNumber}</p>
                <button
                  onClick={handleCopy}
                  className={cn('p-0.5 rounded transition-all', copied ? 'text-emerald-400' : 'text-white/20 hover:text-white')}
                >
                  {copied ? <Check size={10} /> : <Copy size={10} />}
                </button>
              </div>
            )}
            {article.unit && <p className="text-[10px] sm:text-xs text-white/30 hidden xs:block">• {article.unit}</p>}
          </div>
        </div>

        {/* Action Row - Highly Compact Inline */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <div className="flex items-center bg-black/30 rounded-lg border border-white/8 p-0.5 shadow-inner gap-0.5">
            <motion.button
              whileTap={{ scale: quantity <= 0 ? 1 : 0.9 }}
              onClick={onDecrement}
              disabled={quantity <= 0}
              className="flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 rounded-md bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300 disabled:opacity-20 disabled:text-white/20 disabled:bg-transparent shrink-0 transition-all"
            >
              <Minus size={14} />
            </motion.button>
            <motion.div 
              key={quantity}
              initial={{ scale: 1.2, opacity: 0.8 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-8 sm:w-10 text-center font-bold text-white text-sm sm:text-base flex items-center justify-center"
            >
              {quantity}
            </motion.div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onIncrement}
              className="flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 rounded-md bg-emerald-500/90 hover:bg-emerald-400 text-black font-bold shadow-[0_0_10px_rgba(16,185,129,0.25)] shrink-0 transition-all"
            >
              <Plus size={14} />
            </motion.button>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={onReset}
            disabled={quantity <= 0}
            className="h-9 w-9 text-white/10 group-hover:text-white/30 hover:!text-red-400 hover:!bg-red-500/10 transition-all shrink-0 disabled:opacity-0"
          >
            <Trash2 size={15} />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
