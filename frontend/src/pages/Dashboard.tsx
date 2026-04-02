import { useState, useEffect, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import {
  LayoutDashboard, Users, TrendingDown, Clock, UserCheck,
  TrendingUp, AlertTriangle, BarChart3, Zap, PieChart,
} from 'lucide-react';
import api from '../lib/api';
import { Panel } from '../components/ui/Panel';
import { KpiCard } from '../components/ui/KpiCard';
import { PageHero } from '../components/ui/PageHero';
import { Badge } from '../components/ui/Badge';
import { SectionHeader } from '../components/ui/SectionHeader';
import { InsightBanner } from '../components/ui/InsightBanner';
import { ChartTooltip } from '../components/charts/ChartTooltip';

interface Summary {
  total_headcount: number;
  active: number;
  departed: number;
  turnover_rate: number;
  avg_tenure_years: number;
  new_hires_90d: number;
  prior_hires_90d: number;
  unique_departments: number;
}

interface HeadcountPoint {
  month: string;
  headcount: number;
}

interface DeptTurnover {
  department: string;
  total: number;
  active: number;
  departed: number;
  turnover_rate: number;
}

interface TenureBucket {
  bin: string;
  count: number;
}

interface FlightRiskEmployee {
  pk_person: string;
  job_title: string;
  department: string;
  tenure_years: number;
  risk_score: number;
}

interface DashboardProps {
  onChartClick?: (question: string) => void;
}

export function Dashboard({ onChartClick }: DashboardProps) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [headcountTrend, setHeadcountTrend] = useState<HeadcountPoint[]>([]);
  const [deptTurnover, setDeptTurnover] = useState<DeptTurnover[]>([]);
  const [tenureDist, setTenureDist] = useState<TenureBucket[]>([]);
  const [medianTenure, setMedianTenure] = useState(0);
  const [flightRisk, setFlightRisk] = useState<FlightRiskEmployee[]>([]);
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
        setMedianTenure(tenureRes.data?.median_tenure_years || 0);
        const riskEmployees = (riskRes.data?.employees || riskRes.data || [])
          .filter((e: FlightRiskEmployee) => e.job_title && e.job_title !== 'nan');
        setFlightRisk(riskEmployees);
      } catch (err) {
        console.error('Dashboard load error', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Use the COMPANY-WIDE turnover rate from summary (not from top-10 slice)
  const companyAvgTurnover = summary?.turnover_rate ?? 0;

  // Generate AI insight from data
  const insightText = useMemo(() => {
    if (!deptTurnover.length && !flightRisk.length) return '';
    const parts: string[] = [];
    if (deptTurnover.length > 0) {
      const worst = deptTurnover[0];
      parts.push(`${worst.department} has ${worst.turnover_rate}% turnover — the highest across all departments`);
    }
    if (flightRisk.length > 0) {
      const highRisk = flightRisk.filter(e => e.risk_score > 0.8);
      if (highRisk.length > 0) {
        const depts = [...new Set(highRisk.map(e => e.department))];
        parts.push(`${highRisk.length} employee${highRisk.length > 1 ? 's' : ''} in ${depts.join(', ')} flagged at ${Math.round(highRisk[0].risk_score * 100)}%+ flight risk`);
      }
    }
    return parts.join('. ') + '.';
  }, [deptTurnover, flightRisk]);

  // Format headcount trend dates
  const formattedTrend = useMemo(() => {
    return headcountTrend.map(p => {
      const d = new Date(p.month + '-01');
      const mo = d.toLocaleString('en', { month: 'short' });
      const yr = String(d.getFullYear()).slice(2);
      return { ...p, label: `${mo} '${yr}` };
    });
  }, [headcountTrend]);

  const kpiLoading = loading || !summary;

  return (
    <div>
      {/* Page Hero */}
      <PageHero
        icon={<LayoutDashboard size={20} />}
        title="Dashboard"
        subtitle="Workforce health — headcount, turnover, tenure, and risk signals at a glance."
      />

      {/* KPI Row — 4 cards */}
      <div id="kpi-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <KpiCard
          label="Total Headcount"
          value={summary?.active ?? 0}
          icon={<Users size={18} />}
          color="#FF8A4C"
          delay={0}
          loading={kpiLoading}
        />
        <KpiCard
          label="Turnover Rate"
          value={summary?.turnover_rate ?? 0}
          format="percent"
          icon={<TrendingDown size={18} />}
          color="#fb7185"
          delay={60}
          loading={kpiLoading}
        />
        <KpiCard
          label="Avg Tenure"
          value={summary?.avg_tenure_years ?? 0}
          format="decimal"
          suffix=" yr"
          icon={<Clock size={18} />}
          color="#a78bfa"
          delay={120}
          loading={kpiLoading}
        />
        <KpiCard
          label="New Hires (90d)"
          value={summary?.new_hires_90d ?? 0}
          icon={<UserCheck size={18} />}
          color="#34d399"
          delay={180}
          loading={kpiLoading}
          change={
            summary && summary.prior_hires_90d > 0
              ? Math.round(((summary.new_hires_90d - summary.prior_hires_90d) / summary.prior_hires_90d) * 100 * 10) / 10
              : undefined
          }
          changeLabel="vs prior 90d"
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
              style={{
                borderRadius: 9999,
                background: 'rgba(255,138,76,0.12)',
                border: '1px solid rgba(255,138,76,0.25)',
                color: '#FF8A4C',
                fontSize: 10,
                fontWeight: 700,
                padding: '6px 14px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              View Details →
            </button>
          }
        />
      )}

      {/* Charts Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Headcount Trend */}
        <Panel delay={240} id="headcount-chart">
          <SectionHeader
            icon={<TrendingUp size={14} />}
            title="Headcount Trend"
            subtitle="Monthly active headcount over time"
            action={<Badge label={`${formattedTrend.length} months`} color="#FF8A4C" />}
          />
          {loading ? (
            <div style={{ height: 280, background: 'rgba(255,255,255,0.03)', borderRadius: 8, animation: 'shimmer 2s infinite' }} />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={formattedTrend}>
                <defs>
                  <linearGradient id="hcGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF8A4C" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#FF8A4C" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#52525b', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: '#52525b', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  domain={['dataMin - 50', 'dataMax + 50']}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="headcount"
                  stroke="#FF8A4C"
                  fill="url(#hcGrad)"
                  strokeWidth={2}
                  name="Headcount"
                  dot={false}
                  activeDot={{ r: 4, fill: '#FF8A4C', stroke: '#131318', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Turnover by Department — two-color system */}
        <Panel delay={300} id="turnover-chart">
          <SectionHeader
            icon={<BarChart3 size={14} />}
            title="Turnover by Department"
            subtitle="Top 10 departments · rose = above avg, emerald = at/below"
            action={<Badge label={`Avg: ${companyAvgTurnover}%`} color="#fbbf24" />}
          />
          {loading ? (
            <div style={{ height: 280, background: 'rgba(255,255,255,0.03)', borderRadius: 8, animation: 'shimmer 2s infinite' }} />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={deptTurnover} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis
                  type="number"
                  tick={{ fill: '#52525b', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 'dataMax']}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  dataKey="department"
                  type="category"
                  tick={{ fill: '#71717a', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={120}
                />
                <Tooltip content={<ChartTooltip />} />
                <ReferenceLine
                  x={companyAvgTurnover}
                  stroke="#fbbf24"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: `Avg: ${companyAvgTurnover}%`,
                    position: 'top',
                    fill: '#fbbf24',
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                />
                <Bar
                  dataKey="turnover_rate"
                  radius={[0, 4, 4, 0]}
                  barSize={14}
                  name="Turnover %"
                  cursor="pointer"
                  onClick={(data: any) => {
                    if (onChartClick && data?.department) {
                      onChartClick(`Tell me more about ${data.department} department turnover`);
                    }
                  }}
                >
                  {deptTurnover.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.turnover_rate > companyAvgTurnover ? '#fb7185' : '#34d399'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      {/* Charts Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Tenure Distribution — meaningful bins */}
        <Panel delay={360} id="tenure-chart">
          <SectionHeader
            icon={<PieChart size={14} />}
            title="Tenure Distribution"
            subtitle="Employees grouped by years of service"
            action={medianTenure > 0 ? <Badge label={`Median: ${medianTenure} yr`} color="#a78bfa" /> : undefined}
          />
          {loading ? (
            <div style={{ height: 280, background: 'rgba(255,255,255,0.03)', borderRadius: 8, animation: 'shimmer 2s infinite' }} />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={tenureDist}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis
                  dataKey="bin"
                  tick={{ fill: '#52525b', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#52525b', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={24} name="Employees">
                  {tenureDist.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.bin === '0-6mo' || entry.bin === '6-12mo' ? '#fb7185' : '#a78bfa'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Flight Risk Table */}
        <Panel delay={420} id="flight-risk-table">
          <SectionHeader
            icon={<AlertTriangle size={14} />}
            title="Top Flight Risks"
            subtitle="Employees most likely to depart"
            action={<Badge label={`${flightRisk.length} flagged`} color="#fb7185" dot />}
          />
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} style={{ height: 44, background: 'rgba(255,255,255,0.03)', borderRadius: 12, animation: 'shimmer 2s infinite' }} />
              ))}
            </div>
          ) : flightRisk.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: '#52525b', fontSize: 13 }}>
              No flight risk data available. Train the model first.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {/* Header */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1fr 0.5fr 80px',
                  gap: 8,
                  padding: '6px 14px',
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Employee</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Department</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Risk</span>
                <span />
              </div>
              {/* Rows */}
              {flightRisk.map((emp, i) => {
                const pct = Math.round(emp.risk_score * 100);
                const isHigh = pct >= 80;
                const isMed = pct >= 60 && pct < 80;
                const badgeColor = isHigh ? '#fb7185' : isMed ? '#fbbf24' : '#34d399';
                const displayTitle = emp.job_title && emp.job_title !== 'nan' && emp.job_title !== 'null'
                  ? emp.job_title
                  : 'Untitled Role';
                return (
                  <div
                    key={i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.2fr 1fr 0.5fr 80px',
                      gap: 8,
                      padding: '11px 14px',
                      borderRadius: 12,
                      background: i === 0 ? 'rgba(251,113,133,0.06)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${i === 0 ? 'rgba(251,113,133,0.10)' : 'rgba(255,255,255,0.06)'}`,
                      alignItems: 'center',
                      transition: 'background 0.15s',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#fafafa', display: 'block' }}>{displayTitle}</span>
                      <span style={{ fontSize: 10, color: '#52525b' }}>{emp.tenure_years?.toFixed(1)} yr tenure</span>
                    </div>
                    <span style={{ fontSize: 12, color: '#a1a1aa' }}>{emp.department}</span>
                    <Badge label={`${pct}%`} color={badgeColor} dot />
                    <button
                      style={{
                        borderRadius: 9999,
                        background: 'rgba(255,138,76,0.10)',
                        border: '1px solid rgba(255,138,76,0.25)',
                        color: '#FF8A4C',
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '4px 10px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Take Action
                    </button>
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
