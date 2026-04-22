import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, animate } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ResizableSidePanel } from '@/components/ui/ResizableSidePanel';
import { Label } from '@/components/ui/label';
import { Activity, FolderOpen, CheckCircle2, Calendar, MapPin, User, ArrowRight, Trash2, ListChecks, ChevronRight, ChevronLeft, BarChart3, PackageOpen, ClipboardList, Briefcase, FileText, Plus, Sparkles } from 'lucide-react';
import { subscribeToProjects, addProjectToSupabase, updateProject, deleteProjectFromSupabase, setCurrentProjectId, markProjectItemsAsAngebot } from '@/lib/project-storage';
import { preloadCatalog } from '@/lib/catalog-storage';
import type { Project } from '@/lib/project-storage';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';

const CountUp = ({ value }: { value: number }) => {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    const controls = animate(0, value, {
      duration: 1.5,
      ease: "easeOut",
      onUpdate: (latest) => setDisplayValue(Math.round(latest))
    });
    return () => controls.stop();
  }, [value]);

  return <span>{displayValue}</span>;
};

const SpotlightCard = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      className={cn("relative overflow-hidden group", className)}
    >
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300 z-10"
        style={{
          opacity,
          background: `radial-gradient(350px circle at ${position.x}px ${position.y}px, rgba(16, 185, 129, 0.15), transparent 80%)`,
        }}
      />
      {children}
    </div>
  );
};

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewProjectSheetOpen, setIsNewProjectSheetOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', client_name: '', address: '', notes: '', status: 'planning', start_date: '', end_date: '' });
  
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    setIsLoading(true);
    preloadCatalog();
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
        if (project.status === 'planning' && newStatus === 'active') {
          await markProjectItemsAsAngebot(project.id);
        }
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

  const renderProjectCard = (project: Project, index: number) => {
    const articleCount = (project.selectedItems || []).filter(item => item.type === 'article').length;
    const sectionCount = (project.selectedItems || []).filter(item => item.type === 'section').length;

    return (
      <motion.div 
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ 
          type: 'spring', 
          stiffness: 400, 
          damping: 30,
          delay: index * 0.05 
        }}
        key={project.id} 
        className="w-full"
      >
        <SpotlightCard className="bg-card border border-border rounded-xl shadow-sm overflow-hidden group flex flex-col hover:shadow-md hover:border-primary/30 transition-all duration-300">
          <div className="p-4 space-y-3 flex-1">
            <div className="flex justify-between items-start gap-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground leading-tight break-words flex items-center gap-2 group-hover:text-primary transition-colors">
                  {project.name}
                </h3>
                {project.client_name && (
                  <p className="text-muted-foreground text-xs flex items-center gap-1.5 focus:outline-none focus:ring-0">
                    <User className="w-3.5 h-3.5" /> {project.client_name}
                  </p>
                )}
              </div>
              
              <div className="shrink-0 flex items-center relative z-20">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                      <Trash2 size={14} />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="sm:max-w-md bg-card border border-border">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-xl font-bold text-foreground">Baustelle löschen?</AlertDialogTitle>
                      <AlertDialogDescription className="text-muted-foreground">
                        Möchten Sie "{project.name}" wirklich unwiderruflich löschen? Alle zugehörigen Aufmaße gehen verloren.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                      <AlertDialogCancel className="border border-border bg-background text-foreground hover:bg-muted rounded-xl">Abbrechen</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteProject(project.id)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl">Löschen</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-2">
              <div className="flex items-center gap-1.5 bg-muted border border-border px-2 py-1 rounded-md text-[10px] sm:text-xs text-muted-foreground font-medium group-hover:bg-primary/5 transition-colors">
                <ListChecks size={12} className="text-primary" />
                <span>{articleCount} Art.</span>
              </div>
              <div className="flex items-center gap-1.5 bg-muted border border-border px-2 py-1 rounded-md text-[10px] sm:text-xs text-muted-foreground font-medium group-hover:bg-primary/5 transition-colors">
                <FolderOpen size={12} className="text-primary" />
                <span>{sectionCount} Ord.</span>
              </div>
            </div>

            {project.address && (
              <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
                <span className="leading-snug truncate">{project.address}</span>
              </div>
            )}

            {(project.start_date || project.end_date) && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                <span>
                  {project.start_date ? formatDate(project.start_date) : ''} 
                  {project.end_date ? ` - ${formatDate(project.end_date)}` : ''}
                </span>
              </div>
            )}

            {project.notes && (
              <div className="text-xs text-muted-foreground italic line-clamp-2 pl-2 border-l-2 border-border">
                {project.notes}
              </div>
            )}
            
            <div className="text-[10px] text-muted-foreground/70 pt-1">
              Letzte Änderung: {formatDate(project.updated_at)}
            </div>
          </div>

          <div className="border-t border-border p-2 bg-muted/30 flex items-center justify-between gap-2 relative z-20">
            {/* Status Controls */}
            <div className="flex bg-background border border-border rounded-lg p-0.5 shrink-0 shadow-sm">
              {project.status === 'completed' && (
                <Button size="icon" variant="ghost" onClick={() => handleUpdateStatus(project, 'active')} className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Zurück in Ausführung">
                  <ChevronLeft size={16} />
                </Button>
              )}
              {project.status === 'active' && (
                 <Button size="icon" variant="ghost" onClick={() => handleUpdateStatus(project, 'planning')} className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Zurück in Planung">
                   <ChevronLeft size={16} />
                 </Button>
              )}
              {project.status === 'planning' && (
                <Button size="icon" variant="ghost" onClick={() => handleUpdateStatus(project, 'active')} className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10" title="In Ausführung geben">
                  <ChevronRight size={16} />
                </Button>
              )}
              {project.status === 'active' && (
                <Button size="icon" variant="ghost" onClick={() => handleUpdateStatus(project, 'completed')} className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/30" title="Projektabschluss">
                  <ChevronRight size={16} />
                </Button>
              )}
            </div>

            <Button onClick={() => handleSelectProject(project.id)} variant="ghost" className="h-8 flex-1 text-xs text-foreground font-semibold hover:bg-primary/10 hover:text-primary transition-all group-hover:translate-x-1">
              <span>Aufmaß {project.status === 'planning' ? 'vorbereiten' : 'öffnen'}</span>
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        </SpotlightCard>
      </motion.div>
    );
  };

  const pageVariants = {
    initial: { opacity: 0 },
    animate: { 
      opacity: 1, 
      transition: { 
        duration: 0.6, 
        ease: 'easeOut',
        staggerChildren: 0.1,
        when: "beforeChildren"
      } 
    },
    exit: { opacity: 0, transition: { duration: 0.3 } }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { 
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  return (
    <motion.div 
      className="h-full relative flex flex-col overflow-hidden bg-background"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* Animated Retro Grid Background */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-20" 
        style={{ 
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(ellipse 60% 50% at 50% 0%, #000 70%, transparent 100%)'
        }} 
      />
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] animate-blob" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-blob animation-delay-2000" />
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto w-full scrollbar-thin">
        <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-8">
          
          {/* Hero Section */}
          <div className="relative overflow-hidden bg-card/50 backdrop-blur-sm border border-border rounded-3xl shadow-2xl p-6 md:p-10 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
            <div className="relative z-10 space-y-1">
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-[0.2em]"
              >
                <Sparkles size={16} /> Dashboard
              </motion.div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight text-foreground">
                Willkommen zurück
              </h1>
              <p className="text-muted-foreground text-lg font-medium opacity-80">
                Verwalte deine Baustellen und Aufmaße mit Präzision.
              </p>
            </div>
            
            <Button 
              onClick={() => setIsNewProjectSheetOpen(true)} 
              className="group relative z-10 bg-primary hover:bg-primary/90 text-primary-foreground font-black rounded-2xl shadow-lg h-14 px-8 flex items-center gap-3 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] overflow-hidden"
              title="Neue Baustelle anlegen"
            >
              {/* Shiny Effect Overlay */}
              <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12" />
              
              <Plus className="h-6 w-6 transition-transform group-hover:rotate-90 duration-300" />
              <span className="text-lg">Neues Projekt</span>
            </Button>
            
            {/* New Project Panel */}
            <ResizableSidePanel
              isOpen={isNewProjectSheetOpen}
              onClose={() => setIsNewProjectSheetOpen(false)}
              storageKey="new-project"
              defaultWidth={540}
              minWidth={400}
              maxWidth={800}
              title={
                <div>
                  <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
                    <FolderOpen className="text-primary" size={28} /> Neue Baustelle
                  </h2>
                  <p className="text-muted-foreground text-sm mt-1">Lege ein neues Projekt an und bereite das Aufmaß vor, bevor es in die Ausführung geht.</p>
                </div>
              }
              footer={
                <div className="p-6 w-full flex justify-between gap-4 border-t border-border bg-card">
                  <Button variant="outline" onClick={() => setIsNewProjectSheetOpen(false)} className="h-12 px-6 rounded-xl">Abbrechen</Button>
                  <Button onClick={handleAddProject} disabled={newProject.name.trim() === ''} className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl h-12 px-8 shadow-sm">Projekt anlegen</Button>
                </div>
              }
            >
                <div className="p-6 space-y-8 bg-background">
                  
                  {/* Grunddaten */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border pb-2">
                      <FileText size={14} /> Grunddaten
                    </h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-foreground">Projektname / Bauvorhaben <span className="text-destructive">*</span></Label>
                        <Input className="h-11 bg-background border-border text-foreground focus:ring-primary/50" value={newProject.name} onChange={(e) => setNewProject({ ...newProject, name: e.target.value })} placeholder="z.B. EFH Müller Sanierung" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-foreground">Auftraggeber (Optional)</Label>
                          <Input className="h-11 bg-background border-border text-foreground focus:ring-primary/50" value={newProject.client_name} onChange={(e) => setNewProject({ ...newProject, client_name: e.target.value })} placeholder="Kunde GmbH" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-foreground">Start-Status</Label>
                          <Select value={newProject.status} onValueChange={(val) => setNewProject({ ...newProject, status: val })}>
                            <SelectTrigger className="bg-background border-border text-foreground h-11 focus:ring-primary/50">
                              <SelectValue placeholder="Status wählen..." />
                            </SelectTrigger>
                            <SelectContent className="bg-popover border-border text-popover-foreground">
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
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border pb-2">
                      <MapPin size={14} /> Zeitraum & Standort
                    </h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-foreground">Adresse / Ort (Optional)</Label>
                        <Input className="h-11 bg-background border-border text-foreground focus:ring-primary/50" value={newProject.address} onChange={(e) => setNewProject({ ...newProject, address: e.target.value })} placeholder="Musterstraße 1, 12345 Stadt" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-foreground">Startdatum</Label>
                          <div className="relative">
                            <Input className="h-11 bg-background border-border pl-10 text-foreground focus:ring-primary/50" type="date" value={newProject.start_date} onChange={(e) => setNewProject({ ...newProject, start_date: e.target.value })} />
                            <Calendar className="absolute left-3 top-3 h-5 w-5 text-muted-foreground pointer-events-none" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-foreground">Enddatum</Label>
                          <div className="relative">
                            <Input className="h-11 bg-background border-border pl-10 text-foreground focus:ring-primary/50" type="date" value={newProject.end_date} onChange={(e) => setNewProject({ ...newProject, end_date: e.target.value })} />
                            <Calendar className="absolute left-3 top-3 h-5 w-5 text-muted-foreground pointer-events-none" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Extras */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border pb-2">
                      <Briefcase size={14} /> Extras
                    </h3>
                    <div className="space-y-2">
                      <Label className="text-foreground">Interne Bemerkung (Optional)</Label>
                      <Textarea className="min-h-[100px] bg-background border-border text-foreground resize-none focus:ring-primary/50" value={newProject.notes} onChange={(e) => setNewProject({ ...newProject, notes: e.target.value })} placeholder="Wichtige Hinweise für den Monteur..." />
                    </div>
                  </div>

                </div>
            </ResizableSidePanel>
          </div>

          {/* Bento Stats Grid */}
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-4 grid-rows-2 gap-4 h-auto md:h-[240px]">
            {/* Total Stat - Large Bento Box */}
            <motion.div 
              variants={pageVariants} 
              className="md:col-span-2 md:row-span-2 bg-card border border-border rounded-3xl shadow-xl p-8 flex flex-col justify-between group hover:border-primary/50 transition-all duration-500 overflow-hidden relative"
            >
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                <BarChart3 size={120} className="text-primary rotate-12 group-hover:rotate-0 transition-transform duration-700" />
              </div>
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4 shadow-inner">
                  <BarChart3 size={32} />
                </div>
                <p className="text-sm text-muted-foreground uppercase tracking-widest font-black">Gesamte Projekte</p>
              </div>
              <div className="relative z-10 text-7xl font-black text-foreground tracking-tighter">
                <CountUp value={stats.total} />
              </div>
            </motion.div>

            {/* In Planung */}
            <motion.div 
              variants={pageVariants} 
              className="md:col-span-1 bg-card border border-border rounded-3xl shadow-lg p-6 flex flex-col justify-between group hover:border-amber-500/50 transition-all duration-500"
            >
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-500 group-hover:scale-110 transition-transform">
                  <ClipboardList size={24} />
                </div>
                <div className="text-3xl font-black text-foreground">
                  <CountUp value={stats.planning} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-black">In Planung</p>
            </motion.div>

            {/* Laufend */}
            <motion.div 
              variants={pageVariants} 
              className="md:col-span-1 bg-card border border-border rounded-3xl shadow-lg p-6 flex flex-col justify-between group hover:border-primary/50 transition-all duration-500"
            >
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <Activity size={24} />
                </div>
                <div className="text-3xl font-black text-foreground">
                  <CountUp value={stats.active} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-black">Laufend</p>
            </motion.div>

            {/* Erfasste Pos. - Wide Bento Box */}
            <motion.div 
              variants={pageVariants} 
              className="md:col-span-2 bg-card border border-border rounded-3xl shadow-lg p-6 flex items-center gap-6 group hover:border-slate-400/50 transition-all duration-500 overflow-hidden relative"
            >
              <div className="absolute right-[-20px] bottom-[-20px] opacity-5 group-hover:opacity-10 transition-opacity">
                <PackageOpen size={100} />
              </div>
              <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 shrink-0 group-hover:rotate-12 transition-transform shadow-inner">
                <PackageOpen size={32} />
              </div>
              <div className="min-w-0 relative z-10">
                <div className="text-4xl font-black text-foreground">
                  <CountUp value={stats.totalItems} />
                </div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-black">Erfasste Positionen</p>
              </div>
            </motion.div>
          </motion.div>

          {/* Kanban Columns */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 pt-4">
            
            {/* Column: Planung */}
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between pb-3 border-b-2 border-amber-500/20">
                <h2 className="text-xl font-black flex items-center gap-2 text-foreground">
                  <ClipboardList className="text-amber-500" size={24} /> Planung
                </h2>
                <div className="bg-amber-500/10 text-amber-500 text-sm font-black px-3 py-1 rounded-xl border border-amber-500/20">{stats.planning}</div>
              </div>
              <motion.div variants={containerVariants} initial="hidden" animate="show" className="flex flex-col gap-4 min-h-[200px]">
                <AnimatePresence mode="popLayout">
                  {planningProjects.length === 0 && !isLoading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-muted-foreground text-sm text-center py-12 bg-card/30 rounded-3xl border border-dashed border-border italic">Keine Projekte in Planung</motion.div>
                  )}
                  {planningProjects.map((p, i) => renderProjectCard(p, i))}
                </AnimatePresence>
              </motion.div>
            </div>

            {/* Column: Laufend */}
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between pb-3 border-b-2 border-primary/20">
                <h2 className="text-xl font-black flex items-center gap-2 text-foreground">
                  <Activity className="text-primary" size={24} /> Ausführung
                </h2>
                <div className="bg-primary/10 text-primary text-sm font-black px-3 py-1 rounded-xl border border-primary/20">{stats.active}</div>
              </div>
              <motion.div variants={containerVariants} initial="hidden" animate="show" className="flex flex-col gap-4 min-h-[200px]">
                <AnimatePresence mode="popLayout">
                  {activeProjects.length === 0 && !isLoading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-muted-foreground text-sm text-center py-12 bg-card/30 rounded-3xl border border-dashed border-border italic">Keine laufenden Projekte</motion.div>
                  )}
                  {activeProjects.map((p, i) => renderProjectCard(p, i))}
                </AnimatePresence>
              </motion.div>
            </div>

            {/* Column: Abgeschlossen */}
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between pb-3 border-b-2 border-emerald-500/20">
                <h2 className="text-xl font-black flex items-center gap-2 text-foreground">
                  <CheckCircle2 className="text-emerald-500" size={24} /> Abgeschlossen
                </h2>
                <div className="bg-emerald-500/10 text-emerald-500 text-sm font-black px-3 py-1 rounded-xl border border-emerald-500/20">{stats.completed}</div>
              </div>
              <motion.div variants={containerVariants} initial="hidden" animate="show" className="flex flex-col gap-4 min-h-[200px]">
                <AnimatePresence mode="popLayout">
                  {completedProjects.length === 0 && !isLoading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-muted-foreground text-sm text-center py-12 bg-card/30 rounded-3xl border border-dashed border-border italic">Keine abgeschlossenen Projekte</motion.div>
                  )}
                  {completedProjects.map((p, i) => renderProjectCard(p, i))}
                </AnimatePresence>
              </motion.div>
            </div>

          </div>

        </div>
      </div>
    </motion.div>
  );
}
