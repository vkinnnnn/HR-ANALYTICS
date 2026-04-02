import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { MessageSquareText } from 'lucide-react';
import api from '../lib/api';
import { PageHero } from '../components/ui/PageHero';
import { Panel } from '../components/ui/Panel';
import { SectionHeader } from '../components/ui/SectionHeader';
import { ChartTooltip } from '../components/charts/ChartTooltip';

/* ---------- types ---------- */
interface SpecBand {
  band: string;
  count: number;
  percentage: number;
}

interface QualityData {
  avg_specificity: number;
  action_verb_rate: number;
  quantified_impact_rate: number;
  cliche_rate: number;
  specificity_distribution: SpecBand[];
  avg_word_count: number;
  median_word_count: number;
  min_word_count: number;
  max_word_count: number;
}

/* ---------- constants ---------- */
const PALETTE = ['#FF8A4C', '#34d399', '#a78bfa', '#60a5fa', '#fbbf24', '#fb7185', '#22d3ee', '#f472b6'];
const AXIS = { fill: '#52525b', fontSize: 10 };
const GRID = 'rgba(255,255,255,0.03)';

const BAND_COLORS: Record<string, string> = {
  'Very Vague': '#fb7185',
  'Vague': '#fbbf24',
  'Moderate': '#a78bfa',
  'Specific': '#34d399',
  'Highly Specific': '#22d3ee',
};

const Shimmer = ({ height = 280 }: { height?: number }) => (
  <div style={{ height, background: 'rgba(255,255,255,0.03)', borderRadius: 8, animation: 'shimmer 2s infinite' }} />
);

interface KpiMiniProps {
  label: string;
  value: string;
  color: string;
  subtitle?: string;
}

function KpiMini({ label, value, color, subtitle }: KpiMiniProps) {
  return (
    <div className="flex flex-col items-center py-3">
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#52525b', marginBottom: 8 }}>
        {label}
      </span>
      <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, color }}>
        {value}
      </span>
      {subtitle && <span style={{ fontSize: 11, color: '#71717a', marginTop: 4 }}>{subtitle}</span>}
    </div>
  );
}

export function Quality() {
  const [data, setData] = useState<QualityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<QualityData>('/api/recognition/nlp-quality')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 28px 44px' }}>
      <PageHero icon={<MessageSquareText size={20} />} title="Message Quality" subtitle="NLP analysis of recognition message specificity" />

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <Panel delay={0}>
          {loading ? <Shimmer height={100} /> : (
            <KpiMini label="Avg Specificity" value={(data?.avg_specificity ?? 0).toFixed(2)} color={PALETTE[0]} />
          )}
        </Panel>
        <Panel delay={60}>
          {loading ? <Shimmer height={100} /> : (
            <KpiMini label="Action Verb Rate" value={`${((data?.action_verb_rate ?? 0) * 100).toFixed(1)}%`} color={PALETTE[1]} subtitle="Messages with action verbs" />
          )}
        </Panel>
        <Panel delay={120}>
          {loading ? <Shimmer height={100} /> : (
            <KpiMini label="Quantified Impact" value={`${((data?.quantified_impact_rate ?? 0) * 100).toFixed(1)}%`} color={PALETTE[2]} subtitle="Messages with metrics" />
          )}
        </Panel>
        <Panel delay={180}>
          {loading ? <Shimmer height={100} /> : (
            <KpiMini label="Cliche Rate" value={`${((data?.cliche_rate ?? 0) * 100).toFixed(1)}%`} color="#fb7185" subtitle="Generic/template messages" />
          )}
        </Panel>
      </div>

      {/* Specificity Histogram */}
      <Panel delay={240} className="mb-4">
        <SectionHeader icon={<MessageSquareText size={14} />} title="Specificity Distribution" subtitle="How specific are recognition messages?" />
        {loading ? <Shimmer height={300} /> : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data?.specificity_distribution ?? []} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis dataKey="band" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Awards">
                {(data?.specificity_distribution ?? []).map((b, i) => (
                  <Cell key={i} fill={BAND_COLORS[b.band] ?? PALETTE[i % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>

      {/* Word Count Stats */}
      <Panel delay={300}>
        <SectionHeader icon={<MessageSquareText size={14} />} title="Word Count Statistics" />
        {loading ? <Shimmer height={80} /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[
              { label: 'Average', value: data?.avg_word_count ?? 0 },
              { label: 'Median', value: data?.median_word_count ?? 0 },
              { label: 'Minimum', value: data?.min_word_count ?? 0 },
              { label: 'Maximum', value: data?.max_word_count ?? 0 },
            ].map((s) => (
              <div key={s.label} style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 12,
                padding: '14px 16px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#52525b', marginBottom: 6 }}>
                  {s.label}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#fafafa' }}>
                  {Math.round(s.value)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
