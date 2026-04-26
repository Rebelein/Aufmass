"use client";

import React, { useState } from 'react';
import type { Supplier } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { 
  PlusCircle, 
  FileDown, 
  Trash2, 
  GripVertical, 
  Type, 
  PackagePlus, 
  Settings2,
  ChevronDown,
  ChevronUp,
  X,
  Download,
  FileSpreadsheet
} from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription 
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from '@/lib/utils';
import type { ProcessedSummaryItem } from '@/lib/types';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { generateGCCsv, generateHeinzeCsv, downloadCsv } from '@/lib/csv-export';

interface SelectionSummaryProps {
  selectedItems: ProcessedSummaryItem[];
  onGeneratePdf: () => void;
  isGeneratingPdf: boolean;
  onClearSelection: () => void;
  onAddSection: (text: string) => void;
  onAddManualArticle: (data: { name: string; articleNumber: string; unit: string; quantity: string; supplierName?: string }) => void;
  onUpdateItemsOrder: (items: any[]) => void;
  onDeleteItem: (id: string) => void;
  onUpdateSectionText: (id: string, text: string) => void;
  onUpdateSelectedItemQuantity: (id: string, quantity: number) => void;
  onUpdateManualArticle: (id: string, data: { name: string; articleNumber: string; unit: string; supplierName?: string }) => void;
  suppliers: Supplier[];
}

const SelectionSummary: React.FC<SelectionSummaryProps> = ({
  selectedItems,
  onGeneratePdf,
  isGeneratingPdf,
  onClearSelection,
  onAddSection,
  onAddManualArticle,
  onDeleteItem,
  onUpdateSectionText,
  onUpdateSelectedItemQuantity,
}) => {
  const [newSectionText, setNewSectionText] = useState('');
  const [isAddingSection, setIsAddingSection] = useState(false);

  const articleCount = selectedItems.filter(i => i.type === 'article').length;

  const handleExport = (type: 'gc' | 'heinze') => {
    const dateStr = new Date().toISOString().split('T')[0];
    if (type === 'gc') {
      const csv = generateGCCsv(selectedItems);
      downloadCsv(csv, `bestellung_gc_${dateStr}.csv`);
    } else {
      const csv = generateHeinzeCsv(selectedItems);
      downloadCsv(csv, `bestellung_heinze_${dateStr}.csv`);
    }
  };

  return (
    <div className="bg-card text-card-foreground border-border shadow-sm rounded-xl flex flex-col h-full border overflow-hidden">
      <CardHeader className="p-6 pb-4 border-b border-border bg-muted/50">
        <div className="flex items-center justify-between">
            <div className="space-y-1">
                <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                    <Settings2 size={20} className="text-primary" /> Aufmaß-Details
                </CardTitle>
                <CardDescription className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                    {articleCount} Positionen erfasst
                </CardDescription>
            </div>
            {selectedItems.length > 0 && (
                <button 
                    onClick={onClearSelection}
                    className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                    title="Alles löschen"
                >
                    <Trash2 size={18} />
                </button>
            )}
        </div>
      </CardHeader>

      <CardContent className="flex-grow p-0 overflow-hidden flex flex-col">
        {/* Scrollable Items List */}
        <div className="flex-grow overflow-y-auto p-4 space-y-3 no-scrollbar max-h-[50vh]">
          {selectedItems.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-center space-y-3">
                <PackagePlus size={32} className="text-muted-foreground" />
                <p className="text-muted-foreground text-sm font-medium">Noch keine Einträge im Aufmaß.</p>
            </div>
          ) : (
            selectedItems.map((item, index) => (
              <div 
                key={item.id} 
                className={cn(
                    "group relative p-3 rounded-xl border transition-all duration-300",
                    item.type === 'section' 
                        ? "bg-muted/50 border-border" 
                        : "bg-primary/5 border-primary/10 hover:border-primary/30"
                )}
              >
                <div className="flex items-start gap-3">
                    <div className="mt-1 text-[10px] font-bold text-muted-foreground shrink-0 w-4">
                        {index + 1}
                    </div>
                    
                    <div className="flex-grow min-w-0">
                        {item.type === 'section' ? (
                            <input 
                                value={item.text}
                                onChange={(e) => onUpdateSectionText(item.id, e.target.value)}
                                className="bg-transparent border-none text-primary font-bold text-sm w-full focus:outline-none focus:text-primary/80"
                                placeholder="Überschrift eingeben..."
                            />
                        ) : (
                            <div className="space-y-1">
                                <p className="text-sm font-bold text-foreground leading-tight">
                                    {item.article?.name}
                                </p>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium">
                                    <Badge variant="outline" className="text-[9px] py-0 h-4 border-border bg-background font-mono">
                                        {item.article?.articleNumber}
                                    </Badge>
                                    <span>{item.quantity} {item.article?.unit}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                        {item.type === 'article' && (
                            <div className="flex flex-col gap-0.5">
                                <button onClick={() => onUpdateSelectedItemQuantity(item.id, (item.quantity || 0) + 1)} className="p-1 hover:text-primary text-muted-foreground transition-colors"><ChevronUp size={12}/></button>
                                <button onClick={() => onUpdateSelectedItemQuantity(item.id, (item.quantity || 0) - 1)} className="p-1 hover:text-primary text-muted-foreground transition-colors"><ChevronDown size={12}/></button>
                            </div>
                        )}
                        <button 
                            onClick={() => onDeleteItem(item.id)}
                            className="p-1.5 rounded-md hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Action Area */}
        <div className="p-6 bg-muted/30 border-t border-border space-y-4">
            {isAddingSection ? (
                <div className="flex gap-2 animate-in slide-in-from-bottom-2 duration-300">
                    <Input 
                        autoFocus
                        value={newSectionText}
                        onChange={(e) => setNewSectionText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') { onAddSection(newSectionText); setNewSectionText(''); setIsAddingSection(false); }
                            if (e.key === 'Escape') setIsAddingSection(false);
                        }}
                        className="bg-background border border-input text-foreground focus-visible:ring-1 focus-visible:ring-ring shadow-sm rounded-md h-10 py-0 text-sm"
                        placeholder="Name der Sektion..."
                    />
                    <Button onClick={() => { onAddSection(newSectionText); setNewSectionText(''); setIsAddingSection(false); }} className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl h-10">OK</Button>
                </div>
            ) : (
                <Button 
                    variant="outline" 
                    onClick={() => setIsAddingSection(true)}
                    className="w-full border-border bg-muted/50 hover:bg-muted text-foreground rounded-xl h-12 gap-2 font-bold transition-all"
                >
                    <PlusCircle size={18} className="text-primary" /> Sektion hinzufügen
                </Button>
            )}

            <div className="flex gap-2 w-full">
              <Button 
                  onClick={onGeneratePdf}
                  disabled={articleCount === 0 || isGeneratingPdf}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-14 rounded-2xl shadow-sm gap-3 text-lg font-bold flex-1"
              >
                  {isGeneratingPdf ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary-foreground/20 border-t-primary-foreground"></div>
                  ) : (
                      <>
                          <FileDown size={22} />
                          PDF Export
                      </>
                  )}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                      disabled={articleCount === 0}
                      variant="outline"
                      className="h-14 rounded-2xl border-border bg-muted/50 hover:bg-muted text-foreground font-bold px-4"
                  >
                      <Download size={22} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top" className="w-56 bg-card border-border text-card-foreground shadow-xl">
                  <DropdownMenuItem onClick={() => handleExport('gc')} className="hover:bg-muted cursor-pointer gap-3 py-3">
                      <FileSpreadsheet size={18} className="text-primary" />
                      <div className="flex flex-col">
                        <span className="font-medium">CSV (GC & Funk)</span>
                        <span className="text-[10px] text-muted-foreground">Mit Kopfzeile & ART-Präfix</span>
                      </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('heinze')} className="hover:bg-muted cursor-pointer gap-3 py-3">
                      <FileSpreadsheet size={18} className="text-primary" />
                      <div className="flex flex-col">
                        <span className="font-medium">UGS (Sanitär Heinze)</span>
                        <span className="text-[10px] text-muted-foreground">Format für den Import</span>
                      </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
        </div>
      </CardContent>
    </div>
  );
};

export default SelectionSummary;lectionSummary;