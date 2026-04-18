import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProjectSelectedItem } from '@/lib/project-storage';

interface SectionBarProps {
  sections: ProjectSelectedItem[];
  activeSectionId: string | null;
  onSelectSection: (sectionId: string | null) => void;
  onAddSection: (name: string) => void;
}

export function SectionBar({ sections, activeSectionId, onSelectSection, onAddSection }: SectionBarProps) {
  const [isAddingSectionOpen, setIsAddingSectionOpen] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');

  const handleAddSection = () => {
    if (!newSectionName.trim()) return;
    onAddSection(newSectionName.trim());
    setNewSectionName('');
    setIsAddingSectionOpen(false);
  };

  return (
    <div className="flex items-center gap-2 px-4 py-3 overflow-x-auto border-b border-white/5 shrink-0">
      <button
        onClick={() => onSelectSection(null)}
        className={cn(
          'shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap',
          activeSectionId === null
            ? 'bg-emerald-500 text-white shadow-lg'
            : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
        )}
      >
        Allgemein
      </button>
      {sections.map(sec => (
        <button
          key={sec.id}
          onClick={() => onSelectSection(sec.id)}
          className={cn(
            'shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap',
            activeSectionId === sec.id
              ? 'bg-emerald-500 text-white shadow-lg'
              : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
          )}
        >
          {sec.text}
        </button>
      ))}
      {isAddingSectionOpen ? (
        <div className="flex items-center gap-2 shrink-0">
          <Input
            value={newSectionName}
            onChange={e => setNewSectionName(e.target.value)}
            placeholder="Abschnitt Name..."
            className="h-8 w-36 glass-input text-sm"
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleAddSection(); if (e.key === 'Escape') setIsAddingSectionOpen(false); }}
          />
          <Button onClick={handleAddSection} size="sm" className="h-8 glass-button px-3">OK</Button>
          <Button onClick={() => setIsAddingSectionOpen(false)} size="sm" variant="ghost" className="h-8 px-2 text-white/50">✕</Button>
        </div>
      ) : (
        <button
          onClick={() => setIsAddingSectionOpen(true)}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-white/5 text-emerald-400 hover:bg-emerald-500/10 transition-all whitespace-nowrap border border-emerald-500/20"
        >
          <Plus size={14} /> Abschnitt
        </button>
      )}
    </div>
  );
}
