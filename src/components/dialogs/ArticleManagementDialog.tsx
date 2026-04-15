import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Article, Category, Supplier } from '@/lib/data';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, GripVertical, Edit3, Trash2, LayoutGrid, PackagePlus, Store, X, ChevronLeft, ChevronRight, FileUp, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { batchAddCatalog } from '@/lib/catalog-storage';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ProposedArticle {
  name: string;
  articleNumber: string;
  unit: string;
  supplierName?: string;
}

interface ProposedCategory {
  categoryName: string;
  articles: ProposedArticle[];
  subCategories: ProposedCategory[];
}

export interface NewArticleFormData {
// ... (rest of the interface)
  name: string;
  articleNumber: string;
  unit: string;
  supplierName?: string;
  aliases?: string;
}

interface ArticleManagementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  categoryName: string;
  categoryId: string;
  articles: Article[];
  suppliers: Supplier[];
  onAddNewArticle: (formData: NewArticleFormData) => void;
  onUpdateExistingArticle: (articleId: string, formData: NewArticleFormData) => void;
  onReorderArticles: (categoryId: string, reorderedArticles: Article[]) => void;
  onDeleteArticles: (articleIds: string[]) => void;
  onAssignSupplier: (articleIds: string[], supplierName: string | undefined) => void;
  allCategories: Category[]; 
  onAssignImage: (articleIds: string[], imageUrl: string) => void;
  onNavigateCategory: (direction: 'prev' | 'next') => void;
}

const ArticleManagementDialog: React.FC<ArticleManagementDialogProps> = ({
  isOpen,
  onClose,
  categoryName,
  categoryId,
  articles: initialArticles,
  suppliers,
  onAddNewArticle,
  onUpdateExistingArticle,
  onReorderArticles,
  onDeleteArticles,
  onAssignSupplier,
  allCategories,
}) => {
  const [isArticleFormDialogOpen, setIsArticleFormDialogOpen] = useState(false);
  const [articleFormData, setArticleFormData] = useState<NewArticleFormData>({
    name: '', articleNumber: '', unit: '', supplierName: '', aliases: '',
  });
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [selectedArticleIds, setSelectedArticleIds] = useState(new Set<string>());
  const [itemsPendingDelete, setItemsPendingDelete] = useState<string[]>([]);
  const [importPreview, setImportPreview] = useState<ProposedCategory[] | null>(null);
  const { toast } = useToast();

  const [isImportingPdf, setIsImportingPdf] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const handlePdfImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingPdf(true);
    toast({ title: "KI Analyse gestartet", description: "Datei wird lokal verarbeitet..." });

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      
      if (!apiKey || apiKey.trim() === "") {
        throw new Error("Gemini API Key nicht konfiguriert oder leer");
      }

      const cleanApiKey = apiKey.trim();

      // Datei in Base64 umwandeln
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const base64Data = await base64Promise;

      // Initialisierung mit der offiziellen Bibliothek
      const genAI = new GoogleGenerativeAI(cleanApiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

      const prompt = `
        Du bist ein Experte für die Extraktion von Produktdaten aus Großhändler-Katalogen.
        Analysiere die beigefügte Katalogseite.
        Extrahiere alle Artikel. Gruppiere Variationen (z.B. verschiedene Größen eines Produkts) sinnvoll.
        Die Ausgabe MUSS zwingend als gültiges JSON erfolgen:
        {
          "categoryName": "Name der Hauptkategorie",
          "articles": [
            {
              "name": "Vollständiger Name inkl. Größe",
              "articleNumber": "Artikelnummer",
              "unit": "Stück/m/etc",
              "supplierName": "Großhändler"
            }
          ],
          "subCategories": []
        }
        Gib NUR das JSON zurück, keine Markdown-Formatierung.
      `;

      const result = await model.generateContent([
        {
          inlineData: {
            data: base64Data,
            mimeType: file.type
          }
        },
        { text: prompt }
      ]);

      const response = await result.response;
      const text = response.text();
      
      // JSON extrahieren (falls die KI doch Markdown-Boxen nutzt)
      let jsonStr = text.trim();
      if (jsonStr.includes('```')) {
        jsonStr = jsonStr.replace(/```json|```/g, '').trim();
      }

      const data = JSON.parse(jsonStr);

      if (data) {
        const catalogArray = Array.isArray(data) ? data : [data];
        setImportPreview(catalogArray);
        toast({ title: "Analyse abgeschlossen", description: "Bitte prüfen Sie die erfassten Daten." });
      } else {
        throw new Error("Die KI hat keine gültigen Daten zurückgegeben.");
      }
    } catch (error: any) {
      console.error("KI Fehler:", error);
      toast({ title: "Import fehlgeschlagen", description: error.message || "Unbekannter Fehler.", variant: "destructive" });
    } finally {
      setIsImportingPdf(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview) return;
    try {
      await batchAddCatalog(importPreview as any, allCategories, categoryId);
      setImportPreview(null);
      toast({ title: "Import erfolgreich", description: "Artikel & Kategorien wurden hinzugefügt." });
    } catch (error) {
      toast({ title: "Fehler beim Speichern", variant: "destructive" });
    }
  };

  const updatePreviewItem = (catIdx: number, artIdx: number, field: keyof ProposedArticle, value: string) => {
    if (!importPreview) return;
    const next = [...importPreview];
    next[catIdx].articles[artIdx] = { ...next[catIdx].articles[artIdx], [field]: value };
    setImportPreview(next);
  };

  const updatePreviewCategoryName = (catIdx: number, value: string) => {
    if (!importPreview) return;
    const next = [...importPreview];
    next[catIdx] = { ...next[catIdx], categoryName: value };
    setImportPreview(next);
  };

  const handleArticleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingArticle) onUpdateExistingArticle(editingArticle.id, articleFormData);
    else onAddNewArticle(articleFormData);
    setIsArticleFormDialogOpen(false);
  };

  const handleOpenEdit = (article: Article) => {
    setEditingArticle(article);
    setArticleFormData({
      name: article.name,
      articleNumber: article.articleNumber,
      unit: article.unit,
      supplierName: article.supplierName || '',
    });
    setIsArticleFormDialogOpen(true);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="sm:max-w-5xl glass-card bg-gray-900/95 border-white/10 text-white p-0 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
          <DialogHeader className="p-6 border-b border-white/5 bg-white/[0.02]">
            <div className="flex justify-between items-center">
                <div className="space-y-1">
                    <DialogTitle className="text-2xl font-bold text-gradient flex items-center gap-2">
                        <LayoutGrid size={24} className="text-emerald-400" /> {categoryName}
                    </DialogTitle>
                    <p className="text-white/40 text-xs font-bold uppercase tracking-widest">{initialArticles.length} Artikel im Katalog</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-colors"><X size={20}/></button>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-6">
            {!importPreview ? (
              <>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => { setEditingArticle(null); setArticleFormData({name:'', articleNumber:'', unit:''}); setIsArticleFormDialogOpen(true); }} className="btn-primary">
                    <PlusCircle className="mr-2 h-4 w-4" /> Artikel hinzufügen
                  </Button>
                  
                  <Button 
                    onClick={() => pdfInputRef.current?.click()} 
                    disabled={isImportingPdf}
                    variant="outline" 
                    className="bg-white/5 border-white/10 hover:bg-white/10 text-white rounded-xl"
                  >
                    {isImportingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
                    {isImportingPdf ? "Analysiere..." : "PDF Katalog einlesen (KI)"}
                  </Button>
                  <input 
                      type="file" 
                      ref={pdfInputRef} 
                      onChange={handlePdfImport} 
                      accept="application/pdf,image/*" 
                      className="hidden" 
                  />

                  {selectedArticleIds.size > 0 && (
                    <Button variant="destructive" onClick={() => setItemsPendingDelete(Array.from(selectedArticleIds))} className="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30 rounded-xl">
                        <Trash2 className="mr-2 h-4 w-4" /> ({selectedArticleIds.size}) Löschen
                    </Button>
                  )}
                </div>

                <div className="border border-white/5 rounded-2xl overflow-hidden bg-white/[0.01]">
                  <ScrollArea className="h-[50vh]">
                    <Table>
                        <TableHeader className="bg-white/[0.03] sticky top-0 z-10">
                            <TableRow className="border-white/5 hover:bg-transparent">
                                <TableHead className="w-12 text-center">
                                    <Checkbox 
                                        checked={selectedArticleIds.size === initialArticles.length && initialArticles.length > 0} 
                                        onCheckedChange={(checked) => setSelectedArticleIds(checked ? new Set(initialArticles.map(a => a.id)) : new Set())}
                                    />
                                </TableHead>
                                <TableHead className="text-white/40 font-bold uppercase text-[10px] tracking-wider">Artikel</TableHead>
                                <TableHead className="text-white/40 font-bold uppercase text-[10px] tracking-wider">Nummer</TableHead>
                                <TableHead className="text-white/40 font-bold uppercase text-[10px] tracking-wider">Einheit</TableHead>
                                <TableHead className="text-right text-white/40 font-bold uppercase text-[10px] tracking-wider">Aktionen</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {initialArticles.map(article => (
                                <TableRow key={article.id} className="border-white/5 hover:bg-white/[0.03] transition-colors group">
                                    <TableCell className="text-center">
                                        <Checkbox 
                                            checked={selectedArticleIds.has(article.id)} 
                                            onCheckedChange={(checked) => {
                                                const next = new Set(selectedArticleIds);
                                                if (checked) next.add(article.id); else next.delete(article.id);
                                                setSelectedArticleIds(next);
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell className="font-bold text-white/80 group-hover:text-emerald-300 transition-colors">{article.name}</TableCell>
                                    <TableCell><Badge variant="outline" className="font-mono text-[10px] bg-white/5 border-white/10 text-white/60">{article.articleNumber}</Badge></TableCell>
                                    <TableCell className="text-white/40 text-xs font-medium uppercase">{article.unit}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(article)} className="h-8 w-8 text-white/50 hover:text-blue-400 hover:bg-blue-500/10"><Edit3 size={14}/></Button>
                                            <Button variant="ghost" size="icon" onClick={() => setItemsPendingDelete([article.id])} className="h-8 w-8 text-white/50 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={14}/></Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {initialArticles.length === 0 && (
                        <div className="py-20 text-center text-white/50 font-medium">Keine Artikel in dieser Kategorie.</div>
                    )}
                  </ScrollArea>
                </div>
              </>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                      <FileUp className="text-emerald-400" size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-emerald-400">KI Vorschau</h3>
                      <p className="text-white/40 text-xs">Bitte prüfen und korrigieren Sie die Daten vor dem Speichern.</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setImportPreview(null)} className="text-white/50 hover:text-white hover:bg-white/10 rounded-xl">Abbrechen</Button>
                    <Button onClick={handleConfirmImport} className="btn-primary">Alles Speichern</Button>
                  </div>
                </div>

                <div className="border border-white/5 rounded-2xl overflow-hidden bg-white/[0.01]">
                  <ScrollArea className="h-[55vh]">
                    <div className="p-4 space-y-8">
                      {importPreview.map((category, catIdx) => (
                        <div key={catIdx} className="space-y-4 bg-white/[0.02] p-4 rounded-xl border border-white/5">
                          <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                            <LayoutGrid size={18} className="text-emerald-400 shrink-0" />
                            <div className="flex-1 space-y-1">
                              <Label className="text-[10px] uppercase text-white/30 font-bold ml-1">Kategorie Name</Label>
                              <input 
                                value={category.categoryName} 
                                onChange={(e) => updatePreviewCategoryName(catIdx, e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-bold text-white focus:border-emerald-400/50 outline-none transition-colors"
                                placeholder="Name der Kategorie..."
                              />
                            </div>
                          </div>
                          
                          <Table>
                            <TableHeader className="bg-transparent">
                              <TableRow className="border-none hover:bg-transparent">
                                <TableHead className="text-[10px] uppercase text-white/30 font-bold p-1">Bezeichnung</TableHead>
                                <TableHead className="text-[10px] uppercase text-white/30 font-bold p-1 w-32">Nummer</TableHead>
                                <TableHead className="text-[10px] uppercase text-white/30 font-bold p-1 w-24">Einheit</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {category.articles.map((article, artIdx) => (
                                <TableRow key={artIdx} className="border-white/5 hover:bg-white/[0.02]">
                                  <TableCell className="p-1">
                                    <input 
                                      value={article.name} 
                                      onChange={(e) => updatePreviewItem(catIdx, artIdx, 'name', e.target.value)}
                                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500/50 outline-none transition-colors"
                                    />
                                  </TableCell>
                                  <TableCell className="p-1">
                                    <input 
                                      value={article.articleNumber} 
                                      onChange={(e) => updatePreviewItem(catIdx, artIdx, 'articleNumber', e.target.value)}
                                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-emerald-400 focus:border-emerald-500/50 outline-none transition-colors"
                                    />
                                  </TableCell>
                                  <TableCell className="p-1">
                                    <input 
                                      value={article.unit} 
                                      onChange={(e) => updatePreviewItem(catIdx, artIdx, 'unit', e.target.value)}
                                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/60 focus:border-emerald-500/50 outline-none transition-colors"
                                    />
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-6 bg-white/[0.02] border-t border-white/5">
            <Button variant="outline" onClick={onClose} className="border-white/10 bg-white/5 text-white hover:bg-white/10 rounded-xl px-8">Fertig</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Forms */}
      <Dialog open={isArticleFormDialogOpen} onOpenChange={setIsArticleFormDialogOpen}>
        <DialogContent className="glass-card bg-gray-900/90 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <PackagePlus size={20} className="text-emerald-400" /> {editingArticle ? 'Artikel bearbeiten' : 'Neuer Artikel'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleArticleFormSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
                <Label className="text-white/40 text-xs uppercase font-bold tracking-widest ml-1">Bezeichnung</Label>
                <Input name="name" value={articleFormData.name} onChange={(e) => setArticleFormData({...articleFormData, name: e.target.value})} className="glass-input h-12" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-white/40 text-xs uppercase font-bold tracking-widest ml-1">Artikel-Nr.</Label>
                    <Input name="articleNumber" value={articleFormData.articleNumber} onChange={(e) => setArticleFormData({...articleFormData, articleNumber: e.target.value})} className="glass-input h-12" required />
                </div>
                <div className="space-y-2">
                    <Label className="text-white/40 text-xs uppercase font-bold tracking-widest ml-1">Einheit</Label>
                    <Input name="unit" value={articleFormData.unit} onChange={(e) => setArticleFormData({...articleFormData, unit: e.target.value})} className="glass-input h-12" placeholder="Stück, m, kg..." required />
                </div>
            </div>
            <DialogFooter className="pt-6">
                <Button variant="ghost" type="button" onClick={() => setIsArticleFormDialogOpen(false)} className="text-white/50 rounded-xl">Abbrechen</Button>
                <Button type="submit" className="btn-primary px-10">Speichern</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={itemsPendingDelete.length > 0} onOpenChange={(open) => { if (!open) setItemsPendingDelete([]); }}>
        <AlertDialogContent className="glass-card bg-gray-900/90 border-white/10 text-white">
            <AlertDialogHeader>
                <AlertDialogTitle className="text-2xl font-bold text-red-400">Artikel löschen?</AlertDialogTitle>
                <p className="text-white/60">Die gewählten Artikel werden unwiderruflich aus dem Katalog entfernt.</p>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-6">
                <AlertDialogCancel onClick={() => setItemsPendingDelete([])} className="bg-white/5 border-white/10 text-white hover:bg-white/10 rounded-xl">Abbrechen</AlertDialogCancel>
                <AlertDialogAction onClick={() => { onDeleteArticles(itemsPendingDelete); setItemsPendingDelete([]); setSelectedArticleIds(new Set()); }} className="bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold px-6">Löschen</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ArticleManagementDialog;
