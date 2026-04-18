import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Camera, FileText, Plus, Image as ImageIcon, Trash2, X, BookMarked, PenLine } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import type { Project, ProjectSelectedItem } from '@/lib/project-storage';
import { upsertProjectItem, deleteProjectItem, addSection } from '@/lib/project-storage';
import { useToast } from '@/hooks/use-toast';
import { generateUUID } from '@/lib/utils';
import { generateAngebotPdf } from '@/lib/pdf-export-angebot';
import type { ProcessedSummaryItem } from '@/lib/types';

interface AngebotToolProps {
  project: Project;
  activeSectionId: string | null;
  onUpdateLocalItem: (item: ProjectSelectedItem) => void;
  onRemoveLocalItem: (itemId: string) => void;
}

export function AngebotTool({ project, activeSectionId, onUpdateLocalItem, onRemoveLocalItem }: AngebotToolProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeUploadSection, setActiveUploadSection] = useState<string | null>(null);

  // Compression helper
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.6)); // 0.6 quality for size reduction
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeUploadSection || !e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    try {
      const base64 = await compressImage(file);
      const section = project.selectedItems.find(s => s.id === activeUploadSection);
      if (section) {
        const newImages = [...(section.images || []), base64];
        const updated = await upsertProjectItem({ ...section, images: newImages });
        if (updated) onUpdateLocalItem(updated);
      }
    } catch (error) {
      console.error("Compression failed", error);
      toast({ title: "Fehler", description: "Bild konnte nicht verarbeitet werden.", variant: "destructive" });
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
    setActiveUploadSection(null);
  };

  const triggerCamera = (sectionId: string) => {
    setActiveUploadSection(sectionId);
    fileInputRef.current?.click();
  };

  const deleteImage = async (section: ProjectSelectedItem, imageIndex: number) => {
    if (!section.images) return;
    const newImages = section.images.filter((_, idx) => idx !== imageIndex);
    const updated = await upsertProjectItem({ ...section, images: newImages });
    if (updated) onUpdateLocalItem(updated);
  };

  const handleTitleChange = async (section: ProjectSelectedItem, newTitle: string) => {
    if (newTitle.trim() && newTitle !== section.text) {
      const updated = await upsertProjectItem({ ...section, text: newTitle.trim() });
      if (updated) onUpdateLocalItem(updated);
    }
  };

  const handleDescriptionChange = async (section: ProjectSelectedItem, desc: string) => {
    const updated = await upsertProjectItem({ ...section, description: desc });
    if (updated) onUpdateLocalItem(updated);
  };

  const handleDeleteSection = async () => {
    if (!activeSectionId) return;
    if (window.confirm("Bist du sicher, dass du diesen kompletten Abschnitt inkl. aller Notizen und Fotos löschen willst?")) {
       const id = activeSectionId;
       onRemoveLocalItem(id);
       await deleteProjectItem(id);
       toast({ title: "Gelöscht", description: "Der Bauabschnitt wurde entfernt." });
    }
  };

  const activeSection = project.selectedItems.find(i => i.id === activeSectionId && i.type === 'section');

  if (!activeSection) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white/30 p-8 space-y-4 bg-background/50">
        <BookMarked className="w-16 h-16 opacity-30" />
        <h2 className="text-xl font-medium text-white/50">Kein Bauabschnitt ausgewählt</h2>
        <p className="text-center text-sm max-w-sm">Wähle links in der Seitenleiste einen Projekt-Abschnitt aus oder erstelle einen neuen, um hier Fotos und Notizen für das Angebot zu erfassen.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background/50 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-8">
      <input 
        type="file" 
        accept="image/*" 
        capture="environment" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        onChange={handleFileChange} 
      />

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div className="flex-1 w-full relative">
          <input
             id={`section-title-${activeSection.id}`}
             key={`input-${activeSection.id}`} /* Force re-render on active section change */
             className="w-full bg-transparent text-2xl md:text-3xl lg:text-4xl font-black text-white border-b border-transparent focus:border-white/20 focus:outline-none transition-colors pb-2"
             defaultValue={activeSection.text}
             onBlur={(e) => handleTitleChange(activeSection, e.target.value)}
             onKeyDown={e => { if(e.key === 'Enter') e.currentTarget.blur(); }}
             placeholder="Bauabschnitt Name..."
          />
          <p className="text-emerald-400 font-medium text-sm mt-2 uppercase tracking-widest flex items-center gap-2">
            {project.name} <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" /> Abschnitt Dokumentation
          </p>
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
           <Button variant="ghost" size="icon" onClick={handleDeleteSection} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-11 w-11 shrink-0 rounded-full">
             <Trash2 className="w-5 h-5" />
           </Button>
           <Button onClick={() => triggerCamera(activeSection.id)} className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full h-11 px-6 shadow-lg shadow-emerald-500/20 font-bold">
             <Camera className="w-5 h-5 mr-2" /> Foto aufnehmen
           </Button>
        </div>
      </div>

      {/* NOTIZEN */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={`desc-${activeSection.id}`} className="space-y-3">
        <h3 className="text-white/40 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
          <PenLine className="w-3.5 h-3.5" /> Notizen & Details
        </h3>
        <Textarea 
          className="glass-input resize-y min-h-[160px] text-base p-5 leading-relaxed bg-white/5 border-white/5 focus:bg-white/10 focus:border-emerald-500/50 rounded-2xl"
          placeholder="Dokumentiere hier alle wichtigen Details, Kundenwünsche oder Besonderheiten für das Angebot..."
          defaultValue={activeSection.description || ''}
          onBlur={(e) => handleDescriptionChange(activeSection, e.target.value)}
        />
      </motion.div>

      {/* GALERIE */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={`gal-${activeSection.id}`} className="space-y-3 pb-8">
        <h3 className="text-white/40 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
          <ImageIcon className="w-3.5 h-3.5" /> Galerie ({activeSection.images?.length || 0})
        </h3>
        {activeSection.images && activeSection.images.length > 0 ? (
           <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
             {activeSection.images.map((img, idx) => (
                <div key={`${activeSection.id}-img-${idx}`} className="relative group aspect-[4/3] rounded-2xl overflow-hidden border border-white/10 shadow-lg bg-black/40">
                  <img src={img} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="Capture" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <button 
                    onClick={() => deleteImage(activeSection, idx)}
                    className="absolute bottom-3 right-3 bg-red-500/90 hover:bg-red-500 text-white rounded-full p-2.5 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 shadow-xl"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
             ))}
           </div>
        ) : (
           <div className="flex flex-col items-center justify-center p-16 text-white/30 border-2 border-dashed border-white/10 rounded-3xl bg-white/[0.01]">
             <ImageIcon className="w-12 h-12 mb-4 opacity-30" />
             <p className="text-sm font-medium">Noch keine Fotos hinterlegt.</p>
             <p className="text-xs text-white/40 mt-1">Nimm ein Foto auf, um Details visuell zu dokumentieren.</p>
           </div>
        )}
      </motion.div>

    </div>
  );
}
