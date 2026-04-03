import { useState, useEffect, useRef } from 'react';
import {
  Upload, Database, Sparkles, Download, Loader2, RefreshCw, X,
  CheckCircle2, FileText, BarChart3, Zap,
} from 'lucide-react';
import { PageHero } from '../components/ui/PageHero';
import { Panel } from '../components/ui/Panel';
import { SectionHeader } from '../components/ui/SectionHeader';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import api from '../lib/api';

/* ─── Types ─── */
interface DataStatus {
  is_loaded: boolean;
  employee_count: number;
  active_count: number;
  departed_count: number;
  recognition_count?: number;
  recognition_categories?: number;
  recognition_subcategories?: number;
  unique_recipients?: number;
  unique_nominators?: number;
  loaded_at: string | null;
}

type Tab = 'overview' | 'upload' | 'reports';

/* ─── Helpers ─── */
const Shimmer = ({ h = 48 }: { h?: number }) => <div style={{ height: h, background: 'rgba(255,255,255,0.03)', borderRadius: 10, animation: 'shimmer 2s infinite' }} />;

const Stat = ({ label, value, color = '#fafafa' }: { label: string; value: string | number; color?: string }) => (
  <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
    <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#52525b', marginBottom: 4 }}>{label}</p>
    <p style={{ fontSize: 20, fontWeight: 800, color, letterSpacing: '-0.03em' }}>{value}</p>
  </div>
);

const TabButton = ({ active, label, icon, onClick }: { active: boolean; label: string; icon: React.ReactNode; onClick: () => void }) => (
  <button
    onClick={onClick}
    style={{
      padding: '10px 20px', borderRadius: 9999, display: 'flex', alignItems: 'center', gap: 8,
      background: active ? 'rgba(255,138,76,0.12)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${active ? 'rgba(255,138,76,0.25)' : 'rgba(255,255,255,0.06)'}`,
      color: active ? '#FF8A4C' : '#71717a', fontSize: 12, fontWeight: 600, cursor: 'pointer',
      transition: 'all 150ms',
    }}
  >
    {icon}{label}
  </button>
);

/* ─── Component ─── */
export function DataHub() {
  const [tab, setTab] = useState<Tab>('overview');
  const [status, setStatus] = useState<DataStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [exporting, setExporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();

  const fetchStatus = async () => {
    try {
      const res = await api.get('/api/upload/status');
      setStatus(res.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchStatus(); }, []);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.post('/api/upload/csv', fd);
      addToast('Dataset uploaded and processed', 'success');
      setFile(null);
      fetchStatus();
    } catch { addToast('Upload failed', 'error'); }
    finally { setUploading(false); }
  };

  const handleReload = async () => {
    setReloading(true);
    try {
      await api.post('/api/upload/reload');
      await fetchStatus();
      addToast('Data reloaded — dashboard updated', 'success');
    } catch { addToast('Reload failed', 'error'); }
    finally { setReloading(false); }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await api.post('/api/reports/generate');
      setReport(res.data);
      addToast('Report generated', 'success');
    } catch { addToast('Report generation failed', 'error'); }
    finally { setGenerating(false); }
  };

  const handleExport = () => {
    setExporting(true);
    window.open(`${api.defaults.baseURL}/api/reports/export`, '_blank');
    setTimeout(() => setExporting(false), 2000);
  };

  const hasData = status?.is_loaded || (status?.recognition_count ?? 0) > 0;

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto' }}>
      <PageHero
        icon={<Database size={20} />}
        title="Data Hub"
        subtitle="Manage datasets, refresh analytics, and generate reports — all in one place."
      />

      {/* Tab Switcher */}
      <div className="flex gap-2 mb-5">
        <TabButton active={tab === 'overview'} label="Overview" icon={<BarChart3 size={14} />} onClick={() => setTab('overview')} />
        <TabButton active={tab === 'upload'} label="Upload Data" icon={<Upload size={14} />} onClick={() => setTab('upload')} />
        <TabButton active={tab === 'reports'} label="Reports & Export" icon={<FileText size={14} />} onClick={() => setTab('reports')} />
      </div>

      {/* ═══════ OVERVIEW TAB ═══════ */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Data Health */}
          <Panel delay={0}>
            <SectionHeader
              icon={<Database size={14} />}
              title="Data Health"
              action={hasData ? <Badge label="Data Loaded" color="#34d399" dot /> : <Badge label="No Data" color="#fb7185" dot />}
            />
            {loading ? <div className="grid grid-cols-4 gap-3">{[0,1,2,3].map(i => <Shimmer key={i} h={72} />)}</div> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <Stat label="Recognition Awards" value={status?.recognition_count?.toLocaleString() ?? '0'} color="#FF8A4C" />
                <Stat label="Categories" value={`${status?.recognition_categories ?? 0} / ${status?.recognition_subcategories ?? 0} sub`} color="#a78bfa" />
                <Stat label="Unique Recipients" value={status?.unique_recipients?.toLocaleString() ?? '0'} color="#34d399" />
                <Stat label="Unique Nominators" value={status?.unique_nominators?.toLocaleString() ?? '0'} color="#60a5fa" />
              </div>
            )}
            {!loading && status?.employee_count ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 12 }}>
                <Stat label="Total Employees" value={status.employee_count.toLocaleString()} color="#fbbf24" />
                <Stat label="Active" value={status.active_count.toLocaleString()} color="#34d399" />
                <Stat label="Departed" value={status.departed_count.toLocaleString()} color="#fb7185" />
                <Stat label="Last Loaded" value={status.loaded_at ? new Date(status.loaded_at).toLocaleDateString() : 'Never'} color="#71717a" />
              </div>
            ) : null}
          </Panel>

          {/* Quick Actions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Panel delay={60}>
              <div className="flex flex-col items-center gap-3 py-4">
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,138,76,0.1)', border: '1px solid rgba(255,138,76,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RefreshCw size={18} color="#FF8A4C" />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>Refresh Data</span>
                <span style={{ fontSize: 11, color: '#52525b', textAlign: 'center' }}>Reload CSVs and recompute all analytics</span>
                <button onClick={handleReload} disabled={reloading} style={{
                  padding: '8px 20px', borderRadius: 9999, background: 'rgba(255,138,76,0.12)',
                  border: '1px solid rgba(255,138,76,0.25)', color: '#FF8A4C', fontSize: 11, fontWeight: 700,
                  cursor: reloading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  {reloading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  {reloading ? 'Refreshing...' : 'Refresh Now'}
                </button>
              </div>
            </Panel>
            <Panel delay={120}>
              <div className="flex flex-col items-center gap-3 py-4">
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={18} color="#a78bfa" />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>Generate Report</span>
                <span style={{ fontSize: 11, color: '#52525b', textAlign: 'center' }}>AI-powered executive intelligence report</span>
                <button onClick={() => { setTab('reports'); handleGenerate(); }} disabled={generating || !hasData} style={{
                  padding: '8px 20px', borderRadius: 9999, background: 'rgba(167,139,250,0.12)',
                  border: '1px solid rgba(167,139,250,0.25)', color: '#a78bfa', fontSize: 11, fontWeight: 700,
                  cursor: generating || !hasData ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  Generate
                </button>
              </div>
            </Panel>
            <Panel delay={180}>
              <div className="flex flex-col items-center gap-3 py-4">
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Download size={18} color="#34d399" />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>Export Data</span>
                <span style={{ fontSize: 11, color: '#52525b', textAlign: 'center' }}>Download enriched dataset as ZIP</span>
                <button onClick={handleExport} disabled={exporting || !hasData} style={{
                  padding: '8px 20px', borderRadius: 9999, background: 'rgba(52,211,153,0.12)',
                  border: '1px solid rgba(52,211,153,0.25)', color: '#34d399', fontSize: 11, fontWeight: 700,
                  cursor: exporting || !hasData ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                  Export ZIP
                </button>
              </div>
            </Panel>
          </div>

          {/* Pipeline Status */}
          <Panel delay={240}>
            <SectionHeader icon={<Zap size={14} />} title="Pipeline Status" subtitle="Data processing workflow" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[
                { label: 'Data Loaded', done: hasData, detail: hasData ? `${status?.recognition_count ?? 0} awards + ${status?.employee_count ?? 0} employees` : 'No data' },
                { label: 'Taxonomy Built', done: (status?.recognition_categories ?? 0) > 0, detail: `${status?.recognition_categories ?? 0} categories, ${status?.recognition_subcategories ?? 0} sub` },
                { label: 'Records Annotated', done: (status?.recognition_count ?? 0) > 0, detail: `${status?.recognition_count ?? 0} records` },
                { label: 'Analytics Computed', done: hasData, detail: hasData ? 'All KPIs live' : 'Pending' },
              ].map((step, i) => (
                <div key={i} style={{
                  padding: '16px 14px', borderRadius: 12, textAlign: 'center',
                  background: step.done ? 'rgba(52,211,153,0.04)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${step.done ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.04)'}`,
                }}>
                  <div style={{ marginBottom: 8, color: step.done ? '#34d399' : '#52525b' }}>
                    {step.done ? <CheckCircle2 size={20} /> : <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #52525b', margin: '0 auto' }} />}
                  </div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: step.done ? '#fafafa' : '#71717a', marginBottom: 2 }}>{step.label}</p>
                  <p style={{ fontSize: 10, color: '#52525b' }}>{step.detail}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {/* ═══════ UPLOAD TAB ═══════ */}
      {tab === 'upload' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <Panel delay={0}>
            <SectionHeader icon={<Upload size={14} />} title="Upload Dataset" subtitle="Drag and drop CSV files or click to browse" />
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }}
              onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]); }} />
            {/* Drop zone */}
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'rgba(255,138,76,0.4)'; }}
              onDragLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; }}
              onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]); }}
              style={{
                padding: '40px 20px', borderRadius: 16, textAlign: 'center', cursor: 'pointer',
                border: '2px dashed rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.01)',
                transition: 'border-color 200ms',
              }}
            >
              <Upload size={28} style={{ color: '#52525b', margin: '0 auto 12px' }} />
              <p style={{ fontSize: 13, fontWeight: 600, color: '#a1a1aa' }}>Drop a CSV here or click to browse</p>
              <p style={{ fontSize: 11, color: '#52525b', marginTop: 4 }}>Supports: recognition awards (.csv), workforce data (.csv)</p>
            </div>

            {/* File chip */}
            {file && (
              <div className="flex items-center gap-3 mt-3" style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,138,76,0.06)', border: '1px solid rgba(255,138,76,0.15)' }}>
                <FileText size={16} color="#FF8A4C" />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#fafafa' }}>{file.name}</p>
                  <p style={{ fontSize: 10, color: '#52525b' }}>{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <button onClick={() => setFile(null)} style={{ color: '#52525b', cursor: 'pointer', background: 'none', border: 'none' }}><X size={14} /></button>
              </div>
            )}

            {/* Upload button */}
            {file && (
              <button onClick={handleUpload} disabled={uploading} style={{
                marginTop: 12, width: '100%', padding: '12px 20px', borderRadius: 12,
                background: 'linear-gradient(135deg, rgba(255,138,76,0.15), rgba(232,93,4,0.15))',
                border: '1px solid rgba(255,138,76,0.25)', color: '#FF8A4C',
                fontSize: 13, fontWeight: 700, cursor: uploading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                {uploading ? 'Processing...' : 'Upload & Process'}
              </button>
            )}
          </Panel>

          {/* Supported file formats */}
          <Panel delay={60}>
            <SectionHeader icon={<Database size={14} />} title="Supported Datasets" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(255,138,76,0.04)', border: '1px solid rgba(255,138,76,0.08)' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#FF8A4C', marginBottom: 4 }}>Recognition Awards</p>
                <p style={{ fontSize: 11, color: '#71717a', lineHeight: 1.5 }}>annotated_results.csv — message, award_title, recipient_title, nominator_title, category_id, subcategory</p>
              </div>
              <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.08)' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24', marginBottom: 4 }}>Workforce Data</p>
                <p style={{ fontSize: 11, color: '#71717a', lineHeight: 1.5 }}>function_wh.csv — PK_PERSON, Hire, Expire, job_title, department_name, grade_title, country</p>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* ═══════ REPORTS TAB ═══════ */}
      {tab === 'reports' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Generate Report */}
            <Panel delay={0}>
              <SectionHeader icon={<Sparkles size={14} />} title="Intelligence Report" subtitle="AI-powered executive summary" />
              <button onClick={handleGenerate} disabled={generating || !hasData} style={{
                width: '100%', padding: '12px 20px', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: generating ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg, rgba(255,138,76,0.15), rgba(232,93,4,0.15))',
                border: `1px solid ${generating ? 'rgba(255,255,255,0.06)' : 'rgba(255,138,76,0.25)'}`,
                color: generating ? '#71717a' : '#FF8A4C', fontSize: 13, fontWeight: 600, cursor: generating || !hasData ? 'not-allowed' : 'pointer',
              }}>
                {generating ? <><Loader2 size={15} className="animate-spin" /> Generating...</> : <><Sparkles size={15} /> Generate Intelligence Report</>}
              </button>
            </Panel>

            {/* Export */}
            <Panel delay={60}>
              <SectionHeader icon={<Download size={14} />} title="Export Data Package" subtitle="Download enriched dataset as ZIP" />
              <button onClick={handleExport} disabled={exporting || !hasData} style={{
                width: '100%', padding: '12px 20px', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: exporting ? 'rgba(255,255,255,0.04)' : 'rgba(52,211,153,0.1)',
                border: `1px solid ${exporting ? 'rgba(255,255,255,0.06)' : 'rgba(52,211,153,0.2)'}`,
                color: exporting ? '#71717a' : '#34d399', fontSize: 13, fontWeight: 600, cursor: exporting || !hasData ? 'not-allowed' : 'pointer',
              }}>
                {exporting ? <><Loader2 size={15} className="animate-spin" /> Preparing...</> : <><Download size={15} /> Export Data Package</>}
              </button>
              <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.02)' }}>
                <p style={{ fontSize: 11, color: '#52525b', lineHeight: 1.6 }}>
                  Includes: employees.csv, history.csv, active_employees.csv, departed_employees.csv, department_summary.csv, README.txt
                </p>
              </div>
            </Panel>
          </div>

          {/* Report Rendering */}
          {generating && (
            <Panel delay={120}>
              <div className="flex flex-col items-center gap-4 py-12">
                <div className="fire-orb" style={{ width: 48, height: 48 }} />
                <p style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>Analyzing data...</p>
                <p style={{ fontSize: 12, color: '#52525b' }}>Generating executive intelligence report</p>
              </div>
            </Panel>
          )}

          {report && !generating && (
            <Panel delay={120}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fafafa', letterSpacing: '-0.02em' }}>{report.title}</h2>
                  <p style={{ fontSize: 11, color: '#52525b', marginTop: 2 }}>Generated {new Date(report.generated_at).toLocaleString()}</p>
                </div>
              </div>
              {/* Executive Summary */}
              <div style={{ padding: '16px 20px', borderRadius: 12, background: 'rgba(255,138,76,0.04)', border: '1px solid rgba(255,138,76,0.1)', marginBottom: 16 }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="fire-orb" style={{ width: 18, height: 18 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#FF8A4C' }}>Executive Summary</span>
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.7, color: '#a1a1aa', whiteSpace: 'pre-wrap' }}>{report.executive_summary}</p>
              </div>
              {/* Sections */}
              {(report.sections || []).map((s: any, i: number) => (
                <div key={i} style={{ marginBottom: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fafafa', marginBottom: 8 }}>{s.title}</h3>
                  {s.key_metrics?.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(s.key_metrics.length, 4)}, 1fr)`, gap: 10, marginBottom: 10 }}>
                      {s.key_metrics.map((m: any, mi: number) => (
                        <div key={mi} style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                          <p style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: '#52525b', marginBottom: 2 }}>{m.label}</p>
                          <p style={{ fontSize: 16, fontWeight: 800, color: '#fafafa' }}>{m.value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <p style={{ fontSize: 12, lineHeight: 1.6, color: '#a1a1aa' }}>{s.narrative}</p>
                </div>
              ))}
              {/* Recommendations */}
              {(report.recommendations || []).length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fafafa', marginBottom: 8 }}>Recommendations</h3>
                  {report.recommendations.map((r: any, ri: number) => (
                    <div key={ri} className="flex items-start gap-3" style={{ padding: '10px 14px', marginBottom: 6, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <Badge label={r.priority} color={r.priority === 'critical' ? '#fb7185' : r.priority === 'high' ? '#fbbf24' : '#a78bfa'} />
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#fafafa' }}>{r.title}</p>
                        <p style={{ fontSize: 11, color: '#52525b', marginTop: 2 }}>{r.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}
