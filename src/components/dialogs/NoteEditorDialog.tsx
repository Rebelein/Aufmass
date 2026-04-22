import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useHapticFeedback } from '@/hooks/use-haptic-feedback';
import { Pen, Eraser, Undo, ImagePlus, Save, Trash2, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NoteEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (base64Image: string) => void;
}

export function NoteEditorDialog({ open, onOpenChange, onSave }: NoteEditorDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [mode, setMode] = useState<'draw' | 'erase'>('draw');
  const [color, setColor] = useState('#10b981'); // default emerald
  const [lineWidth, setLineWidth] = useState(3);
  
  // History for Undo
  const [history, setHistory] = useState<ImageData[]>([]);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);

  const { impactLight, impactMedium } = useHapticFeedback();

  // Initialize Canvas
  useEffect(() => {
    if (!open) {
      setBgImage(null);
      setHistory([]);
      return;
    }
    
    // Slight delay to allow modal animation to finish so container has width
    const timer = setTimeout(initCanvas, 100);
    return () => clearTimeout(timer);
  }, [open, bgImage]);

  const initCanvas = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions to match container
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height; // Use full height of container

    // Fill background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (bgImage) {
      // Draw background image centered and scaled to fit
      const scale = Math.min(canvas.width / bgImage.width, canvas.height / bgImage.height);
      const x = (canvas.width / 2) - (bgImage.width / 2) * scale;
      const y = (canvas.height / 2) - (bgImage.height / 2) * scale;
      ctx.drawImage(bgImage, x, y, bgImage.width * scale, bgImage.height * scale);
    }

    saveStateToHistory();
  };

  const saveStateToHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const currentState = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory(prev => {
      const newHistory = [...prev, currentState];
      // Keep only last 20 states
      if (newHistory.length > 20) return newHistory.slice(newHistory.length - 20);
      return newHistory;
    });
  };

  const handleUndo = () => {
    if (history.length <= 1) return; // Need at least 1 state to go back to (initial)
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const newHistory = [...history];
    newHistory.pop(); // Remove current state
    const previousState = newHistory[newHistory.length - 1];
    
    ctx.putImageData(previousState, 0, 0);
    setHistory(newHistory);
    impactLight();
  };

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); // Prevent scrolling on touch
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const { x, y } = getCoordinates(e);
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = mode === 'erase' ? '#ffffff' : color;
    ctx.lineWidth = mode === 'erase' ? lineWidth * 3 : lineWidth;
    
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const { x, y } = getCoordinates(e);
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveStateToHistory();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setBgImage(img);
        impactMedium();
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleClear = () => {
    setBgImage(null);
    setTimeout(initCanvas, 0);
    impactMedium();
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Save as JPEG to reduce size, high quality
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    onSave(dataUrl);
    onOpenChange(false);
    impactMedium();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[800px] h-[90vh] sm:h-[80vh] flex flex-col p-0 gap-0 bg-card text-card-foreground border-border shadow-sm rounded-xl border-border bg-background overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader className="p-4 border-b border-border shrink-0 bg-muted">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl text-gradient-emerald">Foto / Notiz</DialogTitle>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleClear}
                className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10 h-8 px-2"
                title="Blatt leeren"
              >
                <Trash2 size={16} className="sm:mr-2" />
                <span className="hidden sm:inline">Leeren</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Toolbar */}
        <div className="p-2 border-b border-border flex items-center justify-between bg-muted overflow-x-auto no-scrollbar shrink-0">
          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setMode('draw'); impactLight(); }}
              className={cn("h-9 w-9 sm:w-auto sm:px-3 rounded-xl transition-all", mode === 'draw' ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-muted-foreground hover:text-accent-foreground hover:bg-muted")}
            >
              <Pen size={16} className="sm:mr-2" />
              <span className="hidden sm:inline">Stift</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setMode('erase'); impactLight(); }}
              className={cn("h-9 w-9 sm:w-auto sm:px-3 rounded-xl transition-all", mode === 'erase' ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-muted-foreground hover:text-accent-foreground hover:bg-muted")}
            >
              <Eraser size={16} className="sm:mr-2" />
              <span className="hidden sm:inline">Radierer</span>
            </Button>
            
            <div className="w-px h-6 bg-muted mx-1" />
            
            <div className="flex items-center gap-1">
              {['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#000000'].map(c => (
                <button
                  key={c}
                  onClick={() => { setColor(c); setMode('draw'); impactLight(); }}
                  className={cn(
                    "w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 transition-all",
                    color === c && mode === 'draw' ? "border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.3)]" : "border-transparent opacity-70 hover:opacity-100 hover:scale-105"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            
            <div className="w-px h-6 bg-muted mx-1" />
            
            <Button
              variant="ghost"
              size="icon"
              onClick={handleUndo}
              disabled={history.length <= 1}
              className="h-9 w-9 rounded-xl text-muted-foreground hover:text-accent-foreground hover:bg-muted disabled:opacity-30 transition-all"
              title="Rückgängig"
            >
              <Undo size={16} />
            </Button>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <input 
              type="file" 
              ref={cameraInputRef} 
              onChange={handleImageUpload} 
              accept="image/*" 
              capture="environment" 
              className="hidden" 
            />
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
              accept="image/*" 
              className="hidden" 
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => cameraInputRef.current?.click()}
              className="h-9 px-2 sm:px-3 rounded-xl bg-muted text-foreground hover:text-accent-foreground hover:bg-accent transition-all border border-border"
            >
              <Camera size={16} className="sm:mr-2" />
              <span className="hidden sm:inline">Foto machen</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-9 px-2 sm:px-3 rounded-xl bg-muted text-foreground hover:text-accent-foreground hover:bg-accent transition-all border border-border"
            >
              <ImagePlus size={16} className="sm:mr-2" />
              <span className="hidden sm:inline">Hochladen</span>
            </Button>
          </div>
        </div>

        {/* Canvas Area */}
        <div 
          ref={containerRef} 
          className="flex-1 relative bg-gray-900 overflow-hidden touch-none"
        >
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseOut={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            onTouchCancel={stopDrawing}
            className="absolute top-0 left-0 w-full h-full cursor-crosshair touch-none"
            style={{ touchAction: 'none' }} // Crucial for preventing mobile scrolling while drawing
          />
        </div>

        <DialogFooter className="p-4 border-t border-border shrink-0 bg-muted flex-row justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-accent-foreground flex-1 sm:flex-none">Abbrechen</Button>
          <Button onClick={handleSave} className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold shadow-lg shadow-emerald-500/20 flex-1 sm:flex-none">
            <Save size={16} className="mr-2" /> Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
