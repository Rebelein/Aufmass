import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Camera, FileText, Plus, Image as ImageIcon, Trash2, X, BookMarked, PenLine, ImagePlus } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import type { Project, ProjectSelectedItem } from '@/lib/project-storage';
import { upsertProjectItem, deleteProjectItem, addSection } from '@/lib/project-storage';
import { useToast } from '@/hooks/use-toast';
import { generateUUID } from '@/lib/utils';
import { generateAngebotPdf } from '@/lib/pdf-export-angebot';
import type { ProcessedSummaryItem } from '@/lib/types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { NoteEditorDialog } from '@/components/dialogs/NoteEditorDialog';

interface AngebotToolProps {
  project: Project;
  activeSectionId: string | null;
  activeListId?: string | null;
  onUpdateLocalItem: (item: ProjectSelectedItem) => void;
  onRemoveLocalItem: (itemId: string) => void;
  onUpdateProject?: (updates: Partial<Project>) => void;
}

export function AngebotTool({ project, activeSectionId, activeListId, onUpdateLocalItem, onRemoveLocalItem, onUpdateProject }: AngebotToolProps) {
  const { toast } = useToast();
  const [isNoteEditorOpen, setIsNoteEditorOpen] = useState(false);

  const handleDeleteSection = async () => {
    if (!activeSectionId) return;
    const id = activeSectionId;
    onRemoveLocalItem(id);
    await deleteProjectItem(id);
    toast({ title: "Gelöscht", description: "Der Bauabschnitt wurde entfernt." });
  };

  const handleSaveNote = async (base64Image: string) => {
    if (!project) return;
    const newItem: ProjectSelectedItem = {
      id: generateUUID(),
      project_id: project.id,
      list_id: activeListId ?? null,
      type: 'article',
      order: project.selectedItems.length,
      article_id: null,
      quantity: 1,
      name: 'Skizze / Foto',
      unit: 'Stk',
      images: [base64Image],
      section_id: activeSectionId ?? null,
    };
    onUpdateLocalItem(newItem);
    const saved = await upsertProjectItem(newItem);
    if (!saved) {
      onRemoveLocalItem(newItem.id);
      toast({ title: 'Fehler', description: 'Skizze konnte nicht gespeichert werden.', variant: 'destructive' });
    } else {
      toast({ title: 'Skizze gespeichert', description: 'Sie erscheint nun auch in der Materialliste.' });
    }
  };

  const deleteImage = async (section: ProjectSelectedItem, imageIndex: number) => {
    if (activeSectionId === null) return;
    if (!section.images) return;
    const newImages = section.images.filter((_, idx) => idx !== imageIndex);
    const updated = await upsertProjectItem({ ...section, images: newImages });
    if (updated) onUpdateLocalItem(updated);
  };

  const handleTitleChange = async (section: ProjectSelectedItem, newTitle: string) => {
    if (activeSectionId === null) return;
    if (newTitle.trim() && newTitle !== section.text) {
      const updated = await upsertProjectItem({ ...section, text: newTitle.trim() });
      if (updated) onUpdateLocalItem(updated);
    }
  };

  const handleDescriptionChange = async (section: ProjectSelectedItem, desc: string) => {
    if (activeSectionId === null) {
      const { updateProject } = await import('@/lib/project-storage');
      const success = await updateProject(project.id, { notes: desc });
      if (success && onUpdateProject) onUpdateProject({ notes: desc });
    } else {
      const updated = await upsertProjectItem({ ...section, description: desc });
      if (updated) onUpdateLocalItem(updated);
    }
  };

  const activeSection = activeSectionId === null 
    ? {
        id: 'allgemein',
        type: 'section',
        text: 'Allgemein',
        description: project.notes || '',
        images: []
      } as unknown as ProjectSelectedItem
    : project.selectedItems.find(i => i.id === activeSectionId && i.type === 'section');

  if (!activeSection) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 space-y-4 bg-background/50">
        <BookMarked className="w-16 h-16 opacity-30" />
        <h2 className="text-xl font-medium text-muted-foreground">Kein Bauabschnitt ausgewählt</h2>
        <p className="text-center text-sm max-w-sm">Wähle links in der Seitenleiste einen Projekt-Abschnitt aus oder erstelle einen neuen, um hier Fotos und Notizen für das Angebot zu erfassen.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background/50 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div className="flex-1 w-full relative">
          <input
             id={`section-title-${activeSection.id}`}
             key={`input-${activeSection.id}`} /* Force re-render on active section change */
             className="w-full bg-transparent text-2xl md:text-3xl lg:text-4xl font-black text-foreground border-b border-transparent focus:border-input focus:outline-none transition-colors pb-2"
             defaultValue={activeSection.text}
             onBlur={(e) => handleTitleChange(activeSection, e.target.value)}
             onKeyDown={e => { if(e.key === 'Enter') e.currentTarget.blur(); }}
             placeholder="Bauabschnitt Name..."
             readOnly={activeSectionId === null}
          />
          <p className="text-emerald-400 font-medium text-sm mt-2 uppercase tracking-widest flex items-center gap-2">
            {project.name} <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" /> Abschnitt Dokumentation
          </p>
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          {activeSectionId !== null && (
           <AlertDialog>
             <AlertDialogTrigger asChild>
               <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-11 w-11 shrink-0 rounded-full">
                 <Trash2 className="w-5 h-5" />
               </Button>
             </AlertDialogTrigger>
             <AlertDialogContent className="bg-card text-card-foreground border-border shadow-sm rounded-xl border border-border bg-background">
               <AlertDialogHeader>
                 <AlertDialogTitle className="text-xl font-bold text-foreground">Bauabschnitt löschen?</AlertDialogTitle>
                 <AlertDialogDescription className="text-muted-foreground">
                   Möchten Sie diesen kompletten Abschnitt inkl. aller Notizen und Fotos wirklich unwiderruflich löschen?
                 </AlertDialogDescription>
               </AlertDialogHeader>
               <AlertDialogFooter className="gap-2">
                 <AlertDialogCancel className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm rounded-md-secondary border-none">Abbrechen</AlertDialogCancel>
                 <AlertDialogAction onClick={handleDeleteSection} className="bg-red-500/90 hover:bg-red-500 text-destructive-foreground rounded-xl">Löschen</AlertDialogAction>
               </AlertDialogFooter>
             </AlertDialogContent>
           </AlertDialog>
          )}
           <Button onClick={() => setIsNoteEditorOpen(true)} className="bg-emerald-500 hover:bg-emerald-600 text-primary-foreground rounded-full h-11 px-6 shadow-lg shadow-emerald-500/20 font-bold">
             <ImagePlus className="w-5 h-5 mr-2" /> Foto / Skizze
           </Button>
        </div>
      </div>

      {/* NOTIZEN */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={`desc-${activeSection.id}`} className="space-y-3">
        <h3 className="text-muted-foreground text-xs font-bold uppercase tracking-wider flex items-center gap-2">
          <PenLine className="w-3.5 h-3.5" /> Notizen & Details
        </h3>
        <Textarea 
          className="bg-background border border-input text-foreground focus-visible:ring-1 focus-visible:ring-ring shadow-sm rounded-md resize-y min-h-[160px] text-base p-5 leading-relaxed bg-muted border-border focus:bg-muted focus:border-emerald-500/50 rounded-2xl"
          placeholder="Dokumentiere hier alle wichtigen Details, Kundenwünsche oder Besonderheiten für das Angebot..."
          defaultValue={activeSection.description || ''}
          onBlur={(e) => handleDescriptionChange(activeSection, e.target.value)}
        />
      </motion.div>

      {/* GALERIE */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={`gal-${activeSection.id}`} className="space-y-3 pb-8">
        <h3 className="text-muted-foreground text-xs font-bold uppercase tracking-wider flex items-center gap-2">
          <ImageIcon className="w-3.5 h-3.5" /> Galerie & Skizzen
        </h3>
        
        {/* Combine images from section and from individual sketch items */}
        {(() => {
          const sectionImages = activeSection.images?.map((img, idx) => ({ url: img, type: 'section', index: idx })) || [];
          const itemImages = project.selectedItems
            .filter(i => {
              const matchesSection = activeSection.id === 'allgemein' ? i.section_id === null : i.section_id === activeSection.id;
              return matchesSection && i.type === 'article' && i.images && i.images.length > 0;
            })
            .flatMap(i => i.images!.map(img => ({ url: img, type: 'item', id: i.id, name: i.name })));
          
          const allImages = [...sectionImages, ...itemImages];

          if (allImages.length === 0) {
            return (
              <div className="flex flex-col items-center justify-center p-16 text-muted-foreground border-2 border-dashed border-border rounded-3xl bg-background">
                <ImageIcon className="w-12 h-12 mb-4 opacity-30" />
                <p className="text-sm font-medium">Noch keine Fotos oder Skizzen hinterlegt.</p>
                <p className="text-xs text-muted-foreground mt-1">Erstelle eine Skizze oder nimm ein Foto auf.</p>
              </div>
            );
          }

          return (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {allImages.map((imgObj, idx) => (
                <div key={`${activeSection.id}-img-${idx}`} className="relative group aspect-[4/3] rounded-2xl overflow-hidden border border-border shadow-lg bg-muted">
                  <img src={imgObj.url} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="Capture" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute top-3 left-3 px-2 py-1 rounded-md bg-muted backdrop-blur-md border border-border opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-[10px] text-foreground font-medium">{(imgObj as any).name || 'Foto'}</p>
                  </div>
                  <button 
                    onClick={() => {
                      if (imgObj.type === 'section') {
                        deleteImage(activeSection, imgObj.index!);
                      } else {
                        onRemoveLocalItem(imgObj.id!);
                        deleteProjectItem(imgObj.id!);
                      }
                    }}
                    className="absolute bottom-3 right-3 bg-red-500/90 hover:bg-red-500 text-destructive-foreground rounded-full p-2.5 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 shadow-xl"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          );
        })()}
      </motion.div>

      <NoteEditorDialog
        open={isNoteEditorOpen}
        onOpenChange={setIsNoteEditorOpen}
        onSave={handleSaveNote}
      />

    </div>
  );
}
