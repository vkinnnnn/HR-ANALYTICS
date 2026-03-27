import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts';
import { Building2, Layers, BarChart3, Calendar } from 'lucide-react';
import api from '../lib/api';
import { CHART_COLORS } from '../lib/utils';
import { PageHero } from '../components/ui/PageHero';
import { KpiCard } from '../components/ui/KpiCard';
import { Panel } from '../components/ui/Panel';
import { Badge } from '../components/ui/Badge';
import { SectionHeader } from '../components/ui/SectionHeader';
import { ChartTooltip } from '../components/charts/ChartTooltip';

interface OrgSummary {
  total_departments: number;
  total_business_units: number;
  avg_dept_size: number;
  max_dept_size: number;
}

interface DeptSize {
  department: string;
  headcount: number;
}

interface GrowthRow {
  year: number;
  [department: string]: number;
}

interface RestructuringEvent {
  month: string;
  department: string;
  role_changes: number;
  description: string;
}

export function Org() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<OrgSummary | null>(null);
  const [deptSizes, setDeptSizes] = useState<DeptSize[]>([]);
  const [growth, setGrowth] = useState<GrowthRow[]>([]);
  const [growthDepts, setGrowthDepts] = useState<string[]>([]);
  const [restructuring, setRestructuring] = useState<RestructuringEvent[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [sumRes, sizeRes, growthRes, restrRes] = await Promise.all([
          api.get('/api/org/summary'),
          api.get('/api/org/department-sizes'),
          api.get('/api/org/department-growth'),
          api.get('/api/org/restructuring'),
        ]);
        setSummary(sumRes.data);
        setDeptSizes(sizeRes.data.departments ?? sizeRes.data ?? []);

        const growthData = growthRes.data;
        const rows: GrowthRow[] = growthData.rows ?? growthData.data ?? growthData ?? [];
        const depts: string[] = growthData.departments ?? growthData.top_departments ?? [];
        setGrowth(rows);
        setGrowthDepts(depts.length > 0 ? depts.slice(0, 5) : extractDeptKeys(rows));

        setRestructuring(restrRes.data.events ?? restrRes.data ?? []);
      } catch (e) {
        console.error('Org load error', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function extractDeptKeys(rows: GrowthRow[]): string[] {
    if (!rows.length) return [];
    const keys = Object.keys(rows[0]).filter(k => k !== 'year');
    return keys.slice(0, 5);
  }

  return (
    <div>
      <PageHero
        icon={<Building2 size={20} />}
        title="Org Structure"
        subtitle="Department sizes, growth, and hierarchy"
      />

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-4 mb-7">
        <KpiCard
          label="Total Departments"
          value={summary?.total_departments ?? 0}
          icon={<Building2 size={18} />}
          loading={loading}
          delay={0}
        />
        <KpiCard
          label="Business Units"
          value={summary?.total_business_units ?? 0}
          icon={<Layers size={18} />}
          color="#60a5fa"
          loading={loading}
          delay={60}
        />
        <KpiCard
          label="Avg Dept Size"
          value={summary?.avg_dept_size ?? 0}
          icon={<BarChart3 size={18} />}
          color="#a78bfa"
          loading={loading}
          delay={120}
        />
        <KpiCard
          label="Max Dept Size"
          value={summary?.max_dept_size ?? 0}
          icon={<BarChart3 size={18} />}
          color="#34d399"
          loading={loading}
          delay={180}
        />
      </div>

      {/* Department Sizes - Horizontal Bar */}
      <Panel delay={240} className="mb-7">
        <SectionHeader
          title="Department Sizes"
          subtitle="Current headcount by department"
        />
        {loading ? (
          <div style={{ height: 400, background: 'rgba(255,255,255,0.02)', borderRadius: 8 }} />
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(300, deptSizes.length * 30)}>
            <BarChart
              data={deptSizes}
              layout="vertical"
              margin={{ top: 0, right: 20, bottom: 0, left: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: '#52525b', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                dataKey="department"
                type="category"
                tick={{ fill: '#52525b', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={150}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar
                dataKey="headcount"
                name="Headcount"
                fill={CHART_COLORS[3]}
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>

      <div className="grid grid-cols-2 gap-4">
        {/* Department Growth Line Chart */}
        <Panel delay={300}>
          <SectionHeader
            title="Department Growth"
            subtitle="Top 5 departments over time"
          />
          {loading ? (
            <div style={{ height: 320, background: 'rgba(255,255,255,0.02)', borderRadius: 8 }} />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart
                data={growth}
                margin={{ top: 0, right: 20, bottom: 0, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis
                  dataKey="year"
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
                <Legend
                  wrapperStyle={{ fontSize: 10, color: '#71717a' }}
                />
                {growthDepts.map((dept, i) => (
                  <Line
                    key={dept}
                    type="monotone"
                    dataKey={dept}
                    name={dept}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Restructuring Events */}
        <Panel delay={360}>
          <SectionHeader
            icon={<Calendar size={15} />}
            title="Restructuring Events"
            subtitle="Months with abnormal role changes"
          />
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 rounded" style={{ background: 'rgba(255,255,255,0.04)', animation: 'shimmer 2s infinite' }} />
              ))}
            </div>
          ) : restructuring.length === 0 ? (
            <p style={{ color: '#52525b', fontSize: 12, textAlign: 'center', padding: 32 }}>
              No restructuring events detected
            </p>
          ) : (
            <div className="space-y-2.5" style={{ maxHeight: 380, overflowY: 'auto' }}>
              {restructuring.map((evt, i) => (
                <div
                  key={i}
                  style={{
                    padding: '12px 14px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: 10,
                  }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#d4d4d8' }}>
                      {evt.department}
                    </span>
                    <Badge
                      label={`${evt.role_changes} changes`}
                      color="#fbbf24"
                      dot
                    />
                  </div>
                  <div className="flex items-center gap-3" style={{ fontSize: 11, color: '#71717a' }}>
                    <span>{evt.month}</span>
                    {evt.description && (
                      <>
                        <span style={{ color: '#3f3f46' }}>|</span>
                        <span>{evt.description}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
