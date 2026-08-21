import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { ResizeHandle } from '@/components/ui/ResizeHandle';

interface ResizableSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  /** localStorage key for persisting width */
  storageKey: string;
  /** Default width in px */
  defaultWidth?: number;
  /** Min width in px */
  minWidth?: number;
  /** Max width in px */
  maxWidth?: number;
  /** Which side the panel appears on */
  side?: 'left' | 'right';
  /** Additional className for the panel */
  className?: string;
  /** Footer content */
  footer?: React.ReactNode;
}

export function ResizableSidePanel({
  isOpen,
  onClose,
  title,
  children,
  storageKey,
  defaultWidth = 540,
  minWidth = 380,
  maxWidth = 1200,
  side = 'right',
  className,
  footer,
}: ResizableSidePanelProps) {
  const [width, setWidth] = useState(() => {
    const stored = localStorage.getItem(`panel-width-${storageKey}`);
    return stored ? Math.min(Math.max(parseInt(stored, 10), minWidth), maxWidth) : defaultWidth;
  });

  const isResizing = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const startWidthRef = useRef(width);

  // onClose in einer Ref halten, damit der Effekt NICHT bei jedem Render
  // (z.B. jedem Tastendruck in Formularfeldern) neu läuft.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Escape schließt das Panel; Fokus-Verwaltung nur beim echten Öffnen/Schließen
  useEffect(() => {
    if (!isOpen) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Fokus nur zurückgeben, wenn das Panel wirklich geschlossen wird
      previouslyFocusedRef.current?.focus?.();
      previouslyFocusedRef.current = null;
    };
  }, [isOpen]);

  const handleResizeStart = useCallback(() => {
    isResizing.current = true;
    startWidthRef.current = width;
  }, [width]);

  const clampDelta = useCallback((deltaX: number) => {
    const d = side === 'right' ? -deltaX : deltaX;
    return Math.min(Math.max(startWidthRef.current + d, minWidth), maxWidth);
  }, [side, minWidth, maxWidth]);

  const handleResizeDrag = useCallback((deltaX: number) => {
    setWidth(clampDelta(deltaX));
  }, [clampDelta]);

  const handleResizeEnd = useCallback((deltaX: number) => {
    isResizing.current = false;
    setWidth(clampDelta(deltaX));
  }, [clampDelta]);

  // Save width whenever it changes
  useEffect(() => {
    localStorage.setItem(`panel-width-${storageKey}`, String(Math.round(width)));
  }, [width, storageKey]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 top-16 z-[60] bg-background/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            initial={{ x: side === 'right' ? '100%' : '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: side === 'right' ? '100%' : '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className={cn(
              "fixed top-16 bottom-0 z-[60] flex flex-col bg-background/80 backdrop-blur-[60px] border-border shadow-2xl outline-none",
              side === 'right' ? 'right-0 border-l' : 'left-0 border-r',
              className
            )}
            style={{ width: `${width}px`, maxWidth: '95vw' }}
          >
            {/* Resize handle */}
            <ResizeHandle
              ariaLabel="Panel in der Breite verändern"
              onStart={handleResizeStart}
              onDrag={handleResizeDrag}
              onEnd={handleResizeEnd}
              className={cn(
                "absolute top-0 bottom-0 w-1.5 cursor-col-resize group z-10",
                "hover:bg-emerald-500/30 active:bg-emerald-500/50 transition-colors",
                side === 'right' ? 'left-0 -ml-0.5' : 'right-0 -mr-0.5'
              )}
            >
              <div className={cn(
                "absolute top-1/2 -translate-y-1/2 w-0.5 h-12 rounded-full bg-border group-hover:bg-emerald-400/60 transition-colors",
                side === 'right' ? 'left-0.5' : 'right-0.5'
              )} />
            </ResizeHandle>

            {/* Header */}
            {title && (
              <div className="p-5 bg-muted/50 border-b border-border shrink-0 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">{title}</div>
                <button
                  onClick={onClose}
                  aria-label="Panel schließen"
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-accent-foreground hover:bg-accent transition-[color,background-color,border-color,fill,stroke,opacity,box-shadow,transform] shrink-0 mt-0.5"
                >
                  <X size={18} />
                </button>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="border-t border-border bg-muted/50 shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
