import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { GitBranch, TrendingUp, Clock, AlertCircle, ArrowRight } from 'lucide-react';
import api from '../lib/api';
import { CHART_COLORS } from '../lib/utils';
import { PageHero } from '../components/ui/PageHero';
import { KpiCard } from '../components/ui/KpiCard';
import { Panel } from '../components/ui/Panel';
import { Badge } from '../components/ui/Badge';
import { SectionHeader } from '../components/ui/SectionHeader';
import { ChartTooltip } from '../components/charts/ChartTooltip';

interface CareerSummary {
  total_promotions: number;
  avg_promotion_velocity_days: number;
  pct_with_title_changes: number;
  stuck_count: number;
}

interface StuckEmployee {
  pk_person: string;
  job_title: string;
  department: string;
  time_in_current_role_days: number;
}

interface DeptVelocity {
  department: string;
  avg_velocity_days: number;
}

interface CareerPath {
  path: string[];
  count: number;
  steps: number;
}

export function Careers() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<CareerSummary | null>(null);
  const [stuck, setStuck] = useState<StuckEmployee[]>([]);
  const [paths, setPaths] = useState<CareerPath[]>([]);
  const [deptVelocity, setDeptVelocity] = useState<DeptVelocity[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [sumRes, stuckRes, pathsRes, deptRes] = await Promise.all([
          api.get('/api/careers/summary'),
          api.get('/api/careers/stuck-employees'),
          api.get('/api/careers/career-paths'),
          api.get('/api/careers/by-department'),
        ]);
        setSummary(sumRes.data);
        setStuck(stuckRes.data.employees ?? stuckRes.data ?? []);
        setPaths(pathsRes.data.paths ?? pathsRes.data ?? []);
        setDeptVelocity(deptRes.data.departments ?? deptRes.data ?? []);
      } catch (e) {
        console.error('Careers load error', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div>
      <PageHero
        icon={<GitBranch size={20} />}
        title="Career Progression"
        subtitle="Track promotions, lateral moves, and career velocity"
      />

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-4 mb-7">
        <KpiCard
          label="Total Promotions"
          value={summary?.total_promotions ?? 0}
          icon={<TrendingUp size={18} />}
          loading={loading}
          delay={0}
        />
        <KpiCard
          label="Avg Promotion Velocity"
          value={summary?.avg_promotion_velocity_days ?? 0}
          icon={<Clock size={18} />}
          color="#60a5fa"
          loading={loading}
          delay={60}
        />
        <KpiCard
          label="% With Title Changes"
          value={summary?.pct_with_title_changes ?? 0}
          format="percent"
          icon={<GitBranch size={18} />}
          color="#a78bfa"
          loading={loading}
          delay={120}
        />
        <KpiCard
          label="Stuck Employees"
          value={summary?.stuck_count ?? 0}
          icon={<AlertCircle size={18} />}
          color="#fb7185"
          loading={loading}
          delay={180}
        />
      </div>

      {/* Promotion Velocity by Department */}
      <Panel delay={240} className="mb-7">
        <SectionHeader
          title="Promotion Velocity by Department"
          subtitle="Average days between promotions"
        />
        {loading ? (
          <div style={{ height: 340, background: 'rgba(255,255,255,0.02)', borderRadius: 8 }} />
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            <BarChart
              data={deptVelocity}
              margin={{ top: 0, right: 20, bottom: 0, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
              <XAxis
                dataKey="department"
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
              <Bar
                dataKey="avg_velocity_days"
                name="Avg Days"
                fill={CHART_COLORS[0]}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>

      <div className="grid grid-cols-2 gap-4">
        {/* Stuck Employees Table */}
        <Panel delay={300}>
          <SectionHeader
            icon={<AlertCircle size={15} />}
            title="Stuck Employees"
            subtitle="3+ years in the same role"
          />
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 rounded" style={{ background: 'rgba(255,255,255,0.04)', animation: 'shimmer 2s infinite' }} />
              ))}
            </div>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1.8fr 1.2fr 1fr',
                  gap: '0',
                  fontSize: 12,
                  minWidth: 480,
                }}
              >
                {/* Header */}
                {['ID', 'Job Title', 'Department', 'Days in Role'].map(h => (
                  <div
                    key={h}
                    style={{
                      padding: '10px 12px',
                      fontWeight: 700,
                      color: '#71717a',
                      fontSize: 10,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                      position: 'sticky',
                      top: 0,
                      background: 'rgba(19,19,24,0.98)',
                    }}
                  >
                    {h}
                  </div>
                ))}
                {/* Rows */}
                {stuck.map((emp, i) => (
                  <div key={emp.pk_person ?? i} style={{ display: 'contents' }}>
                    <div style={{ padding: '10px 12px', color: '#71717a', fontFamily: 'monospace', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      {emp.pk_person}
                    </div>
                    <div style={{ padding: '10px 12px', color: '#d4d4d8', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      {emp.job_title}
                    </div>
                    <div style={{ padding: '10px 12px', color: '#a1a1aa', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      {emp.department}
                    </div>
                    <div style={{ padding: '10px 12px', color: '#a1a1aa', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      {emp.time_in_current_role_days?.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>

        {/* Career Paths */}
        <Panel delay={360}>
          <SectionHeader
            icon={<GitBranch size={15} />}
            title="Top Career Paths"
            subtitle="Most common 2-step and 3-step sequences"
          />
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 rounded" style={{ background: 'rgba(255,255,255,0.04)', animation: 'shimmer 2s infinite' }} />
              ))}
            </div>
          ) : (
            <div className="space-y-3" style={{ maxHeight: 420, overflowY: 'auto' }}>
              {paths.map((path, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between"
                  style={{
                    padding: '10px 14px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: 10,
                  }}
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {path.path.map((step, j) => (
                      <span key={j} className="flex items-center gap-1.5">
                        <Badge
                          label={step}
                          color={CHART_COLORS[j % CHART_COLORS.length]}
                        />
                        {j < path.path.length - 1 && (
                          <ArrowRight size={12} style={{ color: '#52525b' }} />
                        )}
                      </span>
                    ))}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#71717a', marginLeft: 12, whiteSpace: 'nowrap' }}>
                    {path.count} employees
                  </span>
                </div>
              ))}
              {paths.length === 0 && (
                <p style={{ color: '#52525b', fontSize: 12, textAlign: 'center', padding: 24 }}>
                  No career path data available
                </p>
              )}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
