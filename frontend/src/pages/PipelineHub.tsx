import { useState, useEffect, useCallback } from 'react';
import { Play, StopCircle, RefreshCw, Download, Clock, CheckCircle2, XCircle, Loader2, FileText } from 'lucide-react';
import api from '../lib/api';
import { Panel } from '../components/ui/Panel';
import { KpiCard } from '../components/ui/KpiCard';
import { PageHero } from '../components/ui/PageHero';
import { Badge } from '../components/ui/Badge';
import { SectionHeader } from '../components/ui/SectionHeader';

interface RunType {
  id: string;
  description: string;
}

interface PipelineRun {
  id: number;
  run_type: string;
  status: string;
  progress_pct: number;
  completed_steps: number | null;
  total_steps: number | null;
  total_cost: number | null;
  input_file: string | null;
  output_file: string | null;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
}

interface RunDetail {
  id: number;
  run_type: string;
  status: string;
  progress_pct: number;
  log: string | null;
  error_detail: string | null;
  config: string | null;
  cancelled: boolean;
  artifacts: Array<{ id: number; type: string; filename: string; size_bytes: number }>;
}

const STATUS_CONFIG: Record<string, { color: string; icon: typeof CheckCircle2 }> = {
  pending: { color: '#60a5fa', icon: Clock },
  running: { color: '#fbbf24', icon: Loader2 },
  done: { color: '#34d399', icon: CheckCircle2 },
  failed: { color: '#fb7185', icon: XCircle },
  cancelled: { color: '#71717a', icon: StopCircle },
};

export function PipelineHub() {
  const [runTypes, setRunTypes] = useState<RunType[]>([]);
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState<string | null>(null);

  const fetchRuns = useCallback(() => {
    api.get('/api/pipeline/runs').then(res => setRuns(res.data?.runs || [])).catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([
      api.get('/api/pipeline/run-types'),
      api.get('/api/pipeline/runs'),
    ]).then(([typesRes, runsRes]) => {
      setRunTypes(typesRes.data?.run_types || []);
      setRuns(runsRes.data?.runs || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // WebSocket for real-time log streaming (with polling fallback)
  useEffect(() => {
    if (!selectedRun || !['running', 'pending'].includes(selectedRun.status)) return;

    const wsBase = (api.defaults.baseURL || 'http://localhost:8000').replace(/^http/, 'ws');
    let ws: WebSocket | null = null;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;

    try {
      ws = new WebSocket(`${wsBase}/ws/pipeline/${selectedRun.id}/logs`);
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.new_log || data.status) {
          setSelectedRun(prev => prev ? {
            ...prev,
            log: (prev.log || '') + (data.new_log || ''),
            status: data.status || prev.status,
            progress_pct: data.progress_pct ?? prev.progress_pct,
          } : null);
        }
        if (data.final) {
          fetchRuns();
          if (data.status === 'done' || data.status === 'failed') {
            selectRun(selectedRun.id); // Refresh full detail
          }
        }
      };
      ws.onerror = () => {
        // Fallback to polling if WebSocket fails
        ws?.close();
        ws = null;
        fallbackInterval = setInterval(() => {
          fetchRuns();
          api.get(`/api/pipeline/runs/${selectedRun.id}/log`).then(res => {
            setSelectedRun(prev => prev ? { ...prev, log: res.data?.log, status: res.data?.status, progress_pct: res.data?.progress_pct } : null);
          }).catch(() => {});
        }, 3000);
      };
    } catch {
      // WebSocket not supported, use polling
      fallbackInterval = setInterval(() => {
        fetchRuns();
        api.get(`/api/pipeline/runs/${selectedRun.id}/log`).then(res => {
          setSelectedRun(prev => prev ? { ...prev, log: res.data?.log, status: res.data?.status, progress_pct: res.data?.progress_pct } : null);
        }).catch(() => {});
      }, 3000);
    }

    return () => {
      ws?.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, [selectedRun?.id, selectedRun?.status]);

  // Also poll the runs list when any are active
  useEffect(() => {
    const hasRunning = runs.some(r => r.status === 'running' || r.status === 'pending');
    if (!hasRunning) return;
    const interval = setInterval(fetchRuns, 5000);
    return () => clearInterval(interval);
  }, [runs, fetchRuns]);

  const launchRun = async (runType: string) => {
    setLaunching(runType);
    try {
      const res = await api.post('/api/pipeline/start', { run_type: runType });
      fetchRuns();
      // Auto-select the new run
      const newRunId = res.data?.run_id;
      if (newRunId) {
        const detail = await api.get(`/api/pipeline/runs/${newRunId}`);
        setSelectedRun(detail.data);
      }
    } catch (err) {
      console.error('Failed to launch run:', err);
    } finally {
      setLaunching(null);
    }
  };

  const cancelRun = async (runId: number) => {
    try {
      await api.post(`/api/pipeline/runs/${runId}/cancel`);
      fetchRuns();
      if (selectedRun?.id === runId) {
        setSelectedRun(prev => prev ? { ...prev, status: 'cancelled', cancelled: true } : null);
      }
    } catch (err) {
      console.error('Failed to cancel:', err);
    }
  };

  const selectRun = async (runId: number) => {
    try {
      const res = await api.get(`/api/pipeline/runs/${runId}`);
      setSelectedRun(res.data);
    } catch (err) {
      console.error('Failed to fetch run detail:', err);
    }
  };

  const doneCount = runs.filter(r => r.status === 'done').length;
  const runningCount = runs.filter(r => r.status === 'running' || r.status === 'pending').length;
  const failedCount = runs.filter(r => r.status === 'failed').length;

  return (
    <div>
      <PageHero icon={<Play size={20} />} title="Pipeline Hub" subtitle="Launch, monitor, and manage data processing pipelines" />

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        <KpiCard label="Total Runs" value={runs.length} icon={<FileText size={18} />} delay={0} loading={loading} />
        <KpiCard label="Completed" value={doneCount} icon={<CheckCircle2 size={18} />} color="#34d399" delay={60} loading={loading} />
        <KpiCard label="Running" value={runningCount} icon={<Loader2 size={18} />} color="#fbbf24" delay={120} loading={loading} />
        <KpiCard label="Failed" value={failedCount} icon={<XCircle size={18} />} color="#fb7185" delay={180} loading={loading} />
      </div>

      {/* Launch Buttons */}
      <Panel delay={240} className="mb-5">
        <SectionHeader title="Launch Pipeline" subtitle="Start a new processing run" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {runTypes.map(rt => (
            <button
              key={rt.id}
              onClick={() => launchRun(rt.id)}
              disabled={launching === rt.id}
              className="flex flex-col items-start gap-1.5 p-4 rounded-[12px] text-left transition-all hover-lift"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.09)',
              }}
            >
              <div className="flex items-center gap-2">
                {launching === rt.id ? (
                  <Loader2 size={14} style={{ color: '#FF8A4C', animation: 'spin 1s linear infinite' }} />
                ) : (
                  <Play size={14} style={{ color: '#FF8A4C' }} />
                )}
                <span style={{ fontSize: 12, fontWeight: 600, color: '#fafafa' }}>
                  {rt.id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </span>
              </div>
              <span style={{ fontSize: 11, color: '#71717a', lineHeight: 1.4 }}>{rt.description}</span>
            </button>
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Runs List */}
        <Panel delay={300}>
          <SectionHeader
            title="Recent Runs"
            subtitle={`${runs.length} total`}
            action={
              <button onClick={fetchRuns} className="p-1.5 rounded-[8px] hover:bg-white/5 transition-colors">
                <RefreshCw size={14} style={{ color: '#71717a' }} />
              </button>
            }
          />
          <div style={{ maxHeight: 500, overflowY: 'auto' }}>
            {runs.length === 0 && !loading ? (
              <p style={{ color: '#52525b', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>No runs yet. Launch one above.</p>
            ) : (
              <div className="space-y-1.5">
                {runs.map(run => {
                  const sc = STATUS_CONFIG[run.status] || STATUS_CONFIG.pending;
                  const StatusIcon = sc.icon;
                  const isSelected = selectedRun?.id === run.id;
                  return (
                    <button
                      key={run.id}
                      onClick={() => selectRun(run.id)}
                      className="w-full flex items-center gap-3 p-3 rounded-[12px] text-left transition-all"
                      style={{
                        background: isSelected ? 'rgba(255,138,76,0.08)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${isSelected ? 'rgba(255,138,76,0.2)' : 'rgba(255,255,255,0.06)'}`,
                      }}
                    >
                      <StatusIcon size={16} style={{ color: sc.color, flexShrink: 0, ...(run.status === 'running' ? { animation: 'spin 1s linear infinite' } : {}) }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#fafafa' }}>
                            #{run.id} {run.run_type.replace(/_/g, ' ')}
                          </span>
                          <Badge label={run.status} color={sc.color} />
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          {run.progress_pct > 0 && run.progress_pct < 100 && (
                            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)', maxWidth: 120 }}>
                              <div className="h-full rounded-full transition-all" style={{ width: `${run.progress_pct}%`, background: sc.color }} />
                            </div>
                          )}
                          <span style={{ fontSize: 10, color: '#52525b' }}>
                            {run.created_at ? new Date(run.created_at).toLocaleString() : ''}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Panel>

        {/* Run Detail / Log */}
        <Panel delay={360}>
          {selectedRun ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <SectionHeader
                  title={`Run #${selectedRun.id} — ${selectedRun.run_type.replace(/_/g, ' ')}`}
                  subtitle={`Status: ${selectedRun.status} | Progress: ${selectedRun.progress_pct?.toFixed(0) || 0}%`}
                />
                {(selectedRun.status === 'running' || selectedRun.status === 'pending') && (
                  <button
                    onClick={() => cancelRun(selectedRun.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                    style={{ background: 'rgba(251,113,133,0.15)', border: '1px solid rgba(251,113,133,0.25)', color: '#fb7185' }}
                  >
                    <StopCircle size={12} /> Cancel
                  </button>
                )}
              </div>

              {/* Progress bar */}
              {selectedRun.progress_pct > 0 && (
                <div className="h-2 rounded-full overflow-hidden mb-4" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${selectedRun.progress_pct}%`,
                      background: selectedRun.status === 'done' ? '#34d399' : selectedRun.status === 'failed' ? '#fb7185' : '#FF8A4C',
                    }}
                  />
                </div>
              )}

              {/* Error */}
              {selectedRun.error_detail && (
                <div className="p-3 rounded-[12px] mb-4" style={{ background: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.2)' }}>
                  <p style={{ fontSize: 12, color: '#fb7185', fontWeight: 600 }}>Error</p>
                  <p style={{ fontSize: 12, color: '#a1a1aa', marginTop: 4 }}>{selectedRun.error_detail}</p>
                </div>
              )}

              {/* Log */}
              <div
                className="rounded-[12px] p-3 font-mono"
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  fontSize: 11,
                  lineHeight: 1.6,
                  color: '#a1a1aa',
                  maxHeight: 300,
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {selectedRun.log || 'No log output yet...'}
              </div>

              {/* Artifacts */}
              {selectedRun.artifacts && selectedRun.artifacts.length > 0 && (
                <div className="mt-4">
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Artifacts</p>
                  <div className="space-y-1.5">
                    {selectedRun.artifacts.map(a => (
                      <div key={a.id} className="flex items-center justify-between p-2 rounded-[8px]" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="flex items-center gap-2">
                          <FileText size={14} style={{ color: '#71717a' }} />
                          <span style={{ fontSize: 12, color: '#fafafa' }}>{a.filename}</span>
                          <span style={{ fontSize: 10, color: '#52525b' }}>{(a.size_bytes / 1024).toFixed(0)}KB</span>
                        </div>
                        <a
                          href={`${api.defaults.baseURL}/api/pipeline/runs/${selectedRun.id}/artifacts/${a.id}/download`}
                          className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold"
                          style={{ background: 'rgba(255,138,76,0.12)', color: '#FF8A4C' }}
                        >
                          <Download size={10} /> Download
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16" style={{ color: '#52525b' }}>
              <FileText size={32} className="mb-3" />
              <p style={{ fontSize: 13 }}>Select a run to view details</p>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
