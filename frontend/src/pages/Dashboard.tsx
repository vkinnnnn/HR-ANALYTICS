import { useState, useEffect, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { LayoutDashboard, TrendingDown, Clock, ShieldAlert, TrendingUp, Zap } from 'lucide-react';
import api from '../lib/api';
import { PageHero } from '../components/ui/PageHero';
import { Panel } from '../components/ui/Panel';
import { SectionHeader } from '../components/ui/SectionHeader';
import { KpiCard } from '../components/ui/KpiCard';
import { Badge } from '../components/ui/Badge';
import { InsightBanner } from '../components/ui/InsightBanner';
import { ChartTooltip } from '../components/charts/ChartTooltip';
import { CHART_COLORS } from '../lib/utils';

/* ---------- types ---------- */
interface WorkforceSummary {
  total_active: number;
  total_departed: number;
  new_hires_this_quarter: number;
  departures_this_quarter: number;
}

interface TurnoverSummary {
  turnover_rate: number;
  avg_tenure_days: number;
}

interface TenureSummary {
  avg_tenure_years: number;
}

interface FlightRiskItem {
  pk_user: string;
  job_title: string;
  department_name: string;
  risk_score: number;
}

interface HeadcountTrend {
  month: string;
  headcount: number;
}

interface DepartmentTurnover {
  department_name: string;
  turnover_rate: number;
}

interface TenureDistribution {
  band: string;
  count: number;
}

/* ---------- constants ---------- */
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

/* ---------- component ---------- */
export function Dashboard() {
  const [workforce, setWorkforce] = useState<WorkforceSummary | null>(null);
  const [turnover, setTurnover] = useState<TurnoverSummary | null>(null);
  const [tenure, setTenure] = useState<TenureSummary | null>(null);
  const [flightRisk, setFlightRisk] = useState<FlightRiskItem[]>([]);
  const [headcountTrend, setHeadcountTrend] = useState<HeadcountTrend[]>([]);
  const [deptTurnover, setDeptTurnover] = useState<DepartmentTurnover[]>([]);
  const [tenureDistribution, setTenureDistribution] = useState<TenureDistribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setError(null);
        const results = await Promise.allSettled([
          api.get('/api/workforce/summary'),
          api.get('/api/turnover/summary'),
          api.get('/api/tenure/summary'),
          api.get('/api/predictions/flight-risk?top_n=50'),
          api.get('/api/workforce/headcount-trend'),
          api.get('/api/turnover/by-department'),
          api.get('/api/tenure/distribution'),
        ]);
        const val = (i: number) => results[i].status === 'fulfilled' ? (results[i] as any).value.data : null;
        if (val(0)) setWorkforce(val(0));
        if (val(1)) setTurnover(val(1));
        if (val(2)) setTenure(val(2));
        if (val(3)) setFlightRisk((val(3)?.flight_risk || val(3) || []).slice(0, 5));
        if (val(4)) setHeadcountTrend(val(4)?.trend || val(4) || []);
        if (val(5)) setDeptTurnover((val(5)?.by_department || val(5) || []).slice(0, 8));
        if (val(6)) setTenureDistribution(val(6)?.distribution || val(6) || []);
        if (results.every(r => r.status === 'rejected')) setError('Unable to load data. Check backend connection.');
      } catch (err: any) {
        setError(err?.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const kpiLoading = loading || !workforce;

  /* AI insight from turnover data */
  const insightText = useMemo(() => {
    if (!deptTurnover.length || !turnover) return '';
    const highest = deptTurnover[0];
    if (highest.turnover_rate > 20) {
      return `${highest.department_name} is experiencing elevated turnover at ${highest.turnover_rate.toFixed(1)}%. Consider targeted retention initiatives for this department.`;
    }
    return `Turnover rate is ${turnover.turnover_rate.toFixed(1)}%. Monitor departments with rising attrition.`;
  }, [deptTurnover, turnover]);

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
        subtitle="Workforce intelligence at a glance"
      />

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <KpiCard label="Active Headcount" value={workforce?.total_active ?? 0} icon={<TrendingUp size={18} />} color="#FF8A4C" delay={0} loading={kpiLoading} />
        <KpiCard
          label="Turnover Rate"
          value={turnover?.turnover_rate ?? 0}
          format="percent"
          icon={<TrendingDown size={18} />}
          color="#fb7185"
          delay={60}
          loading={kpiLoading}
        />
        <KpiCard
          label="Avg Tenure"
          value={tenure?.avg_tenure_years ?? 0}
          format="decimal"
          suffix="yrs"
          icon={<Clock size={18} />}
          color="#34d399"
          delay={120}
          loading={kpiLoading}
        />
        <KpiCard
          label="Flight Risk"
          value={flightRisk.length}
          icon={<ShieldAlert size={18} />}
          color="#a78bfa"
          delay={180}
          loading={kpiLoading}
        />
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: '14px 18px', borderRadius: 12, background: 'rgba(251,113,133,0.06)', border: '1px solid rgba(251,113,133,0.15)', color: '#fb7185', fontSize: 13, fontWeight: 500 }}>
          {error}
        </div>
      )}
      <PageHero
        icon={<LayoutDashboard size={20} />}
        title="Dashboard"
        subtitle="Workforce intelligence at a glance"
      />

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <KpiCard label="Active Headcount" value={workforce?.total_active ?? 0} icon={<TrendingUp size={18} />} color="#FF8A4C" delay={0} loading={kpiLoading} />
        <KpiCard
          label="Turnover Rate"
          value={turnover?.turnover_rate ?? 0}
          format="percent"
          icon={<TrendingDown size={18} />}
          color="#fb7185"
          delay={60}
          loading={kpiLoading}
        />
        <KpiCard
          label="Avg Tenure"
          value={tenure?.avg_tenure_years ?? 0}
          format="decimal"
          suffix="yrs"
          icon={<Clock size={18} />}
          color="#34d399"
          delay={120}
          loading={kpiLoading}
        />
        <KpiCard
          label="Flight Risk"
          value={flightRisk.length}
          icon={<ShieldAlert size={18} />}
          color="#a78bfa"
          delay={180}
          loading={kpiLoading}
        />
      </div>

      {/* AI Insight Banner */}
      {!loading && insightText && (
        <InsightBanner
          icon={<Zap size={16} />}
          title="Workforce Alert"
          message={insightText}
          color="#FF8A4C"
        />
      )}

      {/* Charts Row 1: Headcount Trend + Turnover by Department */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Headcount Trend */}
        <Panel delay={240}>
          <SectionHeader
            icon={<TrendingUp size={14} />}
            title="Headcount Trend"
            subtitle="Active employee count over time"
          />
          {loading ? <Shimmer /> : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={headcountTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                <XAxis dataKey="month" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="headcount" stroke="#FF8A4C" fill="rgba(255,138,76,0.1)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Turnover by Department */}
        <Panel delay={300}>
          <SectionHeader
            icon={<TrendingDown size={14} />}
            title="Turnover by Department"
            subtitle="Department attrition rates (top 8)"
            action={<Badge label={`${deptTurnover.length} depts`} color="#fb7185" />}
          />
          {loading ? <Shimmer /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={deptTurnover}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                <XAxis dataKey="department_name" tick={AXIS_STYLE} angle={-45} textAnchor="end" height={80} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="turnover_rate" radius={[4, 4, 0, 0]} name="Turnover %">
                  {deptTurnover.map((_, i) => <Cell key={i} fill={deptTurnover[i].turnover_rate > 20 ? '#fb7185' : CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      {/* Charts Row 2: Tenure Distribution + Flight Risk Watchlist */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Tenure Distribution */}
        <Panel delay={360}>
          <SectionHeader
            icon={<Clock size={14} />}
            title="Tenure Distribution"
            subtitle="Employees by tenure bands"
          />
          {loading ? <Shimmer /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={tenureDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                <XAxis dataKey="band" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Count">
                  {tenureDistribution.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Flight Risk Watchlist */}
        <Panel delay={420}>
          <SectionHeader
            icon={<ShieldAlert size={14} />}
            title="Flight Risk Watchlist"
            subtitle="Top 5 at-risk employees"
            action={<Badge label={`${flightRisk.length} at risk`} color="#a78bfa" />}
          />
          {loading ? <ShimmerRows count={5} /> : flightRisk.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: '#52525b', fontSize: 13 }}>
              No flight risk employees detected.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {flightRisk.map((emp, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, padding: '11px 14px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', alignItems: 'center'
                }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#fafafa' }}>{emp.job_title}</p>
                    <p style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>{emp.department_name}</p>
                  </div>
                  <Badge label={`${(emp.risk_score * 100).toFixed(0)}%`} color="#a78bfa" />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
