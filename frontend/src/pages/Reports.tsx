import { useState } from 'react';
import {
  FileText, Sparkles, Download, Loader2, ClipboardCopy, CheckCircle2,
  AlertTriangle, TrendingUp, ArrowRight,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { PageHero } from '../components/ui/PageHero';
import { Panel } from '../components/ui/Panel';
import { SectionHeader } from '../components/ui/SectionHeader';
import { Badge } from '../components/ui/Badge';
import { ChartTooltip } from '../components/charts/ChartTooltip';
import api from '../lib/api';
import { CHART_COLORS } from '../lib/utils';

interface ReportSection {
  title: string;
  narrative: string;
  chart: { type: string; data: { name: string; value: number }[] } | null;
  key_metrics: { label: string; value: string; change?: string }[];
  insights: string[];
}

interface StructuredReport {
  title: string;
  generated_at: string;
  executive_summary: string;
  sections: ReportSection[];
  recommendations: { priority: string; title: string; detail: string }[];
  metrics_snapshot: Record<string, number | string>;
}

export function Reports() {
  const [report, setReport] = useState<StructuredReport | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await api.post('/api/reports/generate');
      setReport(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!report) return;
    const text = `${report.title}\n${report.executive_summary}\n\n${report.sections.map(s => `${s.title}\n${s.narrative}`).join('\n\n')}`;
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = () => {
    setExporting(true);
    window.open(`${api.defaults.baseURL}/api/reports/download`, '_blank');
    setTimeout(() => setExporting(false), 1500);
  };

  const priorityColor: Record<string, string> = {
    critical: '#fb7185',
    high: '#fbbf24',
    medium: '#a78bfa',
    low: '#34d399',
  };

  return (
    <div>
      <PageHero
        icon={<FileText size={20} />}
        title="Reports & Export"
        subtitle="Generate executive intelligence reports and export data packages."
      />

      {/* Action Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Panel delay={0}>
          <SectionHeader icon={<Sparkles size={16} />} title="Intelligence Report" subtitle="AI-powered workforce analysis" />
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              width: '100%', padding: '12px 20px', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: generating ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg, rgba(255,138,76,0.15), rgba(232,93,4,0.15))',
              border: `1px solid ${generating ? 'rgba(255,255,255,0.06)' : 'rgba(255,138,76,0.25)'}`,
              color: generating ? '#71717a' : '#FF8A4C', fontSize: 13, fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer',
            }}
          >
            {generating ? <><Loader2 size={15} className="animate-spin" /> Generating Report...</> : <><Sparkles size={15} /> Generate Intelligence Report</>}
          </button>
          {error && (
            <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.15)' }}>
              <p style={{ fontSize: 12, color: '#fb7185' }}>{error}</p>
            </div>
          )}
        </Panel>

        <Panel delay={80}>
          <SectionHeader icon={<Download size={16} />} title="Export Data Package" subtitle="Download complete workforce data bundle" />
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{
              width: '100%', padding: '12px 20px', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: exporting ? 'rgba(255,255,255,0.04)' : 'rgba(52,211,153,0.1)',
              border: `1px solid ${exporting ? 'rgba(255,255,255,0.06)' : 'rgba(52,211,153,0.2)'}`,
              color: exporting ? '#71717a' : '#34d399', fontSize: 13, fontWeight: 600, cursor: exporting ? 'not-allowed' : 'pointer',
            }}
          >
            {exporting ? <><Loader2 size={15} className="animate-spin" /> Preparing...</> : <><Download size={15} /> Export Data Package</>}
          </button>
        </Panel>
      </div>

      {/* Generating State */}
      {generating && (
        <Panel delay={100}>
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="fire-orb" style={{ width: 48, height: 48 }} />
            <p style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>Analyzing workforce data...</p>
            <p style={{ fontSize: 12, color: '#52525b' }}>Generating sections with AI insights</p>
          </div>
        </Panel>
      )}

      {/* Rendered Report */}
      {report && !generating && (
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Report Header */}
          <Panel delay={0}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fafafa', letterSpacing: '-0.02em' }}>{report.title}</h2>
                <p style={{ fontSize: 12, color: '#52525b', marginTop: 4 }}>
                  Generated {new Date(report.generated_at).toLocaleString()} by Workforce AI
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={handleCopy} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: copied ? '#34d399' : '#a1a1aa', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {copied ? <><CheckCircle2 size={12} /> Copied</> : <><ClipboardCopy size={12} /> Copy</>}
                </button>
              </div>
            </div>
            {/* Executive Summary */}
            <div style={{ padding: '16px 20px', borderRadius: 12, background: 'rgba(255,138,76,0.04)', border: '1px solid rgba(255,138,76,0.1)' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="fire-orb" style={{ width: 20, height: 20 }} />
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#FF8A4C' }}>Executive Summary</span>
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: '#a1a1aa', whiteSpace: 'pre-wrap' }}>{report.executive_summary}</p>
            </div>
          </Panel>

          {/* Report Sections */}
          {report.sections.map((section, i) => (
            <Panel key={i} delay={60 * (i + 1)}>
              <SectionHeader icon={<TrendingUp size={14} />} title={section.title} />
              {/* Key Metrics */}
              {section.key_metrics.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(section.key_metrics.length, 4)}, 1fr)`, gap: 12, marginBottom: 16 }}>
                  {section.key_metrics.map((m, mi) => (
                    <div key={mi} style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#71717a', marginBottom: 4 }}>{m.label}</p>
                      <p style={{ fontSize: 18, fontWeight: 800, color: '#fafafa' }}>{m.value}</p>
                      {m.change && <p style={{ fontSize: 11, color: '#fb7185', marginTop: 2 }}>{m.change}</p>}
                    </div>
                  ))}
                </div>
              )}
              {/* Narrative */}
              <p style={{ fontSize: 13, lineHeight: 1.7, color: '#a1a1aa', marginBottom: section.chart ? 16 : 0 }}>{section.narrative}</p>
              {/* Chart */}
              {section.chart && section.chart.data.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={section.chart.data} layout={section.chart.type === 'horizontal_bar' ? 'vertical' : 'horizontal'}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                      {section.chart.type === 'horizontal_bar' ? (
                        <>
                          <XAxis type="number" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis dataKey="name" type="category" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} width={110} />
                        </>
                      ) : (
                        <>
                          <XAxis dataKey="name" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} />
                        </>
                      )}
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="value" radius={section.chart.type === 'horizontal_bar' ? [0, 4, 4, 0] : [4, 4, 0, 0]}>
                        {section.chart.data.map((_, ci) => <Cell key={ci} fill={CHART_COLORS[ci % CHART_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {/* Insights */}
              {section.insights.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  {section.insights.map((insight, ii) => (
                    <div key={ii} className="flex items-start gap-2" style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(251,113,133,0.06)', border: '1px solid rgba(251,113,133,0.1)', marginTop: ii > 0 ? 8 : 0 }}>
                      <AlertTriangle size={14} style={{ color: '#fb7185', marginTop: 1, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: '#fb7185' }}>{insight}</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          ))}

          {/* Recommendations */}
          {report.recommendations.length > 0 && (
            <Panel delay={300}>
              <SectionHeader icon={<ArrowRight size={14} />} title="Recommendations" subtitle="Prioritized actions based on data analysis" />
              <div style={{ display: 'grid', gap: 10 }}>
                {report.recommendations.map((rec, ri) => (
                  <div key={ri} className="flex items-start gap-3" style={{
                    padding: '14px 16px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.02)',
                    border: `1px solid ${(priorityColor[rec.priority] || '#71717a')}20`,
                  }}>
                    <Badge label={rec.priority} color={priorityColor[rec.priority] || '#71717a'} />
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>{rec.title}</p>
                      <p style={{ fontSize: 12, color: '#71717a', marginTop: 2 }}>{rec.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}
