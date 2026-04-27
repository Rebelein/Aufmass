import React, { useState, useEffect, useRef } from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ResizableSidePanel } from '@/components/ui/ResizableSidePanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sparkles, ChevronDown, Loader2, Save, Check, Trash2, FolderPlus, ListPlus, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Category, Supplier, Article } from '@/lib/data';
import type { ImportDraft } from '@/lib/import-storage';

export type ImportMode = 'add_to_existing' | 'create_new' | 'replace_all';

interface ImportReviewDialogProps {
  draft: ImportDraft | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveDraft: (id: string, data: any, supplierId: string | null) => Promise<void>;
  onConfirmImport: (id: string, data: any, targetCategoryId: string | null, supplierId: string | null, importMode?: ImportMode, catalogSource?: 'own' | 'wholesale') => Promise<void>;
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
  const [catalogSource, setCatalogSource] = useState<'own' | 'wholesale'>('own');
  const [supplierId, setSupplierId] = useState<string>('none');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<number>>(new Set());
  const [cursorInfo, setCursorInfo] = useState<{ catIdx: number, artIdx: number, pos: number, field: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showImportModeDialog, setShowImportModeDialog] = useState(false);

  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(new Set());
  const [targetMoveIdx, setTargetMoveIdx] = useState<string>('');
  const [newCategoryName, setNewCategoryName] = useState('');

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

  const availableArticles = React.useMemo(() => {
    const getRecursiveIds = (parentId: string): string[] => {
      const children = categories.filter(c => c.parentId === parentId);
      return [parentId, ...children.flatMap(c => getRecursiveIds(c.id))];
    };
    const validIds = getRecursiveIds(targetCategoryId || defaultTargetCategoryId || 'root');
    const filtered = articles.filter(a => a.categoryId && validIds.includes(a.categoryId));
    
    // Duplikate nach ID entfernen, um React-Key-Warnungen im Select zu vermeiden
    const seen = new Set();
    return filtered.filter(a => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });
  }, [articles, categories, targetCategoryId, defaultTargetCategoryId]);

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

  const toggleArticleSelection = (catIdx: number, artIdx: number) => {
    const key = `${catIdx}-${artIdx}`;
    const next = new Set(selectedArticles);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedArticles(next);
  };

  const handleMoveSelection = () => {
    if (selectedArticles.size === 0) return;
    if (targetMoveIdx === 'new' && !newCategoryName.trim()) return;
    if (targetMoveIdx === '') return;

    const nextData = JSON.parse(JSON.stringify(localData));
    const movedArticles: any[] = [];
    
    const sortedKeys = Array.from(selectedArticles).map(k => {
      const [c, a] = k.split('-');
      return { catIdx: parseInt(c, 10), artIdx: parseInt(a, 10) };
    }).sort((a, b) => {
      if (a.catIdx === b.catIdx) return b.artIdx - a.artIdx;
      return b.catIdx - a.catIdx;
    });

    for (const { catIdx, artIdx } of sortedKeys) {
      const art = nextData[catIdx].articles[artIdx];
      movedArticles.push(art);
      nextData[catIdx].articles.splice(artIdx, 1);
    }
    
    movedArticles.reverse();

    if (targetMoveIdx === 'new') {
      nextData.push({
        categoryName: newCategoryName.trim(),
        articles: movedArticles
      });
    } else {
      const targetIdx = parseInt(targetMoveIdx, 10);
      nextData[targetIdx].articles.push(...movedArticles);
    }
    
    setLocalData(nextData.filter((c: any) => c.articles.length > 0 || c.categoryName));
    setSelectedArticles(new Set());
    setTargetMoveIdx('');
    setNewCategoryName('');
  };

  const handleSave = async () => {
    setIsSaving(true);
    const finalSupplierId = supplierId === 'none' ? null : supplierId;
    await onSaveDraft(draft.id, localData, finalSupplierId);
    setIsSaving(false);
  };

  const handleConfirmClick = () => {
    if (draft.import_options?.mode === 'extend') {
      executeImport('add_to_existing');
      return;
    }
    const finalTargetId = targetCategoryId === 'root' ? null : targetCategoryId;
    if (finalTargetId) {
      setShowImportModeDialog(true);
      return;
    }
    executeImport('create_new');
  };

  const executeImport = async (mode: ImportMode) => {
    setShowImportModeDialog(false);
    setIsImporting(true);
    const finalTargetId = targetCategoryId === 'root' ? null : targetCategoryId;
    const finalSupplierId = supplierId === 'none' ? null : supplierId;
    await onConfirmImport(draft?.id || '', localData, finalTargetId, finalSupplierId, mode, catalogSource);
    setIsImporting(false);
    onClose();
  };

  const finalTargetId = targetCategoryId === 'root' ? null : targetCategoryId;
  const hasExistingArticles = finalTargetId ? articles.some(a => a.categoryId === finalTargetId) : false;

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
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary shrink-0">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">KI-Import prüfen</h2>
            <p className="text-muted-foreground text-xs">{draft.file_name} · {totalArticles} Artikel in {localData.length} Gruppen</p>
          </div>
        </div>
      }
      footer={
        <div className="p-4 flex items-center justify-between gap-3">
          <Button 
            variant="ghost" 
            onClick={handleSave} 
            disabled={isSaving}
            className="text-primary hover:bg-primary/10 h-10 px-4"
          >
            {isSaving ? <Loader2 className="animate-spin mr-2" size={16} /> : <Save className="mr-2" size={16} />}
            Sichern
          </Button>
          <Button 
            onClick={handleConfirmClick} 
            disabled={isImporting}
            className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 font-bold shadow-sm"
          >
            {isImporting ? <Loader2 className="animate-spin mr-2" size={16} /> : <Check className="mr-2" size={16} />}
            Import abschließen
          </Button>
        </div>
      }
    >
      <div className="p-4 space-y-4">
        {/* Settings Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-muted/50 p-3 rounded-xl border border-border">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase text-muted-foreground font-bold ml-1">Katalog-Typ</Label>
            <Select value={catalogSource} onValueChange={(val: any) => setCatalogSource(val)}>
              <SelectTrigger className="bg-background border border-input text-foreground focus-visible:ring-1 focus-visible:ring-ring shadow-sm rounded-md h-9 text-xs">
                <SelectValue placeholder="Wählen..." />
              </SelectTrigger>
              <SelectContent className="bg-background border-border text-foreground z-[100]">
                <SelectItem value="own">Eigener Katalog</SelectItem>
                <SelectItem value="wholesale">Großhändler</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase text-muted-foreground font-bold ml-1">Ziel-Kategorie</Label>
            <Select value={targetCategoryId} onValueChange={setTargetCategoryId}>
              <SelectTrigger className="bg-background border border-input text-foreground focus-visible:ring-1 focus-visible:ring-ring shadow-sm rounded-md h-9 text-xs">
                <SelectValue placeholder="Wählen..." />
              </SelectTrigger>
              <SelectContent className="bg-background border-border text-foreground max-h-[300px] z-[100]">
                <SelectItem value="root">Hauptverzeichnis (Root)</SelectItem>
                {categoryTree
                  .filter(({ cat }) => cat.source === catalogSource || (!cat.source && catalogSource === 'own'))
                  .map(({ cat, level }) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        {level > 0 && <span className="text-muted-foreground" style={{ paddingLeft: `${level * 12}px` }}>└</span>}
                        <span>{cat.name}</span>
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase text-muted-foreground font-bold ml-1">Großhändler</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger className="bg-background border border-input text-foreground focus-visible:ring-1 focus-visible:ring-ring shadow-sm rounded-md h-9 text-xs">
                <SelectValue placeholder="Wählen..." />
              </SelectTrigger>
              <SelectContent className="bg-background border-border text-foreground z-[100]">
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
              className="border-primary/50 data-[state=checked]:bg-primary"
            />
            <Label htmlFor="review-sync-edit" className="text-xs text-muted-foreground cursor-pointer">Sync-Edit</Label>
          </div>
        </div>

        {/* Content Area */}
        {selectedArticles.size > 0 && (
          <div className="bg-primary/10 border border-primary/30 p-3 rounded-xl flex flex-col sm:flex-row items-center gap-3 animate-in fade-in sticky top-0 z-50 shadow-md backdrop-blur-md">
            <div className="flex items-center gap-2 shrink-0">
              <Badge className="bg-primary text-primary-foreground">{selectedArticles.size}</Badge>
              <span className="text-sm font-bold text-primary">Artikel ausgewählt</span>
            </div>
            
            <div className="flex flex-1 items-center gap-2 w-full">
              <Select value={targetMoveIdx} onValueChange={setTargetMoveIdx}>
                <SelectTrigger className="h-9 bg-background border-primary/20 text-xs">
                  <SelectValue placeholder="Ziel wählen..." />
                </SelectTrigger>
                <SelectContent className="bg-background border-border z-[150]">
                  <SelectItem value="new" className="font-bold text-primary">+ Neue Kategorie...</SelectItem>
                  <SelectSeparator />
                  {localData.map((c, idx) => (
                    <SelectItem key={c.id || idx} value={String(idx)}>{c.categoryName || `Gruppe ${idx + 1}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {targetMoveIdx === 'new' && (
                <Input 
                  placeholder="Name..." 
                  className="h-9 text-xs bg-background border-primary/30"
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  autoFocus
                />
              )}
              
              <Button 
                size="sm" 
                onClick={handleMoveSelection} 
                disabled={!targetMoveIdx || (targetMoveIdx === 'new' && !newCategoryName.trim())} 
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md shrink-0 h-9 px-4"
              >
                 Ausführen
              </Button>
              
              <Button variant="ghost" size="sm" onClick={() => { setSelectedArticles(new Set()); setTargetMoveIdx(''); }} className="h-9 w-9 p-0 rounded-full hover:bg-destructive/10 hover:text-destructive shrink-0">
                <X size={16} />
              </Button>
            </div>
          </div>
        )}
        <div className="space-y-4">
          {localData.map((category: any, catIdx: number) => (
            <div key={category.id || catIdx} className="bg-muted/30 rounded-xl border border-border overflow-hidden">
              <div 
                className="p-3 bg-muted/50 flex items-center justify-between cursor-pointer hover:bg-muted/80 transition-colors"
                onClick={() => toggleCategory(catIdx)}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                   <ChevronDown className={cn("text-muted-foreground transition-transform shrink-0", collapsedCategories.has(catIdx) && "-rotate-90")} size={16} />
                   <input 
                     value={category.categoryName} 
                     onChange={(e) => {
                       const next = [...localData];
                       next[catIdx] = { ...next[catIdx], categoryName: e.target.value };
                       setLocalData(next);
                     }}
                     onClick={(e) => e.stopPropagation()}
                     className="bg-transparent border-none text-sm font-bold p-0 h-auto focus:ring-0 outline-none text-foreground w-full hover:bg-muted rounded px-1.5 -ml-1 transition-colors"
                   />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary" className="bg-muted text-[10px]">{category.articles.length}</Badge>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={(e) => handleDeleteCategory(catIdx, e)}
                    className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
              
              {!collapsedCategories.has(catIdx) && (
                <div className="overflow-x-auto">
                   {draft.import_options?.mode === 'extend' ? (
                     <Table>
                       <TableHeader className="bg-muted/20">
                         <TableRow className="border-border">
                           <TableHead className="text-[9px] uppercase font-bold text-muted-foreground p-2 pl-3 w-8"></TableHead>
                           <TableHead className="text-[9px] uppercase font-bold text-muted-foreground p-2">Original Artikel</TableHead>
                           <TableHead className="text-[9px] uppercase font-bold text-muted-foreground p-2 pl-1">Gefundene Bezeichnung</TableHead>
                           <TableHead className="text-[9px] uppercase font-bold text-muted-foreground w-32 p-2">Neue Art.-Nr.</TableHead>
                           <TableHead className="text-[9px] uppercase font-bold text-muted-foreground w-24 p-2">Einheit</TableHead>
                           <TableHead className="text-[9px] uppercase font-bold text-muted-foreground w-10 p-2"></TableHead>
                         </TableRow>
                       </TableHeader>
                       <TableBody>
                         {category.articles.map((article: any, artIdx: number) => {
                           const originalArticle = articles.find(a => a.id === article.matchedArticleId);
                           return (
                             <TableRow key={`${article.id}-${catIdx}-${artIdx}`} className="border-border hover:bg-muted/50 transition-colors group">
                               <TableCell className="p-1.5 pl-3 w-8 text-center align-middle">
                                 <Checkbox 
                                   checked={selectedArticles.has(`${catIdx}-${artIdx}`)} 
                                   onCheckedChange={() => toggleArticleSelection(catIdx, artIdx)}
                                   className="border-primary/50 data-[state=checked]:bg-primary"
                                 />
                               </TableCell>
                               <TableCell className="p-1.5">
                                 <Select value={article.matchedArticleId || 'none'} onValueChange={(val) => handleUpdateItem(catIdx, artIdx, 'matchedArticleId', val === 'none' ? '' : val)}>
                                   <SelectTrigger className="w-full bg-background/50 border border-border h-8 px-2 rounded-md text-xs text-foreground focus:border-primary/50 outline-none transition-all">
                                     <SelectValue placeholder="Nicht zugeordnet">
                                       {originalArticle ? <span className="font-semibold text-emerald-500">{originalArticle.name}</span> : <span className="text-red-400">Keine Zuordnung</span>}
                                     </SelectValue>
                                   </SelectTrigger>
                                   <SelectContent className="bg-card border-border text-foreground max-w-sm max-h-60">
                                     <SelectItem value="none" className="text-muted-foreground">Ignorieren</SelectItem>
                                     {availableArticles.map((a, idx) => (
                                       <SelectItem key={`${a.id}-${idx}`} value={a.id}>{a.name} <span className="text-muted-foreground ml-2">{a.articleNumber}</span></SelectItem>
                                     ))}
                                   </SelectContent>
                                 </Select>
                               </TableCell>
                               <TableCell className="p-1.5 pl-1">
                                 <input 
                                   ref={el => { if (el) inputRefs.current[`${catIdx}-${artIdx}-name`] = el; }}
                                   value={article.name || ''}
                                   onChange={(e) => handleUpdateItem(catIdx, artIdx, 'name', e.target.value, e.target.selectionStart || 0)}
                                   className="w-full bg-background/50 border border-border h-8 px-2 rounded-md text-xs text-foreground focus:border-primary/50 outline-none transition-all"
                                 />
                               </TableCell>
                               <TableCell className="p-1.5">
                                 <input 
                                   ref={el => { if (el) inputRefs.current[`${catIdx}-${artIdx}-articleNumber`] = el; }}
                                   value={article.articleNumber || ''}
                                   onChange={(e) => handleUpdateItem(catIdx, artIdx, 'articleNumber', e.target.value, e.target.selectionStart || 0)}
                                   className="w-full bg-background/50 border border-border h-8 px-2 rounded-md text-xs font-mono text-primary focus:border-primary/50 outline-none transition-all"
                                 />
                               </TableCell>
                               <TableCell className="p-1.5">
                                 <input 
                                   ref={el => { if (el) inputRefs.current[`${catIdx}-${artIdx}-unit`] = el; }}
                                   value={article.unit || ''}
                                   onChange={(e) => handleUpdateItem(catIdx, artIdx, 'unit', e.target.value, e.target.selectionStart || 0)}
                                   className="w-full bg-background/50 border border-border h-8 px-2 rounded-md text-xs text-muted-foreground focus:border-primary/50 outline-none transition-all"
                                 />
                               </TableCell>
                               <TableCell className="p-1 text-center">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => handleDeleteArticle(catIdx, artIdx)}
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all rounded-lg"
                                  >
                                    <Trash2 size={12} />
                                  </Button>
                               </TableCell>
                             </TableRow>
                           );
                         })}
                       </TableBody>
                     </Table>
                   ) : (
                     <Table>
                       <TableHeader className="bg-muted/20">
                         <TableRow className="border-border">
                           <TableHead className="text-[9px] uppercase font-bold text-muted-foreground p-2 pl-3 w-8"></TableHead>
                           <TableHead className="text-[9px] uppercase font-bold text-muted-foreground p-2 pl-1">Bezeichnung</TableHead>
                           <TableHead className="text-[9px] uppercase font-bold text-muted-foreground w-32 p-2">Art-Nr.</TableHead>
                           <TableHead className="text-[9px] uppercase font-bold text-muted-foreground w-24 p-2">Einheit</TableHead>
                           <TableHead className="text-[9px] uppercase font-bold text-muted-foreground w-10 p-2"></TableHead>
                         </TableRow>
                       </TableHeader>
                       <TableBody>
                         {category.articles.map((article: any, artIdx: number) => (
                           <TableRow key={`${article.id}-${catIdx}-${artIdx}`} className="border-border hover:bg-muted/50 transition-colors group">
                             <TableCell className="p-1.5 pl-3 w-8 text-center align-middle">
                               <Checkbox 
                                 checked={selectedArticles.has(`${catIdx}-${artIdx}`)} 
                                 onCheckedChange={() => toggleArticleSelection(catIdx, artIdx)}
                                 className="border-primary/50 data-[state=checked]:bg-primary"
                               />
                             </TableCell>
                             <TableCell className="p-1.5 pl-1">
                               <input 
                                 ref={el => { if (el) inputRefs.current[`${catIdx}-${artIdx}-name`] = el; }}
                                 value={article.name || ''}
                                 onChange={(e) => handleUpdateItem(catIdx, artIdx, 'name', e.target.value, e.target.selectionStart || 0)}
                                 className="w-full bg-background/50 border border-border h-8 px-2 rounded-md text-xs text-foreground focus:border-primary/50 outline-none transition-all"
                               />
                             </TableCell>
                             <TableCell className="p-1.5">
                               <input 
                                 ref={el => { if (el) inputRefs.current[`${catIdx}-${artIdx}-articleNumber`] = el; }}
                                 value={article.articleNumber || ''}
                                 onChange={(e) => handleUpdateItem(catIdx, artIdx, 'articleNumber', e.target.value, e.target.selectionStart || 0)}
                                 className="w-full bg-background/50 border border-border h-8 px-2 rounded-md text-xs font-mono text-primary focus:border-primary/50 outline-none transition-all"
                               />
                             </TableCell>
                             <TableCell className="p-1.5">
                               <input 
                                 ref={el => { if (el) inputRefs.current[`${catIdx}-${artIdx}-unit`] = el; }}
                                 value={article.unit || ''}
                                 onChange={(e) => handleUpdateItem(catIdx, artIdx, 'unit', e.target.value, e.target.selectionStart || 0)}
                                 className="w-full bg-background/50 border border-border h-8 px-2 rounded-md text-xs text-muted-foreground focus:border-primary/50 outline-none transition-all"
                               />
                             </TableCell>
                             <TableCell className="p-1 text-center">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => handleDeleteArticle(catIdx, artIdx)}
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all rounded-lg"
                                >
                                  <Trash2 size={12} />
                                </Button>
                             </TableCell>
                           </TableRow>
                         ))}
                       </TableBody>
                     </Table>
                   )}
                </div>
              )}            </div>
          ))}
        </div>
      </div>
    </ResizableSidePanel>

    {/* Import Mode Choice Dialog */}
    <AlertDialog open={showImportModeDialog} onOpenChange={setShowImportModeDialog}>
      <AlertDialogContent className="bg-card text-card-foreground border-border shadow-sm rounded-xl max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-bold text-center">Artikel importieren</AlertDialogTitle>
          <p className="text-muted-foreground text-sm text-center mt-2">
            Zielkategorie: <span className="text-primary font-semibold">"{categories.find(c => c.id === targetCategoryId)?.name}"</span>
            <br />
            {hasExistingArticles ? "Diese Kategorie enthält bereits Artikel. Wie möchtest du importieren?" : "Wie möchtest du die KI-Gruppen importieren?"}
          </p>
        </AlertDialogHeader>
        <div className="space-y-3 py-4">
          {hasExistingArticles && (
            <Button
              onClick={() => executeImport('replace_all')}
              className="w-full h-14 bg-destructive/10 hover:bg-destructive/20 border border-destructive/30 text-destructive rounded-xl flex items-center justify-start gap-3 px-4"
            >
              <Trash2 size={20} />
              <div className="text-left">
                <p className="font-bold text-sm">Gesamte Artikelliste erneuern</p>
                <p className="text-[10px] text-destructive/80">Bestehende Artikel werden gelöscht und durch neue ersetzt</p>
              </div>
            </Button>
          )}
          <Button
            onClick={() => executeImport('add_to_existing')}
            className="w-full h-14 bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary rounded-xl flex items-center justify-start gap-3 px-4"
          >
            <ListPlus size={20} />
            <div className="text-left">
              <p className="font-bold text-sm">Direkt in die Kategorie einfügen</p>
              <p className="text-[10px] text-primary/80">Artikel werden eingefügt, KI-Gruppen werden ignoriert (flach)</p>
            </div>
          </Button>
          <Button
            onClick={() => executeImport('create_new')}
            className="w-full h-14 bg-muted/50 hover:bg-muted border border-border text-foreground rounded-xl flex items-center justify-start gap-3 px-4"
          >
            <FolderPlus size={20} />
            <div className="text-left">
              <p className="font-bold text-sm">Neue Unterkategorien erstellen</p>
              <p className="text-[10px] text-muted-foreground">KI-Gruppen werden als neue Unterkategorien angelegt</p>
            </div>
          </Button>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel className="w-full bg-muted border-border text-muted-foreground rounded-xl h-10 hover:bg-muted/80">Abbrechen</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
};

export default ImportReviewDialog;