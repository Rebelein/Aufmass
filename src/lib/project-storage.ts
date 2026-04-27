import { supabase } from './supabase';
import { generateUUID } from './utils';
import { addToOfflineQueue } from './sync-queue';
import { syncEvents } from './sync-events';

export interface ProjectSection {
  id: string;
  project_id: string;
  name: string; // stored in the 'text' column
  order: number;
}

export interface ProjectList {
  id: string;
  project_id: string;
  name: string;
  type: 'angebot' | 'aufmass';
  created_at: string;
}

export interface ProjectSelectedItem {
  id: string;
  project_id: string;
  list_id?: string | null;
  type: 'article' | 'section';
  order: number;
  section_id?: string | null;
  is_from_angebot?: boolean;

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
  status: 'planning' | 'active' | 'completed' | 'quick';
  address?: string | null;
  client_name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
  documents?: string[];
  lists: ProjectList[];
  selectedItems: ProjectSelectedItem[];
  created_at: string;
  updated_at: string;
}

const CURRENT_PROJECT_ID_KEY = 'catalogAppCurrentProjectId';

export async function getProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      project_lists(*),
      project_items(id, list_id, type)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching projects from Supabase:', error);
    return [];
  }
  return (data as any[]).map(p => ({ 
    ...p, 
    selectedItems: p.project_items || [], 
    lists: p.project_lists || [] 
  })) as Project[];
}

let lastProjectsCount = 0;

export function subscribeToProjects(callback: (projects: Project[]) => void) {
  const handleChange = async () => {
    const projects = await getProjects();
    const diff = projects.length - lastProjectsCount;
    if (diff !== 0) {
      syncEvents.emit({ type: 'complete', label: 'Baustellen aktualisiert', changes: Math.abs(diff) });
    }
    lastProjectsCount = projects.length;
    callback(projects);
  };

  const channel = supabase
    .channel('public:projects_and_lists')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, handleChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'project_lists' }, handleChange)
    .subscribe();

  getProjects().then(projects => {
    lastProjectsCount = projects.length;
    callback(projects);
  });
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

  // We try to fetch with project_lists, but if the table doesn't exist yet, we fallback
  const { data, error } = await supabase
    .from('projects')
    .select('*, project_items(*), project_lists(*)')
    .eq('id', projectId)
    .single();

  if (error) {
    // Fallback if project_lists doesn't exist
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('projects')
      .select('*, project_items(*)')
      .eq('id', projectId)
      .single();

    if (fallbackError) {
      console.error('Fehler beim Abrufen des Projekts:', fallbackError);
      return undefined;
    }
    return {
      ...fallbackData,
      lists: [],
      selectedItems: ((fallbackData.project_items as ProjectSelectedItem[]) || []).sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      ),
    } as Project;
  }

  return {
    ...data,
    lists: (data.project_lists as ProjectList[]) || [],
    selectedItems: ((data.project_items as ProjectSelectedItem[]) || []).sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0)
    ),
  } as Project;
}

export async function addProjectToSupabase(projectName: string, projectData?: Partial<Omit<Project, 'id' | 'selectedItems' | 'created_at' | 'updated_at' | 'lists'>>): Promise<Project | null> {
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
  
  const createdProject = data as Project;
  
  // Automatisch erstes Aufmaßblatt anlegen
  const defaultListType = createdProject.status === 'planning' ? 'angebot' : 'aufmass';
  const defaultListName = defaultListType === 'angebot' ? 'Angebot 1' : 'Aufmaßblatt 1';
  
  const { data: listData } = await supabase
    .from('project_lists')
    .insert([{ project_id: createdProject.id, name: defaultListName, type: defaultListType }])
    .select()
    .single();
    
  return { 
    ...createdProject, 
    selectedItems: [], 
    lists: listData ? [listData as ProjectList] : [] 
  };
}

export async function updateProject(projectId: string, updates: Partial<Omit<Project, 'id' | 'selectedItems' | 'created_at' | 'updated_at' | 'lists'>>): Promise<boolean> {
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

// --- List Management ---

export async function createProjectList(projectId: string, name: string, type: 'angebot' | 'aufmass'): Promise<ProjectList | null> {
  const { data, error } = await supabase
    .from('project_lists')
    .insert([{ project_id: projectId, name, type }])
    .select()
    .single();

  if (error) {
    console.error('Fehler beim Erstellen der Liste:', error);
    return null;
  }
  return data as ProjectList;
}

export async function deleteProjectList(listId: string): Promise<boolean> {
  const { error } = await supabase
    .from('project_lists')
    .delete()
    .eq('id', listId);
  return !error;
}

export async function updateProjectList(listId: string, updates: Partial<Pick<ProjectList, 'name' | 'type'>>): Promise<boolean> {
  const { error } = await supabase
    .from('project_lists')
    .update(updates)
    .eq('id', listId);
  return !error;
}

export async function markProjectItemsAsAngebot(projectId: string): Promise<boolean> {
  const { error } = await supabase
    .from('project_items')
    .update({ is_from_angebot: true })
    .eq('project_id', projectId)
    .is('is_from_angebot', false);

  if (error) {
    console.error('Fehler beim Markieren der Angebots-Artikel:', error);
  }
  return !error;
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
    list_id: item.list_id ?? null,
    type: item.type,
    order: item.order,
    section_id: item.section_id ?? null,
    quantity: item.quantity ?? null,
    is_from_angebot: item.is_from_angebot ?? false,
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

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    addToOfflineQueue('upsert', payload);
    return item; // Optimistic return
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
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    addToOfflineQueue('delete', { id: itemId });
    return true; // Optimistic return
  }

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
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    addToOfflineQueue('updateQuantity', { id: itemId, quantity });
    return true; // Optimistic return
  }

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
  order: number,
  listId?: string | null
): Promise<ProjectSelectedItem | null> {
  const newSection: Record<string, unknown> = {
    id: generateUUID(),
    project_id: projectId,
    list_id: listId ?? null,
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
