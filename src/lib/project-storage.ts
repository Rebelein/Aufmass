'use client';

import { supabase } from './supabase';

export interface ProjectSelectedItem {
  id: string; // Supabase UUID
  project_id: string;
  type: 'article' | 'section';
  order: number; 
  
  // For catalog articles
  article_id?: string; 
  
  // For all articles
  quantity?: number;

  // For sections
  text?: string;
  
  // For manual articles
  name?: string;
  article_number?: string;
  unit?: string;
  supplier_name?: string;
}

export interface Project {
  id: string; // UUID from Supabase
  name: string;
  selectedItems: ProjectSelectedItem[];
  created_at: string;
  updated_at: string;
}

const CURRENT_PROJECT_ID_KEY = 'catalogAppCurrentProjectId';

/**
 * Fetches all projects from Supabase.
 * Real-time updates can be added via supabase.channel if needed.
 */
export async function getProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error fetching projects from Supabase:", error);
    return [];
  }
  return data as Project[];
}

/**
 * Subscribes to projects for real-time updates.
 */
export function subscribeToProjects(callback: (projects: Project[]) => void) {
  const channel = supabase
    .channel('public:projects')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, async () => {
      const projects = await getProjects();
      callback(projects);
    })
    .subscribe();

  // Initial fetch
  getProjects().then(callback);

  return () => {
    supabase.removeChannel(channel);
  };
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

  // Fetch project AND its items in one go
  const { data, error } = await supabase
    .from('projects')
    .select('*, project_items(*)')
    .eq('id', projectId)
    .single();

  if (error) {
    console.error("Fehler beim Abrufen des Projekts:", error);
    return undefined;
  }

  return {
    ...data,
    selectedItems: (data.project_items || []).sort((a: any, b: any) => a.order - b.order)
  } as Project;
}

export async function addProjectToSupabase(projectName: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .insert([{ name: projectName.trim() }])
    .select()
    .single();

  if (error) {
    console.error("Projekt konnte nicht erstellt werden:", error);
    return null;
  }
  return { ...data, selectedItems: [] } as Project;
}

export async function updateProjectName(projectId: string, name: string): Promise<boolean> {
  const { error } = await supabase
    .from('projects')
    .update({ name: name.trim() })
    .eq('id', projectId);

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
 * Syncs project items. For simplicity, we delete and re-insert or use a more complex upsert.
 * Given the typical size of an Aufmaß list, deleting and re-inserting is often acceptable.
 */
export async function syncProjectItems(projectId: string, items: ProjectSelectedItem[]): Promise<boolean> {
  // 1. Delete existing items
  const { error: deleteError } = await supabase
    .from('project_items')
    .delete()
    .eq('project_id', projectId);

  if (deleteError) return false;

  if (items.length === 0) return true;

  // 2. Insert new items
  const itemsToInsert = items.map((item, index) => ({
    ...item,
    project_id: projectId,
    order: index,
    id: undefined // Let Supabase generate new IDs or keep them if they are valid UUIDs
  }));

  const { error: insertError } = await supabase
    .from('project_items')
    .insert(itemsToInsert);

  return !insertError;
}
