import { supabase } from './supabase';
import type { ProjectSelectedItem } from './project-storage';

const QUEUE_KEY = 'aufmass_offline_queue';

type ActionType = 'upsert' | 'delete' | 'updateQuantity';

interface QueueAction {
  id: string; // Unique action ID
  type: ActionType;
  timestamp: number;
  payload: any;
}

export function getOfflineQueue(): QueueAction[] {
  try {
    const queue = localStorage.getItem(QUEUE_KEY);
    return queue ? JSON.parse(queue) : [];
  } catch (error) {
    console.error('Error reading offline queue:', error);
    return [];
  }
}

export function setOfflineQueue(queue: QueueAction[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('Error writing to offline queue:', error);
  }
}

export function addToOfflineQueue(type: ActionType, payload: any) {
  const queue = getOfflineQueue();
  queue.push({
    id: crypto.randomUUID(),
    type,
    timestamp: Date.now(),
    payload,
  });
  setOfflineQueue(queue);
  console.log(`[Offline Sync] Aktion ${type} zur Queue hinzugefügt.`);
}

export function clearOfflineQueue() {
  localStorage.removeItem(QUEUE_KEY);
}

export async function processOfflineQueue(): Promise<boolean> {
  const queue = getOfflineQueue();
  if (queue.length === 0) return true;

  console.log(`[Offline Sync] Verarbeite ${queue.length} Aktionen aus der Queue...`);
  
  // Sort by timestamp just to be sure
  queue.sort((a, b) => a.timestamp - b.timestamp);

  const failedActions: QueueAction[] = [];

  for (const action of queue) {
    try {
      if (action.type === 'upsert') {
        const { error } = await supabase
          .from('project_items')
          .upsert(action.payload, { onConflict: 'id' });
        
        if (error) throw error;
      } else if (action.type === 'delete') {
        const { error } = await supabase
          .from('project_items')
          .delete()
          .eq('id', action.payload.id);

        if (error) throw error;
      } else if (action.type === 'updateQuantity') {
        const { error } = await supabase
          .from('project_items')
          .update({ quantity: action.payload.quantity })
          .eq('id', action.payload.id);

        if (error) throw error;
      }
    } catch (err) {
      console.error(`[Offline Sync] Fehler bei Aktion ${action.type}:`, err);
      failedActions.push(action);
    }
  }

  setOfflineQueue(failedActions);
  
  if (failedActions.length === 0) {
    console.log('[Offline Sync] Alle Aktionen erfolgreich synchronisiert.');
    return true;
  } else {
    console.warn(`[Offline Sync] ${failedActions.length} Aktionen konnten nicht synchronisiert werden.`);
    return false;
  }
}

// Event-Listener Setup Hook für die Hauptkomponente (App/AufmassPage)
export function useOfflineSync(onSyncComplete?: () => void) {
  // Diese Hook wird in der Hauptkomponente aufgerufen und registriert den Listener
  if (typeof window !== 'undefined') {
    window.addEventListener('online', async () => {
      const success = await processOfflineQueue();
      if (success && onSyncComplete) {
        onSyncComplete();
      }
    });
  }
}
