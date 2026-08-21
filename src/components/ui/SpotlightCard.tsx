import React, { forwardRef, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  spotlightColor?: string;
}

export const SpotlightCard = forwardRef<HTMLDivElement, SpotlightCardProps>(({
  children,
  className,
  spotlightColor = 'rgba(16, 185, 129, 0.15)',
  ...props
}, ref) => {
  const divRef = useRef<HTMLDivElement | null>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const setRefs = (node: HTMLDivElement | null) => {
    divRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) (ref as { current: HTMLDivElement | null }).current = node;
  };

  // Rect nur bei Enter/Scroll/Resize neu messen – nicht bei jedem mousemove
  const measure = () => {
    if (divRef.current) rectRef.current = divRef.current.getBoundingClientRect();
  };

  React.useEffect(() => {
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = rectRef.current;
    if (!rect) return;
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={setRefs}
      onMouseEnter={() => { measure(); setOpacity(1); }}
      onMouseLeave={() => setOpacity(0)}
      onMouseMove={handleMouseMove}
      className={cn(
        "relative overflow-hidden",
        className
      )}
      {...props}
    >
      <div
        className="pointer-events-none absolute -inset-px transition duration-300"
        style={{
          opacity,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 40%)`,
        }}
      />
      {children}
    </div>
  );
});

SpotlightCard.displayName = 'SpotlightCard';
