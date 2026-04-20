import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ResizableSidePanel } from '@/components/ui/ResizableSidePanel';
import { Label } from '@/components/ui/label';
import { Activity, FolderOpen, CheckCircle2, Calendar, MapPin, User, ArrowRight, Trash2, ListChecks, ChevronRight, ChevronLeft, BarChart3, PackageOpen, ClipboardList, Briefcase, FileText } from 'lucide-react';
import { subscribeToProjects, addProjectToSupabase, updateProject, deleteProjectFromSupabase, setCurrentProjectId } from '@/lib/project-storage';
import type { Project } from '@/lib/project-storage';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewProjectSheetOpen, setIsNewProjectSheetOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', client_name: '', address: '', notes: '', status: 'planning', start_date: '', end_date: '' });
  
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

  const planningProjects = useMemo(() => projects.filter(p => p.status === 'planning'), [projects]);
  const activeProjects = useMemo(() => projects.filter(p => !p.status || p.status === 'active'), [projects]);
  const completedProjects = useMemo(() => projects.filter(p => p.status === 'completed'), [projects]);

  const stats = useMemo(() => {
    let totalItems = 0;
    projects.forEach(p => {
      totalItems += (p.selectedItems || []).filter(item => item.type === 'article').length;
    });
    return {
      total: projects.length,
      planning: planningProjects.length,
      active: activeProjects.length,
      completed: completedProjects.length,
      totalItems
    };
  }, [projects, planningProjects, activeProjects, completedProjects]);

  const handleAddProject = async () => {
    if (newProject.name.trim() === '') return;
    try {
      const addedProject = await addProjectToSupabase(newProject.name, {
        client_name: newProject.client_name,
        address: newProject.address,
        notes: newProject.notes,
        status: newProject.status as any,
        start_date: newProject.start_date || null,
        end_date: newProject.end_date || null
      });
      if (addedProject) {
        toast({ title: "Baustelle angelegt", description: `"${newProject.name}" wurde erfolgreich erstellt.` });
        setNewProject({ name: '', client_name: '', address: '', notes: '', status: 'planning', start_date: '', end_date: '' });
        setIsNewProjectSheetOpen(false);
      }
    } catch (error) {
      console.error("Error adding project:", error);
      toast({ title: "Fehler", description: "Projekt konnte nicht erstellt werden.", variant: "destructive" });
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
        toast({ title: "Baustelle gelöscht" });
      }
    } catch (error) {
      console.error("Error deleting project:", error);
    }
  };

  const handleUpdateStatus = async (project: Project, newStatus: 'planning' | 'active' | 'completed') => {
    try {
      const success = await updateProject(project.id, { status: newStatus });
      if (success) {
        toast({ title: "Status aktualisiert", description: `${project.name} verschoben.` });
      }
    } catch (error) {
      console.error("Error updating project status:", error);
    }
  };

  const formatDate = (dateInput: string | Date | null | undefined): string => {
    if (!dateInput) return "Unbekannt";
    try {
      const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
      return format(date, "dd.MM.yyyy", { locale: de });
    } catch (e) {
      return "Ungültig";
    }
  };

  const renderProjectCard = (project: Project) => {
    const articleCount = (project.selectedItems || []).filter(item => item.type === 'article').length;
    const sectionCount = (project.selectedItems || []).filter(item => item.type === 'section').length;

    return (
      <motion.div 
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        whileHover={{ scale: 1.02 }} 
        key={project.id} 
        className="ios-card overflow-hidden transition-colors border-white/5 bg-background shadow-sm hover:border-white/10 group flex flex-col"
      >
        <div className="p-4 space-y-3 flex-1">
          <div className="flex justify-between items-start gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white leading-tight break-words flex items-center gap-2">
                {project.name}
              </h3>
              {project.client_name && (
                <p className="text-white/60 text-xs flex items-center gap-1.5 focus:outline-none focus:ring-0">
                  <User className="w-3.5 h-3.5" /> {project.client_name}
                </p>
              )}
            </div>
            
            <div className="shrink-0 flex items-center">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10">
                    <Trash2 size={14} />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="ios-card border border-white/10 bg-background">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-xl font-bold text-white">Baustelle löschen?</AlertDialogTitle>
                    <AlertDialogDescription className="text-white/60">
                      Möchten Sie "{project.name}" wirklich unwiderruflich löschen? Alle zugehörigen Aufmaße gehen verloren.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="gap-2">
                    <AlertDialogCancel className="ios-button-secondary border-none">Abbrechen</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDeleteProject(project.id)} className="bg-red-500/90 hover:bg-red-500 text-white rounded-xl">Löschen</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/5 px-2 py-1.5 rounded-md text-xs text-white/60">
              <ListChecks size={12} className="text-primary" />
              <span>{articleCount} Artikel</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/5 px-2 py-1.5 rounded-md text-xs text-white/60">
              <FolderOpen size={12} className="text-primary" />
              <span>{sectionCount} Ordner</span>
            </div>
          </div>

          {project.address && (
            <div className="flex items-start gap-1.5 text-xs text-white/50">
              <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500/80" />
              <span className="leading-snug truncate">{project.address}</span>
            </div>
          )}

          {(project.start_date || project.end_date) && (
            <div className="flex items-center gap-1.5 text-xs text-white/50">
              <Calendar className="w-3.5 h-3.5 shrink-0 text-blue-400" />
              <span>
                {project.start_date ? formatDate(project.start_date) : ''} 
                {project.end_date ? ` - ${formatDate(project.end_date)}` : ''}
              </span>
            </div>
          )}

          {project.notes && (
            <div className="text-xs text-white/40 italic line-clamp-2 pl-2 border-l-2 border-white/10">
              {project.notes}
            </div>
          )}
          
          <div className="text-[10px] text-white/30 pt-1">
            Letzte Änderung: {formatDate(project.updated_at)}
          </div>
        </div>

        <div className="border-t border-white/5 p-2 bg-white/[0.01] flex items-center justify-between gap-2">
          {/* Status Controls */}
          <div className="flex bg-white/5 rounded-lg p-0.5 shrink-0">
            {project.status === 'completed' && (
              <Button size="icon" variant="ghost" onClick={() => handleUpdateStatus(project, 'active')} className="h-8 w-8 text-white/50 hover:text-white" title="Zurück in Ausführung">
                <ChevronLeft size={16} />
              </Button>
            )}
            {project.status === 'active' && (
               <Button size="icon" variant="ghost" onClick={() => handleUpdateStatus(project, 'planning')} className="h-8 w-8 text-white/50 hover:text-white" title="Zurück in Planung">
                 <ChevronLeft size={16} />
               </Button>
            )}
            {project.status === 'planning' && (
              <Button size="icon" variant="ghost" onClick={() => handleUpdateStatus(project, 'active')} className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/20" title="In Ausführung geben">
                <ChevronRight size={16} />
              </Button>
            )}
            {project.status === 'active' && (
              <Button size="icon" variant="ghost" onClick={() => handleUpdateStatus(project, 'completed')} className="h-8 w-8 text-teal-500 hover:text-teal-400 hover:bg-teal-500/20" title="Projektabschluss">
                <ChevronRight size={16} />
              </Button>
            )}
          </div>

          <Button onClick={() => handleSelectProject(project.id)} variant="ghost" className="h-8 flex-1 text-xs text-white/70 hover:text-white hover:bg-white/10 bg-white/5">
            Aufmaß {project.status === 'planning' ? 'vorbereiten' : 'öffnen'}
          </Button>
        </div>
      </motion.div>
    );
  };

  const pageVariants = {
    initial: { opacity: 0, y: 15 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut', staggerChildren: 0.1 } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.2 } }
  };

  return (
    <motion.div 
      className="h-full relative flex flex-col overflow-hidden bg-background"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <div className="relative z-10 flex-1 overflow-y-auto w-full">
        <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
          
          {/* Dashboard Header */}
          <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-end mb-2">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Dashboard</h1>
              <p className="text-white/50">Projekt- und Aufmaßverwaltung</p>
            </div>
            
            <Button onClick={() => setIsNewProjectSheetOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-lg border border-primary/20 transition-all h-11 px-6">
                  <FolderOpen className="mr-2 h-5 w-5" /> Neue Baustelle anlegen
                </Button>
            <ResizableSidePanel
              isOpen={isNewProjectSheetOpen}
              onClose={() => setIsNewProjectSheetOpen(false)}
              storageKey="new-project"
              defaultWidth={540}
              minWidth={400}
              maxWidth={800}
              title={
                <div>
                  <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <FolderOpen className="text-primary" size={28} /> Neue Baustelle
                  </h2>
                  <p className="text-white/50 text-sm mt-1">Lege ein neues Projekt an und bereite das Aufmaß vor, bevor es in die Ausführung geht.</p>
                </div>
              }
              footer={
                <div className="p-6 w-full flex justify-between gap-4">
                  <Button variant="ghost" onClick={() => setIsNewProjectSheetOpen(false)} className="text-white/50 hover:text-white hover:bg-white/5 h-12 px-6 rounded-xl">Abbrechen</Button>
                  <Button onClick={handleAddProject} disabled={newProject.name.trim() === ''} className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl h-12 px-8 shadow-lg">Projekt anlegen</Button>
                </div>
              }
            >
                <div className="p-6 space-y-8">
                  
                  {/* Grunddaten */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2">
                      <FileText size={14} /> Grunddaten
                    </h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-white/80">Projektname / Bauvorhaben <span className="text-red-400">*</span></Label>
                        <Input className="glass-input h-11 bg-white/[0.03] border-white/10 focus:bg-white/[0.06] text-white" value={newProject.name} onChange={(e) => setNewProject({ ...newProject, name: e.target.value })} autoFocus placeholder="z.B. EFH Müller Sanierung" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-white/80">Auftraggeber (Optional)</Label>
                          <Input className="glass-input h-11 bg-white/[0.03] border-white/10 text-white" value={newProject.client_name} onChange={(e) => setNewProject({ ...newProject, client_name: e.target.value })} placeholder="Kunde GmbH" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-white/80">Start-Status</Label>
                          <Select value={newProject.status} onValueChange={(val) => setNewProject({ ...newProject, status: val })}>
                            <SelectTrigger className="glass-input bg-white/[0.03] border-white/10 text-white h-11">
                              <SelectValue placeholder="Status wählen..." />
                            </SelectTrigger>
                            <SelectContent className="bg-background border-white/10 text-white">
                              <SelectItem value="planning">Planung / Angebot</SelectItem>
                              <SelectItem value="active">Laufend / Ausführung</SelectItem>
                              <SelectItem value="completed">Abgeschlossen</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Zeitraum & Standort */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2">
                      <MapPin size={14} /> Zeitraum & Standort
                    </h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-white/80">Adresse / Ort (Optional)</Label>
                        <Input className="glass-input h-11 bg-white/[0.03] border-white/10 text-white" value={newProject.address} onChange={(e) => setNewProject({ ...newProject, address: e.target.value })} placeholder="Musterstraße 1, 12345 Stadt" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-white/80">Startdatum</Label>
                          <div className="relative">
                            <Input className="glass-input h-11 bg-white/[0.03] border-white/10 pl-10 text-white" type="date" value={newProject.start_date} onChange={(e) => setNewProject({ ...newProject, start_date: e.target.value })} />
                            <Calendar className="absolute left-3 top-3 h-5 w-5 text-white/40 pointer-events-none" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-white/80">Enddatum</Label>
                          <div className="relative">
                            <Input className="glass-input h-11 bg-white/[0.03] border-white/10 pl-10 text-white" type="date" value={newProject.end_date} onChange={(e) => setNewProject({ ...newProject, end_date: e.target.value })} />
                            <Calendar className="absolute left-3 top-3 h-5 w-5 text-white/40 pointer-events-none" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Extras */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2">
                      <Briefcase size={14} /> Extras
                    </h3>
                    <div className="space-y-2">
                      <Label className="text-white/80">Interne Bemerkung (Optional)</Label>
                      <Textarea className="glass-input min-h-[100px] bg-white/[0.03] border-white/10 text-white resize-none" value={newProject.notes} onChange={(e) => setNewProject({ ...newProject, notes: e.target.value })} placeholder="Wichtige Hinweise für den Monteur..." />
                    </div>
                  </div>

                </div>
            </ResizableSidePanel>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="ios-card bg-white/[0.02] border border-white/5 p-4 rounded-xl flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                <BarChart3 size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-white/50 uppercase tracking-wider font-semibold">Gesamt</p>
                <div className="text-2xl font-bold text-white">{stats.total}</div>
              </div>
            </div>
            <div className="ios-card bg-white/[0.02] border border-white/5 p-4 rounded-xl flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center text-yellow-500 shrink-0">
                <ClipboardList size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-white/50 uppercase tracking-wider font-semibold">In Planung</p>
                <div className="text-2xl font-bold text-white">{stats.planning}</div>
              </div>
            </div>
            <div className="ios-card bg-white/[0.02] border border-white/5 p-4 rounded-xl flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary shrink-0">
                <Activity size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-white/50 uppercase tracking-wider font-semibold">Laufend</p>
                <div className="text-2xl font-bold text-white">{stats.active}</div>
              </div>
            </div>
            <div className="ios-card bg-white/[0.02] border border-white/5 p-4 rounded-xl flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white/80 shrink-0">
                <PackageOpen size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-white/50 uppercase tracking-wider font-semibold">Erfasste Pos.</p>
                <div className="text-2xl font-bold text-white">{stats.totalItems}</div>
              </div>
            </div>
          </div>

          {/* Kanban Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
            
            {/* Column: Planung */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <h2 className="text-lg font-bold flex items-center gap-2 text-white/90">
                  <ClipboardList className="text-yellow-500" size={18} /> Planung / Angebot
                </h2>
                <div className="bg-white/10 text-white/60 text-xs font-bold px-2 py-0.5 rounded-full">{stats.planning}</div>
              </div>
              <div className="flex flex-col gap-3 min-h-[200px]">
                <AnimatePresence>
                  {planningProjects.length === 0 && !isLoading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-white/30 text-sm text-center py-8">Keine Projekte in Planung</motion.div>
                  )}
                  {planningProjects.map(renderProjectCard)}
                </AnimatePresence>
              </div>
            </div>

            {/* Column: Laufend */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <h2 className="text-lg font-bold flex items-center gap-2 text-white/90">
                  <Activity className="text-primary" size={18} /> Laufend / Ausführung
                </h2>
                <div className="bg-primary/20 text-primary text-xs font-bold px-2 py-0.5 rounded-full">{stats.active}</div>
              </div>
              <div className="flex flex-col gap-3 min-h-[200px]">
                <AnimatePresence>
                  {activeProjects.length === 0 && !isLoading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-white/30 text-sm text-center py-8">Keine laufenden Projekte</motion.div>
                  )}
                  {activeProjects.map(renderProjectCard)}
                </AnimatePresence>
              </div>
            </div>

            {/* Column: Abgeschlossen */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <h2 className="text-lg font-bold flex items-center gap-2 text-white/60">
                  <CheckCircle2 className="text-white/40" size={18} /> Abgeschlossen
                </h2>
                <div className="bg-white/10 text-white/40 text-xs font-bold px-2 py-0.5 rounded-full">{stats.completed}</div>
              </div>
              <div className="flex flex-col gap-3 min-h-[200px]">
                <AnimatePresence>
                  {completedProjects.length === 0 && !isLoading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-white/30 text-sm text-center py-8">Keine abgeschlossenen Projekte</motion.div>
                  )}
                  {completedProjects.map(renderProjectCard)}
                </AnimatePresence>
              </div>
            </div>

          </div>

        </div>
      </div>
    </motion.div>
  );
}
