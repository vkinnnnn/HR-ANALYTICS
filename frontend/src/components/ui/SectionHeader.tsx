import type { ReactNode } from 'react';

interface SectionHeaderProps {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function SectionHeader({ icon, title, subtitle, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="w-[30px] h-[30px] rounded-[8px] flex items-center justify-center" style={{ background: 'rgba(255,138,76,0.12)' }}>
            <span style={{ color: '#FF8A4C' }}>{icon}</span>
          </div>
        )}
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em', color: '#fafafa' }}>{title}</h3>
          {subtitle && <p style={{ fontSize: 11, color: '#52525b', marginTop: 2 }}>{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
