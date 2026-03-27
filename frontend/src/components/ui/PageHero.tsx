import type { ReactNode } from 'react';

interface PageHeroProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
}

export function PageHero({ icon, title, subtitle }: PageHeroProps) {
  return (
    <div className="mb-7">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-[16px] flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FF8A4C, #e85d04)' }}>
          <span style={{ color: '#fff' }}>{icon}</span>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', color: '#fafafa' }}>{title}</h1>
      </div>
      <p style={{ fontSize: 13, color: '#71717a', maxWidth: 560, marginTop: 4 }}>{subtitle}</p>
      <div className="mt-3" style={{ width: 48, height: 2, background: 'linear-gradient(to right, #FF8A4C, transparent)', borderRadius: 1 }} />
    </div>
  );
}
