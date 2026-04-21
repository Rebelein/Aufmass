"use client";

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';

interface ScreenshotAreaSelectorProps {
    onComplete: (area: { x: number; y: number; width: number; height: number } | null) => void;
}

const ScreenshotAreaSelector: React.FC<ScreenshotAreaSelectorProps> = ({ onComplete }) => {
    const [startPoint, setStartPoint] = useState<{ x: number, y: number } | null>(null);
    const [endPoint, setEndPoint] = useState<{ x: number, y: number } | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleDragStart = useCallback((clientX: number, clientY: number) => {
        setIsDragging(true);
        setStartPoint({ x: clientX, y: clientY });
        setEndPoint({ x: clientX, y: clientY });
    }, []);
    
    const handleDragMove = useCallback((clientX: number, clientY: number) => {
        if (!isDragging) return;
        setEndPoint({ x: clientX, y: clientY });
    }, [isDragging]);

    const handleDragEnd = useCallback(() => {
        if (!isDragging || !startPoint || !endPoint) {
            if (isDragging) {
                 onComplete(null);
            }
            setIsDragging(false);
            return;
        };
        setIsDragging(false);

        const x = Math.min(startPoint.x, endPoint.x);
        const y = Math.min(startPoint.y, endPoint.y);
        const width = Math.abs(startPoint.x - endPoint.x);
        const height = Math.abs(startPoint.y - endPoint.y);
        
        onComplete({ x, y, width, height });
    }, [isDragging, startPoint, endPoint, onComplete]);

    // Mouse event handlers
    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        handleDragStart(e.clientX, e.clientY);
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        handleDragMove(e.clientX, e.clientY);
    };
    
    // Touch event handlers
    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            handleDragStart(touch.clientX, touch.clientY);
        }
    };
    
    const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            handleDragMove(touch.clientX, touch.clientY);
        }
    };

    // Global listeners to end drag even if outside window
    React.useEffect(() => {
        const handleMouseUp = () => handleDragEnd();
        const handleTouchEnd = () => handleDragEnd();

        if (isDragging) {
            window.addEventListener('mouseup', handleMouseUp);
            window.addEventListener('touchend', handleTouchEnd);
        }
        return () => {
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchend', handleTouchEnd);
        }
    }, [isDragging, handleDragEnd]);

    const getSelectionBox = () => {
        if (!startPoint || !endPoint) return null;
        const x = Math.min(startPoint.x, endPoint.x);
        const y = Math.min(startPoint.y, endPoint.y);
        const width = Math.abs(startPoint.x - endPoint.x);
        const height = Math.abs(startPoint.y - endPoint.y);

        if (width < 2 && height < 2) return null;

        return (
            <div
                className="absolute border-2 border-dashed border-primary bg-primary/20 pointer-events-none"
                style={{ left: x, top: y, width, height }}
            />
        );
    };

    return (
        <div
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleDragEnd}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleDragEnd}
            className="fixed inset-0 z-[1000] bg-black/20 cursor-crosshair touch-none"
        >
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-background p-3 rounded-lg shadow-lg text-foreground font-body select-none">
                <p>Klicken und ziehen, um einen Bereich auszuwählen.</p>
            </div>
            {getSelectionBox()}
            <Button
                variant="destructive"
                className="absolute bottom-4 left-1/2 -translate-x-1/2"
                onClick={(e) => {
                    e.stopPropagation(); // Prevent mousedown on the underlying div
                    onComplete(null);
                }}
            >
                Abbrechen
            </Button>
        </div>
    );
};

export default ScreenshotAreaSelector;
