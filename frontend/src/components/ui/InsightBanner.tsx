import type { ReactNode } from 'react';

interface InsightBannerProps {
  icon: ReactNode;
  message: string;
  color?: string;
  action?: ReactNode;
}

export function InsightBanner({ icon, message, color = '#a78bfa', action }: InsightBannerProps) {
  return (
    <div className="flex items-center justify-between p-4 rounded-[16px] mb-5" style={{
      background: `linear-gradient(135deg, ${color}14, ${color}08)`,
      border: `1px solid ${color}26`,
    }}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: `${color}1a` }}>
          <span style={{ color }}>{icon}</span>
        </div>
        <p style={{ fontSize: 13, color: '#a1a1aa' }}>{message}</p>
      </div>
      {action}
    </div>
  );
}
