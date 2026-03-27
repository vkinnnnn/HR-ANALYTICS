import type { ReactNode } from 'react';

interface PageHeroProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
}

export function PageHero({ icon, title, subtitle }: PageHeroProps) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center shrink-0"
          style={{
            width: 40,
            height: 40,
            borderRadius: 16,
            background: 'linear-gradient(135deg, rgba(255,138,76,0.13), rgba(255,138,76,0.03))',
            border: '1px solid rgba(255,138,76,0.15)',
          }}
        >
          <span style={{ color: '#FF8A4C' }}>{icon}</span>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', color: '#fafafa' }}>
          {title}
        </h1>
      </div>
      <p style={{ fontSize: 13, color: '#71717a', maxWidth: 560, marginTop: 6, marginLeft: 52 }}>
        {subtitle}
      </p>
      <div
        style={{
          width: 48,
          height: 2,
          background: 'linear-gradient(90deg, #FF8A4C, transparent)',
          borderRadius: 1,
          marginTop: 14,
          marginLeft: 52,
          opacity: 0.5,
        }}
      />
    </div>
  );
}
