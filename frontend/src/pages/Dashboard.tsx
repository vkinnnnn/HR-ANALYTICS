import { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { LayoutDashboard, Users, UserMinus, Percent, Clock, Building2, AlertTriangle } from 'lucide-react';
import api from '../lib/api';
import { CHART_COLORS, formatNumber } from '../lib/utils';
import { Panel } from '../components/ui/Panel';
import { KpiCard } from '../components/ui/KpiCard';
import { PageHero } from '../components/ui/PageHero';
import { Badge } from '../components/ui/Badge';
import { SectionHeader } from '../components/ui/SectionHeader';
import { ChartTooltip } from '../components/charts/ChartTooltip';

interface Summary {
  total_headcount: number;
  active: number;
  departed: number;
  turnover_rate: number;
  avg_tenure_years: number;
  unique_departments: number;
  unique_locations: number;
}

interface HeadcountPoint {
  month: string;
  headcount: number;
}

interface DeptTurnover {
  department: string;
  turnover_rate: number;
}

interface TenureBucket {
  bucket: string;
  count: number;
}

interface FlightRisk {
  pk_person: string;
  job_title: string;
  department: string;
  tenure_years: number;
  risk_score: number;
}

export function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [headcountTrend, setHeadcountTrend] = useState<HeadcountPoint[]>([]);
  const [deptTurnover, setDeptTurnover] = useState<DeptTurnover[]>([]);
  const [tenureDist, setTenureDist] = useState<TenureBucket[]>([]);
  const [flightRisk, setFlightRisk] = useState<FlightRisk[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [sumRes, trendRes, deptRes, tenureRes, riskRes] = await Promise.all([
          api.get('/api/workforce/summary'),
          api.get('/api/workforce/headcount-trend'),
          api.get('/api/turnover/by-department'),
          api.get('/api/tenure/distribution'),
          api.get('/api/predictions/flight-risk', { params: { top_n: 5 } }),
        ]);
        setSummary(sumRes.data);
        setHeadcountTrend(trendRes.data?.data || trendRes.data || []);
        const turnoverData = (deptRes.data?.data || deptRes.data || []).slice(0, 10);
        setDeptTurnover(turnoverData);
        setTenureDist(tenureRes.data?.data || tenureRes.data || []);
        setFlightRisk(riskRes.data?.employees || riskRes.data || []);
      } catch (err) {
        console.error('Dashboard load error', err);
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
        icon={<LayoutDashboard size={20} />}
        title="Dashboard"
        subtitle="Workforce health at a glance"
      />

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <KpiCard
          label="Active Headcount"
          value={summary?.active ?? 0}
          icon={<Users size={18} />}
          color="#34d399"
          delay={0}
          loading={kpiLoading}
        />
        <KpiCard
          label="Departed"
          value={summary?.departed ?? 0}
          icon={<UserMinus size={18} />}
          color="#fb7185"
          delay={60}
          loading={kpiLoading}
        />
        <KpiCard
          label="Turnover Rate"
          value={summary?.turnover_rate ?? 0}
          format="percent"
          icon={<Percent size={18} />}
          color="#fbbf24"
          delay={120}
          loading={kpiLoading}
        />
        <KpiCard
          label="Avg Tenure (yrs)"
          value={summary?.avg_tenure_years ?? 0}
          icon={<Clock size={18} />}
          color="#a78bfa"
          delay={180}
          loading={kpiLoading}
        />
        <KpiCard
          label="Departments"
          value={summary?.unique_departments ?? 0}
          icon={<Building2 size={18} />}
          color="#60a5fa"
          delay={240}
          loading={kpiLoading}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Headcount Trend */}
        <Panel delay={300}>
          <SectionHeader title="Headcount Trend" subtitle="Monthly active headcount over time" />
          {loading ? (
            <div style={{ height: 280, background: 'rgba(255,255,255,0.03)', borderRadius: 8, animation: 'shimmer 2s infinite' }} />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={headcountTrend}>
                <defs>
                  <linearGradient id="hcGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS[1]} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={CHART_COLORS[1]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="month" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatNumber(v)} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="headcount" stroke={CHART_COLORS[1]} fill="url(#hcGrad)" strokeWidth={2} name="Headcount" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Turnover by Department */}
        <Panel delay={360}>
          <SectionHeader title="Turnover by Department" subtitle="Top 10 departments by turnover rate" />
          {loading ? (
            <div style={{ height: 280, background: 'rgba(255,255,255,0.03)', borderRadius: 8, animation: 'shimmer 2s infinite' }} />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={deptTurnover} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis type="number" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="department" type="category" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} width={110} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="turnover_rate" fill={CHART_COLORS[5]} radius={[0, 4, 4, 0]} name="Turnover %" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tenure Distribution */}
        <Panel delay={420}>
          <SectionHeader title="Tenure Distribution" subtitle="Employees grouped by years of service" />
          {loading ? (
            <div style={{ height: 280, background: 'rgba(255,255,255,0.03)', borderRadius: 8, animation: 'shimmer 2s infinite' }} />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={tenureDist}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="bin" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} name="Employees" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Flight Risk Table */}
        <Panel delay={480}>
          <SectionHeader
            icon={<AlertTriangle size={14} />}
            title="Top Flight Risks"
            subtitle="Employees most likely to depart"
          />
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} style={{ height: 40, background: 'rgba(255,255,255,0.03)', borderRadius: 8, animation: 'shimmer 2s infinite' }} />
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 0 }}>
              {/* Header */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr auto',
                  gap: 12,
                  padding: '8px 12px',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Job Title</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Department</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Risk</span>
              </div>
              {/* Rows */}
              {flightRisk.map((emp, i) => {
                const riskColor = emp.risk_score > 0.7 ? '#fb7185' : emp.risk_score > 0.5 ? '#fbbf24' : '#34d399';
                return (
                  <div
                    key={i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr auto',
                      gap: 12,
                      padding: '10px 12px',
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      transition: 'background 0.15s',
                    }}
                    className="hover:bg-white/[0.02]"
                  >
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#fafafa' }}>{emp.job_title}</span>
                    <span style={{ fontSize: 12, color: '#a1a1aa' }}>{emp.department}</span>
                    <Badge
                      label={`${(emp.risk_score * 100).toFixed(0)}%`}
                      color={riskColor}
                      dot
                    />
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
