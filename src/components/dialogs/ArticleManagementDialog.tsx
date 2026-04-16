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
import { createImportDraft, updateImportDraftSuccess, updateImportDraftError, markImportDraftCompleted, updateImportDraftData } from '@/lib/import-storage';
import type { ImportDraft } from '@/lib/import-storage';
import ImportDraftsDialog from './ImportDraftsDialog';
import ImportReviewDialog from './ImportReviewDialog';
import { PlusCircle, LayoutGrid, PackagePlus, X, ChevronUp, ChevronDown, FileUp, Loader2, Trash2, Edit3, Package, BookMarked, Camera, ImagePlus, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { batchAddCatalog, updateCategoryImage } from '@/lib/catalog-storage';
import { useHapticFeedback } from '@/hooks/use-haptic-feedback';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
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
  id: string; // Hinzugefügt für stabiles Rendering
  name: string;
  articleNumber: string;
  unit: string;
  supplierId?: string;
}

interface ProposedCategory {
  categoryName: string;
  articles: ProposedArticle[];
}

export interface NewArticleFormData {
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
  onDeleteArticles,
  allCategories,
}) => {
  const [isArticleFormDialogOpen, setIsArticleFormDialogOpen] = useState(false);
  const [articleFormData, setArticleFormData] = useState<NewArticleFormData>({
    name: '', articleNumber: '', unit: '', supplierName: '', aliases: '',
  });
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [selectedArticleIds, setSelectedArticleIds] = useState(new Set<string>());
  const [itemsPendingDelete, setItemsPendingDelete] = useState<string[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('none');
  const [categoryImage, setCategoryImage] = useState<string | null>(null);
  const [isDraftsDialogOpen, setIsDraftsDialogOpen] = useState(false);
  const [reviewingDraft, setReviewingDraft] = useState<ImportDraft | null>(null);
  const { toast } = useToast();
  const { impactMedium, impactLight } = useHapticFeedback();

  const [isImportingPdf, setIsImportingPdf] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const currentCat = allCategories.find(c => c.id === categoryId);
      setCategoryImage(currentCat?.imageUrl || null);
    }
  }, [isOpen, categoryId, allCategories]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 120;
            let width = img.width;
            let height = img.height;
            if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } }
            else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
          };
          img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
      });

      const base64 = await base64Promise;
      const success = await updateCategoryImage(categoryId, base64);
      if (success) {
        setCategoryImage(base64);
        impactMedium();
        toast({ title: "Bild aktualisiert" });
      }
    } catch (err) {
      toast({ title: "Fehler beim Upload", variant: "destructive" });
    }
  };

  const handlePdfImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingPdf(true);
    toast({ title: "KI Analyse gestartet", description: "Inhalte werden im Hintergrund extrahiert..." });

    const draftId = await createImportDraft(file.name, selectedSupplierId);
    if (!draftId) {
      toast({ title: "Fehler", description: "Entwurf konnte nicht erstellt werden.", variant: "destructive" });
      setIsImportingPdf(false);
      return;
    }

    if (pdfInputRef.current) pdfInputRef.current.value = '';
    setIsImportingPdf(false); // UI freigeben

    // Asynchrone Verarbeitung im Hintergrund
    (async () => {
      try {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey || apiKey.trim() === "") throw new Error("Gemini API Key fehlt.");

        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const base64Data = await base64Promise;
        const genAI = new GoogleGenerativeAI(apiKey.trim());
        const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

        const prompt = `Extrahiere Materialdaten aus dieser Katalogseite. Erfasse verschiedene Produktgruppen jeweils als eine eigene Kategorie. Rückgabe als JSON-Array von Objekten: [ { "categoryName": "Name der Gruppe/Kategorie", "articles": [ { "name": "...", "articleNumber": "...", "unit": "..." } ] } ]. Erzeuge KEINE verschachtelten Unterkategorien.`;

        const result = await model.generateContent([{ inlineData: { data: base64Data, mimeType: file.type } }, { text: prompt }]);
        const text = (await result.response).text();
        let jsonStr = text.trim().replace(/```json|```/g, '').trim();
        const rawData = JSON.parse(jsonStr);

        const parsedData = (Array.isArray(rawData) ? rawData : [rawData]).map((cat: any) => ({
          ...cat,
          articles: cat.articles.map((art: any) => ({
            ...art,
            id: art.id || crypto.randomUUID()
          }))
        }));
        await updateImportDraftSuccess(draftId, parsedData);
        
        toast({ title: "KI Analyse abgeschlossen", description: "Ein neuer Entwurf ist bereit zur Prüfung." });
        impactMedium();
      } catch (error: any) {
        await updateImportDraftError(draftId, error.message);
        toast({ title: "KI Analyse fehlgeschlagen", description: error.message, variant: "destructive" });
      }
    })();
  };

  const handleSaveDraft = async (id: string, data: any, supplierId: string | null) => {
    await updateImportDraftData(id, data, supplierId);
    toast({ title: "Entwurf gespeichert" });
  };

  const handleConfirmImport = async (id: string, data: any, targetId: string | null, supplierId: string | null) => {
    const catalogData = data.map((c: any) => ({ ...c, subCategories: [] }));
    await batchAddCatalog(catalogData, allCategories, targetId, supplierId);
    await markImportDraftCompleted(id);
    
    setReviewingDraft(null);
    impactMedium();
    toast({ title: "Import erfolgreich" });
  };

  const handleOpenDraft = (draft: ImportDraft) => {
    setIsDraftsDialogOpen(false);
    setReviewingDraft(draft);
  };

  const handleArticleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingArticle) onUpdateExistingArticle(editingArticle.id, articleFormData);
    else onAddNewArticle(articleFormData);
    setIsArticleFormDialogOpen(false);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="sm:max-w-5xl glass-card bg-gray-900/95 border-white/10 text-white p-0 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] h-[90vh] flex flex-col">
          <DialogHeader className="p-6 border-b border-white/5 bg-white/[0.02] shrink-0">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div 
                      onClick={() => imageInputRef.current?.click()}
                      className="relative w-16 h-16 rounded-2xl bg-white/5 border border-white/10 overflow-hidden cursor-pointer group hover:border-emerald-500/50 transition-all shadow-inner shrink-0"
                    >
                      {categoryImage ? (
                        <img src={categoryImage} alt="Kategorie" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/20 group-hover:text-emerald-400 transition-colors">
                          <Camera size={24} />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <ImagePlus size={20} className="text-white" />
                      </div>
                    </div>
                    <input type="file" ref={imageInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                    
                    <div className="space-y-1">
                        <DialogTitle className="text-2xl font-bold text-gradient flex items-center gap-2">
                            {categoryName}
                        </DialogTitle>
                        <p className="text-white/40 text-xs font-bold uppercase tracking-widest">{initialArticles.length} Artikel im Katalog</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-colors"><X size={20}/></button>
            </div>
          </DialogHeader>

          <div className="p-4 sm:p-6 space-y-6 flex-1 overflow-hidden flex flex-col">
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Button onClick={() => { setEditingArticle(null); setArticleFormData({name:'', articleNumber:'', unit:''}); setIsArticleFormDialogOpen(true); }} className="btn-primary flex-1 sm:flex-none">
                <PlusCircle className="mr-2 h-4 w-4" /> Hinzufügen
              </Button>
              
              <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10 flex-1 sm:flex-none">
                <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                  <SelectTrigger className="w-full sm:w-[200px] border-none bg-transparent text-white focus:ring-0 h-9">
                    <SelectValue placeholder="Großhändler" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-white/10 text-white">
                    <SelectItem value="none" className="text-white/50">Kein Großhändler</SelectItem>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="hidden sm:block w-[1px] h-6 bg-white/10"></div>
                <Button 
                  onClick={() => pdfInputRef.current?.click()} 
                  disabled={isImportingPdf}
                  variant="ghost" 
                  className="hover:bg-white/10 text-emerald-400 h-9 px-3"
                >
                  {isImportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                </Button>
                <div className="w-[1px] h-6 bg-white/10"></div>
                <Button 
                  onClick={() => setIsDraftsDialogOpen(true)}
                  variant="ghost" 
                  className="hover:bg-white/10 text-white/70 h-9 px-3"
                  title="KI Entwürfe öffnen"
                >
                  <FileText className="h-4 w-4" />
                </Button>
              </div>
              <input type="file" ref={pdfInputRef} onChange={handlePdfImport} accept="application/pdf,image/*" className="hidden" />

              {selectedArticleIds.size > 0 && (
                <Button variant="destructive" onClick={() => setItemsPendingDelete(Array.from(selectedArticleIds))} className="bg-red-500/20 text-red-400 border-red-500/30 rounded-xl flex-1 sm:flex-none">
                    <Trash2 className="mr-2 h-4 w-4" /> ({selectedArticleIds.size})
                </Button>
              )}
            </div>

            <div className="border border-white/5 rounded-2xl overflow-hidden bg-white/[0.01] flex-1">
              <ScrollArea className="h-full">
                <Table>
                    <TableHeader className="bg-white/[0.03] sticky top-0 z-10">
                        <TableRow className="border-white/5 hover:bg-transparent">
                            <TableHead className="w-12 text-center"><Checkbox checked={selectedArticleIds.size === initialArticles.length && initialArticles.length > 0} onCheckedChange={(checked) => setSelectedArticleIds(checked ? new Set(initialArticles.map(a => a.id)) : new Set())}/></TableHead>
                            <TableHead className="text-white/40 font-bold uppercase text-[10px] tracking-wider">Artikel</TableHead>
                            <TableHead className="text-white/40 font-bold uppercase text-[10px] tracking-wider hidden sm:table-cell">Nummer</TableHead>
                            <TableHead className="text-right text-white/40 font-bold uppercase text-[10px] tracking-wider">Aktionen</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {initialArticles.map(article => (
                            <TableRow key={article.id} className="border-white/5 hover:bg-white/[0.03] group transition-colors">
                                <TableCell className="text-center"><Checkbox checked={selectedArticleIds.has(article.id)} onCheckedChange={(checked) => { const next = new Set(selectedArticleIds); if (checked) next.add(article.id); else next.delete(article.id); setSelectedArticleIds(next); }}/></TableCell>
                                <TableCell className="font-bold text-white/80">
                                  {article.name}
                                  <div className="sm:hidden text-[10px] text-white/40 font-mono mt-1">{article.articleNumber}</div>
                                </TableCell>
                                <TableCell className="hidden sm:table-cell"><Badge variant="outline" className="font-mono text-[10px] bg-white/5 border-white/10 text-white/60">{article.articleNumber}</Badge></TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => { setEditingArticle(article); setArticleFormData({name:article.name, articleNumber:article.articleNumber, unit:article.unit}); setIsArticleFormDialogOpen(true); }} className="h-8 w-8 text-white/50 hover:text-blue-400"><Edit3 size={14}/></Button>
                                        <Button variant="ghost" size="icon" onClick={() => setItemsPendingDelete([article.id])} className="h-8 w-8 text-white/50 hover:text-red-400"><Trash2 size={14}/></Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {initialArticles.length === 0 && <div className="py-20 text-center text-white/50 font-medium">Keine Artikel vorhanden.</div>}
              </ScrollArea>
            </div>
          </div>

          <DialogFooter className="p-6 bg-white/[0.02] border-t border-white/5 shrink-0">
            <Button variant="outline" onClick={onClose} className="border-white/10 bg-white/5 text-white rounded-xl px-8 w-full sm:w-auto">Fertig</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isArticleFormDialogOpen} onOpenChange={setIsArticleFormDialogOpen}>
        <DialogContent className="glass-card bg-gray-900/90 border-white/10 text-white">
          <DialogHeader><DialogTitle className="text-xl font-bold flex items-center gap-2"><PackagePlus size={20} className="text-emerald-400" /> {editingArticle ? 'Bearbeiten' : 'Neu'}</DialogTitle></DialogHeader>
          <form onSubmit={handleArticleFormSubmit} className="space-y-4 py-4">
            <div className="space-y-2"><Label className="text-white/40 text-xs uppercase font-bold tracking-widest ml-1">Bezeichnung</Label><Input name="name" value={articleFormData.name} onChange={(e) => setArticleFormData({...articleFormData, name: e.target.value})} className="glass-input h-12" required /></div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label className="text-white/40 text-xs uppercase font-bold tracking-widest ml-1">Art-Nr.</Label><Input name="articleNumber" value={articleFormData.articleNumber} onChange={(e) => setArticleFormData({...articleFormData, articleNumber: e.target.value})} className="glass-input h-12" required /></div>
                <div className="space-y-2"><Label className="text-white/40 text-xs uppercase font-bold tracking-widest ml-1">Einheit</Label><Input name="unit" value={articleFormData.unit} onChange={(e) => setArticleFormData({...articleFormData, unit: e.target.value})} className="glass-input h-12" required /></div>
            </div>
            <DialogFooter className="pt-6"><Button variant="ghost" type="button" onClick={() => setIsArticleFormDialogOpen(false)} className="text-white/50">Abbrechen</Button><Button type="submit" className="btn-primary px-10">Speichern</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={itemsPendingDelete.length > 0} onOpenChange={(open) => { if (!open) setItemsPendingDelete([]); }}>
        <AlertDialogContent className="glass-card bg-gray-900/90 border-white/10 text-white text-center">
            <AlertDialogHeader><AlertDialogTitle className="text-2xl font-bold text-red-400 mx-auto">Artikel löschen?</AlertDialogTitle></AlertDialogHeader>
            <AlertDialogFooter className="mt-6 flex-col sm:flex-row gap-3">
                <AlertDialogCancel onClick={() => setItemsPendingDelete([])} className="bg-white/5 border-white/10 text-white rounded-xl h-12">Abbrechen</AlertDialogCancel>
                <AlertDialogAction onClick={() => { onDeleteArticles(itemsPendingDelete); setItemsPendingDelete([]); setSelectedArticleIds(new Set()); impactMedium(); }} className="bg-red-500 hover:bg-red-600 text-white rounded-xl h-12 font-bold px-10">Löschen</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImportDraftsDialog 
        isOpen={isDraftsDialogOpen} 
        onClose={() => setIsDraftsDialogOpen(false)} 
        onOpenDraft={handleOpenDraft}
      />

      <ImportReviewDialog
        draft={reviewingDraft}
        isOpen={!!reviewingDraft}
        onClose={() => setReviewingDraft(null)}
        onSaveDraft={handleSaveDraft}
        onConfirmImport={handleConfirmImport}
        categories={allCategories}
        suppliers={suppliers}
        defaultTargetCategoryId={categoryId}
      />
    </>
  );
};

export default ArticleManagementDialog;
