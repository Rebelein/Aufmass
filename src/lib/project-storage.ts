import { supabase } from './supabase';
import { generateUUID } from './utils';

export interface ProjectSection {
  id: string;
  project_id: string;
  name: string; // stored in the 'text' column
  order: number;
}

export interface ProjectSelectedItem {
  id: string;
  project_id: string;
  type: 'article' | 'section';
  order: number;
  section_id?: string | null;

  // For catalog articles
  article_id?: string | null;

  // For all articles
  quantity?: number;

  // For sections
  text?: string;
  description?: string | null;
  images?: string[];

  // For manual articles
  name?: string;
  article_number?: string;
  unit?: string;
  supplier_name?: string;
}

export interface Project {
  id: string;
  name: string;
  status: 'planning' | 'active' | 'completed';
  address?: string | null;
  client_name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
  selectedItems: ProjectSelectedItem[];
  created_at: string;
  updated_at: string;
}

const CURRENT_PROJECT_ID_KEY = 'catalogAppCurrentProjectId';

export async function getProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching projects from Supabase:', error);
    return [];
  }
  return (data as Project[]).map(p => ({ ...p, selectedItems: [] }));
}

export function subscribeToProjects(callback: (projects: Project[]) => void) {
  const channel = supabase
    .channel('public:projects')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, async () => {
      const projects = await getProjects();
      callback(projects);
    })
    .subscribe();

  getProjects().then(callback);
  return () => { supabase.removeChannel(channel); };
}

export function getCurrentProjectId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CURRENT_PROJECT_ID_KEY);
}

export function setCurrentProjectId(projectId: string | null): void {
  if (typeof window === 'undefined') return;
  if (projectId) {
    localStorage.setItem(CURRENT_PROJECT_ID_KEY, projectId);
  } else {
    localStorage.removeItem(CURRENT_PROJECT_ID_KEY);
  }
}

export async function getProjectById(projectId: string): Promise<Project | undefined> {
  if (!projectId) return undefined;

  const { data, error } = await supabase
    .from('projects')
    .select('*, project_items(*)')
    .eq('id', projectId)
    .single();

  if (error) {
    console.error('Fehler beim Abrufen des Projekts:', error);
    return undefined;
  }

  return {
    ...data,
    selectedItems: ((data.project_items as ProjectSelectedItem[]) || []).sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0)
    ),
  } as Project;
}

export async function addProjectToSupabase(projectName: string, projectData?: Partial<Omit<Project, 'id' | 'selectedItems' | 'created_at' | 'updated_at'>>): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .insert([{ 
      name: projectName.trim(),
      status: projectData?.status || 'planning',
      address: projectData?.address || null,
      client_name: projectData?.client_name || null,
      start_date: projectData?.start_date || null,
      end_date: projectData?.end_date || null,
      notes: projectData?.notes || null
    }])
    .select()
    .single();

  if (error) {
    console.error('Projekt konnte nicht erstellt werden:', error);
    return null;
  }
  return { ...data, selectedItems: [] } as Project;
}

export async function updateProject(projectId: string, updates: Partial<Omit<Project, 'id' | 'selectedItems' | 'created_at' | 'updated_at'>>): Promise<boolean> {
  const payload = { ...updates };
  if (payload.name) {
    payload.name = payload.name.trim();
  }
  
  const { error } = await supabase
    .from('projects')
    .update(payload)
    .eq('id', projectId);
  return !error;
}

export async function updateProjectName(projectId: string, name: string): Promise<boolean> {
  return updateProject(projectId, { name });
}

export async function deleteProjectFromSupabase(projectId: string): Promise<boolean> {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId);

  if (!error && getCurrentProjectId() === projectId) {
    setCurrentProjectId(null);
  }
  return !error;
}

/**
 * Upsert a single project item. Uses the item's id for conflict resolution.
 * Sends ONLY the columns that exist in the DB (no extra fields).
 */
export async function upsertProjectItem(item: ProjectSelectedItem): Promise<ProjectSelectedItem | null> {
  const payload: Record<string, unknown> = {
    id: item.id,
    project_id: item.project_id,
    type: item.type,
    order: item.order,
    section_id: item.section_id ?? null,
    quantity: item.quantity ?? null,
    text: item.text ?? null,
    name: item.name ?? null,
    article_number: item.article_number ?? null,
    unit: item.unit ?? null,
    supplier_name: item.supplier_name ?? null,
    description: item.description ?? null,
    images: item.images ?? null,
  };

  // Only include article_id if present and not null
  if (item.article_id) {
    payload.article_id = item.article_id;
  }

  const { data, error } = await supabase
    .from('project_items')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('Fehler beim Speichern des Items:', error);
    return null;
  }
  return data as ProjectSelectedItem;
}

/**
 * Delete a single project item by id.
 */
export async function deleteProjectItem(itemId: string): Promise<boolean> {
  const { error } = await supabase
    .from('project_items')
    .delete()
    .eq('id', itemId);

  if (error) {
    console.error('Fehler beim Löschen des Items:', error);
  }
  return !error;
}

/**
 * Update only the quantity of an existing project item.
 */
export async function updateProjectItemQuantity(itemId: string, quantity: number): Promise<boolean> {
  const { error } = await supabase
    .from('project_items')
    .update({ quantity })
    .eq('id', itemId);

  if (error) {
    console.error('Fehler beim Aktualisieren der Menge:', error);
  }
  return !error;
}

/**
 * Add a new section to a project.
 */
export async function addSection(
  projectId: string,
  sectionName: string,
  order: number
): Promise<ProjectSelectedItem | null> {
  const newSection: Record<string, unknown> = {
    id: generateUUID(),
    project_id: projectId,
    type: 'section',
    text: sectionName.trim(),
    order,
    quantity: null,
    section_id: null,
    article_id: null,
  };

  const { data, error } = await supabase
    .from('project_items')
    .insert([newSection])
    .select()
    .single();

  if (error) {
    console.error('Fehler beim Erstellen des Abschnitts:', error);
    return null;
  }
  return data as ProjectSelectedItem;
}

/**
 * Legacy: kept for compatibility if needed elsewhere. 
 * Prefer upsertProjectItem + deleteProjectItem going forward.
 */
export async function syncProjectItems(projectId: string, items: ProjectSelectedItem[]): Promise<boolean> {
  const { error: deleteError } = await supabase
    .from('project_items')
    .delete()
    .eq('project_id', projectId);

  if (deleteError) return false;
  if (items.length === 0) return true;

  const itemsToInsert = items.map((item, index) => ({
    project_id: projectId,
    type: item.type,
    order: index,
    article_id: item.article_id ?? null,
    quantity: item.quantity ?? null,
    text: item.text ?? null,
    name: item.name ?? null,
    article_number: item.article_number ?? null,
    unit: item.unit ?? null,
    supplier_name: item.supplier_name ?? null,
    section_id: item.section_id ?? null,
  }));

  const { error: insertError } = await supabase
    .from('project_items')
    .insert(itemsToInsert);

  return !insertError;
}
