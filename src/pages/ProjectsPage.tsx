import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusCircle, Trash2, Edit3, ListChecks, Calendar, ArrowRight, FolderOpen, Sparkles } from 'lucide-react';
import { subscribeToProjects, addProjectToSupabase, deleteProjectFromSupabase, setCurrentProjectId, updateProjectName } from '@/lib/project-storage';
import type { Project } from '@/lib/project-storage';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, } from "@/components/ui/alert-dialog";
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

const ProjectsPage = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
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
        toast({ title: "Projekt erstellt", description: `"${newProjectName}" wurde hinzugefügt.` });
        setNewProjectName('');
      }
    } catch (error) {
      console.error("Error adding project:", error);
    }
  };

  const handleSelectProject = (projectId: string) => {
    setCurrentProjectId(projectId);
    navigate('/aufmass');
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
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center animate-pulse">
            <Sparkles className="w-8 h-8 text-emerald-400" />
          </div>
          <p className="text-white/50 font-medium">Projekte werden geladen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      {/* Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="orb orb-teal w-72 h-72 -top-10 right-10" style={{ animationDelay: '-1s' }} />
        <div className="orb orb-emerald w-56 h-56 bottom-20 -left-10" style={{ animationDelay: '-3s' }} />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto space-y-8 py-6 px-4 animate-in fade-in duration-500">
        {/* Header */}
        <header className="text-center md:text-left space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-white/70">
            <FolderOpen className="w-4 h-4 text-emerald-400" />
            <span>Projektübersicht</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gradient-white">
            Ihre Projekte
          </h1>
          <p className="text-white/50 text-lg">
            Verwalten Sie Aufmaß-Projekte in Echtzeit
          </p>
        </header>

        {/* New Project Input */}
        <section className="glass-card p-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-grow">
              <Input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Neues Projekt erstellen..."
                className="glass-input w-full text-lg"
                onKeyDown={(e) => e.key === 'Enter' && handleAddProject()}
              />
              <PlusCircle className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-400 w-5 h-5 pointer-events-none" />
            </div>
            <Button
              onClick={handleAddProject}
              className="glass-button text-lg"
            >
              <PlusCircle className="w-5 h-5 mr-2" />
              Anlegen
            </Button>
          </div>
        </section>

        {/* Projects List */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.length === 0 ? (
            <div className="col-span-full ios-card p-12 text-center space-y-4">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                <ListChecks size={36} className="text-emerald-400" />
              </div>
              <p className="text-white/70 font-semibold text-lg">Keine Projekte vorhanden</p>
              <p className="text-white/40">Erstellen Sie Ihr erstes Projekt oben</p>
            </div>
          ) : (
            projects.map((project, index) => (
              <div
                key={project.id}
                className="ios-card overflow-hidden"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="p-6">
                  {editingProject?.id === project.id ? (
                    <div className="space-y-4">
                      <Input
                        value={editingProjectName}
                        onChange={(e) => setEditingProjectName(e.target.value)}
                        className="glass-input"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button onClick={handleSaveEditProject} className="glass-button flex-1">
                          Speichern
                        </Button>
                        <Button onClick={() => setEditingProject(null)} className="ios-button-secondary flex-1">
                          Abbrechen
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-start gap-4 mb-4">
                        <h3 className="text-xl font-bold text-white leading-tight break-words">
                          {project.name}
                        </h3>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingProject(project);
                              setEditingProjectName(project.name);
                            }}
                            className="h-10 w-10 rounded-xl text-white/50 hover:text-emerald-400 hover:bg-white/10"
                          >
                            <Edit3 size={18} />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 rounded-xl text-white/50 hover:text-red-400 hover:bg-red-500/10"
                              >
                                <Trash2 size={18} />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="ios-card border border-white/10 bg-slate-900/95">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-xl font-bold text-white">
                                  Projekt löschen?
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-white/60">
                                  Möchten Sie "{project.name}" wirklich unwiderruflich löschen?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="gap-2">
                                <AlertDialogCancel className="ios-button-secondary">
                                  Abbrechen
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteProject(project.id)}
                                  className="bg-red-500/90 hover:bg-red-500 text-white rounded-xl"
                                >
                                  Löschen
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 text-sm text-white/50 mb-5">
                        <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-lg">
                          <Calendar size={14} className="text-emerald-400" />
                          {formatDate(project.created_at)}
                        </div>
                        <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-lg">
                          <ListChecks size={14} className="text-teal-400" />
                          {(project.selectedItems || []).filter(item => item.type === 'article').length} Artikel
                        </div>
                      </div>

                      <Button
                        onClick={() => handleSelectProject(project.id)}
                        className="w-full ios-button text-lg"
                      >
                        Öffnen
                        <ArrowRight size={18} className="ml-2" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
};

export default ProjectsPage;
