import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sparkles, ChevronDown, Loader2, Save, Check, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Category, Supplier } from '@/lib/data';
import type { ImportDraft } from '@/lib/import-storage';

interface ImportReviewDialogProps {
  draft: ImportDraft | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveDraft: (id: string, data: any, supplierId: string | null) => Promise<void>;
  onConfirmImport: (id: string, data: any, targetCategoryId: string | null, supplierId: string | null) => Promise<void>;
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
  defaultTargetCategoryId = 'root'
}) => {
  const [localData, setLocalData] = useState<any[]>([]);
  const [isSyncEditing, setIsSyncEditing] = useState(true);
  const [targetCategoryId, setTargetCategoryId] = useState<string>(defaultTargetCategoryId || 'root');
  const [supplierId, setSupplierId] = useState<string>('none');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<number>>(new Set());
  const [cursorInfo, setCursorInfo] = useState<{ catIdx: number, artIdx: number, pos: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const inputRefs = useRef<Record<string, HTMLInputElement>>({});

  useEffect(() => {
    if (draft && isOpen) {
      setLocalData(JSON.parse(JSON.stringify(draft.extracted_data)));
      setTargetCategoryId(defaultTargetCategoryId || 'root');
      setSupplierId(draft.default_supplier_id || 'none');
    }
  }, [draft, isOpen, defaultTargetCategoryId]);

  // Cursor-Sicherung
  React.useLayoutEffect(() => {
    if (cursorInfo) {
      const key = `${cursorInfo.catIdx}-${cursorInfo.artIdx}`;
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

    if (field === 'name' && isSyncEditing && pos !== undefined) {
      const delta = value.length - article.name.length;
      const oldSuffixStart = pos - delta;
      
      category.articles = category.articles.map((art: any) => {
        const suffix = art.name.substring(Math.max(0, oldSuffixStart));
        const newPrefix = value.substring(0, pos);
        return { ...art, name: newPrefix + suffix };
      });
      setCursorInfo({ catIdx, artIdx, pos });
    } else {
      article[field] = value;
      if (field === 'name' && pos !== undefined) {
        setCursorInfo({ catIdx, artIdx, pos });
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

  const handleConfirm = async () => {
    setIsImporting(true);
    const finalTargetId = targetCategoryId === 'root' ? null : targetCategoryId;
    const finalSupplierId = supplierId === 'none' ? null : supplierId;
    await onConfirmImport(draft.id, localData, finalTargetId, finalSupplierId);
    setIsImporting(false);
    onClose();
  };

  const toggleCategory = (idx: number) => {
    const next = new Set(collapsedCategories);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    setCollapsedCategories(next);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-5xl glass-card bg-gray-900/95 border-white/10 text-white p-0 overflow-hidden h-[90vh] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        <DialogHeader className="p-6 border-b border-white/5 bg-white/[0.02] shrink-0">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Sparkles size={24} />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">KI-Import prüfen</DialogTitle>
                <p className="text-white/40 text-xs">{draft.file_name}</p>
              </div>
            </div>
            <div className="flex gap-2">
               <Button 
                variant="ghost" 
                onClick={handleSave} 
                disabled={isSaving}
                className="text-emerald-400 hover:bg-emerald-500/10 h-11 px-4"
               >
                 {isSaving ? <Loader2 className="animate-spin mr-2" size={18} /> : <Save className="mr-2" size={18} />}
                 Sichern
               </Button>
               <Button 
                onClick={handleConfirm} 
                disabled={isImporting}
                className="btn-primary h-11 px-6 font-bold"
               >
                 {isImporting ? <Loader2 className="animate-spin mr-2" size={18} /> : <Check className="mr-2" size={18} />}
                 Import abschließen
               </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6 flex-1 overflow-hidden flex flex-col">
          {/* Settings Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white/5 p-4 rounded-2xl border border-white/10 shrink-0">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase text-white/30 font-bold ml-1">Ziel-Kategorie</Label>
              <Select value={targetCategoryId} onValueChange={setTargetCategoryId}>
                <SelectTrigger className="glass-input h-10">
                  <SelectValue placeholder="Wählen..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10 text-white max-h-[300px]">
                  <SelectItem value="root">Hauptverzeichnis (Root)</SelectItem>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase text-white/30 font-bold ml-1">Standard Großhändler</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="glass-input h-10">
                  <SelectValue placeholder="Wählen..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10 text-white">
                  <SelectItem value="none">Keiner</SelectItem>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Checkbox 
                id="review-sync-edit" 
                checked={isSyncEditing} 
                onCheckedChange={(checked) => setIsSyncEditing(checked as boolean)} 
                className="border-emerald-500/50 data-[state=checked]:bg-emerald-500"
              />
              <Label htmlFor="review-sync-edit" className="text-sm font-medium text-white/70 cursor-pointer">Synchrones Bearbeiten</Label>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden border border-white/5 rounded-2xl bg-white/[0.01]">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-6">
                {localData.map((category: any, catIdx: number) => (
                  <div key={catIdx} className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
                    <div 
                      className="p-4 bg-white/5 flex items-center justify-between cursor-pointer hover:bg-white/[0.08] transition-colors"
                      onClick={() => toggleCategory(catIdx)}
                    >
                      <div className="flex items-center gap-3 flex-1">
                         <ChevronDown className={cn("text-white/30 transition-transform", collapsedCategories.has(catIdx) && "-rotate-90")} />
                         <input 
                           value={category.categoryName} 
                           onChange={(e) => {
                             const next = [...localData];
                             next[catIdx] = { ...next[catIdx], categoryName: e.target.value };
                             setLocalData(next);
                           }}
                           onClick={(e) => e.stopPropagation()}
                           className="bg-transparent border-none text-lg font-bold p-0 h-auto focus:ring-0 outline-none text-white w-full hover:bg-white/5 rounded px-2 -ml-2 transition-colors"
                         />
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-white/10">{category.articles.length} Artikel</Badge>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={(e) => handleDeleteCategory(catIdx, e)}
                          className="h-8 w-8 text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                    
                    {!collapsedCategories.has(catIdx) && (
                      <div className="overflow-x-auto">
                         <Table>
                           <TableHeader className="bg-white/[0.02]">
                             <TableRow className="border-white/5">
                               <TableHead className="text-[10px] uppercase font-bold text-white/30 p-4">Bezeichnung</TableHead>
                               <TableHead className="text-[10px] uppercase font-bold text-white/30 w-40 p-4">Art-Nr.</TableHead>
                               <TableHead className="text-[10px] uppercase font-bold text-white/30 w-28 p-4">Einheit</TableHead>
                               <TableHead className="text-[10px] uppercase font-bold text-white/30 w-16 p-4 text-center">Aktion</TableHead>
                             </TableRow>
                           </TableHeader>
                           <TableBody>
                             {category.articles.map((article: any, artIdx: number) => {
                               const inputKey = `${catIdx}-${artIdx}`;
                               return (
                                 <TableRow key={article.id || artIdx} className="border-white/5 hover:bg-white/[0.02] transition-colors group">
                                   <TableCell className="p-2">
                                     <input 
                                       ref={el => { if (el) inputRefs.current[inputKey] = el; }}
                                       value={article.name}
                                       onChange={(e) => handleUpdateItem(catIdx, artIdx, 'name', e.target.value, e.target.selectionStart || 0)}
                                       className="w-full bg-white/5 border border-white/10 h-10 px-3 rounded-lg text-sm text-white focus:border-emerald-500/50 outline-none transition-all"
                                     />
                                   </TableCell>
                                   <TableCell className="p-2">
                                     <input 
                                       value={article.articleNumber}
                                       onChange={(e) => handleUpdateItem(catIdx, artIdx, 'articleNumber', e.target.value)}
                                       className="w-full bg-white/5 border border-white/10 h-10 px-3 rounded-lg text-sm font-mono text-emerald-400 focus:border-emerald-500/50 outline-none transition-all"
                                     />
                                   </TableCell>
                                   <TableCell className="p-2">
                                     <input 
                                       value={article.unit}
                                       onChange={(e) => handleUpdateItem(catIdx, artIdx, 'unit', e.target.value)}
                                       className="w-full bg-white/5 border border-white/10 h-10 px-3 rounded-lg text-sm text-white/70 focus:border-emerald-500/50 outline-none transition-all"
                                     />
                                   </TableCell>
                                   <TableCell className="p-2 text-center">
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={() => handleDeleteArticle(catIdx, artIdx)}
                                        className="h-8 w-8 text-white/10 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all rounded-lg"
                                      >
                                        <Trash2 size={14} />
                                      </Button>
                                   </TableCell>
                                 </TableRow>
                               );
                             })}
                           </TableBody>
                         </Table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImportReviewDialog;
