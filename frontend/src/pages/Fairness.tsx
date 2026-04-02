import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { ShieldCheck } from 'lucide-react';
import api from '../lib/api';
import { PageHero } from '../components/ui/PageHero';
import { Panel } from '../components/ui/Panel';
import { SectionHeader } from '../components/ui/SectionHeader';
import { Badge } from '../components/ui/Badge';
import { ChartTooltip } from '../components/charts/ChartTooltip';

/* ---------- types ---------- */
interface GroupStat {
  name: string;
  avg_specificity: number;
  count: number;
}

interface FairnessData {
  company_avg_specificity: number;
  by_function: GroupStat[];
  by_seniority: GroupStat[];
}

/* ---------- constants ---------- */
const PALETTE = ['#FF8A4C', '#34d399', '#a78bfa', '#60a5fa', '#fbbf24', '#fb7185', '#22d3ee', '#f472b6'];
const AXIS = { fill: '#52525b', fontSize: 10 };
const GRID = 'rgba(255,255,255,0.03)';

const Shimmer = ({ height = 280 }: { height?: number }) => (
  <div style={{ height, background: 'rgba(255,255,255,0.03)', borderRadius: 8, animation: 'shimmer 2s infinite' }} />
);

export function Fairness() {
  const [data, setData] = useState<FairnessData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/recognition/fairness')
      .then(r => {
        const d = r.data;
        setData({
          company_avg_specificity: d.avg_specificity,
          by_function: (d.by_function || []).map((f: any) => ({ name: f.function, avg_specificity: f.avg_specificity, count: f.count })),
          by_seniority: (d.by_seniority || []).map((s: any) => ({ name: s.seniority, avg_specificity: s.avg_specificity, count: s.count })),
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const avg = data?.company_avg_specificity ?? 0;
  const byFunction = data?.by_function ?? [];
  const bySeniority = data?.by_seniority ?? [];

  const belowAvgFunctions = byFunction.filter(f => f.avg_specificity < avg).map(f => f.name);
  const belowAvgSeniority = bySeniority.filter(s => s.avg_specificity < avg).map(s => s.name);

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 28px 44px' }}>
      <PageHero icon={<ShieldCheck size={20} />} title="Fairness Audit" subtitle="Recognition equity across functions and seniority" />

      {/* Company Average */}
      <Panel delay={0} className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#52525b' }}>
              Company Average Specificity
            </span>
            <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.03em', color: PALETTE[0], lineHeight: 1, marginTop: 6 }}>
              {loading ? '...' : avg.toFixed(3)}
            </div>
          </div>
          <div className="flex gap-2">
            {belowAvgFunctions.length > 0 && (
              <Badge label={`${belowAvgFunctions.length} functions below avg`} color="#fb7185" dot />
            )}
            {belowAvgSeniority.length > 0 && (
              <Badge label={`${belowAvgSeniority.length} seniority levels below avg`} color="#fbbf24" dot />
            )}
          </div>
        </div>
      </Panel>

      {/* By Function */}
      <Panel delay={60} className="mb-4">
        <SectionHeader icon={<ShieldCheck size={14} />} title="Average Specificity by Function" subtitle="Dashed line = company average" />
        {loading ? <Shimmer height={320} /> : (
          <>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={byFunction} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} interval={0} angle={-25} textAnchor="end" height={60} />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} domain={[0, 'auto']} />
                <Tooltip content={<ChartTooltip />} />
                <ReferenceLine y={avg} stroke="#FF8A4C" strokeDasharray="6 4" strokeWidth={1.5} label={{ value: `Avg ${avg.toFixed(2)}`, fill: '#FF8A4C', fontSize: 10, position: 'right' }} />
                <Bar dataKey="avg_specificity" radius={[4, 4, 0, 0]} name="Avg Specificity">
                  {byFunction.map((entry, i) => (
                    <Cell key={i} fill={entry.avg_specificity < avg ? '#fb7185' : '#34d399'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Below-average badges */}
            {belowAvgFunctions.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                <span style={{ fontSize: 11, color: '#71717a', alignSelf: 'center' }}>Below average:</span>
                {belowAvgFunctions.map(f => (
                  <Badge key={f} label={f} color="#fb7185" dot />
                ))}
              </div>
            )}
          </>
        )}
      </Panel>

      {/* By Seniority */}
      <Panel delay={120}>
        <SectionHeader icon={<ShieldCheck size={14} />} title="Average Specificity by Seniority" subtitle="Dashed line = company average" />
        {loading ? <Shimmer height={320} /> : (
          <>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={bySeniority} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} domain={[0, 'auto']} />
                <Tooltip content={<ChartTooltip />} />
                <ReferenceLine y={avg} stroke="#FF8A4C" strokeDasharray="6 4" strokeWidth={1.5} label={{ value: `Avg ${avg.toFixed(2)}`, fill: '#FF8A4C', fontSize: 10, position: 'right' }} />
                <Bar dataKey="avg_specificity" radius={[4, 4, 0, 0]} name="Avg Specificity">
                  {bySeniority.map((entry, i) => (
                    <Cell key={i} fill={entry.avg_specificity < avg ? '#fb7185' : '#34d399'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {belowAvgSeniority.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                <span style={{ fontSize: 11, color: '#71717a', alignSelf: 'center' }}>Below average:</span>
                {belowAvgSeniority.map(s => (
                  <Badge key={s} label={s} color="#fb7185" dot />
                ))}
              </div>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}
