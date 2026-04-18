"use client";

import type { Article } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Minus, Plus, ImageIcon, Clipboard } from 'lucide-react';
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ArticleListProps {
  articles: Article[];
  projectSelectedQuantities: Map<string, number>; 
  stagedQuantities: Map<string, number>; 
  onStagedQuantityChange: (articleId: string, newQuantity: number) => void; 
}

const ArticleList: React.FC<ArticleListProps> = ({ 
  articles, 
  projectSelectedQuantities, 
  stagedQuantities, 
  onStagedQuantityChange 
}) => {
  const { toast } = useToast();

  if (articles.length === 0) {
    return (
        <div className="glass-card p-12 text-center border-dashed border-white/5 bg-white/[0.02]">
            <p className="text-white/50 font-medium">Keine Artikel in dieser Kategorie.</p>
        </div>
    );
  }

  const handleCopyToClipboard = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy).then(() => {
      toast({ title: "Kopiert", description: `"${textToCopy}" ist in der Zwischenablage.` });
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {articles.map((article) => {
        const inputQuantity = stagedQuantities.get(article.id) ?? 0;
        const totalInProject = projectSelectedQuantities.get(article.id) ?? 0;
        const isStaged = inputQuantity > 0;
        const isInProject = totalInProject > 0;

        return (
          <div 
            key={article.id} 
            className={cn(
              "glass-card p-4 flex gap-4 transition-all duration-500 group relative",
              isStaged ? "border-emerald-500/40 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.1)]" : "border-white/5",
              isInProject && !isStaged && "border-teal-500/20 bg-teal-500/5"
            )}
          >
            {/* Project Status Badge */}
            {isInProject && (
                <div className="absolute top-2 right-2 flex gap-1">
                    <Badge variant="secondary" className="bg-teal-500/20 text-teal-300 border-teal-500/30 text-[10px] uppercase font-bold py-0 h-5">
                        Im Aufmaß: {totalInProject}
                    </Badge>
                </div>
            )}

            <div className="flex-shrink-0 w-20 h-20 relative rounded-xl overflow-hidden border border-white/10 bg-white/5">
              {article.imageUrl ? (
                  <img src={article.imageUrl} alt="" fill className="object-cover transition-transform group-hover:scale-110" />
              ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/40">
                      <imgIcon size={32} />
                  </div>
              )}
            </div>

            <div className="flex-grow flex flex-col justify-between min-w-0">
              <div className="space-y-1">
                  <h3 className="font-bold text-white leading-snug truncate group-hover:text-emerald-300 transition-colors" title={article.name}>
                    {article.name}
                  </h3>
                  <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleCopyToClipboard(article.articleNumber)}
                        className="text-[10px] font-mono text-white/40 hover:text-emerald-400 transition-colors flex items-center gap-1 bg-white/5 px-1.5 py-0.5 rounded border border-white/5"
                      >
                        {article.articleNumber}
                      </button>
                      <span className="text-[10px] font-bold text-white/50 uppercase tracking-tighter">{article.unit}</span>
                  </div>
              </div>

              <div className="flex items-center gap-3 mt-3">
                <div className="flex items-center bg-white/5 rounded-xl border border-white/10 p-1">
                    <button 
                        onClick={() => onStagedQuantityChange(article.id, Math.max(0, inputQuantity - 1))}
                        className="h-8 w-8 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                    >
                        <Minus size={14} />
                    </button>
                    <input
                        type="number"
                        min="0"
                        value={inputQuantity || ''}
                        onChange={(e) => onStagedQuantityChange(article.id, parseInt(e.target.value, 10) || 0)}
                        className="w-10 bg-transparent text-center font-bold text-emerald-400 outline-none text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder="0"
                    />
                    <button 
                        onClick={() => onStagedQuantityChange(article.id, inputQuantity + 1)}
                        className="h-8 w-8 flex items-center justify-center text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-all"
                    >
                        <Plus size={14} />
                    </button>
                </div>
                {isStaged && (
                    <span className="text-[10px] font-bold text-emerald-500 uppercase animate-in fade-in zoom-in duration-300">
                        Vormerken
                    </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ArticleList;
