import React, { useState, useEffect } from 'react';
import { ResizableSidePanel } from '@/components/ui/ResizableSidePanel';
import { Button } from '@/components/ui/button';
import { getImportDrafts, deleteImportDraft } from '@/lib/import-storage';
import type { ImportDraft } from '@/lib/import-storage';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileText, Trash2, Edit3, CheckCircle, XCircle, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface ImportDraftsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDraft: (draft: ImportDraft) => void;
}

const ImportDraftsDialog: React.FC<ImportDraftsDialogProps> = ({ isOpen, onClose, onOpenDraft }) => {
  const [drafts, setDrafts] = useState<ImportDraft[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const loadDrafts = async () => {
    setIsLoading(true);
    const data = await getImportDrafts();
    setDrafts(data);
    setIsLoading(false);
  };

  useEffect(() => {
    if (!isOpen) return;

    // Initial load
    loadDrafts();

    // Poll every 3s while open to catch status changes
    const interval = setInterval(async () => {
      const data = await getImportDrafts();
      setDrafts(data);
    }, 3000);

    return () => clearInterval(interval);
  }, [isOpen]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await deleteImportDraft(id);
    if (success) {
      setDrafts(drafts.filter(d => d.id !== id));
      toast({ title: 'Entwurf gelöscht' });
    } else {
      toast({ title: 'Fehler beim Löschen', variant: 'destructive' });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processing': return <Loader2 className="animate-spin text-amber-400" size={20} />;
      case 'ready_for_review': return <CheckCircle className="text-emerald-400" size={20} />;
      case 'completed': return <CheckCircle className="text-blue-400" size={20} />;
      case 'failed': return <XCircle className="text-red-400" size={20} />;
      default: return <FileText size={20} />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'processing': return 'Wird verarbeitet...';
      case 'ready_for_review': return 'Bereit zur Prüfung';
      case 'completed': return 'Abgeschlossen';
      case 'failed': return 'Fehlgeschlagen';
      default: return status;
    }
  };

  return (
    <ResizableSidePanel
      isOpen={isOpen}
      onClose={onClose}
      storageKey="ki-drafts"
      defaultWidth={480}
      minWidth={360}
      maxWidth={700}
      title={
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">KI-Import Entwürfe</h2>
            <p className="text-muted-foreground text-xs">{drafts.length} Entwürfe</p>
          </div>
        </div>
      }
    >
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-emerald-400 w-8 h-8" />
          </div>
        ) : drafts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-4">
            <FileText size={48} className="opacity-20" />
            <p>Keine offenen Import-Entwürfe gefunden.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {drafts.map(draft => (
              <div 
                key={draft.id} 
                className="flex items-center justify-between p-4 rounded-xl bg-muted border border-border hover:bg-muted transition-colors cursor-pointer group"
                onClick={() => draft.status === 'ready_for_review' && onOpenDraft(draft)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    {getStatusIcon(draft.status)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-foreground text-sm truncate">{draft.file_name || 'Unbekannte Datei'}</h4>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                      <span>{format(new Date(draft.created_at), 'dd.MM.yyyy HH:mm', { locale: de })}</span>
                      <span className="w-1 h-1 rounded-full bg-muted/50" />
                      <span className={
                        draft.status === 'processing' ? 'text-amber-400' :
                        draft.status === 'ready_for_review' ? 'text-emerald-400' :
                        draft.status === 'failed' ? 'text-red-400' : ''
                      }>{getStatusText(draft.status)}</span>
                    </div>
                    {draft.error_message && (
                      <p className="text-[11px] text-red-400 mt-1 line-clamp-1">{draft.error_message}</p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                  {draft.status === 'ready_for_review' && (
                    <Button variant="ghost" size="icon" className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20 rounded-lg h-8 w-8">
                      <Edit3 size={16} />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={(e) => handleDelete(draft.id, e)} className="text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg h-8 w-8">
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ResizableSidePanel>
  );
};

export default ImportDraftsDialog;
