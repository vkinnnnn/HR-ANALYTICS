import { useEffect, useRef, useState } from 'react';
import { formatNumber, formatCurrency } from '../../lib/utils';

interface AnimatedNumberProps {
  value: number;
  format?: 'number' | 'currency' | 'percent';
  duration?: number;
}

export function AnimatedNumber({ value, format = 'number', duration = 800 }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0);
  const frameRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const fromRef = useRef(0);

  useEffect(() => {
    fromRef.current = display;
    startRef.current = 0;

    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // cubic ease-out
      setDisplay(fromRef.current + (value - fromRef.current) * eased);
      if (progress < 1) frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [value, duration]);

  const formatted = format === 'currency'
    ? formatCurrency(display)
    : format === 'percent'
    ? `${display.toFixed(1)}%`
    : formatNumber(display);

  return <>{formatted}</>;
}
