import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, FileText, FileSpreadsheet, Check, AlertCircle, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { findWholesaleArticleByNumber } from '@/lib/catalog-storage';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from '@/components/ui/progress';
import type { Article } from '@/lib/data';
import * as pdfjs from 'pdfjs-dist';
import Tesseract from 'tesseract.js';

// Setup PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface ProjectImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImportItems: (items: { article: Article, quantity: number }[]) => void;
}

interface FoundItem {
  articleNumber: string;
  name: string;
  article?: Article;
  status: 'searching' | 'found' | 'not_found';
}

export function ProjectImportDialog({ isOpen, onClose, onImportItems }: ProjectImportDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [foundItems, setFoundItems] = useState<FoundItem[]>([]);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processPdf = async (file: File) => {
    setIsProcessing(true);
    setProgress(10);
    setFoundItems([]);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument(arrayBuffer).promise;
      const numPages = pdf.numPages;
      let fullText = "";

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context!, viewport }).promise;
        const imageData = canvas.toDataURL('image/png');
        
        const { data: { text } } = await Tesseract.recognize(imageData, 'deu', {
          logger: m => {
            if (m.status === 'recognizing text') {
              setProgress(10 + (m.progress * (80 / numPages)) + ((i - 1) * (80 / numPages)));
            }
          }
        });
        fullText += text + "\n";
      }

      // Regex to find potential article numbers (e.g., 6-10 digits, or specific patterns)
      // This is a simple example, might need adjustment based on real data
      const articleNumberRegex = /\b\d{6,12}\b/g;
      const potentialNumbers = Array.from(new Set(fullText.match(articleNumberRegex) || []));
      
      await lookupNumbers(potentialNumbers);
      
    } catch (error) {
      console.error(error);
      toast({ title: "Fehler beim PDF-OCR", variant: "destructive" });
    } finally {
      setIsProcessing(false);
      setProgress(100);
    }
  };

  const processCsv = async (file: File) => {
    setIsProcessing(true);
    setProgress(20);
    
    try {
      const text = await file.text();
      const lines = text.split('\n');
      const potentialNumbers = new Set<string>();
      
      lines.forEach(line => {
        const values = line.split(/[;,]/);
        values.forEach(v => {
          const clean = v.trim().replace(/"/g, '');
          if (/^\d{6,12}$/.test(clean)) {
            potentialNumbers.add(clean);
          }
        });
      });
      
      await lookupNumbers(Array.from(potentialNumbers));
    } catch (error) {
      toast({ title: "Fehler beim CSV-Import", variant: "destructive" });
    } finally {
      setIsProcessing(false);
      setProgress(100);
    }
  };

  const lookupNumbers = async (numbers: string[]) => {
    const results: FoundItem[] = numbers.map(n => ({ articleNumber: n, name: 'Suche...', status: 'searching' }));
    setFoundItems(results);

    const updatedResults = [...results];
    for (let i = 0; i < updatedResults.length; i++) {
      const art = await findWholesaleArticleByNumber(updatedResults[i].articleNumber);
      if (art) {
        updatedResults[i] = { ...updatedResults[i], name: art.name, article: art, status: 'found' };
      } else {
        updatedResults[i] = { ...updatedResults[i], name: 'Nicht in Datanorm', status: 'not_found' };
      }
      setFoundItems([...updatedResults]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type === 'application/pdf') processPdf(file);
    else if (file.name.endsWith('.csv')) processCsv(file);
    else toast({ title: "Dateityp nicht unterstützt", description: "Bitte PDF oder CSV wählen." });
  };

  const handleImport = () => {
    const toImport = foundItems
      .filter(item => item.status === 'found' && item.article)
      .map(item => ({ article: item.article!, quantity: 1 }));
    
    if (toImport.length === 0) {
      toast({ title: "Keine Artikel", description: "Es wurden keine gültigen Datanorm-Artikel zum Importieren gefunden." });
      return;
    }

    onImportItems(toImport);
    toast({ title: "Import erfolgreich", description: `${toImport.length} Artikel wurden dem Aufmaß hinzugefügt.` });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="text-amber-500" /> Aufmaß-Import (OCR & Datanorm)
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-4 py-4">
          <div className="flex justify-center p-8 border-2 border-dashed border-border rounded-2xl bg-muted/20">
            <div className="text-center space-y-4">
              <div className="flex justify-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500">
                  <FileText size={24} />
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <FileSpreadsheet size={24} />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium">PDF-LV oder CSV-Liste hochladen</p>
                <p className="text-xs text-muted-foreground mt-1">Artikelnummern werden automatisch mit der Datanorm abgeglichen.</p>
              </div>
              <Button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">
                {isProcessing ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Upload className="mr-2 h-4 w-4" />}
                Datei auswählen
              </Button>
              <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.csv" onChange={handleFileChange} />
            </div>
          </div>

          {isProcessing && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold uppercase text-amber-500">
                <span>Verarbeite Dokument...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" indicatorClassName="bg-amber-500" />
            </div>
          )}

          {foundItems.length > 0 && (
            <ScrollArea className="flex-1 border border-border rounded-xl bg-card">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-bold">Art-Nr.</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold">Datanorm Treffer</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {foundItems.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-xs">{item.articleNumber}</TableCell>
                      <TableCell className="text-xs font-medium truncate max-w-[250px]">{item.name}</TableCell>
                      <TableCell className="text-right">
                        {item.status === 'searching' && <Loader2 size={14} className="animate-spin ml-auto text-muted-foreground" />}
                        {item.status === 'found' && <Check size={14} className="ml-auto text-emerald-500" />}
                        {item.status === 'not_found' && <AlertCircle size={14} className="ml-auto text-red-400" />}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="border-t border-border pt-4">
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button 
            disabled={isProcessing || foundItems.filter(i => i.status === 'found').length === 0}
            onClick={handleImport}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold"
          >
            {foundItems.filter(i => i.status === 'found').length} Artikel hinzufügen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
