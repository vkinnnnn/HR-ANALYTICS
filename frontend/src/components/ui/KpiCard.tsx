import type { ReactNode } from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Panel } from './Panel';
import { AnimatedNumber } from './AnimatedNumber';

interface KpiCardProps {
  label: string;
  value: number;
  format?: 'number' | 'currency' | 'percent';
  change?: number;
  changeLabel?: string;
  icon?: ReactNode;
  color?: string;
  delay?: number;
  loading?: boolean;
  className?: string;
}

export function KpiCard({ label, value, format = 'number', change, changeLabel, icon, color = '#FF8A4C', delay = 0, loading, className }: KpiCardProps) {
  if (loading) {
    return (
      <Panel delay={delay} className={className}>
        <div className="space-y-3">
          <div className="h-3 w-24 rounded" style={{ background: 'rgba(255,255,255,0.06)', backgroundSize: '200% 100%', animation: 'shimmer 2s infinite' }} />
          <div className="h-7 w-32 rounded" style={{ background: 'rgba(255,255,255,0.06)', backgroundSize: '200% 100%', animation: 'shimmer 2s infinite' }} />
        </div>
      </Panel>
    );
  }

  return (
    <Panel delay={delay} className={cn('relative', className)}>
      {icon && (
        <div className="absolute top-5 right-5 w-[38px] h-[38px] rounded-[8px] flex items-center justify-center" style={{ background: `${color}1a` }}>
          <span style={{ color }}>{icon}</span>
        </div>
      )}
      <p className="text-label mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
          <AnimatedNumber value={value} format={format} />
        </span>
      </div>
      {change !== undefined && (
        <div className="flex items-center gap-1 mt-2" style={{ fontSize: 12 }}>
          {change >= 0 ? (
            <ArrowUpRight size={14} style={{ color: '#34d399' }} />
          ) : (
            <ArrowDownRight size={14} style={{ color: '#fb7185' }} />
          )}
          <span style={{ color: change >= 0 ? '#34d399' : '#fb7185', fontWeight: 600 }}>
            {Math.abs(change).toFixed(1)}%
          </span>
          {changeLabel && <span style={{ color: '#71717a', marginLeft: 4 }}>{changeLabel}</span>}
        </div>
      )}
    </Panel>
  );
}
