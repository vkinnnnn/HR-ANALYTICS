import { useState, useEffect } from 'react';
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Clock, Users, Award, TrendingUp } from 'lucide-react';
import api from '../lib/api';
import { CHART_COLORS } from '../lib/utils';
import { Panel } from '../components/ui/Panel';
import { KpiCard } from '../components/ui/KpiCard';
import { PageHero } from '../components/ui/PageHero';
import { Badge } from '../components/ui/Badge';
import { SectionHeader } from '../components/ui/SectionHeader';
import { ChartTooltip } from '../components/charts/ChartTooltip';

interface TenureSummary {
  avg_tenure_overall: number;
  avg_tenure_active: number;
  median_tenure: number;
  long_tenured_count: number;
}

interface Cohort {
  cohort: string;
  count: number;
}

interface DistBucket {
  bucket: string;
  count: number;
}

interface RetentionPoint {
  year: number;
  pct_retained: number;
}

interface LongTenured {
  name: string;
  department: string;
  tenure_years: number;
  hire_date: string;
}

const COHORT_COLORS = ['#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#fb7185', '#FF8A4C', '#22d3ee'];

export function Tenure() {
  const [summary, setSummary] = useState<TenureSummary | null>(null);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [distribution, setDistribution] = useState<DistBucket[]>([]);
  const [retentionCurve, setRetentionCurve] = useState<RetentionPoint[]>([]);
  const [longTenured, setLongTenured] = useState<LongTenured[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [sumRes, cohortRes, distRes, retRes, longRes] = await Promise.all([
          api.get('/api/tenure/summary'),
          api.get('/api/tenure/cohorts'),
          api.get('/api/tenure/distribution'),
          api.get('/api/tenure/retention-curve'),
          api.get('/api/tenure/long-tenured'),
        ]);
        setSummary(sumRes.data);
        setCohorts(cohortRes.data?.data || cohortRes.data || []);
        setDistribution(distRes.data?.data || distRes.data || []);
        setRetentionCurve(retRes.data?.data || retRes.data || []);
        setLongTenured(longRes.data?.data || longRes.data || []);
      } catch (err) {
        console.error('Tenure load error', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const kpiLoading = loading || !summary;

  return (
    <div>
      <PageHero
        icon={<Clock size={20} />}
        title="Tenure Analysis"
        subtitle="Understand employee tenure patterns and retention"
      />

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Avg Tenure (Overall)" value={summary?.avg_tenure_overall ?? 0} icon={<Clock size={18} />} color="#FF8A4C" delay={0} loading={kpiLoading} />
        <KpiCard label="Avg Tenure (Active)" value={summary?.avg_tenure_active ?? 0} icon={<Users size={18} />} color="#34d399" delay={60} loading={kpiLoading} />
        <KpiCard label="Median Tenure" value={summary?.median_tenure ?? 0} icon={<TrendingUp size={18} />} color="#a78bfa" delay={120} loading={kpiLoading} />
        <KpiCard label="Long Tenured (10yr+)" value={summary?.long_tenured_count ?? 0} icon={<Award size={18} />} color="#fbbf24" delay={180} loading={kpiLoading} />
      </div>

      {/* Cohort + Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Cohort Breakdown - Pie */}
        <Panel delay={240}>
          <SectionHeader title="Tenure Cohorts" subtitle="Workforce grouped by tenure bands" />
          {loading ? (
            <div style={{ height: 300, background: 'rgba(255,255,255,0.03)', borderRadius: 8, animation: 'shimmer 2s infinite' }} />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={cohorts}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={105}
                  paddingAngle={2}
                  dataKey="total"
                  nameKey="cohort"
                  stroke="none"
                >
                  {cohorts.map((_, i) => (
                    <Cell key={i} fill={COHORT_COLORS[i % COHORT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value: string) => (
                    <span style={{ color: '#a1a1aa', fontSize: 11 }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Distribution Histogram */}
        <Panel delay={300}>
          <SectionHeader title="Tenure Distribution" subtitle="Employee count by years of service" />
          {loading ? (
            <div style={{ height: 300, background: 'rgba(255,255,255,0.03)', borderRadius: 8, animation: 'shimmer 2s infinite' }} />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="bin" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} name="Employees" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      {/* Retention Curve + Long Tenured */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Retention Curve (Kaplan-Meier style) */}
        <Panel delay={360}>
          <SectionHeader title="Retention Curve" subtitle="Kaplan-Meier style: % of employees retained by year" />
          {loading ? (
            <div style={{ height: 300, background: 'rgba(255,255,255,0.03)', borderRadius: 8, animation: 'shimmer 2s infinite' }} />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={retentionCurve}>
                <defs>
                  <linearGradient id="retGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS[1]} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={CHART_COLORS[1]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis
                  dataKey="year"
                  tick={{ fill: '#52525b', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: 'Years', position: 'insideBottomRight', offset: -4, style: { fill: '#71717a', fontSize: 10 } }}
                />
                <YAxis
                  tick={{ fill: '#52525b', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area type="stepAfter" dataKey="pct_retained" stroke={CHART_COLORS[1]} fill="url(#retGrad)" strokeWidth={2} name="% Retained" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Long Tenured Employees Table */}
        <Panel delay={420}>
          <SectionHeader
            icon={<Award size={14} />}
            title="Institutional Knowledge"
            subtitle="Long-tenured employees (10+ years)"
          />
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} style={{ height: 40, background: 'rgba(255,255,255,0.03)', borderRadius: 8, animation: 'shimmer 2s infinite' }} />
              ))}
            </div>
          ) : longTenured.length === 0 ? (
            <p style={{ color: '#71717a', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>No long-tenured employees found</p>
          ) : (
            <div style={{ display: 'grid', gap: 0, maxHeight: 320, overflowY: 'auto' }}>
              {/* Header */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr auto auto',
                  gap: 12,
                  padding: '8px 12px',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  position: 'sticky',
                  top: 0,
                  background: 'rgba(19,19,24,0.95)',
                  zIndex: 1,
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Department</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tenure</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hire Date</span>
              </div>
              {/* Rows */}
              {longTenured.map((emp, i) => {
                const tenureColor = emp.tenure_years >= 20 ? '#fbbf24' : emp.tenure_years >= 15 ? '#a78bfa' : '#34d399';
                return (
                  <div
                    key={i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr auto auto',
                      gap: 12,
                      padding: '10px 12px',
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      alignItems: 'center',
                    }}
                    className="hover:bg-white/[0.02]"
                  >
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#fafafa' }}>{emp.name}</span>
                    <span style={{ fontSize: 12, color: '#a1a1aa' }}>{emp.department}</span>
                    <Badge label={`${emp.tenure_years.toFixed(1)} yrs`} color={tenureColor} dot />
                    <span style={{ fontSize: 11, color: '#71717a' }}>{emp.hire_date}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
