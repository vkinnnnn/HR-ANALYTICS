import { useState, useEffect } from 'react';
import { Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, BarChart, Bar, ComposedChart } from 'recharts';
import { Scale } from 'lucide-react';
import api from '../lib/api';
import { PageHero } from '../components/ui/PageHero';
import { Panel } from '../components/ui/Panel';
import { SectionHeader } from '../components/ui/SectionHeader';
import { Badge } from '../components/ui/Badge';
import { ChartTooltip } from '../components/charts/ChartTooltip';

/* ---------- types ---------- */
interface LorenzPoint {
  x: number;
  y: number;
}

interface TopRole {
  role: string;
  count: number;
}

interface InequalityData {
  gini: number;
  lorenz_curve: LorenzPoint[];
  top_10_share: number;
  bottom_50_share: number;
  power_recipients: TopRole[];
  single_award_roles: number;
  total_roles: number;
}

/* ---------- constants ---------- */
const PALETTE = ['#FF8A4C', '#34d399', '#a78bfa', '#60a5fa', '#fbbf24', '#fb7185', '#22d3ee', '#f472b6'];
const AXIS = { fill: '#52525b', fontSize: 10 };
const GRID = 'rgba(255,255,255,0.03)';

const Shimmer = ({ height = 280 }: { height?: number }) => (
  <div style={{ height, background: 'rgba(255,255,255,0.03)', borderRadius: 8, animation: 'shimmer 2s infinite' }} />
);

function giniColor(g: number): string {
  if (g < 0.3) return '#34d399';
  if (g < 0.5) return '#fbbf24';
  return '#fb7185';
}

export function Inequality() {
  const [data, setData] = useState<InequalityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<InequalityData>('/api/recognition/inequality')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const lorenzWithEquality = (data?.lorenz_curve ?? []).map(p => ({
    ...p,
    equality: p.x,
  }));

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 28px 44px' }}>
      <PageHero icon={<Scale size={20} />} title="Inequality & Distribution" subtitle="Recognition equity analysis" />

      {/* Gini + Comparison Cards */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Gini Gauge */}
        <Panel delay={0}>
          <SectionHeader title="Gini Coefficient" subtitle="0 = perfect equality, 1 = total inequality" />
          {loading ? <Shimmer height={120} /> : (
            <div className="flex flex-col items-center py-4">
              <span style={{
                fontSize: 56,
                fontWeight: 800,
                letterSpacing: '-0.03em',
                color: giniColor(data?.gini ?? 0),
                lineHeight: 1,
              }}>
                {(data?.gini ?? 0).toFixed(3)}
              </span>
              <span style={{ fontSize: 12, color: '#71717a', marginTop: 8 }}>
                {(data?.gini ?? 0) < 0.3 ? 'Low inequality' : (data?.gini ?? 0) < 0.5 ? 'Moderate inequality' : 'High inequality'}
              </span>
              <Badge
                label={(data?.gini ?? 0) < 0.3 ? 'Equitable' : (data?.gini ?? 0) < 0.5 ? 'Moderate' : 'Concentrated'}
                color={giniColor(data?.gini ?? 0)}
                dot
              />
            </div>
          )}
        </Panel>

        {/* Top 10% */}
        <Panel delay={60}>
          <SectionHeader title="Top 10% Share" subtitle="Recognition received by top decile" />
          {loading ? <Shimmer height={120} /> : (
            <div className="flex flex-col items-center py-4">
              <span style={{ fontSize: 44, fontWeight: 800, color: '#fb7185', lineHeight: 1 }}>
                {((data?.top_10_share ?? 0) * 100).toFixed(1)}%
              </span>
              <span style={{ fontSize: 12, color: '#71717a', marginTop: 8 }}>of all recognition</span>
            </div>
          )}
        </Panel>

        {/* Bottom 50% */}
        <Panel delay={120}>
          <SectionHeader title="Bottom 50% Share" subtitle="Recognition received by bottom half" />
          {loading ? <Shimmer height={120} /> : (
            <div className="flex flex-col items-center py-4">
              <span style={{ fontSize: 44, fontWeight: 800, color: '#fbbf24', lineHeight: 1 }}>
                {((data?.bottom_50_share ?? 0) * 100).toFixed(1)}%
              </span>
              <span style={{ fontSize: 12, color: '#71717a', marginTop: 8 }}>of all recognition</span>
            </div>
          )}
        </Panel>
      </div>

      {/* Lorenz Curve */}
      <Panel delay={180} className="mb-4">
        <SectionHeader icon={<Scale size={14} />} title="Lorenz Curve" subtitle="Cumulative share of recognition vs population" />
        {loading ? <Shimmer height={350} /> : (
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={lorenzWithEquality} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis dataKey="x" tick={AXIS} axisLine={false} tickLine={false} label={{ value: 'Population %', position: 'bottom', fill: '#52525b', fontSize: 10 }} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} label={{ value: 'Recognition %', angle: -90, position: 'insideLeft', fill: '#52525b', fontSize: 10 }} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="linear" dataKey="equality" stroke="#52525b" strokeDasharray="6 4" strokeWidth={1} dot={false} name="Perfect Equality" />
              <Area type="monotone" dataKey="y" stroke={PALETTE[0]} fill={PALETTE[0]} fillOpacity={0.15} strokeWidth={2} name="Actual Distribution" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </Panel>

      {/* Power Recipients */}
      <Panel delay={240}>
        <SectionHeader icon={<Scale size={14} />} title="Top 10 Most Recognized Roles" />
        {loading ? <Shimmer height={300} /> : (
          <ResponsiveContainer width="100%" height={Math.max(250, (data?.power_recipients?.length ?? 0) * 36)}>
            <BarChart data={data?.power_recipients ?? []} layout="vertical" margin={{ left: 140 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
              <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="role" tick={AXIS} axisLine={false} tickLine={false} width={130} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="count" fill={PALETTE[0]} radius={[0, 4, 4, 0]} name="Awards" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>
    </div>
  );
}
