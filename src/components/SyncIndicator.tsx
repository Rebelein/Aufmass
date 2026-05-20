import React from 'react';
import { useSyncStatus } from '@/hooks/use-sync-status';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Database, CheckCircle2, Download, Package } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function SyncIndicator() {
  const { status } = useSyncStatus();

  return (
    <AnimatePresence>
      {status.isVisible && status.isInitialSync && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 backdrop-blur-2xl px-6"
        >
          <div className="max-w-md w-full bg-card text-card-foreground border-border border p-8 rounded-[2rem] flex flex-col items-center text-center shadow-2xl">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/20">
              <Database size={40} className="text-primary-foreground animate-pulse" />
            </div>
            
            <h2 className="text-2xl font-black text-foreground mb-2 leading-tight">
              Datenbank initialisieren
            </h2>
            <p className="text-muted-foreground text-sm mb-8">
              Wir laden den aktuellen Katalog für die Offline-Nutzung herunter. Bitte bleib kurz online.
            </p>

            <div className="w-full space-y-4">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-emerald-400">
                <span>{status.lastUpdateLabel}</span>
                <span>{status.progress}%</span>
              </div>
              <Progress value={status.progress} className="h-2 bg-muted border border-border" />
            </div>

            <div className="mt-10 flex items-center gap-2 text-muted-foreground text-xs italic">
              <RefreshCw size={12} className="animate-spin" />
              Synchronisierung läuft...
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
