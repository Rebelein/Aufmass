import { useState } from 'react';
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
      className="ios-card overflow-hidden"
    >
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Image */}
          <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
            {categoryImageUrl
              ? <img src={categoryImageUrl} alt="" className="w-full h-full object-cover" />
              : <Package size={20} className="text-white/10" />}
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-white leading-tight line-clamp-2 flex-1">{article.name}</h3>
              <AnimatePresence>
                {quantity > 0 && (
                  <motion.div 
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    className="shrink-0 bg-primary/10 text-primary border border-primary/20 text-xs font-bold px-2 py-0.5 rounded-md"
                  >
                    {quantity}×
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {article.articleNumber && (
              <div className="flex items-center gap-1.5 mt-1">
                <p className="text-xs text-white/40 font-mono">Art.-Nr: {article.articleNumber}</p>
                <button
                  onClick={handleCopy}
                  className={cn('p-1 rounded-md transition-all', copied ? 'text-primary bg-primary/10' : 'text-white/20 hover:text-white hover:bg-white/10')}
                >
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                </button>
              </div>
            )}
            {article.unit && <p className="text-xs text-white/30 mt-0.5">Einheit: {article.unit}</p>}
          </div>
        </div>

        {/* Action Row */}
        <div className="flex items-center gap-2 mt-4">
          <motion.button
            whileTap={{ scale: quantity <= 0 ? 1 : 0.9 }}
            onClick={onDecrement}
            disabled={quantity <= 0}
            className="flex items-center justify-center h-11 w-11 rounded-xl ios-button-secondary shrink-0 disabled:opacity-50"
            aria-label="Minus"
          >
            <Minus size={20} />
          </motion.button>
          
          <motion.div 
            key={quantity}
            initial={{ scale: 1.2, opacity: 0.8 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex-1 flex items-center justify-center h-11 bg-white/[0.02] border border-white/5 rounded-xl font-bold text-white text-xl shadow-inner"
          >
            {quantity}
          </motion.div>
          
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onIncrement}
            className="flex items-center justify-center h-11 w-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm shrink-0"
            aria-label="Plus"
          >
            <Plus size={20} />
          </motion.button>
          
          <motion.button
            whileTap={{ scale: quantity <= 0 ? 1 : 0.9 }}
            onClick={onReset}
            disabled={quantity <= 0}
            className="flex items-center justify-center h-11 w-11 rounded-xl text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0 disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-white/20"
            aria-label="Entfernen"
          >
            <Trash2 size={16} />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
