import type { ReactNode } from 'react';

interface InsightBannerProps {
  icon: ReactNode;
  title?: string;
  message: string;
  color?: string;
  action?: ReactNode;
}

export function InsightBanner({ icon, title, message, color = '#FF8A4C', action }: InsightBannerProps) {
  return (
    <div
      className="flex items-center justify-between"
      style={{
        padding: '16px 20px',
        borderRadius: 16,
        marginBottom: 20,
        background: `linear-gradient(135deg, ${color}14, ${color}08)`,
        border: `1px solid ${color}26`,
      }}
    >
      <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
        <div
          className="flex items-center justify-center shrink-0"
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: `${color}26`,
          }}
        >
          <span style={{ color }}>{icon}</span>
        </div>
        <div style={{ minWidth: 0 }}>
          {title && (
            <p style={{ fontSize: 12, fontWeight: 700, color: '#fafafa', marginBottom: 2 }}>{title}</p>
          )}
          <p style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.5 }}>{message}</p>
        </div>
      </div>
      {action && <div className="shrink-0 ml-4">{action}</div>}
    </div>
  );
}
