type SyncEventType = 'startInitial' | 'progress' | 'complete' | 'error';

interface SyncEvent {
  type: SyncEventType;
  label?: string;
  current?: number;
  total?: number;
  changes?: number;
}

type SyncCallback = (event: SyncEvent) => void;

class SyncEventEmitter {
  private callbacks: Set<SyncCallback> = new Set();

  subscribe(callback: SyncCallback) {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  emit(event: SyncEvent) {
    this.callbacks.forEach(cb => cb(event));
  }
}

export const syncEvents = new SyncEventEmitter();
