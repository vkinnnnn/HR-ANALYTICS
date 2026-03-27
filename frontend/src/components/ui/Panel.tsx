import { cn } from '../../lib/utils';
import type { ReactNode } from 'react';

interface PanelProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export function Panel({ children, className, delay = 0 }: PanelProps) {
  return (
    <div
      className={cn('glass-panel hover-lift', className)}
      style={{ animation: `fadeUp 0.45s ease-out ${delay}ms both` }}
    >
      {children}
    </div>
  );
}
