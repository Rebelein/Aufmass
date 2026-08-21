import React, { useRef } from 'react';
import { cn } from '@/lib/utils';

interface ResizeHandleProps {
  className?: string;
  ariaLabel: string;
  /** Wird beim Start des Drag-Vorgangs aufgerufen */
  onStart?: () => void;
  /** Wird mit dem kumulativen deltaX seit Drag-Start aufgerufen */
  onDrag: (deltaX: number) => void;
  /** Wird beim Loslassen/Abbruch mit dem finalen deltaX aufgerufen */
  onEnd: (deltaX: number) => void;
  children?: React.ReactNode;
}

export function ResizeHandle({ className, ariaLabel, onStart, onDrag, onEnd, children }: ResizeHandleProps) {
  const startXRef = useRef(0);
  const draggingRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    startXRef.current = e.clientX;
    draggingRef.current = true;
    onStart?.();
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    onDrag(e.clientX - startXRef.current);
  };

  const finishDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    onEnd(e.clientX - startXRef.current);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const delta = e.key === 'ArrowLeft' ? -16 : 16;
      onDrag(delta);
      onEnd(delta);
    }
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      tabIndex={0}
      className={cn('touch-none select-none', className)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}
