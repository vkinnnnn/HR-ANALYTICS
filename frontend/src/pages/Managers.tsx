import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { UserCheck, Users, Maximize2, AlertOctagon } from 'lucide-react';
import api from '../lib/api';
import { CHART_COLORS } from '../lib/utils';
import { PageHero } from '../components/ui/PageHero';
import { KpiCard } from '../components/ui/KpiCard';
import { Panel } from '../components/ui/Panel';
import { Badge } from '../components/ui/Badge';
import { SectionHeader } from '../components/ui/SectionHeader';
import { ChartTooltip } from '../components/charts/ChartTooltip';

interface ManagerSummary {
  total_managers: number;
  avg_span_of_control: number;
  max_span_of_control: number;
}

interface SpanBucket {
  range: string;
  count: number;
}

interface ManagerRow {
  pk_person: string;
  job_title: string;
  department: string;
  direct_reports: number;
  grade: string;
}

interface RetentionRow {
  pk_person: string;
  job_title: string;
  department: string;
  direct_reports: number;
  retention_pct: number;
  departures: number;
}

export function Managers() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ManagerSummary | null>(null);
  const [spanDist, setSpanDist] = useState<SpanBucket[]>([]);
  const [leaderboard, setLeaderboard] = useState<ManagerRow[]>([]);
  const [retention, setRetention] = useState<RetentionRow[]>([]);
  const [revolvingDoorCount, setRevolvingDoorCount] = useState<number>(0);

  useEffect(() => {
    async function load() {
      try {
        const [sumRes, spanRes, lbRes, retRes] = await Promise.all([
          api.get('/api/managers/summary'),
          api.get('/api/managers/span-distribution'),
          api.get('/api/managers/leaderboard'),
          api.get('/api/managers/retention'),
        ]);
        setSummary(sumRes.data);
        setSpanDist(spanRes.data.buckets ?? spanRes.data ?? []);
        setLeaderboard(lbRes.data.managers ?? lbRes.data ?? []);
        const retentionData = retRes.data;
        setRetention(retentionData.managers ?? retentionData ?? []);
        setRevolvingDoorCount(retentionData?.revolving_door_count ?? 0);
      } catch (e) {
        console.error('Managers load error', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const revolvingDoor = retention.filter(m => m.retention_pct < 60);

  return (
    <div>
      <PageHero
        icon={<UserCheck size={20} />}
        title="Manager Analytics"
        subtitle="Span of control and retention analysis"
      />

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-4 mb-7">
        <KpiCard
          label="Total Managers"
          value={summary?.total_managers ?? 0}
          icon={<UserCheck size={18} />}
          loading={loading}
          delay={0}
        />
        <KpiCard
          label="Avg Span of Control"
          value={summary?.avg_span_of_control ?? 0}
          icon={<Users size={18} />}
          color="#60a5fa"
          loading={loading}
          delay={60}
        />
        <KpiCard
          label="Max Span"
          value={summary?.max_span_of_control ?? 0}
          icon={<Maximize2 size={18} />}
          color="#a78bfa"
          loading={loading}
          delay={120}
        />
        <KpiCard
          label="Revolving Door"
          value={revolvingDoorCount}
          icon={<AlertOctagon size={18} />}
          color="#fb7185"
          loading={loading}
          delay={180}
        />
      </div>

      {/* Span Distribution Chart */}
      <Panel delay={240} className="mb-7">
        <SectionHeader
          title="Span of Control Distribution"
          subtitle="Number of managers by direct report count"
        />
        {loading ? (
          <div style={{ height: 300, background: 'rgba(255,255,255,0.02)', borderRadius: 8 }} />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={spanDist}
              margin={{ top: 0, right: 20, bottom: 0, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
              <XAxis
                dataKey="range"
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
                dataKey="count"
                name="Managers"
                fill={CHART_COLORS[2]}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>

      <div className="grid grid-cols-2 gap-4">
        {/* Leaderboard Table */}
        <Panel delay={300}>
          <SectionHeader
            icon={<UserCheck size={15} />}
            title="Manager Leaderboard"
            subtitle="Ranked by direct reports"
          />
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-8 rounded" style={{ background: 'rgba(255,255,255,0.04)', animation: 'shimmer 2s infinite' }} />
              ))}
            </div>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: 440, overflowY: 'auto' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1.4fr 0.8fr 0.6fr',
                  gap: '0',
                  fontSize: 12,
                  minWidth: 440,
                }}
              >
                {/* Header */}
                {['Job Title', 'Department', 'Reports', 'Grade'].map(h => (
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
                {leaderboard.map((mgr, i) => (
                  <div key={mgr.pk_person ?? i} style={{ display: 'contents' }}>
                    <div style={{ padding: '10px 12px', color: '#d4d4d8', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      {mgr.job_title}
                    </div>
                    <div style={{ padding: '10px 12px', color: '#a1a1aa', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      {mgr.department}
                    </div>
                    <div style={{ padding: '10px 12px', color: '#fafafa', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      {mgr.direct_reports}
                    </div>
                    <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <Badge label={mgr.grade ?? '—'} color={CHART_COLORS[1]} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>

        {/* Revolving Door */}
        <Panel delay={360}>
          <SectionHeader
            icon={<AlertOctagon size={15} />}
            title="Revolving Door Managers"
            subtitle="Retention below 60%"
          />
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 rounded" style={{ background: 'rgba(255,255,255,0.04)', animation: 'shimmer 2s infinite' }} />
              ))}
            </div>
          ) : revolvingDoor.length === 0 ? (
            <p style={{ color: '#52525b', fontSize: 12, textAlign: 'center', padding: 32 }}>
              No managers with retention below 60%
            </p>
          ) : (
            <div className="space-y-2.5" style={{ maxHeight: 440, overflowY: 'auto' }}>
              {revolvingDoor.map((mgr, i) => (
                <div
                  key={mgr.pk_person ?? i}
                  style={{
                    padding: '12px 14px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: 10,
                  }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#d4d4d8' }}>
                      {mgr.job_title}
                    </span>
                    <Badge
                      label={`${mgr.retention_pct.toFixed(0)}% retention`}
                      color="#fb7185"
                      dot
                    />
                  </div>
                  <div className="flex items-center gap-3" style={{ fontSize: 11, color: '#71717a' }}>
                    <span>{mgr.department}</span>
                    <span style={{ color: '#3f3f46' }}>|</span>
                    <span>{mgr.direct_reports} reports</span>
                    <span style={{ color: '#3f3f46' }}>|</span>
                    <span>{mgr.departures} departures</span>
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
