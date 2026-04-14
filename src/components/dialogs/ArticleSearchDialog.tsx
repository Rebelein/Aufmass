"use client";

import React, { useState, useEffect, useMemo } from 'react';
import type { Article } from '@/lib/data';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Minus, Plus, CheckCircle, ImageIcon, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface ArticleSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  allArticles: Article[];
  projectSelectedQuantities: Map<string, number>;
  onApply: (items: { articleId: string; quantity: number }[]) => void;
}

const ArticleSearchDialog: React.FC<ArticleSearchDialogProps> = ({
  isOpen,
  onClose,
  allArticles,
  projectSelectedQuantities,
  onApply,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [stagedQuantities, setStagedQuantities] = useState<Map<string, number>>(new Map());
  const { toast } = useToast();

  const searchResults = useMemo(() => {
    if (searchQuery.length < 2) {
      return [];
    }
    const lowerCaseQuery = searchQuery.toLowerCase();
    return allArticles.filter(article => {
      const nameMatch = article.name.toLowerCase().includes(lowerCaseQuery);
      const articleNumberMatch = article.articleNumber.toLowerCase().includes(lowerCaseQuery);
      const aliasMatch = article.aliases?.some(alias => alias.toLowerCase().includes(lowerCaseQuery));
      return nameMatch || aliasMatch || articleNumberMatch;
    });
  }, [searchQuery, allArticles]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setStagedQuantities(new Map());
    }
  }, [isOpen]);

  const handleQuantityChange = (articleId: string, change: number) => {
    const currentQuantity = stagedQuantities.get(articleId) || 0;
    const newQuantity = Math.max(0, currentQuantity + change);
    updateStagedQuantities(articleId, newQuantity);
  };
  
  const handleInputChange = (articleId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10);
    if (!isNaN(value) && value >= 0) {
      updateStagedQuantities(articleId, value);
    } else if (event.target.value === '') {
      updateStagedQuantities(articleId, 0);
    }
  };

  const updateStagedQuantities = (articleId: string, quantity: number) => {
      setStagedQuantities(prev => {
        const newMap = new Map(prev);
        if (quantity > 0) {
            newMap.set(articleId, quantity);
        } else {
            newMap.delete(articleId);
        }
        return newMap;
      });
  }

  const handleApply = () => {
    const itemsToApply = Array.from(stagedQuantities.entries())
        .map(([articleId, quantity]) => ({ articleId, quantity }));

    if (itemsToApply.length > 0) {
      onApply(itemsToApply);
      toast({
        title: `${itemsToApply.length} Position(en) hinzugefügt`,
        description: 'Die Artikel aus der Suche wurden dem Aufmaß hinzugefügt.'
      });
      onClose();
    } else {
      toast({
        title: 'Keine Auswahl',
        description: 'Bitte wählen Sie mindestens einen Artikel mit einer Menge größer Null.',
        variant: 'destructive',
      });
    }
  };
  
  const handleCopyToClipboard = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy).then(() => {
      toast({
        title: "Artikelnummer kopiert",
        description: `"${textToCopy}" wurde in die Zwischenablage kopiert.`,
      });
    }).catch(err => {
      console.error("Fehler beim Kopieren in die Zwischenablage:", err);
      toast({
        title: "Kopieren fehlgeschlagen",
        description: "Die Artikelnummer konnte nicht kopiert werden.",
        variant: "destructive",
      });
    });
  };
  
  const totalSelected = Array.from(stagedQuantities.values()).filter(q => q > 0).length;


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="font-headline">Artikelsuche</DialogTitle>
          <DialogDescription className="font-body">
            Geben Sie einen Suchbegriff ein und passen Sie die Mengen für die gewünschten Artikel an.
          </DialogDescription>
        </DialogHeader>

        <div className="relative my-4">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Artikelname, -nummer oder Alias suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 font-body"
            autoFocus
          />
        </div>

        <ScrollArea className="h-[50vh] mt-2 border rounded-md p-2">
          {searchQuery.length < 2 ? (
            <p className="text-muted-foreground text-center font-body py-8">Bitte geben Sie mindestens 2 Zeichen ein, um die Suche zu starten.</p>
          ) : searchResults.length === 0 ? (
            <p className="text-muted-foreground text-center font-body py-8">Keine Artikel für Ihre Suche gefunden.</p>
          ) : (
            <ul className="space-y-3">
              {searchResults.map((article) => {
                const totalInProject = projectSelectedQuantities.get(article.id) ?? 0;
                let quantityStatusText = "";
                if (totalInProject > 0) {
                    quantityStatusText = `Im Aufmaß: ${totalInProject}`;
                }

                return (
                  <li key={article.id} className="p-2.5 border rounded-lg shadow-sm bg-card text-card-foreground flex items-center gap-3">
                    <div className="flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 relative">
                      {article.imageUrl ? (
                          <img src={article.imageUrl} alt={article.name} fill className="rounded-md object-cover" data-ai-hint="product item" />
                      ) : (
                          <div className="w-full h-full bg-muted rounded-md flex items-center justify-center">
                              <imgIcon className="h-8 w-8 text-muted-foreground" />
                          </div>
                      )}
                    </div>
                    <div className="flex-grow flex flex-col justify-center self-stretch gap-1.5">
                      <div>
                          <h3 className="font-headline text-base sm:text-lg leading-tight line-clamp-2">{article.name}</h3>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                              <Badge
                                  variant="outline"
                                  className="font-mono text-[10px] sm:text-xs cursor-pointer hover:bg-muted py-0.5 px-1.5"
                                  onClick={() => handleCopyToClipboard(article.articleNumber)}
                                  title="Artikelnummer kopieren"
                              >
                                  {article.articleNumber}
                              </Badge>
                              <span>{article.unit}</span>
                              {article.supplierName && <Badge variant="secondary" className="text-[10px] sm:text-xs font-semibold py-0.5 px-1.5">{article.supplierName}</Badge>}
                          </div>
                      </div>
                      <div className="flex items-center justify-between mt-auto">
                        <div className="flex items-center space-x-1">
                            <Button variant="outline" size="icon" onClick={() => handleQuantityChange(article.id, -1)} disabled={(stagedQuantities.get(article.id) || 0) <= 0} aria-label={`Menge für ${article.name} verringern`} className="h-8 w-8 rounded-md">
                                <Minus className="h-4 w-4" />
                            </Button>
                            <Input
                                id={`quantity-search-${article.id}`}
                                type="number"
                                min="0"
                                value={stagedQuantities.get(article.id) || 0}
                                onChange={(e) => handleInputChange(article.id, e)}
                                className="w-12 h-8 text-center font-body rounded-md"
                                aria-label={`Menge für ${article.name}`}
                            />
                            <Button variant="outline" size="icon" onClick={() => handleQuantityChange(article.id, 1)} aria-label={`Menge für ${article.name} erhöhen`} className="h-8 w-8 rounded-md">
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        {quantityStatusText && (
                            <p className="text-xs font-body font-semibold text-green-600">
                                {quantityStatusText}
                            </p>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>

        <DialogFooter className="mt-6">
          <Button type="button" variant="outline" onClick={onClose}>
            Schließen
          </Button>
          <Button type="button" onClick={handleApply} disabled={totalSelected === 0}>
            <CheckCircle className="mr-2 h-4 w-4" /> {totalSelected > 0 ? `${totalSelected} Position(en) hinzufügen` : 'Auswahl hinzufügen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ArticleSearchDialog;
