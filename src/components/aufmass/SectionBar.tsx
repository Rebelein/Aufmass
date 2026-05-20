import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProjectSelectedItem } from '@/lib/project-storage';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SectionBarProps {
  sections: ProjectSelectedItem[];
  activeSectionId: string | null;
  onSelectSection: (sectionId: string | null) => void;
  onAddSection: (name: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onUpdateSection: (sectionId: string, name: string) => void;
}

export function SectionBar({ 
  sections, 
  activeSectionId, 
  onSelectSection, 
  onAddSection,
  onDeleteSection,
  onUpdateSection
}: SectionBarProps) {
  const [isAddingSectionOpen, setIsAddingSectionOpen] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  
  const [sectionToDelete, setSectionToDelete] = useState<ProjectSelectedItem | null>(null);

  const handleAddSection = () => {
    if (!newSectionName.trim()) return;
    onAddSection(newSectionName.trim());
    setNewSectionName('');
    setIsAddingSectionOpen(false);
  };

  const handleStartEdit = (e: React.MouseEvent, sec: ProjectSelectedItem) => {
    e.stopPropagation();
    setEditingSectionId(sec.id);
    setEditingName(sec.text || '');
  };

  const handleSaveEdit = () => {
    if (editingSectionId && editingName.trim()) {
      onUpdateSection(editingSectionId, editingName.trim());
    }
    setEditingSectionId(null);
  };

  const handleDeleteClick = (e: React.MouseEvent, sec: ProjectSelectedItem) => {
    e.stopPropagation();
    setSectionToDelete(sec);
  };

  return (
    <div className="flex items-center gap-2 px-4 py-3 overflow-x-auto border-b border-border shrink-0 no-scrollbar">
      <button
        onClick={() => onSelectSection(null)}
        className={cn(
          'shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap',
          activeSectionId === null
            ? 'bg-emerald-500 text-primary-foreground shadow-lg shadow-emerald-500/20'
            : 'bg-muted text-muted-foreground hover:text-accent-foreground hover:bg-muted'
        )}
      >
        Allgemein
      </button>

      {sections.map((sec, idx) => {
        const isActive = activeSectionId === sec.id;
        const isEditing = editingSectionId === sec.id;

        if (isEditing) {
          return (
            <div key={sec.id} className="flex items-center gap-1 bg-muted rounded-full px-2 py-1 shrink-0">
              <Input
                value={editingName}
                onChange={e => setEditingName(e.target.value)}
                className="h-7 w-32 bg-transparent border-none text-sm text-foreground focus-visible:ring-0 p-0 px-2"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSaveEdit();
                  if (e.key === 'Escape') setEditingSectionId(null);
                }}
              />
              <button onClick={handleSaveEdit} className="p-1 text-emerald-400 hover:bg-muted rounded-full">
                <Check size={14} />
              </button>
              <button onClick={() => setEditingSectionId(null)} className="p-1 text-muted-foreground hover:bg-muted rounded-full">
                <X size={14} />
              </button>
            </div>
          );
        }

        return (
          <div key={`${sec.id}-${idx}`} className="relative group shrink-0">
            <button
              onClick={() => onSelectSection(sec.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap',
                isActive
                  ? 'bg-emerald-500 text-primary-foreground shadow-lg shadow-emerald-500/20'
                  : 'bg-muted text-muted-foreground hover:text-accent-foreground hover:bg-muted'
              )}
            >
              {sec.text}
              {isActive && (
                <div className="flex items-center gap-1 ml-1 pl-1 border-l border-input">
                  <span 
                    onClick={(e) => handleStartEdit(e, sec)}
                    className="p-1 hover:bg-accent rounded-full transition-colors"
                  >
                    <Pencil size={12} />
                  </span>
                  <span 
                    onClick={(e) => handleDeleteClick(e, sec)}
                    className="p-1 hover:bg-red-500/40 rounded-full transition-colors"
                  >
                    <Trash2 size={12} />
                  </span>
                </div>
              )}
            </button>
          </div>
        );
      })}

      {isAddingSectionOpen ? (
        <div className="flex items-center gap-2 shrink-0">
          <Input
            value={newSectionName}
            onChange={e => setNewSectionName(e.target.value)}
            placeholder="Name..."
            className="h-8 w-32 bg-background border border-input text-foreground focus-visible:ring-1 focus-visible:ring-ring shadow-sm rounded-md text-sm"
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleAddSection(); if (e.key === 'Escape') setIsAddingSectionOpen(false); }}
          />
          <Button onClick={handleAddSection} size="sm" className="h-8 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm rounded-md px-3">OK</Button>
          <Button onClick={() => setIsAddingSectionOpen(false)} size="sm" variant="ghost" className="h-8 px-2 text-muted-foreground">✕</Button>
        </div>
      ) : (
        <button
          onClick={() => setIsAddingSectionOpen(true)}
          className="shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium bg-muted text-emerald-400 hover:bg-emerald-500/10 transition-all whitespace-nowrap border border-emerald-500/20"
        >
          <Plus size={14} />
        </button>
      )}

      <AlertDialog open={!!sectionToDelete} onOpenChange={() => setSectionToDelete(null)}>
        <AlertDialogContent className="bg-card text-card-foreground border-border shadow-sm rounded-xl bg-background border-border text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>Abschnitt löschen?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Möchten Sie den Abschnitt "{sectionToDelete?.text}" wirklich löschen? 
              Alle enthaltenen Artikel werden in "Allgemein" verschoben.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-muted border-border text-foreground hover:bg-muted">Abbrechen</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (sectionToDelete) onDeleteSection(sectionToDelete.id);
                setSectionToDelete(null);
              }}
              className="bg-red-500 hover:bg-red-600 text-destructive-foreground"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

