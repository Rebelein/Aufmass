"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusCircle, Trash2, Edit3, ListChecks, Calendar, Clock } from 'lucide-react';
import { 
  subscribeToProjects, 
  addProjectToSupabase, 
  deleteProjectFromSupabase, 
  setCurrentProjectId,
  updateProjectName,
  getProjects,
  Project
} from '@/lib/project-storage';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

const ProjectsPage = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  const fetchProjects = async () => {
    const loadedProjects = await getProjects();
    setProjects(loadedProjects);
  };

  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = subscribeToProjects((loadedProjects) => {
      setProjects(loadedProjects);
      setIsLoading(false);
    });

    return () => unsubscribe(); 
  }, []);

  const handleAddProject = async () => {
    if (newProjectName.trim() === '') return;
    try {
      const newProject = await addProjectToSupabase(newProjectName);
      if (newProject) {
        toast({ title: "Projekt erstellt", description: `Projekt "${newProjectName}" wurde hinzugefügt.` });
        setNewProjectName('');
        await fetchProjects();
      }
    } catch (error) {
      console.error("Error adding project:", error);
    }
  };

  const handleSelectProject = (projectId: string) => {
    setCurrentProjectId(projectId);
    router.push('/aufmass');
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      const success = await deleteProjectFromSupabase(projectId);
      if (success) {
        toast({ title: "Projekt gelöscht" });
        await fetchProjects();
      }
    } catch (error) {
      console.error("Error deleting project:", error);
    }
  };
  
  const handleSaveEditProject = async () => {
    if (!editingProject || editingProjectName.trim() === '') return;
    try {
      const success = await updateProjectName(editingProject.id, editingProjectName.trim());
      if (success) {
        toast({ title: "Projekt aktualisiert" });
        setEditingProject(null);
        await fetchProjects();
      }
    } catch (error) {
      console.error("Error updating project:", error);
    }
  };
  
  const formatDate = (dateInput: string | Date): string => {
    try {
        if (!dateInput) return "Unbekannt";
        const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
        return format(date, "dd.MM.yyyy", { locale: de });
    } catch (e) {
        return "Ungültig";
    }
  };

  if (isLoading) {
    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-emerald-500"></div>
        </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in duration-500">
      <header className="space-y-2">
        <h1 className="text-4xl font-bold text-gradient-emerald">Projekte</h1>
        <p className="text-white/50 font-medium text-lg">Verwalten Sie Ihre Aufmaß-Projekte in Echtzeit.</p>
      </header>

      {/* New Project Input */}
      <section className="glass-card p-6 border-white/5 shadow-xl">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-grow">
            <Input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Neues Projekt benennen..."
              className="glass-input w-full pl-12 h-14"
              onKeyDown={(e) => e.key === 'Enter' && handleAddProject()}
            />
            <PlusCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={20} />
          </div>
          <Button onClick={handleAddProject} className="btn-primary h-14 px-8 shrink-0 text-lg font-bold">
            Projekt anlegen
          </Button>
        </div>
      </section>

      {/* Projects List */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {projects.length === 0 ? (
          <div className="col-span-full glass-card p-12 text-center space-y-4">
            <ListChecks size={48} className="mx-auto text-white/10" />
            <p className="text-white/40 text-lg font-medium">Noch keine Projekte vorhanden.</p>
          </div>
        ) : (
          projects.map((project) => (
            <div key={project.id} className="group relative">
              <div className="glass-card p-6 h-full flex flex-col justify-between transition-all duration-300 group-hover:border-emerald-500/30 group-hover:shadow-[0_0_30px_rgba(16,185,129,0.1)]">
                
                <div className="space-y-4">
                  {editingProject?.id === project.id ? (
                    <div className="flex gap-2">
                      <Input
                        value={editingProjectName}
                        onChange={(e) => setEditingProjectName(e.target.value)}
                        className="glass-input flex-grow h-10"
                        autoFocus
                      />
                      <Button onClick={handleSaveEditProject} size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl">OK</Button>
                      <Button onClick={() => setEditingProject(null)} variant="ghost" size="sm" className="text-white/50 rounded-xl">X</Button>
                    </div>
                  ) : (
                    <div className="flex justify-between items-start">
                      <h3 className="text-xl font-bold text-white group-hover:text-emerald-300 transition-colors leading-tight">
                        {project.name}
                      </h3>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingProject(project); setEditingProjectName(project.name); }} className="h-8 w-8 text-white/40 hover:text-emerald-400">
                          <Edit3 size={16} />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-white/40 hover:text-red-400">
                              <Trash2 size={16} />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="glass-card border-white/10 bg-gray-900/90 text-white">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-2xl font-bold">Projekt löschen?</AlertDialogTitle>
                              <AlertDialogDescription className="text-white/60">
                                Möchten Sie "{project.name}" wirklich unwiderruflich löschen?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="bg-white/5 border-white/10 text-white hover:bg-white/10 rounded-xl">Abbrechen</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteProject(project.id)} className="bg-red-500/80 hover:bg-red-600 text-white rounded-xl">Löschen</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-4 text-xs font-semibold text-white/40 uppercase tracking-widest">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={14} className="text-emerald-500/50" />
                      {formatDate(project.created_at)}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <ListChecks size={14} className="text-teal-500/50" />
                      {(project.selectedItems || []).filter(item => item.type === 'article').length} Artikel
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <Button 
                    onClick={() => handleSelectProject(project.id)} 
                    className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl py-6 group/btn"
                  >
                    <span className="flex items-center gap-2 group-hover/btn:text-emerald-400 transition-colors font-bold">
                      Öffnen <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
};

const ArrowRight = ({ size, className }: { size: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M5 12h14m-7-7 7 7-7 7" />
  </svg>
);

export default ProjectsPage;
