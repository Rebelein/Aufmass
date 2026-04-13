"use client";

import React, { useState } from 'react';
import html2canvas from 'html2canvas';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Crop, Loader2, Send } from 'lucide-react';
import { addTicket } from '@/lib/ticket-storage';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import ScreenshotAreaSelector from './ScreenshotAreaSelector';

interface NewTicketDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

const NewTicketDialog: React.FC<NewTicketDialogProps> = ({ isOpen, onClose }) => {
    const [description, setDescription] = useState('');
    const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSelectingArea, setIsSelectingArea] = useState(false);
    const { toast } = useToast();

    const handleStartSelection = () => {
        setIsSelectingArea(true);
    };

    const handleSelectionComplete = async (area: { x: number; y: number; width: number; height: number } | null) => {
        setIsSelectingArea(false); // Hide overlay and return to dialog

        if (!area || area.width < 10 || area.height < 10) { // Ignore tiny selections or clicks
            return;
        }

        setIsCapturing(true);
        setScreenshotDataUrl(null); // Clear previous screenshot
        
        try {
            // Delay to allow the overlay to disappear from the DOM
            await new Promise(resolve => setTimeout(resolve, 50));
            
            const canvas = await html2canvas(document.documentElement, {
                useCORS: true,
                logging: false,
                onclone: (clonedDoc) => {
                    const dialogs = clonedDoc.querySelectorAll('[role="dialog"]');
                    dialogs.forEach(dialog => {
                        let parent = dialog.parentElement;
                        // Traverse up to find the radix portal container
                        while (parent && !parent.hasAttribute('data-radix-dialog-portal')) {
                            parent = parent.parentElement;
                        }
                        if (parent) {
                            (parent as HTMLElement).style.display = 'none';
                        }
                    });
                },
                x: area.x,
                y: area.y,
                width: area.width,
                height: area.height,
            });

            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            setScreenshotDataUrl(dataUrl);
            toast({ title: 'Screenshot erstellt', description: 'Sie können nun eine Beschreibung hinzufügen.' });
        } catch (error) {
            console.error("Error capturing screenshot:", error);
            toast({
                title: 'Screenshot fehlgeschlagen',
                description: 'Es konnte kein Screenshot erstellt werden.',
                variant: 'destructive',
            });
        } finally {
            setIsCapturing(false);
        }
    };
    
    const handleSubmit = async () => {
        if (!description.trim()) {
            toast({ title: 'Beschreibung fehlt', description: 'Bitte beschreiben Sie das Problem.', variant: 'destructive' });
            return;
        }
        if (!screenshotDataUrl) {
            toast({ title: 'Screenshot fehlt', description: 'Bitte erstellen Sie zuerst einen Screenshot.', variant: 'destructive' });
            return;
        }

        setIsSubmitting(true);
        try {
            await addTicket({
                description,
                screenshotDataUrl,
                pageUrl: window.location.href,
            });
            toast({ title: 'Problem gemeldet', description: 'Vielen Dank für Ihr Feedback!' });
            handleClose();
        } catch (error) {
            console.error("Error submitting ticket:", error);
            toast({ title: 'Fehler beim Senden', description: 'Das Problem konnte nicht gemeldet werden.', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setDescription('');
        setScreenshotDataUrl(null);
        setIsSelectingArea(false);
        onClose();
    };

    if (isSelectingArea) {
        return <ScreenshotAreaSelector onComplete={handleSelectionComplete} />;
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="font-headline">Problem melden</DialogTitle>
                    <DialogDescription className="font-body">
                        Erstellen Sie einen Screenshot eines bestimmten Bereichs und fügen Sie eine Beschreibung hinzu.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                    <div className="space-y-4">
                        <Button onClick={handleStartSelection} disabled={isCapturing} className="w-full font-body">
                            {isCapturing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Crop className="mr-2 h-4 w-4" />}
                            Bereich für Screenshot auswählen
                        </Button>
                        <div>
                            <Label htmlFor="description" className="font-body">Beschreibung des Problems</Label>
                            <Textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Bitte beschreiben Sie hier, was nicht wie erwartet funktioniert..."
                                className="mt-2 min-h-[150px] font-body"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                         <Label className="font-body">Vorschau</Label>
                         <div className="w-full aspect-video bg-muted rounded-md border flex items-center justify-center">
                            {isCapturing ? (
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            ) : screenshotDataUrl ? (
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Image src={screenshotDataUrl} alt="Screenshot Vorschau" width={800} height={450} className="rounded-md object-contain cursor-zoom-in" data-ai-hint="screenshot interface" />
                                    </DialogTrigger>
                                    <DialogContent className="max-w-7xl h-[90vh] flex items-center justify-center">
                                        <Image src={screenshotDataUrl} alt="Screenshot Vollansicht" fill className="object-contain" data-ai-hint="screenshot interface" />
                                    </DialogContent>
                                </Dialog>
                            ) : (
                                <p className="text-sm text-muted-foreground">Noch kein Screenshot</p>
                            )}
                         </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={handleClose}>Abbrechen</Button>
                    <Button type="button" onClick={handleSubmit} disabled={isSubmitting || !screenshotDataUrl || !description.trim()}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        Problem melden
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default NewTicketDialog;
