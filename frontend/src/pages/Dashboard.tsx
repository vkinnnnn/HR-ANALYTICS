import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { LayoutDashboard, Award, GitFork, Target, Shuffle, Zap, AlertTriangle, Users } from 'lucide-react';
import api from '../lib/api';
import { PageHero } from '../components/ui/PageHero';
import { Panel } from '../components/ui/Panel';
import { SectionHeader } from '../components/ui/SectionHeader';
import { KpiCard } from '../components/ui/KpiCard';
import { Badge } from '../components/ui/Badge';
import { InsightBanner } from '../components/ui/InsightBanner';
import { ChartTooltip } from '../components/charts/ChartTooltip';

/* ---------- types ---------- */
interface RecSummary {
  total_awards: number;
  gini: number;
  avg_specificity: number;
  cross_function_rate: number;
}

interface Category {
  id: string;
  name: string;
  count: number;
  percentage: number;
  avg_specificity: number;
}

interface NlpQuality {
  band: string;
  count: number;
}

interface TopRole {
  role: string;
  count: number;
}

interface Nominator {
  role: string;
  total: number;
  dominant_category: string;
  concentration_pct: number;
  blind_spot: boolean;
}

interface FlowDirection {
  direction: string;
  count: number;
}

/* ---------- constants ---------- */
const PALETTE = ['#FF8A4C', '#34d399', '#a78bfa', '#60a5fa', '#fbbf24', '#fb7185', '#22d3ee', '#f472b6'];
const DIRECTION_COLORS: Record<string, string> = { Downward: '#fb7185', Upward: '#34d399', Lateral: '#60a5fa' };
const SPEC_COLORS: Record<string, string> = {
  'Very Vague': '#fb7185',
  'Vague': '#fbbf24',
  'Moderate': '#a78bfa',
  'Specific': '#34d399',
  'Highly Specific': '#22d3ee',
};
const AXIS_STYLE = { fill: '#52525b', fontSize: 10 };
const GRID_STROKE = 'rgba(255,255,255,0.03)';

const Shimmer = ({ height = 280 }: { height?: number }) => (
  <div style={{ height, background: 'rgba(255,255,255,0.03)', borderRadius: 8, animation: 'shimmer 2s infinite' }} />
);

const ShimmerRows = ({ count = 5 }: { count?: number }) => (
  <div className="space-y-3">
    {Array.from({ length: count }, (_, i) => (
      <div key={i} style={{ height: 44, background: 'rgba(255,255,255,0.03)', borderRadius: 12, animation: 'shimmer 2s infinite' }} />
    ))}
  </div>
);

const TableLabel = ({ children }: { children: string }) => (
  <span style={{ fontSize: 10, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{children}</span>
);

/* ---------- component ---------- */
export function Dashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<RecSummary | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [nlpQuality, setNlpQuality] = useState<NlpQuality[]>([]);
  const [topRoles, setTopRoles] = useState<TopRole[]>([]);
  const [nominators, setNominators] = useState<Nominator[]>([]);
  const [flowData, setFlowData] = useState<FlowDirection[]>([]);
  const [gradePyramid, setGradePyramid] = useState<{ grade: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setError(null);
        const results = await Promise.allSettled([
          api.get('/api/recognition/summary'),
          api.get('/api/recognition/categories'),
          api.get('/api/recognition/nlp-quality'),
          api.get('/api/recognition/top-roles'),
          api.get('/api/recognition/nominators'),
          api.get('/api/recognition/flow'),
          api.get('/api/workforce/grade-pyramid'),
        ]);
        const val = (i: number) => results[i].status === 'fulfilled' ? (results[i] as any).value.data : null;
        if (val(0)) setSummary(val(0));
        if (val(1)) setCategories((val(1)?.categories || []).sort((a: Category, b: Category) => b.count - a.count));
        if (val(2)) setNlpQuality(val(2)?.specificity_distribution || []);
        if (val(3)) setTopRoles((val(3)?.top_recipients || []).slice(0, 10));
        if (val(4)) setNominators((val(4)?.blind_spots || []).slice(0, 10));
        if (val(5)) {
          const dirSplit = val(5)?.direction_split || {};
          setFlowData(Object.entries(dirSplit).map(([d, c]) => ({ direction: d, count: c as number })));
        }
        if (val(6)) setGradePyramid((val(6)?.pyramid || val(6) || []).slice(0, 12));
        // Check if all failed
        if (results.every(r => r.status === 'rejected')) setError('Unable to load data. Check backend connection.');
      } catch (err: any) {
        setError(err?.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const kpiLoading = loading || !summary;

  /* AI insight from category data */
  const insightText = useMemo(() => {
    if (!categories.length) return '';
    const dominant = categories[0];
    const smallest = categories[categories.length - 1];
    return `${dominant.name} dominates with ${dominant.count} awards (${((dominant.count / (summary?.total_awards || 1)) * 100).toFixed(0)}% of total). ${smallest.name} is the least recognized category at only ${smallest.count} awards — consider targeted recognition campaigns.`;
  }, [categories, summary]);

  /* blind spots */
  const blindSpots = nominators.slice(0, 10);

  return (
    <div>
      {error && (
        <div style={{ marginBottom: 16, padding: '14px 18px', borderRadius: 12, background: 'rgba(251,113,133,0.06)', border: '1px solid rgba(251,113,133,0.15)', color: '#fb7185', fontSize: 13, fontWeight: 500 }}>
          {error}
        </div>
      )}
      <PageHero
        icon={<LayoutDashboard size={20} />}
        title="Dashboard"
        subtitle="Recognition health at a glance"
      />

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <KpiCard label="Total Awards" value={summary?.total_awards ?? 0} icon={<Award size={18} />} color="#FF8A4C" delay={0} loading={kpiLoading} />
        <KpiCard
          label="Recognition Gini"
          value={summary?.gini ?? 0}
          format="decimal"
          icon={<GitFork size={18} />}
          color="#a78bfa"
          delay={60}
          loading={kpiLoading}
        />
        <KpiCard
          label="Avg Specificity"
          value={summary?.avg_specificity ?? 0}
          format="decimal"
          suffix="/1.0"
          icon={<Target size={18} />}
          color="#fb7185"
          delay={120}
          loading={kpiLoading}
        />
        <KpiCard
          label="Cross-Function Rate"
          value={summary?.cross_function_rate ?? 0}
          format="percent"
          icon={<Shuffle size={18} />}
          color="#34d399"
          delay={180}
          loading={kpiLoading}
        />
      </div>

      {/* AI Insight Banner */}
      {!loading && insightText && (
        <InsightBanner
          icon={<Zap size={16} />}
          title="AI Insight"
          message={insightText}
          color="#FF8A4C"
          action={
            <button
              onClick={() => navigate('/categories')}
              style={{
                borderRadius: 9999, background: 'rgba(255,138,76,0.12)', border: '1px solid rgba(255,138,76,0.25)',
                color: '#FF8A4C', fontSize: 10, fontWeight: 700, padding: '6px 14px', cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              View Details →
            </button>
          }
        />
      )}

      {/* Charts Row 1: Category Distribution + Recognition Direction */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16, marginBottom: 16 }}>
        {/* Category Distribution */}
        <Panel delay={240}>
          <SectionHeader
            icon={<Award size={14} />}
            title="Category Distribution"
            subtitle="Awards by recognition category"
            action={<Badge label={`${categories.length} categories`} color="#FF8A4C" />}
          />
          {loading ? <Shimmer /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={categories} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                <XAxis type="number" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} width={180} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18} name="Awards">
                  {categories.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Recognition Direction */}
        <Panel delay={300}>
          <SectionHeader
            icon={<Shuffle size={14} />}
            title="Recognition Direction"
            subtitle="Downward, upward, and lateral flows"
          />
          {loading ? <Shimmer /> : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={flowData}
                  dataKey="count"
                  nameKey="direction"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  stroke="none"
                >
                  {flowData.map((entry, i) => (
                    <Cell key={i} fill={DIRECTION_COLORS[entry.direction] || PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          )}
          {/* Legend */}
          {!loading && (
            <div className="flex items-center justify-center gap-5 mt-2">
              {flowData.map((entry, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: DIRECTION_COLORS[entry.direction] || PALETTE[i] }} />
                  <span style={{ fontSize: 11, color: '#a1a1aa' }}>{entry.direction}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Charts Row 2: Specificity Distribution + Top 10 Roles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Specificity Distribution */}
        <Panel delay={360}>
          <SectionHeader
            icon={<Target size={14} />}
            title="Specificity Distribution"
            subtitle="How specific are recognition messages?"
          />
          {loading ? <Shimmer /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={nlpQuality}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                <XAxis dataKey="band" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={24} name="Messages">
                  {nlpQuality.map((entry, i) => (
                    <Cell key={i} fill={SPEC_COLORS[entry.band] || PALETTE[i % PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Top 10 Most Recognized Roles */}
        <Panel delay={420}>
          <SectionHeader
            icon={<Award size={14} />}
            title="Top 10 Most Recognized Roles"
            subtitle="Roles receiving the most awards"
            action={<Badge label={`${topRoles.length} roles`} color="#34d399" />}
          />
          {loading ? <Shimmer /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topRoles} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                <XAxis type="number" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
                <YAxis dataKey="role" type="category" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} width={130} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={14} name="Awards">
                  {topRoles.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      {/* Grade Pyramid — Workforce Distribution */}
      {gradePyramid.length > 0 && (
        <Panel delay={480} className="mb-4">
          <SectionHeader
            icon={<Users size={14} />}
            title="Grade Pyramid"
            subtitle="Workforce distribution by grade level"
            action={<Badge label={`${gradePyramid.length} grades`} color="#a78bfa" />}
          />
          <ResponsiveContainer width="100%" height={Math.max(200, gradePyramid.length * 32)}>
            <BarChart data={gradePyramid} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
              <XAxis type="number" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="grade" tick={{ fill: '#a1a1aa', fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16} name="Headcount">
                {gradePyramid.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      )}

      {/* Blind Spot Nominators Table */}
      <Panel delay={540}>
        <SectionHeader
          icon={<AlertTriangle size={14} />}
          title="Blind Spot Nominators"
          subtitle="Roles with high concentration in a single category"
          action={<Badge label={`${blindSpots.length} flagged`} color="#fb7185" dot />}
        />
        {loading ? <ShimmerRows /> : blindSpots.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: '#52525b', fontSize: 13 }}>
            No blind spot nominators detected.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.5fr 1fr 80px', gap: 8, padding: '6px 14px' }}>
              <TableLabel>Role</TableLabel>
              <TableLabel>Total</TableLabel>
              <TableLabel>Dominant Category</TableLabel>
              <TableLabel>Concentration</TableLabel>
            </div>
            {/* Rows */}
            {blindSpots.map((nom, i) => {
              const isHigh = nom.concentration_pct >= 80;
              return (
                <div
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.5fr 0.5fr 1fr 80px',
                    gap: 8,
                    padding: '11px 14px',
                    borderRadius: 12,
                    background: isHigh ? 'rgba(251,113,133,0.06)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isHigh ? 'rgba(251,113,133,0.10)' : 'rgba(255,255,255,0.06)'}`,
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#fafafa' }}>{nom.role}</span>
                  <span style={{ fontSize: 12, color: '#a1a1aa' }}>{nom.total}</span>
                  <span style={{ fontSize: 12, color: '#a1a1aa' }}>{nom.dominant_category}</span>
                  <Badge label={`${nom.concentration_pct.toFixed(0)}%`} color={isHigh ? '#fb7185' : '#fbbf24'} dot />
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
