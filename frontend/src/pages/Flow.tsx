import { useState, useEffect } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import api from '../lib/api';
import { PageHero } from '../components/ui/PageHero';
import { Panel } from '../components/ui/Panel';
import { SectionHeader } from '../components/ui/SectionHeader';
import { Badge } from '../components/ui/Badge';

/* ---------- types ---------- */
interface CrossFunctionCell {
  source: string;
  target: string;
  value: number;
}

interface FlowData {
  direction_split: Record<string, number>;
  direction_pct: Record<string, number>;
  heatmap: CrossFunctionCell[];
  same_function_rate: number;
  cross_function_rate: number;
  reciprocal_pairs: number;
}

/* ---------- constants ---------- */
const PALETTE = ['#FF8A4C', '#34d399', '#a78bfa', '#60a5fa', '#fbbf24', '#fb7185', '#22d3ee', '#f472b6'];
const DIR_COLORS: Record<string, string> = { Downward: '#fb7185', Upward: '#34d399', Lateral: '#60a5fa' };

const Shimmer = ({ height = 280 }: { height?: number }) => (
  <div style={{ height, background: 'rgba(255,255,255,0.03)', borderRadius: 8, animation: 'shimmer 2s infinite' }} />
);

export function Flow() {
  const [data, setData] = useState<FlowData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<FlowData>('/api/recognition/flow')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const heatmap = data?.heatmap ?? [];
  const fromFuncs = [...new Set(heatmap.map(h => h.source))];
  const toFuncs = [...new Set(heatmap.map(h => h.target))];
  const maxCount = Math.max(...heatmap.map(h => h.value), 1);

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 28px 44px' }}>
      <PageHero icon={<ArrowRightLeft size={20} />} title="Recognition Flow" subtitle="How recognition flows across roles and functions" />

      {/* Direction Split KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {(['Downward', 'Upward', 'Lateral'] as const).map((dir, i) => (
          <Panel key={dir} delay={i * 60}>
            {loading ? <Shimmer height={110} /> : (
              <div className="flex flex-col items-center py-4">
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#52525b', marginBottom: 8 }}>
                  {dir} Recognition
                </span>
                <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, color: DIR_COLORS[dir] }}>
                  {(data?.direction_pct?.[dir] ?? 0).toFixed(1)}%
                </span>
                <Badge
                  label={dir === 'Downward' ? 'Manager to Report' : dir === 'Upward' ? 'Report to Manager' : 'Peer to Peer'}
                  color={DIR_COLORS[dir]}
                  dot
                />
              </div>
            )}
          </Panel>
        ))}
      </div>

      {/* Same vs Cross Function */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <Panel delay={180}>
          {loading ? <Shimmer height={90} /> : (
            <div className="flex flex-col items-center py-4">
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#52525b', marginBottom: 6 }}>
                Same Function
              </span>
              <span style={{ fontSize: 32, fontWeight: 800, color: PALETTE[2] }}>
                {(data?.same_function_rate ?? 0).toFixed(1)}%
              </span>
            </div>
          )}
        </Panel>
        <Panel delay={240}>
          {loading ? <Shimmer height={90} /> : (
            <div className="flex flex-col items-center py-4">
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#52525b', marginBottom: 6 }}>
                Cross Function
              </span>
              <span style={{ fontSize: 32, fontWeight: 800, color: PALETTE[0] }}>
                {(data?.cross_function_rate ?? 0).toFixed(1)}%
              </span>
            </div>
          )}
        </Panel>
        <Panel delay={300}>
          {loading ? <Shimmer height={90} /> : (
            <div className="flex flex-col items-center py-4">
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#52525b', marginBottom: 6 }}>
                Reciprocal Pairs
              </span>
              <span style={{ fontSize: 32, fontWeight: 800, color: PALETTE[1] }}>
                {data?.reciprocal_pairs ?? 0}
              </span>
            </div>
          )}
        </Panel>
      </div>

      {/* Cross-Function Heatmap */}
      <Panel delay={360}>
        <SectionHeader icon={<ArrowRightLeft size={14} />} title="Cross-Function Heatmap" subtitle="From (row) to (column)" />
        {loading ? <Shimmer height={300} /> : heatmap.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#52525b' }}>No flow data available</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: `120px repeat(${toFuncs.length}, 1fr)`, gap: 2, marginBottom: 2 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#52525b', padding: 4 }}>FROM \ TO</span>
              {toFuncs.map(f => (
                <span key={f} style={{ fontSize: 9, fontWeight: 700, color: '#71717a', textAlign: 'center', padding: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {f}
                </span>
              ))}
            </div>
            {/* Rows */}
            {fromFuncs.map(from => (
              <div key={from} style={{ display: 'grid', gridTemplateColumns: `120px repeat(${toFuncs.length}, 1fr)`, gap: 2, marginBottom: 2 }}>
                <span style={{ fontSize: 11, color: '#a1a1aa', padding: '6px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{from}</span>
                {toFuncs.map(to => {
                  const cell = heatmap.find(h => h.source === from && h.target === to);
                  const val = cell?.value ?? 0;
                  const opacity = val / maxCount;
                  return (
                    <div
                      key={to}
                      title={`${from} → ${to}: ${val}`}
                      style={{
                        background: `rgba(255,138,76,${(opacity * 0.75).toFixed(2)})`,
                        borderRadius: 6,
                        padding: '6px 2px',
                        textAlign: 'center',
                        fontSize: 10,
                        fontWeight: 600,
                        color: opacity > 0.25 ? '#fafafa' : '#52525b',
                        minHeight: 28,
                      }}
                    >
                      {val > 0 ? val : ''}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
