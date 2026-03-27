import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Users, MapPin, UserCheck, UserMinus } from 'lucide-react';
import api from '../lib/api';
import { CHART_COLORS } from '../lib/utils';
import { Panel } from '../components/ui/Panel';
import { KpiCard } from '../components/ui/KpiCard';
import { PageHero } from '../components/ui/PageHero';
import { SectionHeader } from '../components/ui/SectionHeader';
import { Tabs } from '../components/ui/Tabs';
import { ChartTooltip } from '../components/charts/ChartTooltip';

interface Summary {
  total_headcount: number;
  active: number;
  departed: number;
  unique_locations: number;
}

interface DimensionItem {
  name: string;
  count: number;
}

interface GradePyramidRow {
  grade: string;
  active: number;
  departed: number;
}

const DIMENSION_TABS = [
  { id: 'department', label: 'Department' },
  { id: 'grade_band', label: 'Grade Band' },
  { id: 'function_family', label: 'Function Family' },
  { id: 'job_family', label: 'Job Family' },
  { id: 'seniority', label: 'Seniority' },
  { id: 'grade_track', label: 'Career Track' },
  { id: 'country', label: 'Country' },
  { id: 'business_unit', label: 'Business Unit' },
];

const DIMENSION_ENDPOINTS: Record<string, string> = {
  department: '/api/workforce/by-department',
  grade_band: '/api/workforce/by-grade-band',
  function_family: '/api/workforce/by-function-family',
  job_family: '/api/workforce/by-job-family',
  seniority: '/api/workforce/by-seniority',
  grade_track: '/api/workforce/by-grade-track',
  country: '/api/workforce/by-country',
  business_unit: '/api/workforce/by-business-unit',
};

const PIE_COLORS = ['#34d399', '#fb7185'];

export function Workforce() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [dimensionData, setDimensionData] = useState<Record<string, DimensionItem[]>>({});
  const [gradePyramid, setGradePyramid] = useState<GradePyramidRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dimLoading, setDimLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [sumRes, deptRes, pyramidRes] = await Promise.all([
          api.get('/api/workforce/summary'),
          api.get(DIMENSION_ENDPOINTS.department),
          api.get('/api/workforce/grade-pyramid'),
        ]);
        setSummary(sumRes.data);
        // Normalize department data
        const rawDept = deptRes.data?.data || deptRes.data || [];
        const normDept = rawDept.map((item: any) => ({
          name: item.department || item.name,
          count: item.headcount ?? item.count ?? 0,
        }));
        setDimensionData({ department: normDept });
        setGradePyramid(pyramidRes.data?.data || pyramidRes.data || []);
      } catch (err) {
        console.error('Workforce load error', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const fetchDimension = useCallback(async (dim: string) => {
    if (dimensionData[dim]) return;
    setDimLoading(true);
    try {
      const res = await api.get(DIMENSION_ENDPOINTS[dim]);
      // Normalize: API returns {data: [{key: val, headcount: n}]} — flatten to [{name, count}]
      const raw = res.data?.data || res.data || [];
      const normalized = raw.map((item: any) => {
        const keys = Object.keys(item);
        const nameKey = keys.find(k => k !== 'headcount' && k !== 'count' && k !== 'departments') || keys[0];
        return { name: item[nameKey], count: item.headcount ?? item.count ?? 0 };
      });
      setDimensionData(prev => ({ ...prev, [dim]: normalized }));
    } catch (err) {
      console.error(`Failed to fetch ${dim}`, err);
    } finally {
      setDimLoading(false);
    }
  }, [dimensionData]);

  const kpiLoading = loading || !summary;
  const pieData = summary
    ? [
        { name: 'Active', value: summary.active },
        { name: 'Departed', value: summary.departed },
      ]
    : [];

  return (
    <div>
      <PageHero
        icon={<Users size={20} />}
        title="Workforce Composition"
        subtitle="Headcount breakdown across all dimensions"
      />

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total Headcount" value={summary?.total_headcount ?? 0} icon={<Users size={18} />} color="#FF8A4C" delay={0} loading={kpiLoading} />
        <KpiCard label="Active" value={summary?.active ?? 0} icon={<UserCheck size={18} />} color="#34d399" delay={60} loading={kpiLoading} />
        <KpiCard label="Departed" value={summary?.departed ?? 0} icon={<UserMinus size={18} />} color="#fb7185" delay={120} loading={kpiLoading} />
        <KpiCard label="Locations" value={summary?.unique_locations ?? 0} icon={<MapPin size={18} />} color="#60a5fa" delay={180} loading={kpiLoading} />
      </div>

      {/* Dimension Breakdown */}
      <Panel delay={240} className="mb-4">
        <SectionHeader title="Headcount by Dimension" subtitle="Switch between organizational dimensions" />
        <Tabs tabs={DIMENSION_TABS}>
          {(activeTab) => {
            // Trigger fetch when tab changes
            if (!dimensionData[activeTab] && !dimLoading) {
              fetchDimension(activeTab);
            }
            const data = dimensionData[activeTab] ?? [];
            const isLoading = !dimensionData[activeTab];

            return isLoading ? (
              <div style={{ height: 360, background: 'rgba(255,255,255,0.03)', borderRadius: 8, animation: 'shimmer 2s infinite' }} />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(360, data.length * 32)}>
                <BarChart data={data} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis type="number" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} width={140} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} name="Headcount">
                    {data.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            );
          }}
        </Tabs>
      </Panel>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Active vs Departed Pie */}
        <Panel delay={300}>
          <SectionHeader title="Active vs Departed" subtitle="Overall workforce status split" />
          {loading ? (
            <div style={{ height: 300, background: 'rgba(255,255,255,0.03)', borderRadius: 8, animation: 'shimmer 2s infinite' }} />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value: string) => (
                    <span style={{ color: '#a1a1aa', fontSize: 12 }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Grade Pyramid */}
        <Panel delay={360}>
          <SectionHeader title="Grade Pyramid" subtitle="Workforce distribution by grade level" />
          {loading ? (
            <div style={{ height: 300, background: 'rgba(255,255,255,0.03)', borderRadius: 8, animation: 'shimmer 2s infinite' }} />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(300, gradePyramid.length * 36)}>
              <BarChart data={gradePyramid} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis type="number" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="grade" type="category" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} width={80} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="active" stackId="stack" fill="#34d399" name="Active" radius={[0, 0, 0, 0]} />
                <Bar dataKey="departed" stackId="stack" fill="#fb7185" name="Departed" radius={[0, 4, 4, 0]} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value: string) => (
                    <span style={{ color: '#a1a1aa', fontSize: 12 }}>{value}</span>
                  )}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>
    </div>
  );
}
