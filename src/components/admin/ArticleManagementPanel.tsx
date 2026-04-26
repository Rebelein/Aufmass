import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { PlusCircle, LayoutGrid, PackagePlus, X, ChevronUp, ChevronDown, FileUp, Loader2, Trash2, Edit3, Package, BookMarked, Camera, ImagePlus, FileText, ClipboardPaste, Copy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn, generateUUID, getInheritedCategoryImageUrl } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { batchAddCatalog, updateCategoryImage, batchUpdateArticles, findWholesaleArticleByNumber } from '@/lib/catalog-storage';
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
  onAssignImage: (articleIds: string[], imageUrl: string | null) => void;
  onNavigateCategory: (direction: 'prev' | 'next') => void;
  onDataChanged?: () => void;
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
  onDataChanged,
}) => {
  const [isArticleFormDialogOpen, setIsArticleFormDialogOpen] = useState(false);
  const [articleFormData, setArticleFormData] = useState<NewArticleFormData>({
    name: '', articleNumber: '', unit: '', supplierId: '', aliases: '',
  });
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [selectedArticleIds, setSelectedArticleIds] = useState(new Set<string>());
  const [itemsPendingBulkDelete, setItemsPendingBulkDelete] = useState<string[]>([]);
  const [deletingArticleId, setDeletingArticleId] = useState<string | null>(null);
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
  const articleImageInputRef = useRef<HTMLInputElement>(null);
  const [activeArticleIdForImage, setActiveArticleIdForImage] = useState<string | null>(null);

  const [localArticles, setLocalArticles] = useState<Article[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [isSyncEditing, setIsSyncEditing] = useState(true);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [cursorInfo, setCursorInfo] = useState<{ id: string, field: string, pos: number } | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement>>({});

  const previousCategoryRef = useRef(categoryId);
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
  hasUnsavedChangesRef.current = hasUnsavedChanges;

  useEffect(() => {
    const categoryChanged = previousCategoryRef.current !== categoryId;
    previousCategoryRef.current = categoryId;

    // Nur resetten, wenn sich die Kategorie ändert ODER der User gerade keine ungespeicherten Daten tippt.
    if (categoryChanged || !hasUnsavedChangesRef.current) {
      setSelectedArticleIds(new Set());
      const sorted = [...initialArticles].sort((a, b) => (a.name || '').replace(/\s+/g, ' ').trim().localeCompare((b.name || '').replace(/\s+/g, ' ').trim(), undefined, { numeric: true, sensitivity: 'base' }));
      setLocalArticles(sorted.map(a => ({ ...a })));
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

  const handleArticleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeArticleIdForImage) return;

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
      handleUpdateLocalArticle(activeArticleIdForImage, 'imageUrl', base64);
      impactMedium();
      toast({ title: "Artikelbild eingefügt (Bitte Speichern klicken)" });
      setActiveArticleIdForImage(null);
    } catch (err) {
      toast({ title: "Fehler beim Upload", variant: "destructive" });
    }
  };

  const handlePasteArticleImage = async (articleId: string) => {
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
      handleUpdateLocalArticle(articleId, 'imageUrl', base64);
      impactMedium();
      toast({ title: "Bild aus Zwischenablage eingefügt (Bitte Speichern klicken)" });
    } catch (err) {
      console.error(err);
      toast({ title: "Fehler beim Zugriff auf Zwischenablage", description: "Bitte gewähren Sie Berechtigungen oder nutzen Sie den Upload.", variant: "destructive" });
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
        supplierId: a.supplierId,
        imageUrl: a.imageUrl
      }));
      await batchUpdateArticles(changes);
      setHasUnsavedChanges(false);
      impactMedium();
      toast({ title: "Änderungen gespeichert" });
      onDataChanged?.();
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
        onDataChanged?.();
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
        onDataChanged?.();
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
    if ((importMode === 'add_to_existing' || importMode === 'replace_all') && targetId) {
      const { supabase } = await import('@/lib/supabase');

      if (importMode === 'replace_all') {
        // Delete all existing articles in the target category
        await supabase.from('articles').delete().eq('category_id', targetId);
      }

      // Flatten all articles from all KI categories and add them to the existing target category
      const allArticles = data.flatMap((c: any) => c.articles || []);
      const existingCount = importMode === 'replace_all' ? 0 : initialArticles.length;
      const articlesToInsert = allArticles.map((art: any, idx: number) => ({
        name: art.name,
        article_number: art.articleNumber,
        unit: art.unit,
        category_id: targetId,
        supplier_id: art.supplierId || (supplierId === 'none' ? null : supplierId),
        order: existingCount + idx,
      }));
      
      if (articlesToInsert.length > 0) {
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
    onDataChanged?.();
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

  const handleArticleNumberBlur = async () => {
    if (!articleFormData.articleNumber || editingArticle) return;
    
    const wholesaleArticle = await findWholesaleArticleByNumber(articleFormData.articleNumber);
    if (wholesaleArticle) {
      setArticleFormData(prev => ({
        ...prev,
        name: prev.name || wholesaleArticle.name,
        unit: prev.unit || wholesaleArticle.unit,
        supplierId: prev.supplierId || wholesaleArticle.supplierId || prev.supplierId
      }));
      toast({ 
        title: "Artikel in Datanorm gefunden", 
        description: "Daten wurden automatisch ergänzt." 
      });
      impactLight();
    }
  };

  return (
    <div className="h-full flex flex-col items-stretch space-y-0">
      <div className="bg-card text-card-foreground border-border shadow-sm rounded-xl p-0 overflow-hidden flex flex-col h-full rounded-2xl shadow-none border-0 sm:border">
        {/* Header */}
        <div className="p-4 sm:p-5 lg:p-6 border-b border-border bg-muted/50 shrink-0">
          <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                  <div 
                    onClick={() => imageInputRef.current?.click()}
                    className="relative w-12 h-12 lg:w-16 lg:h-16 rounded-2xl bg-muted/50 border border-border overflow-hidden cursor-pointer group hover:border-primary/50 transition-all shadow-inner shrink-0"
                  >
                    {categoryImage ? (
                      <img src={categoryImage} alt="Kategorie" className="w-full h-full object-contain p-1" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                        <Camera className="w-5 h-5 lg:w-6 lg:h-6" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-muted opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <ImagePlus size={20} className="text-foreground" />
                    </div>
                  </div>
                  <input type="file" ref={imageInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handlePasteImage}
                    title="Aus Zwischenablage einfügen"
                    className="h-8 w-8 rounded-lg bg-muted/50 border border-border text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all shrink-0 self-center"
                  >
                    <ClipboardPaste size={16} />
                  </Button>

                  <div className="space-y-1 min-w-0">
                      <h2 className="text-xl lg:text-2xl font-bold text-foreground flex items-center gap-2">
                          {categoryName}
                      </h2>
                      <p className="text-muted-foreground text-[10px] sm:text-xs font-bold uppercase tracking-widest">{initialArticles.length} Artikel</p>
                  </div>
              </div>
          </div>
        </div>

        <div className="p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-6 flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Button onClick={() => { setEditingArticle(null); setArticleFormData({name:'', articleNumber:'', unit:'', supplierId: ''}); setIsArticleFormDialogOpen(true); }} className="bg-primary text-primary-foreground hover:bg-primary/90 flex-1 sm:flex-none shadow-sm">
                <PlusCircle className="mr-2 h-4 w-4" /> Hinzufügen
              </Button>
              
              <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-xl border border-border flex-1 sm:flex-none">
                <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                  <SelectTrigger className="w-full sm:w-[200px] border-none bg-transparent text-foreground focus:ring-0 h-9">
                    <SelectValue placeholder="Großhändler" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground">
                    <SelectItem value="none" className="text-muted-foreground">Kein Großhändler</SelectItem>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="hidden sm:block w-[1px] h-6 bg-border"></div>
                <Button 
                  onClick={() => pdfInputRef.current?.click()} 
                  disabled={isImportingPdf}
                  variant="ghost" 
                  className="hover:bg-muted/50 text-primary h-9 px-3"
                  title="Datei für KI-Scan hochladen"
                >
                  {isImportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                </Button>
                <Button 
                  onClick={handleClipboardAiScan} 
                  disabled={isImportingClipboard}
                  variant="ghost" 
                  className="hover:bg-muted/50 text-amber-400 h-9 px-3"
                  title="Bild aus Zwischenablage scannen"
                >
                  {isImportingClipboard ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardPaste className="h-4 w-4" />}
                </Button>
                <div className="w-[1px] h-6 bg-border"></div>
                <Button 
                  onClick={() => setIsDraftsDialogOpen(true)}
                  variant="ghost" 
                  className="hover:bg-muted/50 text-muted-foreground h-9 px-3"
                  title="KI Entwürfe öffnen"
                >
                  <FileText className="h-4 w-4" />
                </Button>
              </div>
              <input type="file" ref={pdfInputRef} onChange={handlePdfImport} accept="application/pdf,image/*" className="hidden" />
              <input type="file" ref={articleImageInputRef} onChange={handleArticleImageUpload} accept="image/*" className="hidden" />

              <div className="flex items-center gap-3 bg-muted/30 p-1 px-3 rounded-xl border border-border">
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
                  className="bg-primary hover:bg-primary/90 text-primary-foreground flex-1 sm:flex-none ml-auto"
                >
                  {isSavingBatch ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Edit3 className="mr-2 h-4 w-4" />}
                  Speichern
                </Button>
              )}

              {selectedArticleIds.size > 0 && (
                <Button variant="destructive" onClick={() => setItemsPendingBulkDelete(Array.from(selectedArticleIds))} className="bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20 rounded-xl flex-1 sm:flex-none">
                    <Trash2 className="mr-2 h-4 w-4" /> ({selectedArticleIds.size})
                </Button>
              )}
            </div>

            <div className="border border-border rounded-2xl overflow-hidden bg-muted/10 flex-1">
              <ScrollArea className="h-full">
                <Table>
                    <TableHeader className="bg-muted/30 sticky top-0 z-10">
                        <TableRow className="border-border hover:bg-transparent">
                            <TableHead className="w-12 text-center"><Checkbox checked={selectedArticleIds.size === initialArticles.length && initialArticles.length > 0} onCheckedChange={(checked) => setSelectedArticleIds(checked ? new Set(initialArticles.map(a => a.id)) : new Set())}/></TableHead>
                            <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-wider">Artikel</TableHead>
                            <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-wider hidden sm:table-cell">Nummer</TableHead>
                            <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-wider hidden md:table-cell">Einheit</TableHead>
                            <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-wider hidden lg:table-cell">Händler</TableHead>
                            <TableHead className="text-right text-muted-foreground font-bold uppercase text-[10px] tracking-wider hidden xl:table-cell">Aktionen</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence initial={false}>
                        {localArticles.map(article => (
                          deletingArticleId === article.id ? (
                            <motion.tr 
                              key={`del-${article.id}`} 
                              layout 
                              initial={{ opacity: 0, height: 0 }} 
                              animate={{ opacity: 1, height: 'auto' }} 
                              exit={{ opacity: 0, scale: 0.95 }} 
                              className="border-b transition-colors border-destructive/30 bg-destructive/10"
                            >
                              <TableCell colSpan={6} className="p-2">
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-destructive/20 text-destructive border border-destructive/30">
                                      <Trash2 size={16} />
                                    </div>
                                    <span className="text-sm font-semibold text-destructive/80 truncate">
                                      "{article.name}" wirklich löschen?
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <Button onClick={() => {
                                       onDeleteArticles([article.id]);
                                       setLocalArticles(prev => prev.filter(a => a.id !== article.id));
                                       setDeletingArticleId(null);
                                       if (selectedArticleIds.has(article.id)) {
                                         const nextSelected = new Set(selectedArticleIds);
                                         nextSelected.delete(article.id);
                                         setSelectedArticleIds(nextSelected);
                                       }
                                       impactMedium();
                                    }} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold h-9">Löschen</Button>
                                    <Button variant="ghost" onClick={() => setDeletingArticleId(null)} className="text-muted-foreground hover:text-foreground h-9 bg-muted/50">Abbrechen</Button>
                                  </div>
                                </div>
                              </TableCell>
                            </motion.tr>
                          ) : (
                            <motion.tr 
                              key={article.id} 
                              layout 
                              initial={{ opacity: 0, y: -10 }} 
                              animate={{ 
                                opacity: 1, 
                                y: 0,
                                scale: activeRowId === article.id ? 1.005 : 1,
                                zIndex: activeRowId === article.id ? 20 : 0
                              }} 
                              exit={{ opacity: 0, scale: 0.95, backgroundColor: "rgba(239, 68, 68, 0.1)" }} 
                              transition={{ duration: 0.2 }}
                              onFocusCapture={() => setActiveRowId(article.id)}
                              onClick={() => setActiveRowId(article.id)}
                              className={cn(
                                "border-b transition-colors data-[state=selected]:bg-muted group relative",
                                activeRowId === article.id 
                                  ? "bg-card shadow-[0_8px_30px_rgba(245,158,11,0.12)] outline outline-2 outline-amber-500/40 border-transparent rounded-xl" 
                                  : "border-border hover:bg-muted/30"
                              )}
                            >
                                <TableCell className="text-center"><Checkbox checked={selectedArticleIds.has(article.id)} onCheckedChange={(checked) => { const next = new Set(selectedArticleIds); if (checked) next.add(article.id); else next.delete(article.id); setSelectedArticleIds(next); }}/></TableCell>
                                <TableCell className="font-bold text-foreground p-2">
                                  <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center gap-2">
                                     {(article.imageUrl || getInheritedCategoryImageUrl(article.categoryId, allCategories)) && (
                                       <div className="w-8 h-8 rounded-md border border-border shrink-0 bg-background overflow-hidden flex items-center justify-center">
                                         <img src={article.imageUrl || getInheritedCategoryImageUrl(article.categoryId, allCategories)} alt="" className="w-full h-full object-contain" />
                                       </div>
                                     )}
                                     <textarea 
                                        ref={el => { 
                                          if (el) {
                                            inputRefs.current[`${article.id}-name`] = el;
                                            // Auto-resize on mount
                                            el.style.height = '0px';
                                            el.style.height = el.scrollHeight + 'px';
                                          } 
                                        }}
                                        rows={1}
                                        value={article.name || ''}
                                        onChange={(e) => {
                                          e.target.style.height = '0px';
                                          e.target.style.height = e.target.scrollHeight + 'px';
                                          handleUpdateLocalArticle(article.id, 'name', e.target.value, e.target.selectionStart || 0);
                                        }}
                                        className="w-full bg-background/50 border border-border min-h-[40px] py-2 px-3 rounded-lg text-sm text-foreground focus:border-primary/50 outline-none transition-all min-w-0 resize-none overflow-hidden"
                                        style={{ fieldSizing: 'content' } as React.CSSProperties}
                                      />
                                    </div>
                                    
                                    {/* Actions for tablet/mobile - visible below article name */}
                                    <div className="flex xl:hidden items-center gap-2 ml-1 sm:ml-10">
                                        <Button variant="ghost" size="sm" onClick={() => { setActiveArticleIdForImage(article.id); articleImageInputRef.current?.click(); }} className="h-8 px-2 text-muted-foreground hover:text-primary bg-muted/30 hover:bg-primary/10 rounded-lg text-[10px] font-bold uppercase tracking-wider gap-1.5">
                                          <ImagePlus size={12}/> Bild
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => handlePasteArticleImage(article.id)} className="h-8 px-2 text-muted-foreground hover:text-primary bg-muted/30 hover:bg-primary/10 rounded-lg text-[10px] font-bold uppercase tracking-wider gap-1.5">
                                          <ClipboardPaste size={12}/> Einfügen
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => setDeletingArticleId(article.id)} className="h-8 px-2 text-muted-foreground hover:text-destructive bg-muted/30 hover:bg-destructive/10 rounded-lg text-[10px] font-bold uppercase tracking-wider gap-1.5 ml-auto sm:ml-0">
                                          <Trash2 size={12}/> Löschen
                                        </Button>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="hidden sm:table-cell p-2">
                                  <div className="relative flex items-center">
                                    <input 
                                      ref={el => { if (el) inputRefs.current[`${article.id}-articleNumber`] = el; }}
                                      value={article.articleNumber || ''}
                                      onChange={(e) => handleUpdateLocalArticle(article.id, 'articleNumber', e.target.value, e.target.selectionStart || 0)}
                                      className="w-full bg-background/50 border border-border h-10 pl-3 pr-8 rounded-lg text-sm font-mono text-primary focus:border-primary/50 outline-none transition-all"
                                    />
                                    {article.articleNumber && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          navigator.clipboard.writeText(article.articleNumber || '');
                                          toast({ title: 'Kopiert', description: 'Artikelnummer in die Zwischenablage kopiert.' });
                                        }}
                                        className="absolute right-1 text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-muted"
                                        title="Artikelnummer kopieren"
                                      >
                                        <Copy size={14} />
                                      </button>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="hidden md:table-cell text-muted-foreground text-xs font-medium p-2">
                                  <input 
                                    ref={el => { if (el) inputRefs.current[`${article.id}-unit`] = el; }}
                                    value={article.unit || ''}
                                    onChange={(e) => handleUpdateLocalArticle(article.id, 'unit', e.target.value, e.target.selectionStart || 0)}
                                    className="w-full bg-background/50 border border-border h-10 px-3 rounded-lg text-sm text-muted-foreground focus:border-primary/50 outline-none transition-all"
                                  />
                                </TableCell>
                                <TableCell className="hidden lg:table-cell text-muted-foreground text-xs p-2">
                                  <Select value={article.supplierId || 'none'} onValueChange={(val) => handleUpdateLocalArticle(article.id, 'supplierId', val === 'none' ? '' : val)}>
                                    <SelectTrigger className="w-full bg-background/50 border border-border h-10 px-3 rounded-lg text-sm text-muted-foreground focus:border-primary/50 outline-none transition-all">
                                      <SelectValue placeholder="-" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border text-foreground">
                                      <SelectItem value="none" className="text-muted-foreground">-</SelectItem>
                                      {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell className="text-right p-2 hidden xl:table-cell">
                                    <div className="flex justify-end gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => { setActiveArticleIdForImage(article.id); articleImageInputRef.current?.click(); }} className="h-8 w-8 text-muted-foreground hover:text-primary" title="Bild hochladen"><ImagePlus size={14}/></Button>
                                        <Button variant="ghost" size="icon" onClick={() => handlePasteArticleImage(article.id)} className="h-8 w-8 text-muted-foreground hover:text-primary" title="Bild aus Zwischenablage einfügen"><ClipboardPaste size={14}/></Button>
                                        <Button variant="ghost" size="icon" onClick={() => setDeletingArticleId(article.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive"><Trash2 size={14}/></Button>
                                    </div>
                                </TableCell>
                            </motion.tr>
                          )
                        ))}
                      </AnimatePresence>
                    </TableBody>
                </Table>
                {initialArticles.length === 0 && <div className="py-20 text-center text-muted-foreground font-medium">Keine Artikel vorhanden.</div>}
              </ScrollArea>
            </div>
          </div>
      </div>

      <Dialog open={isArticleFormDialogOpen} onOpenChange={setIsArticleFormDialogOpen}>
        <DialogContent className="bg-card text-card-foreground border-border shadow-sm rounded-xl">
          <DialogHeader><DialogTitle className="text-xl font-bold flex items-center gap-2"><PackagePlus size={20} className="text-primary" /> {editingArticle ? 'Bearbeiten' : 'Neu'}</DialogTitle></DialogHeader>
          <form onSubmit={handleArticleFormSubmit} className="space-y-4 py-4">
            <div className="space-y-2"><Label className="text-muted-foreground text-xs uppercase font-bold tracking-widest ml-1">Bezeichnung</Label><Input name="name" value={articleFormData.name} onChange={(e) => setArticleFormData({...articleFormData, name: e.target.value})} className="bg-background border border-input text-foreground focus-visible:ring-1 focus-visible:ring-ring shadow-sm rounded-md h-12" required /></div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase font-bold tracking-widest ml-1">Art-Nr.</Label>
                  <Input 
                    name="articleNumber" 
                    value={articleFormData.articleNumber} 
                    onChange={(e) => setArticleFormData({...articleFormData, articleNumber: e.target.value})} 
                    onBlur={handleArticleNumberBlur}
                    className="bg-background border border-input text-foreground focus-visible:ring-1 focus-visible:ring-ring shadow-sm rounded-md h-12" 
                    required 
                  />
                </div>
                <div className="space-y-2"><Label className="text-muted-foreground text-xs uppercase font-bold tracking-widest ml-1">Einheit</Label><Input name="unit" value={articleFormData.unit} onChange={(e) => setArticleFormData({...articleFormData, unit: e.target.value})} className="bg-background border border-input text-foreground focus-visible:ring-1 focus-visible:ring-ring shadow-sm rounded-md h-12" required /></div>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase font-bold tracking-widest ml-1">Großhändler</Label>
              <Select value={articleFormData.supplierId || 'none'} onValueChange={(val) => setArticleFormData({...articleFormData, supplierId: val === 'none' ? undefined : val})}>
                <SelectTrigger className="w-full bg-background border border-input text-foreground focus-visible:ring-1 focus-visible:ring-ring shadow-sm rounded-md h-12">
                  <SelectValue placeholder="Kein Großhändler" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="none" className="text-muted-foreground">Kein Großhändler</SelectItem>
                  {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-6"><Button variant="ghost" type="button" onClick={() => setIsArticleFormDialogOpen(false)} className="text-muted-foreground">Abbrechen</Button><Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90 px-10">Speichern</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={itemsPendingBulkDelete.length > 0} onOpenChange={(open) => { if (!open) setItemsPendingBulkDelete([]); }}>
        <AlertDialogContent className="bg-card text-card-foreground border-border shadow-sm rounded-xl text-center">
            <AlertDialogHeader><AlertDialogTitle className="text-2xl font-bold text-destructive mx-auto">Artikel löschen?</AlertDialogTitle>
            <p className="text-muted-foreground text-sm mt-2">{itemsPendingBulkDelete.length} Artikel markiert zur Löschung.</p>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-6 flex-col sm:flex-row gap-3">
                <AlertDialogCancel onClick={() => setItemsPendingBulkDelete([])} className="bg-muted border-border text-foreground rounded-xl h-12">Abbrechen</AlertDialogCancel>
                <AlertDialogAction onClick={() => { 
                  onDeleteArticles(itemsPendingBulkDelete); 
                  setLocalArticles(prev => prev.filter(a => !itemsPendingBulkDelete.includes(a.id)));
                  setItemsPendingBulkDelete([]); 
                  setSelectedArticleIds(new Set()); 
                  impactMedium(); 
                }} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl h-12 font-bold px-10">Löschen</AlertDialogAction>
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