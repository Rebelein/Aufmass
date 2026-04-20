import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ArrowDownToLine, Package, Search, CheckSquare, X } from 'lucide-react';
import type { Article, Category } from '@/lib/data';
import { copyArticleToOwnCatalog } from '@/lib/catalog-storage';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface WholesaleCatalogPanelProps {
  categoryName: string;
  categoryId: string;
  articles: Article[];
  ownCategories: Category[]; // Eigene Kategorien als Ziel
  onArticlesCopied: () => void; // Callback nach erfolgreichem Kopieren
}

export function WholesaleCatalogPanel({
  categoryName,
  categoryId,
  articles,
  ownCategories,
  onArticlesCopied,
}: WholesaleCatalogPanelProps) {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState(new Set<string>());
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
  const [articlesToCopy, setArticlesToCopy] = useState<Article[]>([]);
  const [targetCategoryId, setTargetCategoryId] = useState<string>('');
  const [isCopying, setIsCopying] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Flache Liste aller eigenen Kategorien (für Zielauswahl)
  const flatOwnCategories = ownCategories.filter(c => c.source !== 'wholesale');

  const filteredArticles = searchQuery.trim()
    ? articles.filter(a =>
        a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.articleNumber.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : articles;

  const toggleArticle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredArticles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredArticles.map(a => a.id)));
    }
  };

  const openCopyDialog = (articles: Article[]) => {
    setArticlesToCopy(articles);
    setTargetCategoryId(flatOwnCategories[0]?.id ?? '');
    setIsCopyDialogOpen(true);
  };

  const handleCopySingle = (article: Article) => openCopyDialog([article]);

  const handleCopySelected = () => {
    const selected = articles.filter(a => selectedIds.has(a.id));
    if (selected.length === 0) return;
    openCopyDialog(selected);
  };

  const confirmCopy = async () => {
    if (!targetCategoryId || articlesToCopy.length === 0) return;
    setIsCopying(true);

    let successCount = 0;
    for (const article of articlesToCopy) {
      const result = await copyArticleToOwnCatalog(article, targetCategoryId);
      if (result) successCount++;
    }

    setIsCopying(false);
    setIsCopyDialogOpen(false);
    setSelectedIds(new Set());

    if (successCount > 0) {
      toast({
        title: `${successCount} Artikel übernommen`,
        description: `In: ${flatOwnCategories.find(c => c.id === targetCategoryId)?.name}`,
      });
      onArticlesCopied();
    } else {
      toast({ title: 'Fehler beim Übernehmen', variant: 'destructive' });
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-5 border-b border-white/5 bg-amber-500/5 shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <Package size={18} className="text-amber-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-white truncate">{categoryName}</h2>
              <p className="text-[11px] text-amber-400/70 font-medium uppercase tracking-widest">
                Großhändler · {articles.length} Artikel
              </p>
            </div>
          </div>
          {selectedIds.size > 0 && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <Button
                onClick={handleCopySelected}
                className="bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/20 gap-2 h-9 shrink-0"
              >
                <ArrowDownToLine size={14} />
                {selectedIds.size} übernehmen
              </Button>
            </motion.div>
          )}
        </div>

        {/* Suche */}
        <div className="relative mt-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Artikel suchen..."
            className="h-9 pl-8 pr-8 bg-white/5 border-white/10 text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Tabelle */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <Table>
            <TableHeader className="bg-white/[0.02] sticky top-0 z-10">
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="w-11 text-center">
                  <Checkbox
                    checked={filteredArticles.length > 0 && selectedIds.size === filteredArticles.length}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead className="text-white/40 font-bold uppercase text-[10px] tracking-wider">Artikel</TableHead>
                <TableHead className="text-white/40 font-bold uppercase text-[10px] tracking-wider hidden sm:table-cell">Nummer</TableHead>
                <TableHead className="text-white/40 font-bold uppercase text-[10px] tracking-wider hidden md:table-cell">Einheit</TableHead>
                <TableHead className="text-right text-white/40 font-bold uppercase text-[10px] tracking-wider w-32">Übernehmen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence initial={false}>
                {filteredArticles.map(article => (
                  <motion.tr
                    key={article.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={cn(
                      'border-b border-white/5 hover:bg-white/[0.03] transition-colors',
                      selectedIds.has(article.id) && 'bg-emerald-500/5'
                    )}
                  >
                    <td className="text-center py-2 px-4 w-11">
                      <Checkbox
                        checked={selectedIds.has(article.id)}
                        onCheckedChange={() => toggleArticle(article.id)}
                      />
                    </td>
                    <td className="py-2 px-3 font-medium text-white/85 text-sm">{article.name}</td>
                    <td className="py-2 px-3 font-mono text-xs text-emerald-400/70 hidden sm:table-cell">
                      {article.articleNumber}
                    </td>
                    <td className="py-2 px-3 text-xs text-white/50 hidden md:table-cell">{article.unit}</td>
                    <td className="py-2 px-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopySingle(article)}
                        className="h-7 px-2.5 text-white/30 hover:text-emerald-400 hover:bg-emerald-500/10 gap-1.5 text-xs transition-all"
                      >
                        <ArrowDownToLine size={12} />
                        <span className="hidden sm:inline">Übernehmen</span>
                      </Button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
          {filteredArticles.length === 0 && (
            <div className="py-20 text-center text-white/30 text-sm">
              {searchQuery ? 'Kein Artikel gefunden.' : 'Keine Artikel in dieser Kategorie.'}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Übernahme-Dialog */}
      <Dialog open={isCopyDialogOpen} onOpenChange={setIsCopyDialogOpen}>
        <DialogContent className="ios-card border border-white/10 bg-background sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white text-lg font-bold flex items-center gap-2">
              <ArrowDownToLine size={18} className="text-emerald-400" />
              In eigenen Katalog übernehmen
            </DialogTitle>
          </DialogHeader>

          <div className="py-3 space-y-4">
            {/* Artikel-Vorschau */}
            <div className="bg-white/5 rounded-xl p-3 max-h-48 overflow-y-auto space-y-1">
              {articlesToCopy.map(a => (
                <div key={a.id} className="flex items-center gap-2 text-sm">
                  <CheckSquare size={13} className="text-emerald-400 shrink-0" />
                  <span className="text-white/80">{a.name}</span>
                  <span className="text-white/30 font-mono text-xs shrink-0">{a.articleNumber}</span>
                </div>
              ))}
            </div>

            {/* Zielkategorie */}
            <div>
              <label className="text-xs text-white/50 uppercase tracking-wider mb-2 block font-bold">
                Zielkategorie (Eigener Katalog)
              </label>
              <Select value={targetCategoryId} onValueChange={setTargetCategoryId}>
                <SelectTrigger className="glass-input h-11">
                  <SelectValue placeholder="Kategorie wählen..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-white/10 text-white max-h-64">
                  {flatOwnCategories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setIsCopyDialogOpen(false)}
              className="text-white/50"
              disabled={isCopying}
            >
              Abbrechen
            </Button>
            <Button
              onClick={confirmCopy}
              disabled={!targetCategoryId || isCopying}
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold"
            >
              {isCopying ? 'Wird übernommen...' : `${articlesToCopy.length} Artikel übernehmen`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
