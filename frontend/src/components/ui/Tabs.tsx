import { useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  children: (activeTab: string) => ReactNode;
  className?: string;
}

export function Tabs({ tabs, children, className }: TabsProps) {
  const [active, setActive] = useState(tabs[0].id);
  return (
    <div className={className}>
      <div className="flex gap-1 p-1 rounded-[9999px] mb-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', display: 'inline-flex' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={cn('px-4 py-1.5 rounded-[9999px] text-xs font-semibold transition-all duration-200')}
            style={{
              background: active === tab.id ? 'rgba(255,138,76,0.15)' : 'transparent',
              color: active === tab.id ? '#FF8A4C' : '#71717a',
              border: active === tab.id ? '1px solid rgba(255,138,76,0.25)' : '1px solid transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {children(active)}
    </div>
  );
}
