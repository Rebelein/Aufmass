import React from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/use-haptic-feedback';

interface SwipeableItemProps {
  children: React.ReactNode;
  onDelete: () => void;
  id: string;
}

export const SwipeableItem: React.FC<SwipeableItemProps> = ({ children, onDelete, id }) => {
  const x = useMotionValue(0);
  const { impactHeavy } = useHapticFeedback();
  
  // Map x-position to opacity and background color
  const opacity = useTransform(x, [-100, -50, 0], [1, 0.5, 0]);
  const backgroundColor = useTransform(x, [-100, 0], ['rgba(239, 68, 68, 0.2)', 'rgba(239, 68, 68, 0)']);
  const scale = useTransform(x, [-100, -50, 0], [1.1, 0.8, 0.5]);

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x < -100) {
      impactHeavy();
      onDelete();
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl mb-2 bg-muted border border-border">
      {/* Background/Delete Indicator */}
      <motion.div 
        style={{ backgroundColor, opacity }}
        className="absolute inset-0 flex items-center justify-end pr-6 z-0"
      >
        <motion.div style={{ scale }}>
          <Trash2 className="text-red-500 h-6 w-6" />
        </motion.div>
      </motion.div>

      {/* Foreground/Content */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -120, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className="relative z-10 bg-background/90 backdrop-blur-sm p-4 w-full touch-pan-y"
      >
        {children}
      </motion.div>
    </div>
  );
};
