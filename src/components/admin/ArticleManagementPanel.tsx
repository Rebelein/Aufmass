import React, { useState, useEffect, useRef } from 'react';
import type { Article, Category, Supplier } from '@/lib/data';
import type { ProposedCategory, NewArticleFormData } from '@/lib/types';
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
import { markImportDraftCompleted, updateImportDraftData } from '@/lib/import-storage';
import { startAiCatalogImport, startAiCatalogImportFromBlob } from '@/lib/ai-import';
import type { ImportDraft } from '@/lib/import-storage';
import ImportDraftsDialog from '../dialogs/ImportDraftsDialog';
import ImportReviewDialog from '../dialogs/ImportReviewDialog';
import { PlusCircle, LayoutGrid, PackagePlus, X, ChevronUp, ChevronDown, FileUp, Loader2, Trash2, Edit3, Package, BookMarked, Camera, ImagePlus, FileText, ClipboardPaste } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn, generateUUID } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { batchAddCatalog, updateCategoryImage, batchUpdateArticles } from '@/lib/catalog-storage';
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

// ProposedArticle, ProposedCategory, NewArticleFormData → importiert aus @/lib/types

interface ArticleManagementPanelProps {
  categoryName: string;
  categoryId: string;
  articles: Article[];
  allArticles: Article[];
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

const ArticleManagementPanel: React.FC<ArticleManagementPanelProps> = ({
  categoryName,
  categoryId,
  articles: initialArticles,
  allArticles,
  suppliers,
  onAddNewArticle,
  onUpdateExistingArticle,
  onDeleteArticles,
  allCategories,
}) => {
  const [isArticleFormDialogOpen, setIsArticleFormDialogOpen] = useState(false);
  const [articleFormData, setArticleFormData] = useState<NewArticleFormData>({
    name: '', articleNumber: '', unit: '', supplierId: '', aliases: '',
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
  const [isImportingClipboard, setIsImportingClipboard] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [localArticles, setLocalArticles] = useState<Article[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [isSyncEditing, setIsSyncEditing] = useState(true);
  const [cursorInfo, setCursorInfo] = useState<{ id: string, field: string, pos: number } | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement>>({});

  const previousCategoryRef = useRef(categoryId);
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
  hasUnsavedChangesRef.current = hasUnsavedChanges;

  useEffect(() => {
    const categoryChanged = previousCategoryRef.current !== categoryId;
    previousCategoryRef.current = categoryId;

    // Nur resetten, wenn sich die Kategorie ändert ODER der User gerade keine ungespeicherten Daten tippt.
    if (categoryChanged || !hasUnsavedChangesRef.current) {
      setSelectedArticleIds(new Set());
      setLocalArticles(initialArticles.map(a => ({ ...a })));
      setHasUnsavedChanges(false);
    }
  }, [categoryId, initialArticles]);

  useEffect(() => {
    const currentCat = allCategories.find(c => c.id === categoryId);
    setCategoryImage(currentCat?.imageUrl || null);
  }, [categoryId, allCategories]);

  React.useLayoutEffect(() => {
    if (cursorInfo) {
      const key = `${cursorInfo.id}-${cursorInfo.field}`;
      const input = inputRefs.current[key];
      if (input) {
        input.setSelectionRange(cursorInfo.pos, cursorInfo.pos);
      }
    }
  }, [localArticles, cursorInfo]);

  const handleUpdateLocalArticle = (id: string, field: keyof Article, value: string, pos?: number) => {
    setHasUnsavedChanges(true);
    setLocalArticles(current => {
      const next = [...current];
      const articleIndex = next.findIndex(a => a.id === id);
      if (articleIndex === -1) return current;

      const article = next[articleIndex];

      if ((field === 'unit' || field === 'supplierId') && isSyncEditing) {
        return next.map(art => ({ ...art, [field]: value }));
      } else if ((field === 'name' || field === 'articleNumber') && isSyncEditing && pos !== undefined) {
        const oldValue = String(article[field]) || '';
        const newValue = value;
        
        // Find common prefix length
        let commonPrefixLen = 0;
        while (commonPrefixLen < oldValue.length && commonPrefixLen < newValue.length && oldValue[commonPrefixLen] === newValue[commonPrefixLen]) {
          commonPrefixLen++;
        }
        
        // Find common suffix length
        let commonSuffixLen = 0;
        while (commonSuffixLen < oldValue.length - commonPrefixLen && 
               commonSuffixLen < newValue.length - commonPrefixLen && 
               oldValue[oldValue.length - 1 - commonSuffixLen] === newValue[newValue.length - 1 - commonSuffixLen]) {
          commonSuffixLen++;
        }
        
        const charsToDelete = oldValue.length - commonPrefixLen - commonSuffixLen;
        const stringToInsert = newValue.substring(commonPrefixLen, newValue.length - commonSuffixLen);

        return next.map(art => {
          if (art.id === id) {
            return { ...art, [field]: value };
          }
          const oldArtVal = String(art[field]) || '';
          
          const replaceStart = Math.min(commonPrefixLen, oldArtVal.length);
          const replaceEnd = Math.min(replaceStart + charsToDelete, oldArtVal.length);
          
          const newArtVal = oldArtVal.substring(0, replaceStart) + stringToInsert + oldArtVal.substring(replaceEnd);
          
          return { ...art, [field]: newArtVal };
        });
      } else {
        next[articleIndex] = { ...article, [field]: value };
        return next;
      }
    });

    if ((field === 'name' || field === 'articleNumber' || field === 'unit') && pos !== undefined) {
      setCursorInfo({ id, field, pos });
    }
  };

  const handleSaveBatch = async () => {
    if (!hasUnsavedChanges) return;
    setIsSavingBatch(true);
    try {
      const changes = localArticles.map(a => ({ 
        id: a.id, 
        name: a.name, 
        articleNumber: a.articleNumber, 
        unit: a.unit,
        supplierId: a.supplierId 
      }));
      await batchUpdateArticles(changes);
      setHasUnsavedChanges(false);
      impactMedium();
      toast({ title: "Änderungen gespeichert" });
    } catch (error) {
      toast({ title: "Fehler beim Speichern", variant: "destructive" });
    } finally {
      setIsSavingBatch(false);
    }
  };

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

  const handlePasteImage = async () => {
    try {
      const items = await navigator.clipboard.read();
      let blob: Blob | null = null;
      for (const item of items) {
        const imageType = item.types.find(type => type.startsWith('image/'));
        if (imageType) {
          blob = await item.getType(imageType);
          break;
        }
      }

      if (!blob) {
        toast({ title: "Kein Bild in der Zwischenablage", variant: "destructive" });
        return;
      }

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
        reader.readAsDataURL(blob);
      });

      const base64 = await base64Promise;
      const success = await updateCategoryImage(categoryId, base64);
      if (success) {
        setCategoryImage(base64);
        impactMedium();
        toast({ title: "Bild aus Zwischenablage eingefügt" });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Fehler beim Zugriff auf Zwischenablage", description: "Bitte gewähren Sie Berechtigungen oder nutzen Sie den Upload.", variant: "destructive" });
    }
  };

  const handlePdfImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingPdf(true);
    toast({ title: "KI Analyse gestartet", description: "Inhalte werden im Hintergrund extrahiert..." });

    const draftId = await startAiCatalogImport(file, selectedSupplierId, categoryId, {
      onDraftCreated: () => {
        if (pdfInputRef.current) pdfInputRef.current.value = '';
        setIsImportingPdf(false);
      },
      onSuccess: () => {
        toast({ title: "KI Analyse abgeschlossen", description: "Ein neuer Entwurf ist bereit zur Prüfung." });
        impactMedium();
      },
      onError: (_id, errorMessage) => {
        toast({ title: "KI Analyse fehlgeschlagen", description: errorMessage, variant: "destructive" });
      },
    });

    if (!draftId) {
      toast({ title: "Fehler", description: "Entwurf konnte nicht erstellt werden.", variant: "destructive" });
      setIsImportingPdf(false);
    }
  };

  const handleClipboardAiScan = async () => {
    try {
      const items = await navigator.clipboard.read();
      let blob: Blob | null = null;
      for (const item of items) {
        const imageType = item.types.find(type => type.startsWith('image/'));
        if (imageType) {
          blob = await item.getType(imageType);
          break;
        }
      }

      if (!blob) {
        toast({ title: "Kein Bild in der Zwischenablage", description: "Bitte erst ein Bild kopieren.", variant: "destructive" });
        return;
      }

      setIsImportingClipboard(true);
      impactLight();
      toast({ title: "KI Analyse gestartet", description: "Bild aus Zwischenablage wird analysiert..." });

      const draftId = await startAiCatalogImportFromBlob(
        blob,
        selectedSupplierId,
        categoryId,
        {
          onDraftCreated: () => {
            setIsImportingClipboard(false);
          },
          onSuccess: () => {
            toast({ title: "KI Analyse abgeschlossen", description: "Ein neuer Entwurf ist bereit zur Prüfung." });
            impactMedium();
          },
          onError: (_id, errorMessage) => {
            toast({ title: "KI Analyse fehlgeschlagen", description: errorMessage, variant: "destructive" });
          },
        }
      );

      if (!draftId) {
        toast({ title: "Fehler", description: "Entwurf konnte nicht erstellt werden.", variant: "destructive" });
        setIsImportingClipboard(false);
      }
    } catch (err) {
      console.error(err);
      setIsImportingClipboard(false);
      toast({ title: "Zwischenablage nicht verfügbar", description: "Bitte gewähren Sie Berechtigungen oder nutzen Sie den Datei-Upload.", variant: "destructive" });
    }
  };

  const handleSaveDraft = async (id: string, data: any, supplierId: string | null) => {
    await updateImportDraftData(id, data, supplierId);
    toast({ title: "Entwurf gespeichert" });
  };

  const handleConfirmImport = async (id: string, data: any, targetId: string | null, supplierId: string | null, importMode?: string) => {
    if (importMode === 'add_to_existing' && targetId) {
      // Flatten all articles from all KI categories and add them to the existing target category
      const allArticles = data.flatMap((c: any) => c.articles || []);
      const existingCount = initialArticles.length;
      const articlesToInsert = allArticles.map((art: any, idx: number) => ({
        name: art.name,
        article_number: art.articleNumber,
        unit: art.unit,
        category_id: targetId,
        supplier_id: art.supplierId || (supplierId === 'none' ? null : supplierId),
        order: existingCount + idx,
      }));
      
      if (articlesToInsert.length > 0) {
        const { supabase } = await import('@/lib/supabase');
        await supabase.from('articles').insert(articlesToInsert);
      }
    } else {
      // Default: create new subcategories
      const catalogData = data.map((c: any) => ({ ...c, subCategories: [] }));
      await batchAddCatalog(catalogData, allCategories, targetId, supplierId);
    }

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
    <div className="h-full flex flex-col items-stretch space-y-0">
      <div className="ios-card bg-gray-900/40 border-white/10 text-white p-0 overflow-hidden flex flex-col h-full rounded-2xl shadow-none border-0 sm:border">
        {/* Header */}
        <div className="p-4 sm:p-5 lg:p-6 border-b border-white/5 bg-white/[0.02] shrink-0">
          <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                  <div 
                    onClick={() => imageInputRef.current?.click()}
                    className="relative w-12 h-12 lg:w-16 lg:h-16 rounded-2xl bg-white/5 border border-white/10 overflow-hidden cursor-pointer group hover:border-emerald-500/50 transition-all shadow-inner shrink-0"
                  >
                    {categoryImage ? (
                      <img src={categoryImage} alt="Kategorie" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/20 group-hover:text-emerald-400 transition-colors">
                        <Camera className="w-5 h-5 lg:w-6 lg:h-6" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <ImagePlus size={20} className="text-white" />
                    </div>
                  </div>
                  <input type="file" ref={imageInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handlePasteImage}
                    title="Aus Zwischenablage einfügen"
                    className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all shrink-0 self-center"
                  >
                    <ClipboardPaste size={16} />
                  </Button>

                  <div className="space-y-1 min-w-0">
                      <h2 className="text-xl lg:text-2xl font-bold text-gradient flex items-center gap-2">
                          {categoryName}
                      </h2>
                      <p className="text-white/40 text-[10px] sm:text-xs font-bold uppercase tracking-widest">{initialArticles.length} Artikel</p>
                  </div>
              </div>
          </div>
        </div>

        <div className="p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-6 flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Button onClick={() => { setEditingArticle(null); setArticleFormData({name:'', articleNumber:'', unit:'', supplierId: ''}); setIsArticleFormDialogOpen(true); }} className="btn-primary flex-1 sm:flex-none">
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
                  title="Datei für KI-Scan hochladen"
                >
                  {isImportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                </Button>
                <Button 
                  onClick={handleClipboardAiScan} 
                  disabled={isImportingClipboard}
                  variant="ghost" 
                  className="hover:bg-white/10 text-amber-400 h-9 px-3"
                  title="Bild aus Zwischenablage scannen"
                >
                  {isImportingClipboard ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardPaste className="h-4 w-4" />}
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

              <div className="flex items-center gap-3 bg-white/5 p-1 px-3 rounded-xl border border-white/10">
                <Checkbox 
                  id="sync-edit-toggle" 
                  checked={isSyncEditing} 
                  onCheckedChange={(checked) => setIsSyncEditing(checked as boolean)} 
                />
                <Label htmlFor="sync-edit-toggle" className="text-sm font-medium cursor-pointer whitespace-nowrap">Synchrone Bearbeitung</Label>
              </div>

              {hasUnsavedChanges && (
                <Button 
                  onClick={handleSaveBatch} 
                  disabled={isSavingBatch}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white flex-1 sm:flex-none ml-auto"
                >
                  {isSavingBatch ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Edit3 className="mr-2 h-4 w-4" />}
                  Speichern
                </Button>
              )}

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
                            <TableHead className="text-white/40 font-bold uppercase text-[10px] tracking-wider hidden md:table-cell">Einheit</TableHead>
                            <TableHead className="text-white/40 font-bold uppercase text-[10px] tracking-wider hidden lg:table-cell">Händler</TableHead>
                            <TableHead className="text-right text-white/40 font-bold uppercase text-[10px] tracking-wider">Aktionen</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {[...localArticles].sort((a, b) => (a.name || '').replace(/\s+/g, ' ').trim().localeCompare((b.name || '').replace(/\s+/g, ' ').trim(), undefined, { numeric: true, sensitivity: 'base' })).map(article => (
                            <TableRow key={article.id} className="border-white/5 hover:bg-white/[0.03] group transition-colors">
                                <TableCell className="text-center"><Checkbox checked={selectedArticleIds.has(article.id)} onCheckedChange={(checked) => { const next = new Set(selectedArticleIds); if (checked) next.add(article.id); else next.delete(article.id); setSelectedArticleIds(next); }}/></TableCell>
                                <TableCell className="font-bold text-white/80 p-2">
                                  <input 
                                    ref={el => { if (el) inputRefs.current[`${article.id}-name`] = el; }}
                                    value={article.name || ''}
                                    onChange={(e) => handleUpdateLocalArticle(article.id, 'name', e.target.value, e.target.selectionStart || 0)}
                                    className="w-full bg-white/5 border border-white/10 h-10 px-3 rounded-lg text-sm text-white focus:border-emerald-500/50 outline-none transition-all"
                                  />
                                </TableCell>
                                <TableCell className="hidden sm:table-cell p-2">
                                  <input 
                                    ref={el => { if (el) inputRefs.current[`${article.id}-articleNumber`] = el; }}
                                    value={article.articleNumber || ''}
                                    onChange={(e) => handleUpdateLocalArticle(article.id, 'articleNumber', e.target.value, e.target.selectionStart || 0)}
                                    className="w-full bg-white/5 border border-white/10 h-10 px-3 rounded-lg text-sm font-mono text-emerald-400 focus:border-emerald-500/50 outline-none transition-all"
                                  />
                                </TableCell>
                                <TableCell className="hidden md:table-cell text-white/60 text-xs font-medium p-2">
                                  <input 
                                    ref={el => { if (el) inputRefs.current[`${article.id}-unit`] = el; }}
                                    value={article.unit || ''}
                                    onChange={(e) => handleUpdateLocalArticle(article.id, 'unit', e.target.value, e.target.selectionStart || 0)}
                                    className="w-full bg-white/5 border border-white/10 h-10 px-3 rounded-lg text-sm text-white/70 focus:border-emerald-500/50 outline-none transition-all"
                                  />
                                </TableCell>
                                <TableCell className="hidden lg:table-cell text-white/60 text-xs p-2">
                                  <Select value={article.supplierId || 'none'} onValueChange={(val) => handleUpdateLocalArticle(article.id, 'supplierId', val === 'none' ? '' : val)}>
                                    <SelectTrigger className="w-full bg-white/5 border border-white/10 h-10 px-3 rounded-lg text-sm text-white/70 focus:border-emerald-500/50 outline-none transition-all">
                                      <SelectValue placeholder="-" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-gray-900 border-white/10 text-white">
                                      <SelectItem value="none" className="text-white/50">-</SelectItem>
                                      {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell className="text-right p-2">
                                    <div className="flex justify-end gap-1">
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
      </div>

      <Dialog open={isArticleFormDialogOpen} onOpenChange={setIsArticleFormDialogOpen}>
        <DialogContent className="glass-card bg-gray-900/90 border-white/10 text-white">
          <DialogHeader><DialogTitle className="text-xl font-bold flex items-center gap-2"><PackagePlus size={20} className="text-emerald-400" /> {editingArticle ? 'Bearbeiten' : 'Neu'}</DialogTitle></DialogHeader>
          <form onSubmit={handleArticleFormSubmit} className="space-y-4 py-4">
            <div className="space-y-2"><Label className="text-white/40 text-xs uppercase font-bold tracking-widest ml-1">Bezeichnung</Label><Input name="name" value={articleFormData.name} onChange={(e) => setArticleFormData({...articleFormData, name: e.target.value})} className="glass-input h-12" required /></div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label className="text-white/40 text-xs uppercase font-bold tracking-widest ml-1">Art-Nr.</Label><Input name="articleNumber" value={articleFormData.articleNumber} onChange={(e) => setArticleFormData({...articleFormData, articleNumber: e.target.value})} className="glass-input h-12" required /></div>
                <div className="space-y-2"><Label className="text-white/40 text-xs uppercase font-bold tracking-widest ml-1">Einheit</Label><Input name="unit" value={articleFormData.unit} onChange={(e) => setArticleFormData({...articleFormData, unit: e.target.value})} className="glass-input h-12" required /></div>
            </div>
            <div className="space-y-2">
              <Label className="text-white/40 text-xs uppercase font-bold tracking-widest ml-1">Großhändler</Label>
              <Select value={articleFormData.supplierId || 'none'} onValueChange={(val) => setArticleFormData({...articleFormData, supplierId: val === 'none' ? undefined : val})}>
                <SelectTrigger className="w-full glass-input h-12">
                  <SelectValue placeholder="Kein Großhändler" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-white/10 text-white">
                  <SelectItem value="none" className="text-white/50">Kein Großhändler</SelectItem>
                  {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
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
        articles={allArticles}
        defaultTargetCategoryId={categoryId}
      />
    </div>
  );
};

export default ArticleManagementPanel;
