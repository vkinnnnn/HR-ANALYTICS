import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface EmptyStateProps {
  icon: ReactNode;
  title?: string;
  message?: string;
  actionLabel?: string;
  actionTo?: string;
}

export function EmptyState({
  icon,
  title = 'No data yet',
  message = 'Upload a dataset in the Data Hub to get started.',
  actionLabel = 'Go to Data Hub',
  actionTo = '/data-hub',
}: EmptyStateProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', gap: 16 }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(255,138,76,0.08)', border: '1px solid rgba(255,138,76,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FF8A4C' }}>
        {icon}
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fafafa', letterSpacing: '-0.01em' }}>{title}</h3>
      <p style={{ fontSize: 13, color: '#52525b', maxWidth: 320, textAlign: 'center', lineHeight: 1.5 }}>{message}</p>
      <Link
        to={actionTo}
        style={{
          marginTop: 8, padding: '10px 24px', borderRadius: 9999,
          background: 'linear-gradient(135deg, rgba(255,138,76,0.15), rgba(232,93,4,0.15))',
          border: '1px solid rgba(255,138,76,0.25)',
          color: '#FF8A4C', fontSize: 12, fontWeight: 700, textDecoration: 'none',
        }}
      >
        {actionLabel} →
      </Link>
    </div>
  );
}
