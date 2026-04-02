import { useState, useEffect, useRef } from 'react';
import {
  Upload, Database, Sparkles, FileText, Download, Loader2,
  RefreshCw, AlertTriangle, X, ClipboardCopy, CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { PageHero } from '../components/ui/PageHero';
import { Panel } from '../components/ui/Panel';
import { SectionHeader } from '../components/ui/SectionHeader';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import api from '../lib/api';

/* ─── Types ─── */

interface UploadStatus {
  is_loaded: boolean;
  employee_count: number;
  history_count: number;
  active_count: number;
  departed_count: number;
  loaded_at: string | null;
  upload_dir: string;
  recent_uploads: any[];
}

interface ReportSection {
  title: string;
  narrative: string;
  chart: { type: string; data: { name: string; value: number }[] } | null;
  key_metrics: { label: string; value: string; change?: string }[];
  insights: string[];
  recommendations?: string[];
}

interface StructuredReport {
  title: string;
  generated_at: string;
  executive_summary: string;
  sections: ReportSection[];
  recommendations: { priority: string; title: string; detail: string }[];
  metrics_snapshot: Record<string, number | string>;
}

/* ─── Helpers ─── */

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      className="flex items-center justify-between"
      style={{
        padding: '10px 14px', borderRadius: 10,
        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      <span style={{ fontSize: 12, color: '#71717a' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

function StepCard({ icon, title, badge, badgeColor, action, delay }: {
  icon: React.ReactNode; title: string;
  badge: string; badgeColor: string;
  action?: React.ReactNode; delay: number;
}) {
  return (
    <Panel delay={delay}>
      <div className="flex flex-col items-center text-center gap-3" style={{ padding: '8px 0' }}>
        <div
          className="w-10 h-10 rounded-[12px] flex items-center justify-center"
          style={{ background: 'rgba(255,138,76,0.1)' }}
        >
          <span style={{ color: '#FF8A4C' }}>{icon}</span>
        </div>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>{title}</p>
        <Badge label={badge} color={badgeColor} dot />
        {action && <div style={{ marginTop: 4, width: '100%' }}>{action}</div>}
      </div>
    </Panel>
  );
}

function OrangeButton({ onClick, disabled, loading, children }: {
  onClick: () => void; disabled?: boolean; loading?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        width: '100%', padding: '10px 20px', borderRadius: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        background: disabled ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg, rgba(255,138,76,0.15), rgba(232,93,4,0.15))',
        border: `1px solid ${disabled ? 'rgba(255,255,255,0.06)' : 'rgba(255,138,76,0.25)'}`,
        color: disabled ? '#52525b' : '#FF8A4C', fontSize: 13, fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

const priorityColor: Record<string, string> = {
  critical: '#fb7185', high: '#fbbf24', medium: '#a78bfa', low: '#34d399',
};

/* ─── Main Component ─── */

export function DataHub() {
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Status state
  const [status, setStatus] = useState<UploadStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [recomputing, setRecomputing] = useState(false);

  // Report state
  const [report, setReport] = useState<StructuredReport | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  /* ─── Fetch status ─── */

  const fetchStatus = async () => {
    try {
      setStatusLoading(true);
      const res = await api.get('/api/upload/status');
      setStatus(res.data);
    } catch {
      setStatus(null);
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, []);

  /* ─── Upload handlers ─── */

  const handleFilePick = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.name.endsWith('.csv')) {
      addToast('Only .csv files are accepted', 'error');
      return;
    }
    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFilePick(e.dataTransfer.files);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      await api.post('/api/upload/csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      addToast('File uploaded and processed successfully', 'success');
      setSelectedFile(null);
      await fetchStatus();
    } catch (err: any) {
      addToast(err?.response?.data?.detail ?? 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleReload = async () => {
    setReloading(true);
    try {
      await api.post('/api/upload/reload');
      await fetchStatus();
      addToast('Data reloaded successfully', 'success');
    } catch {
      addToast('Failed to reload data', 'error');
    } finally {
      setReloading(false);
    }
  };

  const handleRecompute = async () => {
    setRecomputing(true);
    try {
      await api.post('/api/upload/reload');
      await fetchStatus();
      addToast('Analytics recomputed', 'success');
    } catch {
      addToast('Failed to recompute analytics', 'error');
    } finally {
      setRecomputing(false);
    }
  };

  /* ─── Report handlers ─── */

  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      const res = await api.post('/api/reports/generate');
      setReport(res.data);
      addToast('Report generated', 'success');
    } catch (err: any) {
      addToast(err?.response?.data?.detail ?? 'Failed to generate report', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyReport = async () => {
    if (!report) return;
    const text = [
      report.title,
      report.executive_summary,
      '',
      ...report.sections.map(s => `${s.title}\n${s.narrative}`),
      '',
      'Recommendations:',
      ...report.recommendations.map(r => `[${r.priority}] ${r.title} — ${r.detail}`),
    ].join('\n\n');
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    addToast('Report copied to clipboard', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = () => {
    window.open(`${api.defaults.baseURL}/api/reports/export`, '_blank');
  };

  const isLoaded = status?.is_loaded ?? false;

  /* ─── Render ─── */

  return (
    <div>
      <PageHero
        icon={<Upload size={20} />}
        title="Data Hub"
        subtitle="Upload data, run analysis pipelines, and generate reports."
      />

      {/* ───────── Section 1: Data Ingestion ───────── */}
      <SectionHeader icon={<Database size={16} />} title="Data Ingestion" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

        {/* Upload Dataset */}
        <Panel delay={0}>
          <SectionHeader icon={<Upload size={14} />} title="Upload Dataset" subtitle="Drag and drop or click to select" />

          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{
              height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 12,
              border: `2px dashed ${dragOver ? '#FF8A4C' : 'rgba(255,255,255,0.08)'}`,
              background: dragOver ? 'rgba(255,138,76,0.06)' : 'rgba(255,255,255,0.02)',
              cursor: uploading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={e => { handleFilePick(e.target.files); e.target.value = ''; }}
              style={{ display: 'none' }}
            />
            <div className="flex flex-col items-center gap-2">
              <Upload size={20} style={{ color: dragOver ? '#FF8A4C' : '#52525b' }} />
              <p style={{ fontSize: 12, color: '#71717a' }}>
                Drop a .csv file here or click to browse
              </p>
            </div>
          </div>

          {/* File chip */}
          {selectedFile && (
            <div
              className="flex items-center gap-3 mt-3"
              style={{
                padding: '8px 12px', borderRadius: 8,
                background: 'rgba(255,138,76,0.06)', border: '1px solid rgba(255,138,76,0.12)',
              }}
            >
              <FileText size={14} style={{ color: '#FF8A4C', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#d4d4d8', flex: 1 }}>{selectedFile.name}</span>
              <span style={{ fontSize: 11, color: '#52525b' }}>{formatBytes(selectedFile.size)}</span>
              <button
                onClick={e => { e.stopPropagation(); setSelectedFile(null); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
              >
                <X size={13} style={{ color: '#71717a' }} />
              </button>
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <OrangeButton onClick={handleUpload} disabled={!selectedFile} loading={uploading}>
              {uploading ? 'Uploading...' : 'Upload & Process'}
            </OrangeButton>
          </div>
        </Panel>

        {/* Data Status */}
        <Panel delay={80}>
          <SectionHeader
            icon={<Database size={14} />}
            title="Data Status"
            subtitle="Current dataset information"
            action={
              <button
                onClick={handleReload}
                disabled={reloading}
                className="flex items-center gap-2"
                style={{
                  padding: '6px 12px', borderRadius: 10,
                  background: 'rgba(255,138,76,0.1)', border: '1px solid rgba(255,138,76,0.2)',
                  color: '#FF8A4C', fontSize: 11, fontWeight: 600,
                  cursor: reloading ? 'not-allowed' : 'pointer',
                  opacity: reloading ? 0.6 : 1,
                }}
              >
                <RefreshCw size={12} className={reloading ? 'animate-spin' : ''} />
                Reload Data
              </button>
            }
          />

          {statusLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(n => (
                <div key={n} className="h-5 rounded" style={{ background: 'rgba(255,255,255,0.04)', width: `${55 + n * 10}%`, animation: 'shimmer 2s infinite' }} />
              ))}
            </div>
          ) : status ? (
            <div className="space-y-2">
              <StatRow label="Employee Count" value={status.employee_count.toLocaleString()} color="#FF8A4C" />
              <StatRow label="Active" value={status.active_count.toLocaleString()} color="#34d399" />
              <StatRow label="Departed" value={status.departed_count.toLocaleString()} color="#fb7185" />
              <StatRow label="History Records" value={status.history_count.toLocaleString()} color="#a78bfa" />
              <StatRow
                label="Last Loaded"
                value={status.loaded_at ? new Date(status.loaded_at).toLocaleString() : 'Never'}
                color="#71717a"
              />
              <div className="flex justify-end pt-1">
                <Badge label={isLoaded ? 'Data loaded' : 'No data'} color={isLoaded ? '#34d399' : '#fb7185'} dot />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-6" style={{ color: '#52525b' }}>
              <AlertTriangle size={22} />
              <p style={{ fontSize: 12 }}>No data loaded. Upload a CSV to begin.</p>
            </div>
          )}
        </Panel>
      </div>

      {/* ───────── Section 2: Pipeline Steps ───────── */}
      <SectionHeader icon={<RefreshCw size={16} />} title="Pipeline Steps" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
        <StepCard
          icon={<Upload size={18} />}
          title="Upload Data"
          badge={isLoaded ? 'Complete' : 'Pending'}
          badgeColor={isLoaded ? '#34d399' : '#52525b'}
          delay={0}
        />
        <StepCard
          icon={<Sparkles size={18} />}
          title="Generate Taxonomy"
          badge="Available"
          badgeColor="#a78bfa"
          delay={60}
          action={
            <div title="Requires Bedrock / OpenAI API key configured">
              <OrangeButton onClick={() => {}} disabled>
                Run (Requires LLM)
              </OrangeButton>
            </div>
          }
        />
        <StepCard
          icon={<FileText size={18} />}
          title="Annotate Records"
          badge={isLoaded ? `${status?.history_count ?? 0} records` : 'Pending'}
          badgeColor={isLoaded ? '#34d399' : '#52525b'}
          delay={120}
        />
        <StepCard
          icon={<Database size={18} />}
          title="Compute Analytics"
          badge={isLoaded ? 'Ready' : 'Pending'}
          badgeColor={isLoaded ? '#34d399' : '#52525b'}
          delay={180}
          action={
            <OrangeButton onClick={handleRecompute} disabled={!isLoaded} loading={recomputing}>
              {recomputing ? 'Computing...' : 'Recompute'}
            </OrangeButton>
          }
        />
      </div>

      {/* ───────── Section 3: Reports & Export ───────── */}
      <SectionHeader icon={<FileText size={16} />} title="Reports & Export" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Intelligence Report */}
        <Panel delay={0}>
          <SectionHeader icon={<Sparkles size={14} />} title="Intelligence Report" subtitle="AI-powered workforce analysis" />
          <OrangeButton onClick={handleGenerateReport} loading={generating}>
            {generating ? 'Generating...' : 'Generate Report'}
          </OrangeButton>

          {generating && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 size={28} style={{ color: '#FF8A4C' }} className="animate-spin" />
              <p style={{ fontSize: 12, color: '#52525b' }}>Analyzing workforce data...</p>
            </div>
          )}

          {report && !generating && (
            <div style={{ marginTop: 16 }}>
              {/* Executive Summary */}
              <div style={{
                padding: '14px 16px', borderRadius: 12, marginBottom: 12,
                background: 'rgba(255,138,76,0.04)', border: '1px solid rgba(255,138,76,0.1)',
              }}>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#FF8A4C', marginBottom: 6 }}>
                  Executive Summary
                </p>
                <p style={{ fontSize: 12, lineHeight: 1.7, color: '#a1a1aa', whiteSpace: 'pre-wrap' }}>
                  {report.executive_summary}
                </p>
              </div>

              {/* Sections */}
              {report.sections.map((section, i) => (
                <div
                  key={i}
                  style={{
                    padding: '12px 14px', borderRadius: 10, marginBottom: 10,
                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp size={12} style={{ color: '#FF8A4C' }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#fafafa' }}>{section.title}</span>
                  </div>
                  {section.key_metrics.length > 0 && (
                    <div className="flex flex-wrap gap-3 mb-2">
                      {section.key_metrics.map((m, mi) => (
                        <div key={mi} className="flex items-center gap-1">
                          <span style={{ fontSize: 10, color: '#52525b' }}>{m.label}:</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#fafafa' }}>{m.value}</span>
                          {m.change && <span style={{ fontSize: 10, color: '#fb7185' }}>{m.change}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  <p style={{ fontSize: 12, lineHeight: 1.6, color: '#71717a' }}>{section.narrative}</p>
                </div>
              ))}

              {/* Recommendations */}
              {report.recommendations.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#a78bfa', marginBottom: 8 }}>
                    Recommendations
                  </p>
                  {report.recommendations.map((rec, ri) => (
                    <div key={ri} className="flex items-start gap-2" style={{
                      padding: '10px 12px', borderRadius: 8, marginBottom: 6,
                      background: 'rgba(255,255,255,0.02)',
                      border: `1px solid ${(priorityColor[rec.priority] || '#71717a')}20`,
                    }}>
                      <Badge label={rec.priority} color={priorityColor[rec.priority] || '#71717a'} />
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#fafafa' }}>{rec.title}</p>
                        <p style={{ fontSize: 11, color: '#52525b', marginTop: 2 }}>{rec.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Copy button */}
              <button
                onClick={handleCopyReport}
                className="flex items-center gap-2 mt-3"
                style={{
                  padding: '7px 14px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                  color: copied ? '#34d399' : '#a1a1aa', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {copied ? <><CheckCircle2 size={12} /> Copied</> : <><ClipboardCopy size={12} /> Copy Report</>}
              </button>
            </div>
          )}
        </Panel>

        {/* Export Data */}
        <Panel delay={80}>
          <SectionHeader icon={<Download size={14} />} title="Export Data" subtitle="Download workforce data bundle" />
          <button
            onClick={handleExport}
            style={{
              width: '100%', padding: '12px 20px', borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)',
              color: '#34d399', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Download size={15} /> Export Full Dataset
          </button>

          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#52525b', marginBottom: 8 }}>
              Included in Export
            </p>
            {['employees.csv', 'history.csv', 'analytics_summary.json', 'taxonomy.json'].map(f => (
              <div
                key={f}
                className="flex items-center gap-2"
                style={{
                  padding: '8px 12px', borderRadius: 8, marginBottom: 4,
                  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <FileText size={12} style={{ color: '#52525b' }} />
                <span style={{ fontSize: 12, color: '#a1a1aa' }}>{f}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
