import { cn } from '../../lib/utils';

interface BadgeProps {
  label: string;
  color?: string;
  dot?: boolean;
  className?: string;
}

export function Badge({ label, color = '#FF8A4C', dot, className }: BadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5', className)}
      style={{
        borderRadius: 9999,
        background: `${color}24`,
        border: `1px solid ${color}2e`,
        fontSize: 10,
        fontWeight: 700,
        color,
      }}
    >
      {dot && <span className="w-1 h-1 rounded-full" style={{ background: color }} />}
      {label}
    </span>
  );
}
