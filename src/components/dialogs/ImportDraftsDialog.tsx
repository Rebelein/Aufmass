import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getImportDrafts, deleteImportDraft } from '@/lib/import-storage';
import type { ImportDraft } from '@/lib/import-storage';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileText, Trash2, Edit3, CheckCircle, XCircle } from 'lucide-react';
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
    if (isOpen) {
      loadDrafts();
    }
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl glass-card bg-gray-900/95 border-white/10 text-white p-0 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        <DialogHeader className="p-6 border-b border-white/5 bg-white/[0.02]">
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <FileText className="text-emerald-400" /> KI-Import Entwürfe
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 h-[60vh]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="animate-spin text-emerald-400 w-8 h-8" />
            </div>
          ) : drafts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-white/50 space-y-4">
              <FileText size={48} className="opacity-20" />
              <p>Keine offenen Import-Entwürfe gefunden.</p>
            </div>
          ) : (
            <ScrollArea className="h-full pr-4">
              <div className="space-y-3">
                {drafts.map(draft => (
                  <div 
                    key={draft.id} 
                    className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer group"
                    onClick={() => draft.status === 'ready_for_review' && onOpenDraft(draft)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                        {getStatusIcon(draft.status)}
                      </div>
                      <div>
                        <h4 className="font-bold text-white/90">{draft.file_name || 'Unbekannte Datei'}</h4>
                        <div className="flex items-center gap-3 text-xs text-white/50 mt-1">
                          <span>{format(new Date(draft.created_at), 'dd.MM.yyyy HH:mm', { locale: de })}</span>
                          <span className="w-1 h-1 rounded-full bg-white/20" />
                          <span className={
                            draft.status === 'processing' ? 'text-amber-400' :
                            draft.status === 'ready_for_review' ? 'text-emerald-400' :
                            draft.status === 'failed' ? 'text-red-400' : ''
                          }>{getStatusText(draft.status)}</span>
                        </div>
                        {draft.error_message && (
                          <p className="text-xs text-red-400 mt-1 line-clamp-1">{draft.error_message}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                      {draft.status === 'ready_for_review' && (
                        <Button variant="ghost" size="icon" className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20 rounded-lg">
                          <Edit3 size={18} />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={(e) => handleDelete(draft.id, e)} className="text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg">
                        <Trash2 size={18} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImportDraftsDialog;
