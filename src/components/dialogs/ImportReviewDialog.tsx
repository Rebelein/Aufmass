import React, { useState, useEffect, useRef } from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { ResizableSidePanel } from '@/components/ui/ResizableSidePanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sparkles, ChevronDown, Loader2, Save, Check, Trash2, FolderPlus, ListPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Category, Supplier, Article } from '@/lib/data';
import type { ImportDraft } from '@/lib/import-storage';

export type ImportMode = 'add_to_existing' | 'create_new';

interface ImportReviewDialogProps {
  draft: ImportDraft | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveDraft: (id: string, data: any, supplierId: string | null) => Promise<void>;
  onConfirmImport: (id: string, data: any, targetCategoryId: string | null, supplierId: string | null, importMode?: ImportMode) => Promise<void>;
  articles: Article[];
  categories: Category[];
  suppliers: Supplier[];
  defaultTargetCategoryId?: string | null;
}

const ImportReviewDialog: React.FC<ImportReviewDialogProps> = ({
  draft,
  isOpen,
  onClose,
  onSaveDraft,
  onConfirmImport,
  categories,
  suppliers,
  articles,
  defaultTargetCategoryId = 'root'
}) => {
  const [localData, setLocalData] = useState<any[]>([]);
  const [isSyncEditing, setIsSyncEditing] = useState(true);
  const [targetCategoryId, setTargetCategoryId] = useState<string>(defaultTargetCategoryId || 'root');
  const [supplierId, setSupplierId] = useState<string>('none');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<number>>(new Set());
  const [cursorInfo, setCursorInfo] = useState<{ catIdx: number, artIdx: number, pos: number, field: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showImportModeDialog, setShowImportModeDialog] = useState(false);

  const inputRefs = useRef<Record<string, HTMLInputElement>>({});

  const categoryTree = React.useMemo(() => {
    const buildTree = (cats: Category[], parentId: string | null = null, level: number = 0): { cat: Category; level: number }[] => {
      const result: { cat: Category; level: number }[] = [];
      const children = cats
        .filter((c) => (c.parentId || null) === parentId)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      for (const child of children) {
        result.push({ cat: child, level });
        result.push(...buildTree(cats, child.id, level + 1));
      }
      return result;
    };
    return buildTree(categories);
  }, [categories]);

  useEffect(() => {
    if (draft && isOpen) {
      setLocalData(JSON.parse(JSON.stringify(draft.extracted_data)));
      setTargetCategoryId(draft.default_target_category_id || defaultTargetCategoryId || 'root');
      setSupplierId(draft.default_supplier_id || 'none');
    }
  }, [draft, isOpen, defaultTargetCategoryId]);

  // Cursor-Sicherung
  React.useLayoutEffect(() => {
    if (cursorInfo) {
      const key = `${cursorInfo.catIdx}-${cursorInfo.artIdx}-${cursorInfo.field}`;
      const input = inputRefs.current[key];
      if (input) {
        input.setSelectionRange(cursorInfo.pos, cursorInfo.pos);
      }
    }
  }, [localData, cursorInfo]);

  if (!draft) return null;

  const handleUpdateItem = (catIdx: number, artIdx: number, field: string, value: string, pos?: number) => {
    const nextData = [...localData];
    const category = nextData[catIdx];
    const article = category.articles[artIdx];

    if (field === 'unit' && isSyncEditing) {
      category.articles = category.articles.map((art: any) => ({ ...art, unit: value }));
      if (pos !== undefined) setCursorInfo({ catIdx, artIdx, pos, field });
    } else if ((field === 'name' || field === 'articleNumber') && isSyncEditing && pos !== undefined) {
      const oldValue = String(article[field] || '');
      const newValue = value;
      
      let commonPrefixLen = 0;
      while (commonPrefixLen < oldValue.length && commonPrefixLen < newValue.length && oldValue[commonPrefixLen] === newValue[commonPrefixLen]) {
        commonPrefixLen++;
      }
      
      let commonSuffixLen = 0;
      while (commonSuffixLen < oldValue.length - commonPrefixLen && 
             commonSuffixLen < newValue.length - commonPrefixLen && 
             oldValue[oldValue.length - 1 - commonSuffixLen] === newValue[newValue.length - 1 - commonSuffixLen]) {
        commonSuffixLen++;
      }
      
      const charsToDelete = oldValue.length - commonPrefixLen - commonSuffixLen;
      const stringToInsert = newValue.substring(commonPrefixLen, newValue.length - commonSuffixLen);

      category.articles = category.articles.map((art: any) => {
        if (art === article) return { ...art, [field]: value };
        
        const oldArtVal = String(art[field] || '');
        const replaceStart = Math.min(commonPrefixLen, oldArtVal.length);
        const replaceEnd = Math.min(replaceStart + charsToDelete, oldArtVal.length);
        const newArtVal = oldArtVal.substring(0, replaceStart) + stringToInsert + oldArtVal.substring(replaceEnd);
        
        return { ...art, [field]: newArtVal };
      });
      setCursorInfo({ catIdx, artIdx, pos, field });
    } else {
      article[field] = value;
      if ((field === 'name' || field === 'articleNumber' || field === 'unit') && pos !== undefined) {
        setCursorInfo({ catIdx, artIdx, pos, field });
      }
    }
    setLocalData(nextData);
  };

  const handleDeleteArticle = (catIdx: number, artIdx: number) => {
    const nextData = [...localData];
    const category = { ...nextData[catIdx] };
    category.articles = category.articles.filter((_: any, i: number) => i !== artIdx);
    nextData[catIdx] = category;
    setLocalData(nextData);
  };

  const handleDeleteCategory = (catIdx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextData = localData.filter((_, i) => i !== catIdx);
    setLocalData(nextData);
  };

  const handleSave = async () => {
    setIsSaving(true);
    const finalSupplierId = supplierId === 'none' ? null : supplierId;
    await onSaveDraft(draft.id, localData, finalSupplierId);
    setIsSaving(false);
  };

  const handleConfirmClick = () => {
    const finalTargetId = targetCategoryId === 'root' ? null : targetCategoryId;
    if (finalTargetId) {
      const existingArticles = articles.filter(a => a.categoryId === finalTargetId);
      if (existingArticles.length > 0) {
        setShowImportModeDialog(true);
        return;
      }
    }
    executeImport('create_new');
  };

  const executeImport = async (mode: ImportMode) => {
    setShowImportModeDialog(false);
    setIsImporting(true);
    const finalTargetId = targetCategoryId === 'root' ? null : targetCategoryId;
    const finalSupplierId = supplierId === 'none' ? null : supplierId;
    await onConfirmImport(draft.id, localData, finalTargetId, finalSupplierId, mode);
    setIsImporting(false);
    onClose();
  };

  const toggleCategory = (idx: number) => {
    const next = new Set(collapsedCategories);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    setCollapsedCategories(next);
  };

  const totalArticles = localData.reduce((sum: number, c: any) => sum + (c.articles?.length || 0), 0);

  return (
    <>
    <ResizableSidePanel
      isOpen={isOpen}
      onClose={onClose}
      storageKey="ki-review"
      defaultWidth={780}
      minWidth={500}
      maxWidth={1200}
      title={
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">KI-Import prüfen</h2>
            <p className="text-white/40 text-xs">{draft.file_name} · {totalArticles} Artikel in {localData.length} Gruppen</p>
          </div>
        </div>
      }
      footer={
        <div className="p-4 flex items-center justify-between gap-3">
          <Button 
            variant="ghost" 
            onClick={handleSave} 
            disabled={isSaving}
            className="text-emerald-400 hover:bg-emerald-500/10 h-10 px-4"
          >
            {isSaving ? <Loader2 className="animate-spin mr-2" size={16} /> : <Save className="mr-2" size={16} />}
            Sichern
          </Button>
          <Button 
            onClick={handleConfirmClick} 
            disabled={isImporting}
            className="btn-primary h-10 px-6 font-bold"
          >
            {isImporting ? <Loader2 className="animate-spin mr-2" size={16} /> : <Check className="mr-2" size={16} />}
            Import abschließen
          </Button>
        </div>
      }
    >
      <div className="p-4 space-y-4">
        {/* Settings Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white/5 p-3 rounded-xl border border-white/10">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase text-white/30 font-bold ml-1">Ziel-Kategorie</Label>
            <Select value={targetCategoryId} onValueChange={setTargetCategoryId}>
              <SelectTrigger className="glass-input h-9 text-xs">
                <SelectValue placeholder="Wählen..." />
              </SelectTrigger>
              <SelectContent className="bg-background border-white/10 text-white max-h-[300px] z-[100]">
                <SelectItem value="root">Hauptverzeichnis (Root)</SelectItem>
                {categoryTree.map(({ cat, level }) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <div className="flex items-center gap-2">
                      {level > 0 && <span className="text-white/30" style={{ paddingLeft: `${level * 12}px` }}>└</span>}
                      <span>{cat.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase text-white/30 font-bold ml-1">Großhändler</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger className="glass-input h-9 text-xs">
                <SelectValue placeholder="Wählen..." />
              </SelectTrigger>
              <SelectContent className="bg-background border-white/10 text-white z-[100]">
                <SelectItem value="none">Keiner</SelectItem>
                {suppliers.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pt-4 sm:pt-5">
            <Checkbox 
              id="review-sync-edit" 
              checked={isSyncEditing} 
              onCheckedChange={(checked) => setIsSyncEditing(checked as boolean)} 
              className="border-emerald-500/50 data-[state=checked]:bg-emerald-500"
            />
            <Label htmlFor="review-sync-edit" className="text-xs text-white/70 cursor-pointer">Sync-Edit</Label>
          </div>
        </div>

        {/* Content Area */}
        <div className="space-y-4">
          {localData.map((category: any, catIdx: number) => (
            <div key={catIdx} className="bg-white/5 rounded-xl border border-white/5 overflow-hidden">
              <div 
                className="p-3 bg-white/5 flex items-center justify-between cursor-pointer hover:bg-white/[0.08] transition-colors"
                onClick={() => toggleCategory(catIdx)}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                   <ChevronDown className={cn("text-white/30 transition-transform shrink-0", collapsedCategories.has(catIdx) && "-rotate-90")} size={16} />
                   <input 
                     value={category.categoryName} 
                     onChange={(e) => {
                       const next = [...localData];
                       next[catIdx] = { ...next[catIdx], categoryName: e.target.value };
                       setLocalData(next);
                     }}
                     onClick={(e) => e.stopPropagation()}
                     className="bg-transparent border-none text-sm font-bold p-0 h-auto focus:ring-0 outline-none text-white w-full hover:bg-white/5 rounded px-1.5 -ml-1 transition-colors"
                   />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary" className="bg-white/10 text-[10px]">{category.articles.length}</Badge>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={(e) => handleDeleteCategory(catIdx, e)}
                    className="h-7 w-7 text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
              
              {!collapsedCategories.has(catIdx) && (
                <div className="overflow-x-auto">
                   <Table>
                     <TableHeader className="bg-white/[0.02]">
                       <TableRow className="border-white/5">
                         <TableHead className="text-[9px] uppercase font-bold text-white/30 p-2 pl-3">Bezeichnung</TableHead>
                         <TableHead className="text-[9px] uppercase font-bold text-white/30 w-32 p-2">Art-Nr.</TableHead>
                         <TableHead className="text-[9px] uppercase font-bold text-white/30 w-24 p-2">Einheit</TableHead>
                         <TableHead className="text-[9px] uppercase font-bold text-white/30 w-10 p-2"></TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {category.articles.map((article: any, artIdx: number) => (
                         <TableRow key={article.id || artIdx} className="border-white/5 hover:bg-white/[0.02] transition-colors group">
                           <TableCell className="p-1.5 pl-2">
                             <input 
                               ref={el => { if (el) inputRefs.current[`${catIdx}-${artIdx}-name`] = el; }}
                               value={article.name}
                               onChange={(e) => handleUpdateItem(catIdx, artIdx, 'name', e.target.value, e.target.selectionStart || 0)}
                               className="w-full bg-white/5 border border-white/10 h-8 px-2 rounded-md text-xs text-white focus:border-emerald-500/50 outline-none transition-all"
                             />
                           </TableCell>
                           <TableCell className="p-1.5">
                             <input 
                               ref={el => { if (el) inputRefs.current[`${catIdx}-${artIdx}-articleNumber`] = el; }}
                               value={article.articleNumber}
                               onChange={(e) => handleUpdateItem(catIdx, artIdx, 'articleNumber', e.target.value, e.target.selectionStart || 0)}
                               className="w-full bg-white/5 border border-white/10 h-8 px-2 rounded-md text-xs font-mono text-emerald-400 focus:border-emerald-500/50 outline-none transition-all"
                             />
                           </TableCell>
                           <TableCell className="p-1.5">
                             <input 
                               ref={el => { if (el) inputRefs.current[`${catIdx}-${artIdx}-unit`] = el; }}
                               value={article.unit}
                               onChange={(e) => handleUpdateItem(catIdx, artIdx, 'unit', e.target.value, e.target.selectionStart || 0)}
                               className="w-full bg-white/5 border border-white/10 h-8 px-2 rounded-md text-xs text-white/70 focus:border-emerald-500/50 outline-none transition-all"
                             />
                           </TableCell>
                           <TableCell className="p-1 text-center">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleDeleteArticle(catIdx, artIdx)}
                                className="h-7 w-7 text-white/10 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all rounded-lg"
                              >
                                <Trash2 size={12} />
                              </Button>
                           </TableCell>
                         </TableRow>
                       ))}
                     </TableBody>
                   </Table>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </ResizableSidePanel>

    {/* Import Mode Choice Dialog */}
    <AlertDialog open={showImportModeDialog} onOpenChange={setShowImportModeDialog}>
      <AlertDialogContent className="glass-card bg-gray-900/95 border-white/10 text-white max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-bold text-center">Artikel importieren</AlertDialogTitle>
          <p className="text-white/50 text-sm text-center mt-2">
            Die Zielkategorie <span className="text-emerald-400 font-semibold">"{categories.find(c => c.id === targetCategoryId)?.name}"</span> enthält bereits Artikel. Wie möchtest du importieren?
          </p>
        </AlertDialogHeader>
        <div className="space-y-3 py-4">
          <Button
            onClick={() => executeImport('add_to_existing')}
            className="w-full h-14 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 rounded-xl flex items-center justify-start gap-3 px-4"
          >
            <ListPlus size={20} />
            <div className="text-left">
              <p className="font-bold text-sm">Zu bestehender Kategorie hinzufügen</p>
              <p className="text-[10px] text-emerald-400/60">Artikel werden direkt in die Kategorie eingefügt</p>
            </div>
          </Button>
          <Button
            onClick={() => executeImport('create_new')}
            className="w-full h-14 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 rounded-xl flex items-center justify-start gap-3 px-4"
          >
            <FolderPlus size={20} />
            <div className="text-left">
              <p className="font-bold text-sm">Neue Unterkategorien erstellen</p>
              <p className="text-[10px] text-white/40">KI-Gruppen werden als neue Unterkategorien angelegt</p>
            </div>
          </Button>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel className="w-full bg-white/5 border-white/10 text-white/50 rounded-xl h-10">Abbrechen</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
};

export default ImportReviewDialog;
