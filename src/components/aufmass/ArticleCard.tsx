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
  isFromAngebot?: boolean;
  copyMode?: boolean;
}

export function ArticleCard({ article, quantity, onIncrement, onDecrement, onReset, categoryImageUrl, isFromAngebot, copyMode }: ArticleCardProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const { impactLight } = useHapticFeedback();

  const imageUrl = article.imageUrl || categoryImageUrl;

  const handleCopyArticleNumber = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!article.articleNumber) return;
    try {
      await navigator.clipboard.writeText(article.articleNumber);
      setCopied(true);
      impactLight();
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({ title: 'Kopieren fehlgeschlagen', variant: 'destructive' });
    }
  };

  return (
    <motion.div 
      whileHover={copyMode ? { scale: 1.02 } : { scale: 1.01 }}
      whileTap={copyMode ? { scale: 0.98 } : {}}
      onClick={copyMode ? handleCopyArticleNumber : undefined}
      className={cn(
        "ios-card overflow-hidden group relative transition-colors",
        copyMode ? "cursor-pointer hover:bg-white/10 ring-1 ring-white/10" : ""
      )}
    >
      {/* Copied overlay */}
      <AnimatePresence>
        {copied && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 bg-emerald-500/15 backdrop-blur-sm flex items-center justify-center rounded-xl pointer-events-none"
          >
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
              <Check size={32} className="text-emerald-400" strokeWidth={3} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-2 sm:p-3 flex items-center gap-3">
        {/* Article Image */}
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-white/5 flex items-center justify-center overflow-hidden shrink-0 border border-white/10 shadow-inner">
          {imageUrl
            ? <img src={imageUrl} alt="" className="w-full h-full object-contain p-1" />
            : <Package size={20} className="text-white/15" />}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 py-0.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <h3 className="font-semibold text-white/90 text-sm leading-tight truncate" title={article.name}>{article.name}</h3>
              {isFromAngebot && (
                <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded shadow-sm" title="Ursprünglich aus Angebot übernommen">Angebot</span>
              )}
            </div>
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
              <button
                onClick={handleCopyArticleNumber}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-0.5 rounded-md transition-all active:scale-95',
                  copied 
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80'
                )}
                title="Artikelnummer kopieren"
              >
                <span className="text-[11px] sm:text-xs font-mono font-medium">{article.articleNumber}</span>
                {copied 
                  ? <Check size={12} className="text-emerald-400" strokeWidth={3} />
                  : <Copy size={11} className="opacity-50" />}
              </button>
            )}
            {article.supplierName && (
              <span className="text-[10px] sm:text-xs text-cyan-400/60 font-medium truncate max-w-[120px]" title={article.supplierName}>
                {article.supplierName}
              </span>
            )}
            {article.unit && <p className="text-[10px] sm:text-xs text-white/30 hidden xs:block">• {article.unit}</p>}
          </div>
        </div>

        {/* Action Row */}
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
