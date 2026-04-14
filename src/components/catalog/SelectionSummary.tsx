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
  X
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

  return (
    <div className="glass-card flex flex-col h-full border-white/10 shadow-2xl overflow-hidden bg-gray-900/20 backdrop-blur-2xl">
      <CardHeader className="p-6 pb-4 border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center justify-between">
            <div className="space-y-1">
                <CardTitle className="text-xl font-bold text-gradient flex items-center gap-2">
                    <Settings2 size={20} className="text-emerald-400" /> Aufmaß-Details
                </CardTitle>
                <CardDescription className="text-white/40 text-xs font-medium uppercase tracking-wider">
                    {articleCount} Positionen erfasst
                </CardDescription>
            </div>
            {selectedItems.length > 0 && (
                <button 
                    onClick={onClearSelection}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-white/50 hover:text-red-400 transition-all"
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
                <PackagePlus size={32} className="text-white/40" />
                <p className="text-white/50 text-sm font-medium">Noch keine Einträge im Aufmaß.</p>
            </div>
          ) : (
            selectedItems.map((item, index) => (
              <div 
                key={item.id} 
                className={cn(
                    "group relative p-3 rounded-xl border transition-all duration-300",
                    item.type === 'section' 
                        ? "bg-white/5 border-white/10" 
                        : "bg-emerald-500/[0.03] border-emerald-500/10 hover:border-emerald-500/30"
                )}
              >
                <div className="flex items-start gap-3">
                    <div className="mt-1 text-[10px] font-bold text-white/50 shrink-0 w-4">
                        {index + 1}
                    </div>
                    
                    <div className="flex-grow min-w-0">
                        {item.type === 'section' ? (
                            <input 
                                value={item.text}
                                onChange={(e) => onUpdateSectionText(item.id, e.target.value)}
                                className="bg-transparent border-none text-emerald-300 font-bold text-sm w-full focus:outline-none focus:text-emerald-200"
                                placeholder="Überschrift eingeben..."
                            />
                        ) : (
                            <div className="space-y-1">
                                <p className="text-sm font-bold text-white truncate leading-tight">
                                    {item.article?.name}
                                </p>
                                <div className="flex items-center gap-2 text-[10px] text-white/40 font-medium">
                                    <Badge variant="outline" className="text-[9px] py-0 h-4 border-white/10 bg-white/5 font-mono">
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
                                <button onClick={() => onUpdateSelectedItemQuantity(item.id, (item.quantity || 0) + 1)} className="p-1 hover:text-emerald-400 text-white/50 transition-colors"><ChevronUp size={12}/></button>
                                <button onClick={() => onUpdateSelectedItemQuantity(item.id, (item.quantity || 0) - 1)} className="p-1 hover:text-emerald-400 text-white/50 transition-colors"><ChevronDown size={12}/></button>
                            </div>
                        )}
                        <button 
                            onClick={() => onDeleteItem(item.id)}
                            className="p-1.5 rounded-md hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-all"
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
        <div className="p-6 bg-white/[0.03] border-t border-white/5 space-y-4">
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
                        className="glass-input h-10 py-0 text-sm"
                        placeholder="Name der Sektion..."
                    />
                    <Button onClick={() => { onAddSection(newSectionText); setNewSectionText(''); setIsAddingSection(false); }} className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-10">OK</Button>
                </div>
            ) : (
                <Button 
                    variant="outline" 
                    onClick={() => setIsAddingSection(true)}
                    className="w-full border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-xl h-12 gap-2 font-bold transition-all"
                >
                    <PlusCircle size={18} className="text-emerald-400" /> Sektion hinzufügen
                </Button>
            )}

            <Button 
                onClick={onGeneratePdf}
                disabled={articleCount === 0 || isGeneratingPdf}
                className="w-full btn-primary h-14 rounded-2xl shadow-emerald-900/20 gap-3 text-lg font-bold"
            >
                {isGeneratingPdf ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/20 border-t-white"></div>
                ) : (
                    <>
                        <FileDown size={22} />
                        PDF Exportieren
                    </>
                )}
            </Button>
        </div>
      </CardContent>
    </div>
  );
};

export default SelectionSummary;
