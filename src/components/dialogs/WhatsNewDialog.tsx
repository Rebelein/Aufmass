"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { whatsNewData, type WhatsNewEntry } from '@/lib/whats-new-data';

interface WhatsNewDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const WhatsNewDialog: React.FC<WhatsNewDialogProps> = ({ isOpen, onClose }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-headline">Was ist neu?</DialogTitle>
          <DialogDescription className="font-body">
            Eine Übersicht der letzten Änderungen und neuen Funktionen in Ihrer Anwendung.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] my-4 pr-4">
          <div className="space-y-6">
            {whatsNewData.map((entry: WhatsNewEntry) => (
              <div key={entry.version}>
                <div className="flex items-center gap-4 mb-2">
                  <Badge variant="secondary" className="text-base font-bold">{entry.version}</Badge>
                  <h3 className="text-lg font-headline font-semibold">{entry.title}</h3>
                </div>
                <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground font-body">
                  {entry.changes.map((change, index) => (
                    <li key={index}>{change}</li>
                  ))}
                </ul>
                <Separator className="mt-6" />
              </div>
            ))}
             <p className="text-center text-sm text-muted-foreground font-body">Ende der Übersicht.</p>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button onClick={onClose} variant="outline" className="font-body">Schließen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WhatsNewDialog;
