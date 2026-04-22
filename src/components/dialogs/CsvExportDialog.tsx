import React, { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Download, Archive, FileText } from 'lucide-react';
import type { ProcessedSummaryItem } from '@/lib/types';
import { generateCsvForSupplier, downloadCsv, getSupplierName } from '@/lib/csv-export';
import JSZip from 'jszip';
import { useToast } from '@/hooks/use-toast';

interface CsvExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectItems: ProcessedSummaryItem[];
  projectName: string;
}

export const CsvExportDialog: React.FC<CsvExportDialogProps> = ({
  isOpen,
  onClose,
  projectItems,
  projectName,
}) => {
  const { toast } = useToast();

  const suppliers = useMemo(() => {
    const articleItems = projectItems.filter((item) => item.type === 'article');
    const uniqueSuppliers = new Set<string>();
    
    articleItems.forEach((item) => {
      uniqueSuppliers.add(getSupplierName(item));
    });
    
    return Array.from(uniqueSuppliers).sort();
  }, [projectItems]);

  const getDateString = () => {
    return new Date().toISOString().split('T')[0];
  };

  const handleDownloadSingle = (supplier: string) => {
    const items = projectItems.filter(
      (item) => item.type === 'article' && getSupplierName(item) === supplier
    );
    const csvContent = generateCsvForSupplier(supplier, items);
    const filename = `${projectName}_${supplier}_${getDateString()}.csv`;
    downloadCsv(csvContent, filename);
    toast({ title: 'CSV heruntergeladen', description: filename });
  };

  const handleDownloadAllSeparately = () => {
    suppliers.forEach((supplier) => {
      handleDownloadSingle(supplier);
    });
  };

  const handleDownloadZip = async () => {
    const zip = new JSZip();
    const dateStr = getDateString();

    suppliers.forEach((supplier) => {
      const items = projectItems.filter(
        (item) => item.type === 'article' && getSupplierName(item) === supplier
      );
      const csvContent = generateCsvForSupplier(supplier, items);
      const filename = `${projectName}_${supplier}_${dateStr}.csv`;
      // UTF-8 BOM for Excel
      zip.file(filename, "\ufeff" + csvContent);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const zipFilename = `${projectName}_CSV_Export_${dateStr}.zip`;
    
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = zipFilename;
    link.click();
    URL.revokeObjectURL(url);
    
    toast({ title: 'ZIP-Archiv erstellt', description: zipFilename });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-card text-card-foreground border-border shadow-sm rounded-xl border border-border bg-background sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground text-xl font-bold flex items-center gap-2">
            <FileSpreadsheet size={22} className="text-emerald-400" /> CSV Export
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p className="text-muted-foreground text-sm">
            Wählen Sie ein Format für den Export der Artikel aus.
          </p>
          
          <div className="space-y-2">
            <Button
              onClick={handleDownloadZip}
              className="w-full justify-start gap-3 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm rounded-md h-12"
              disabled={suppliers.length === 0}
            >
              <Archive size={18} className="text-emerald-400" />
              <span>Als ZIP herunterladen (Alle Lieferanten)</span>
            </Button>
            
            <Button
              onClick={handleDownloadAllSeparately}
              variant="outline"
              className="w-full justify-start gap-3 border-border bg-muted text-foreground hover:bg-muted h-12"
              disabled={suppliers.length <= 1}
            >
              <Download size={18} className="text-emerald-400" />
              <span>Alle separat herunterladen</span>
            </Button>
          </div>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Einzelne Lieferanten</span>
            </div>
          </div>
          
          <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {suppliers.map((supplier) => (
              <Button
                key={supplier}
                onClick={() => handleDownloadSingle(supplier)}
                variant="ghost"
                className="w-full justify-start gap-3 text-muted-foreground hover:text-accent-foreground hover:bg-emerald-500/10 h-11 px-3 border border-transparent hover:border-emerald-500/20"
              >
                <FileText size={16} className="text-emerald-400/70" />
                <span className="truncate">Download {supplier} CSV</span>
              </Button>
            ))}
            {suppliers.length === 0 && (
              <p className="text-center py-4 text-muted-foreground text-sm">Keine Artikel gefunden</p>
            )}
          </div>
        </div>
        
        <DialogFooter>
          <Button onClick={onClose} variant="ghost" className="text-muted-foreground">
            Schließen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
