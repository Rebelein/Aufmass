import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Upload, FileUp, Save, FileStack, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Supplier } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { Progress } from '@/components/ui/progress';

interface DatanormImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  suppliers: Supplier[];
  onImportComplete: () => void;
}

interface FileProgress {
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
}

export function DatanormImportDialog({
  isOpen,
  onClose,
  suppliers,
  onImportComplete
}: DatanormImportDialogProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [fileStatuses, setFileStatuses] = useState<FileProgress[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [supplierId, setSupplierId] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setFiles(selectedFiles);
      setFileStatuses(selectedFiles.map(f => ({ name: f.name, status: 'pending', progress: 0 })));
    }
  };

  const processFile = async (file: File, index: number) => {
    setFileStatuses(prev => {
      const next = [...prev];
      next[index].status = 'processing';
      return next;
    });

    try {
      const text = await file.text();
      const lines = text.trim().replace(/\r/g, '').split('\n');
      if (lines.length < 2) return;

      // Header extrahieren (Erste Zeile)
      const headerLine = lines.shift()!;
      const headers = headerLine.toLowerCase().split(';').map(h => h.trim().replace(/"/g, ''));

      // Mapping basierend auf Spalten-Indizes
      const colMap = {
        name: headers.indexOf('name'),
        num: headers.findIndex(h => h.includes('artikel')),
        unit: headers.indexOf('einheit')
      };

      const CHUNK_SIZE = 1000;
      const totalLines = lines.length;

      for (let i = 0; i < totalLines; i += CHUNK_SIZE) {
        const chunk = lines.slice(i, i + CHUNK_SIZE);
        const inserts = chunk.map(line => {
          const values = line.split(';').map(v => v.trim().replace(/"/g, ''));
          return {
            name: values[colMap.name] || 'Unbekannt',
            article_number: values[colMap.num] || '',
            unit: values[colMap.unit] || 'Stück',
            source: 'wholesale',
            supplier_id: supplierId,
            order: 0
          };
        }).filter(item => item.article_number);

        if (inserts.length > 0) {
          const { error } = await supabase.from('articles').insert(inserts);
          if (error) throw error;
        }

        // Update Progress für diese Datei
        const currentProgress = Math.round(((i + chunk.length) / totalLines) * 100);
        setFileStatuses(prev => {
          const next = [...prev];
          next[index].progress = currentProgress;
          return next;
        });
      }

      setFileStatuses(prev => {
        const next = [...prev];
        next[index].status = 'completed';
        next[index].progress = 100;
        return next;
      });

    } catch (err) {
      console.error(`Fehler bei Datei ${file.name}:`, err);
      setFileStatuses(prev => {
        const next = [...prev];
        next[index].status = 'error';
        return next;
      });
      throw err;
    }
  };

  const startImport = async () => {
    if (!supplierId) {
      toast({ title: "Großhändler fehlt", description: "Bitte wähle erst einen Großhändler aus.", variant: "destructive" });
      return;
    }

    setIsImporting(true);
    try {
      // Dateien nacheinander verarbeiten
      for (let i = 0; i < files.length; i++) {
        await processFile(files[i], i);
      }
      toast({ title: "Import abgeschlossen", description: "Alle Datanorm-Dateien wurden verarbeitet." });
      onImportComplete();
    } catch (error) {
      toast({ title: "Import teilweise fehlgeschlagen", description: "Prüfe die Dateiliste auf Fehler.", variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isImporting && !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-background">
        <DialogHeader className="p-6 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <FileStack className="text-amber-500" />
            Datanorm Massen-Import (Supabase)
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Diese Funktion importiert alle Artikel direkt in den Datanorm-Suchkatalog.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Großhändler Auswahl */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">1. Großhändler auswählen</Label>
            <Select value={supplierId} onValueChange={setSupplierId} disabled={isImporting}>
              <SelectTrigger className="h-12 bg-card">
                <SelectValue placeholder="Wähle den Absender der Datanorm..." />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Datei Auswahl */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">2. CSV Teilstücke hochladen</Label>
            <div 
              onClick={() => !isImporting && fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer hover:bg-muted/30",
                files.length > 0 ? "border-amber-500/50 bg-amber-500/5" : "border-border bg-card",
                isImporting && "opacity-50 cursor-not-allowed"
              )}
            >
              <FileUp className={cn("w-10 h-10", files.length > 0 ? "text-amber-500" : "text-muted-foreground")} />
              <div className="text-center">
                <p className="text-sm font-semibold">{files.length > 0 ? `${files.length} Dateien ausgewählt` : "Datanorm-Parts auswählen"}</p>
                <p className="text-xs text-muted-foreground mt-1">Alle CSV-Dateien des Großhändlers gleichzeitig möglich</p>
              </div>
              <input type="file" ref={fileInputRef} multiple accept=".csv" className="hidden" onChange={handleFileChange} />
            </div>
          </div>

          {/* Dateiliste mit Fortschritt */}
          {fileStatuses.length > 0 && (
            <div className="space-y-3 bg-muted/20 p-4 rounded-xl border border-border">
              <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Import-Status</p>
              {fileStatuses.map((status, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium truncate max-w-[200px]">{status.name}</span>
                    <div className="flex items-center gap-2">
                      {status.status === 'processing' && <Loader2 className="w-3 h-3 animate-spin text-amber-500" />}
                      {status.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                      {status.status === 'error' && <AlertCircle className="w-3 h-3 text-red-500" />}
                      <span className={cn(
                        "font-bold",
                        status.status === 'completed' ? "text-emerald-500" : "text-amber-500"
                      )}>{status.progress}%</span>
                    </div>
                  </div>
                  <Progress value={status.progress} className="h-1.5" />
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="p-6 border-t border-border bg-muted/10">
          <Button variant="ghost" onClick={onClose} disabled={isImporting}>
            Abbrechen
          </Button>
          <Button 
            className="bg-amber-500 hover:bg-amber-600 text-black font-bold min-w-[200px]"
            disabled={files.length === 0 || isImporting || !supplierId}
            onClick={startImport}
          >
            {isImporting ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <Save className="mr-2 h-5 w-5" />}
            {isImporting ? 'Import läuft...' : 'Import jetzt starten'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
