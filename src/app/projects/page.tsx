"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusCircle, Trash2, Edit3, ListChecks, Calendar, ArrowRight } from 'lucide-react';
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
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-emerald-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <header className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Projekte</h1>
        <p className="text-slate-600">Verwalten Sie Ihre Aufmaß-Projekte in Echtzeit.</p>
      </header>

      {/* New Project Input */}
      <section className="bg-white rounded-xl border border-slate-200 p-4 md:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-grow">
            <Input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Neues Projekt benennen..."
              className="w-full pl-10 h-11 border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20"
              onKeyDown={(e) => e.key === 'Enter' && handleAddProject()}
            />
            <PlusCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          </div>
          <Button 
            onClick={handleAddProject} 
            className="btn-primary h-11 px-6 shrink-0"
          >
            Projekt anlegen
          </Button>
        </div>
      </section>

      {/* Projects List */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.length === 0 ? (
          <div className="col-span-full bg-white rounded-xl border border-slate-200 p-12 text-center space-y-4 shadow-sm">
            <ListChecks size={40} className="mx-auto text-slate-300" />
            <p className="text-slate-500 font-medium">Noch keine Projekte vorhanden.</p>
            <p className="text-sm text-slate-400">Erstellen Sie Ihr erstes Projekt oben.</p>
          </div>
        ) : (
          projects.map((project) => (
            <div key={project.id} className="group bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200">
              <div className="p-5">
                {editingProject?.id === project.id ? (
                  <div className="space-y-3">
                    <Input
                      value={editingProjectName}
                      onChange={(e) => setEditingProjectName(e.target.value)}
                      className="border-slate-200 focus:border-emerald-500"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button onClick={handleSaveEditProject} size="sm" className="btn-primary flex-1">
                        Speichern
                      </Button>
                      <Button onClick={() => setEditingProject(null)} variant="outline" size="sm" className="flex-1">
                        Abbrechen
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-start gap-4 mb-4">
                      <h3 className="text-lg font-semibold text-slate-900 leading-tight break-words">
                        {project.name}
                      </h3>
                      <div className="flex gap-1 shrink-0">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => { setEditingProject(project); setEditingProjectName(project.name); }} 
                          className="h-8 w-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                          aria-label="Projekt bearbeiten"
                        >
                          <Edit3 size={16} />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                              aria-label="Projekt löschen"
                            >
                              <Trash2 size={16} />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-white border-slate-200">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-xl font-bold text-slate-900">Projekt löschen?</AlertDialogTitle>
                              <AlertDialogDescription className="text-slate-600">
                                Möchten Sie "{project.name}" wirklich unwiderruflich löschen?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="gap-2">
                              <AlertDialogCancel className="border-slate-200">Abbrechen</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDeleteProject(project.id)} 
                                className="bg-red-500 hover:bg-red-600 text-white"
                              >
                                Löschen
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 text-xs font-medium text-slate-500 mb-4">
                      <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1.5 rounded-md">
                        <Calendar size={14} className="text-emerald-600" />
                        {formatDate(project.created_at)}
                      </div>
                      <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1.5 rounded-md">
                        <ListChecks size={14} className="text-teal-600" />
                        {(project.selectedItems || []).filter(item => item.type === 'article').length} Artikel
                      </div>
                    </div>

                    <Button
                      onClick={() => handleSelectProject(project.id)}
                      variant="outline"
                      className="w-full h-11 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-colors"
                    >
                      Öffnen
                      <ArrowRight size={16} className="ml-2" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
};

export default ProjectsPage;
