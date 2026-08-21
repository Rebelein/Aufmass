import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Article } from '@/lib/data';
import { Package, Plus, Minus, Trash2, Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useHapticFeedback } from '@/hooks/use-haptic-feedback';
import { motion, AnimatePresence } from 'framer-motion';
import { SpotlightCard } from '@/components/ui/SpotlightCard';
import { MotionNumber } from '@/components/ui/MotionNumber';
import { Magnetic } from '@/components/ui/Magnetic';

export interface ArticleCardProps {
  article: Article;
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onReset: () => void;
  categoryImageUrl?: string;
  isFromAngebot?: boolean;
  copyMode?: boolean;
  className?: string;
}

export function ArticleCard({ article, quantity, onIncrement, onDecrement, onReset, categoryImageUrl, isFromAngebot, copyMode, className }: ArticleCardProps) {
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
    <SpotlightCard 
      className={cn(
        "rounded-xl overflow-hidden transition-[color,background-color,border-color,fill,stroke,opacity,box-shadow,transform] duration-300",
        copyMode ? "ring-1 ring-white/20" : "",
        className
      )}
    >
      <motion.div 
        whileHover={copyMode ? { scale: 1.01 } : { scale: 1.005 }}
        whileTap={copyMode ? { scale: 0.99 } : {}}
        onClick={copyMode ? handleCopyArticleNumber : undefined}
        role={copyMode ? 'button' : undefined}
        tabIndex={copyMode ? 0 : undefined}
        aria-label={copyMode && article.articleNumber ? `Artikelnummer ${article.articleNumber} kopieren` : undefined}
        onKeyDown={copyMode ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCopyArticleNumber(e as unknown as React.MouseEvent); }
        } : undefined}
        className={cn(
          "bg-card text-card-foreground border border-border shadow-sm overflow-hidden group relative transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          copyMode ? "cursor-pointer hover:bg-muted/50" : ""
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
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-muted flex items-center justify-center overflow-hidden shrink-0 border border-border shadow-inner">
            {imageUrl
              ? <img src={imageUrl} alt="" width={56} height={56} loading="lazy" className="w-full h-full object-contain p-1" />
              : <Package size={20} className="text-muted-foreground" />}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 py-0.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <h3 className="font-semibold text-foreground text-sm leading-tight break-words" title={article.name}>{article.name}</h3>
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
                    <MotionNumber value={quantity} />×
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-2 mt-1">
              {article.articleNumber && (
                <button
                  onClick={handleCopyArticleNumber}
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-0.5 rounded-md transition-[color,background-color,border-color,fill,stroke,opacity,box-shadow,transform] active:scale-95',
                    copied 
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-muted hover:bg-muted text-muted-foreground hover:text-primary-foreground'
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
              {article.unit && <p className="text-[10px] sm:text-xs text-muted-foreground hidden min-[400px]:block">• {article.unit}</p>}
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <div className="flex items-center bg-muted rounded-lg border border-border p-0.5 shadow-inner gap-0.5">
              <motion.button
                whileTap={{ scale: quantity <= 0 ? 1 : 0.9 }}
                onClick={onDecrement}
                disabled={quantity <= 0}
                aria-label={`Menge von ${article.name} verringern`}
                className="flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 rounded-md bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300 disabled:opacity-20 disabled:text-muted-foreground disabled:bg-transparent shrink-0 transition-[color,background-color,border-color,fill,stroke,opacity,box-shadow,transform]"
              >
                <Minus size={14} />
              </motion.button>
              <div className="w-8 sm:w-10 text-center font-bold text-foreground text-sm sm:text-base flex items-center justify-center">
                <MotionNumber value={quantity} />
              </div>
              <Magnetic strength={0.2}>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={onIncrement}
                  aria-label={`Menge von ${article.name} erhöhen`}
                  className="flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 rounded-md bg-emerald-500/90 hover:bg-emerald-400 text-black font-bold shadow-[0_0_10px_rgba(16,185,129,0.25)] shrink-0 transition-[color,background-color,border-color,fill,stroke,opacity,box-shadow,transform]"
                >
                  <Plus size={14} />
                </motion.button>
              </Magnetic>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={onReset}
              disabled={quantity <= 0}
              aria-label={`${article.name} aus dem Aufmaß entfernen`}
              title="Zurücksetzen"
              className="h-9 w-9 text-muted-foreground group-hover:text-muted-foreground can-hover:hover:!text-red-400 can-hover:hover:!bg-red-500/10 transition-[color,background-color,border-color,fill,stroke,opacity,box-shadow,transform] shrink-0 disabled:opacity-0"
            >
              <Trash2 size={15} />
            </Button>
          </div>
        </div>
      </motion.div>
    </SpotlightCard>
  );
}
