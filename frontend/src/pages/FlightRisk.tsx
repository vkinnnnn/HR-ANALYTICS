import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { AlertTriangle, Users, ShieldAlert, Database } from 'lucide-react';
import api from '../lib/api';
import { CHART_COLORS } from '../lib/utils';
import { PageHero } from '../components/ui/PageHero';
import { KpiCard } from '../components/ui/KpiCard';
import { Panel } from '../components/ui/Panel';
import { Badge } from '../components/ui/Badge';
import { SectionHeader } from '../components/ui/SectionHeader';
import { ChartTooltip } from '../components/charts/ChartTooltip';

interface TopRiskEmployee {
  pk_person: string;
  job_title: string;
  department: string;
  tenure_years: number;
  risk_score: number;
  time_in_current_role_days: number;
}

interface FeatureImportance {
  feature: string;
  coefficient: number;
}

interface RiskByDept {
  department: string;
  avg_risk_score: number;
  employee_count: number;
}

interface Summary {
  total_active: number;
  high_risk_count: number;
  train_samples: number;
}

export function FlightRisk() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [topRisk, setTopRisk] = useState<TopRiskEmployee[]>([]);
  const [features, setFeatures] = useState<FeatureImportance[]>([]);
  const [riskByDept, setRiskByDept] = useState<RiskByDept[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [riskRes, featRes, deptRes] = await Promise.all([
          api.get('/api/predictions/flight-risk?top_n=20'),
          api.get('/api/predictions/feature-importance'),
          api.get('/api/predictions/risk-by-department'),
        ]);
        const riskData = riskRes.data;
        setSummary({
          total_active: riskData.total_active ?? riskData.total_scored ?? 0,
          high_risk_count: riskData.high_risk_count ?? 0,
          train_samples: riskData.train_samples ?? 0,
        });
        setTopRisk(riskData.top_risk ?? riskData.employees ?? []);
        setFeatures(featRes.data.features ?? featRes.data ?? []);
        setRiskByDept(deptRes.data.departments ?? deptRes.data ?? []);
      } catch (e) {
        console.error('FlightRisk load error', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function riskColor(score: number): string {
    if (score >= 0.7) return '#fb7185';
    if (score >= 0.4) return '#fbbf24';
    return '#34d399';
  }

  function riskLabel(score: number): string {
    if (score >= 0.7) return 'High';
    if (score >= 0.4) return 'Medium';
    return 'Low';
  }

  return (
    <div>
      <PageHero
        icon={<AlertTriangle size={20} />}
        title="Flight Risk"
        subtitle="ML-predicted attrition risk for active employees"
      />

      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-4 mb-7">
        <KpiCard
          label="Total Active Scored"
          value={summary?.total_active ?? 0}
          icon={<Users size={18} />}
          loading={loading}
          delay={0}
        />
        <KpiCard
          label="High Risk (score >= 0.7)"
          value={summary?.high_risk_count ?? 0}
          icon={<ShieldAlert size={18} />}
          color="#fb7185"
          loading={loading}
          delay={60}
        />
        <KpiCard
          label="Model Train Samples"
          value={summary?.train_samples ?? 0}
          icon={<Database size={18} />}
          color="#a78bfa"
          loading={loading}
          delay={120}
        />
      </div>

      {/* Top 20 At-Risk Employees Table */}
      <Panel delay={180} className="mb-7">
        <SectionHeader
          icon={<AlertTriangle size={15} />}
          title="Top 20 At-Risk Employees"
          subtitle="Ranked by predicted risk score"
        />
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 rounded" style={{ background: 'rgba(255,255,255,0.04)', animation: 'shimmer 2s infinite' }} />
            ))}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1.5fr 0.8fr 1fr 1fr',
                gap: '0',
                fontSize: 12,
                minWidth: 640,
              }}
            >
              {/* Header */}
              {['Job Title', 'Department', 'Tenure (yrs)', 'Risk Score', 'Days in Role'].map(h => (
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
                  }}
                >
                  {h}
                </div>
              ))}
              {/* Rows */}
              {topRisk.map((emp, i) => (
                <div key={emp.pk_person ?? i} style={{ display: 'contents' }}>
                  <div style={{ padding: '10px 12px', color: '#d4d4d8', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    {emp.job_title}
                  </div>
                  <div style={{ padding: '10px 12px', color: '#a1a1aa', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    {emp.department}
                  </div>
                  <div style={{ padding: '10px 12px', color: '#a1a1aa', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    {emp.tenure_years?.toFixed(1)}
                  </div>
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <Badge
                      label={`${(emp.risk_score * 100).toFixed(0)}% ${riskLabel(emp.risk_score)}`}
                      color={riskColor(emp.risk_score)}
                      dot
                    />
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

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Feature Importance */}
        <Panel delay={240}>
          <SectionHeader
            title="Feature Importance"
            subtitle="Model coefficient values"
          />
          {loading ? (
            <div style={{ height: 300, background: 'rgba(255,255,255,0.02)', borderRadius: 8 }} />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(300, features.length * 32)}>
              <BarChart
                data={features}
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
                  dataKey="feature"
                  type="category"
                  tick={{ fill: '#52525b', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={140}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="coefficient" name="Coefficient" radius={[0, 4, 4, 0]}>
                  {features.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.coefficient >= 0 ? '#fb7185' : '#34d399'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Risk by Department */}
        <Panel delay={300}>
          <SectionHeader
            title="Risk by Department"
            subtitle="Average risk score per department"
          />
          {loading ? (
            <div style={{ height: 300, background: 'rgba(255,255,255,0.02)', borderRadius: 8 }} />
          ) : (
            <ResponsiveContainer width="100%" height={340}>
              <BarChart
                data={riskByDept}
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
                <Bar dataKey="avg_risk_score" name="Avg Risk Score" fill={CHART_COLORS[5]} radius={[4, 4, 0, 0]}>
                  {riskByDept.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.avg_risk_score >= 0.5 ? '#fb7185' : CHART_COLORS[3]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>
    </div>
  );
}
