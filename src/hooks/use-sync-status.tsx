import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { syncEvents } from '@/lib/sync-events';

interface SyncStatus {
  isInitialSync: boolean;
  progress: number; // 0 to 100
  lastUpdateLabel: string | null;
  changesCount: number;
  isVisible: boolean;
}

interface SyncContextType {
  status: SyncStatus;
  hideStatus: () => void;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SyncStatus>({
    isInitialSync: false,
    progress: 0,
    lastUpdateLabel: null,
    changesCount: 0,
    isVisible: false,
  });

  const hideStatus = useCallback(() => {
    setStatus(prev => ({ ...prev, isVisible: false }));
  }, []);

  useEffect(() => {
    const unsubscribe = syncEvents.subscribe((event) => {
      if (event.type === 'startInitial') {
        setStatus({
          isInitialSync: true,
          progress: 0,
          lastUpdateLabel: event.label || 'Initialisiere Datenbank...',
          changesCount: 0,
          isVisible: true,
        });
      } else if (event.type === 'progress') {
        const progress = event.total ? Math.min(Math.round((event.current! / event.total) * 100), 100) : 0;
        setStatus(prev => ({ ...prev, progress }));
      } else if (event.type === 'complete') {
        setStatus(prev => ({
          ...prev,
          isInitialSync: false,
          progress: 100,
          lastUpdateLabel: event.label || 'Synchronisation abgeschlossen',
          changesCount: event.changes || 0,
          isVisible: true,
        }));

        // Auto-hide after 5 seconds if changes were detected
        if (event.changes && event.changes > 0) {
          setTimeout(() => {
            setStatus(prev => ({ ...prev, isVisible: false }));
          }, 5000);
        } else if (!status.isInitialSync) {
           // Also hide after 3s if it was just a background check with 0 changes
           setTimeout(() => {
            setStatus(prev => ({ ...prev, isVisible: false }));
          }, 3000);
        }
      }
    });

    return () => unsubscribe();
  }, [status.isInitialSync]);

  return (
    <SyncContext.Provider value={{ status, hideStatus }}>
      {children}
    </SyncContext.Provider>
  );
}

export const useSyncStatus = () => {
  const context = useContext(SyncContext);
  if (!context) throw new Error('useSyncStatus must be used within SyncProvider');
  return context;
};
