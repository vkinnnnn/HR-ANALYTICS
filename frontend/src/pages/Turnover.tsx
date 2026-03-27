import { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { TrendingDown, Percent, Clock, UserMinus, AlertTriangle } from 'lucide-react';
import api from '../lib/api';
import { CHART_COLORS } from '../lib/utils';
import { Panel } from '../components/ui/Panel';
import { KpiCard } from '../components/ui/KpiCard';
import { PageHero } from '../components/ui/PageHero';
import { Badge } from '../components/ui/Badge';
import { SectionHeader } from '../components/ui/SectionHeader';
import { ChartTooltip } from '../components/charts/ChartTooltip';

interface TurnoverSummary {
  total_employees: number;
  active: number;
  departed: number;
  turnover_rate: number;
  avg_tenure_at_departure_years: number;
  median_tenure_at_departure_years: number;
}

interface TrendPoint {
  month: string;
  departures: number;
}

interface DeptTurnover {
  department: string;
  total: number;
  active: number;
  departed: number;
  turnover_rate: number;
  avg_tenure_at_departure: number;
}

interface TenureBucket {
  bin: string;
  count: number;
}

interface DangerZone {
  department: string;
  total: number;
  departed: number;
  turnover_rate: number;
  company_avg: number;
  excess_pct: number;
}

export function Turnover() {
  const [summary, setSummary] = useState<TurnoverSummary | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [deptTurnover, setDeptTurnover] = useState<DeptTurnover[]>([]);
  const [tenureAtDep, setTenureAtDep] = useState<TenureBucket[]>([]);
  const [dangerZones, setDangerZones] = useState<DangerZone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [sumRes, trendRes, deptRes, tenureRes, dangerRes] = await Promise.all([
          api.get('/api/turnover/summary'),
          api.get('/api/turnover/trend'),
          api.get('/api/turnover/by-department'),
          api.get('/api/turnover/tenure-at-departure'),
          api.get('/api/turnover/danger-zones'),
        ]);
        setSummary(sumRes.data);
        setTrend(trendRes.data?.data || trendRes.data || []);
        setDeptTurnover(deptRes.data?.data || deptRes.data || []);
        setTenureAtDep(tenureRes.data?.data || tenureRes.data || []);
        setDangerZones(dangerRes.data?.danger_zones || dangerRes.data?.data || dangerRes.data || []);
      } catch (err) {
        console.error('Turnover load error', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const kpiLoading = loading || !summary;

  // Build a set of danger zone department names for highlighting
  const dangerDeptSet = new Set(dangerZones.map(d => d.department));

  return (
    <div>
      <PageHero
        icon={<TrendingDown size={20} />}
        title="Turnover & Attrition"
        subtitle="Track and analyze employee departures"
      />

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Turnover Rate" value={summary?.turnover_rate ?? 0} format="percent" icon={<Percent size={18} />} color="#fb7185" delay={0} loading={kpiLoading} />
        <KpiCard label="Avg Tenure at Departure" value={summary?.avg_tenure_at_departure_years ?? 0} icon={<Clock size={18} />} color="#a78bfa" delay={60} loading={kpiLoading} />
        <KpiCard label="Total Departed" value={summary?.departed ?? 0} icon={<UserMinus size={18} />} color="#fbbf24" delay={120} loading={kpiLoading} />
        <KpiCard label="Danger Zones" value={dangerZones.length} icon={<AlertTriangle size={18} />} color="#fb7185" delay={180} loading={kpiLoading} />
      </div>

      {/* Trend + Department */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Monthly Turnover Trend */}
        <Panel delay={240}>
          <SectionHeader title="Monthly Turnover Trend" subtitle="Turnover rate over time" />
          {loading ? (
            <div style={{ height: 280, background: 'rgba(255,255,255,0.03)', borderRadius: 8, animation: 'shimmer 2s infinite' }} />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="month" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="departures" stroke={CHART_COLORS[5]} strokeWidth={2} dot={{ r: 3, fill: CHART_COLORS[5] }} activeDot={{ r: 5 }} name="Departures" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Turnover by Department */}
        <Panel delay={300}>
          <SectionHeader title="Turnover by Department" subtitle="Danger zones highlighted in rose" />
          {loading ? (
            <div style={{ height: 280, background: 'rgba(255,255,255,0.03)', borderRadius: 8, animation: 'shimmer 2s infinite' }} />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(280, deptTurnover.length * 28)}>
              <BarChart data={deptTurnover} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis type="number" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="department" type="category" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} width={120} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="turnover_rate" radius={[0, 4, 4, 0]} name="Turnover %">
                  {deptTurnover.map((item, i) => (
                    <Cell key={i} fill={dangerDeptSet.has(item.department) ? '#fb7185' : CHART_COLORS[3]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tenure at Departure Histogram */}
        <Panel delay={360}>
          <SectionHeader title="Tenure at Departure" subtitle="How long departed employees stayed" />
          {loading ? (
            <div style={{ height: 280, background: 'rgba(255,255,255,0.03)', borderRadius: 8, animation: 'shimmer 2s infinite' }} />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={tenureAtDep}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="bin" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} name="Employees" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Danger Zones Panel */}
        <Panel delay={420}>
          <SectionHeader
            icon={<AlertTriangle size={14} />}
            title="Danger Zone Departments"
            subtitle="Departments with critically high turnover"
          />
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} style={{ height: 44, background: 'rgba(255,255,255,0.03)', borderRadius: 8, animation: 'shimmer 2s infinite' }} />
              ))}
            </div>
          ) : dangerZones.length === 0 ? (
            <p style={{ color: '#71717a', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>No danger zones detected</p>
          ) : (
            <div style={{ display: 'grid', gap: 0 }}>
              {/* Header */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto auto',
                  gap: 12,
                  padding: '8px 12px',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Department</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Departed</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rate</span>
              </div>
              {/* Rows */}
              {dangerZones.map((zone, i) => (
                <div
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto auto auto',
                    gap: 12,
                    padding: '10px 12px',
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    alignItems: 'center',
                  }}
                  className="hover:bg-white/[0.02]"
                >
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#fafafa' }}>{zone.department}</span>
                  <span style={{ fontSize: 12, color: '#a1a1aa', textAlign: 'right' }}>{zone.total}</span>
                  <span style={{ fontSize: 12, color: '#a1a1aa', textAlign: 'right' }}>{zone.departed}</span>
                  <Badge label={`${zone.turnover_rate.toFixed(1)}%`} color="#fb7185" dot />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
