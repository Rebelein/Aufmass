import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Loader2, Copy, Check, PackageSearch } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Article, Category } from '@/lib/data';
import { searchWholesaleArticles, copyArticleToOwnCatalog } from '@/lib/catalog-storage';

interface WholesaleCatalogPanelProps {
  ownCategories: Category[];
  onArticlesCopied: () => void;
}

export function WholesaleCatalogPanel({
  ownCategories,
  onArticlesCopied
}: WholesaleCatalogPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setRows] = useState<Article[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [targetCategoryId, setTargetCategoryId] = useState<string>('');
  const [copyingIds, setCopyingIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim() || searchQuery.length < 2) return;

    setIsSearching(true);
    try {
      const articles = await searchWholesaleArticles(searchQuery);
      setRows(articles);
      if (articles.length === 0) {
        toast({ title: "Keine Ergebnisse", description: "Es wurden keine passenden Artikel in der Datanorm gefunden." });
      }
    } catch (error) {
      toast({ title: "Fehler bei der Suche", variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const handleCopy = async (article: Article) => {
    if (!targetCategoryId) {
      toast({ title: "Kategorie wählen", description: "Bitte wähle erst eine Zielkategorie im eigenen Katalog aus.", variant: "destructive" });
      return;
    }

    setCopyingIds(prev => new Set(prev).add(article.id));
    try {
      const success = await copyArticleToOwnCatalog(article, targetCategoryId);
      if (success) {
        toast({ title: "Artikel übernommen", description: `"${article.name}" wurde in deinen Katalog kopiert.` });
        onArticlesCopied();
      }
    } catch (error) {
      toast({ title: "Fehler beim Kopieren", variant: "destructive" });
    } finally {
      setCopyingIds(prev => {
        const next = new Set(prev);
        next.delete(article.id);
        return next;
      });
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <form onSubmit={handleSearch} className="flex-1 space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">
              Datanorm Artikel suchen
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Name oder Artikelnummer eingeben..."
                className="pl-10 h-12 bg-background border-border focus-visible:ring-amber-500"
              />
            </div>
          </form>
          
          <div className="space-y-2 w-full md:w-[300px]">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">
              Zielkategorie (Eigener Katalog)
            </label>
            <Select value={targetCategoryId} onValueChange={setTargetCategoryId}>
              <SelectTrigger className="h-12 bg-background border-border">
                <SelectValue placeholder="Wähle eine Kategorie..." />
              </SelectTrigger>
              <SelectContent>
                {ownCategories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button 
            onClick={() => handleSearch()} 
            disabled={isSearching || !searchQuery.trim()}
            className="h-12 px-8 bg-amber-500 hover:bg-amber-600 text-black font-bold"
          >
            {isSearching ? <Loader2 className="animate-spin h-5 w-5" /> : "Suchen"}
          </Button>
        </div>
      </div>

      <div className="flex-1 border border-border rounded-2xl overflow-hidden bg-card flex flex-col">
        {results.length > 0 ? (
          <ScrollArea className="flex-1">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="text-xs font-bold uppercase py-4">Bezeichnung</TableHead>
                  <TableHead className="text-xs font-bold uppercase">Artikel-Nr.</TableHead>
                  <TableHead className="text-xs font-bold uppercase">Einheit</TableHead>
                  <TableHead className="text-xs font-bold uppercase">Großhändler</TableHead>
                  <TableHead className="text-right text-xs font-bold uppercase pr-6">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((art) => (
                  <TableRow key={art.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium py-4">{art.name}</TableCell>
                    <TableCell className="font-mono text-amber-500">{art.articleNumber}</TableCell>
                    <TableCell>{art.unit}</TableCell>
                    <TableCell className="text-muted-foreground">{art.supplierName || '-'}</TableCell>
                    <TableCell className="text-right pr-6">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopy(art)}
                        disabled={copyingIds.has(art.id)}
                        className="h-9 border-amber-500/30 text-amber-600 hover:bg-amber-500 hover:text-black font-bold gap-2"
                      >
                        {copyingIds.has(art.id) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                        Übernehmen
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-40">
            <PackageSearch size={64} className="mb-4" />
            <p className="text-lg font-medium">Starte eine Suche im Datanorm-Katalog</p>
            <p className="text-sm">Gefundene Artikel können direkt in deinen eigenen Katalog übernommen werden.</p>
          </div>
        )}
      </div>
    </div>
  );
}
