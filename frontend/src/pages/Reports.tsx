import { useState } from 'react';
import { FileText, Sparkles, Download, Loader2, ClipboardCopy, CheckCircle2 } from 'lucide-react';
import { PageHero } from '../components/ui/PageHero';
import { Panel } from '../components/ui/Panel';
import { SectionHeader } from '../components/ui/SectionHeader';
import api from '../lib/api';

export function Reports() {
  const [summary, setSummary] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleGenerateSummary = async () => {
    setGenerating(true);
    setGenerateError(null);

    try {
      const res = await api.post('/api/reports/executive-summary');
      setSummary(res.data.summary ?? res.data.text ?? JSON.stringify(res.data, null, 2));
    } catch (err: any) {
      setGenerateError(err?.response?.data?.detail ?? err.message ?? 'Failed to generate summary');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleExport = () => {
    setExporting(true);
    const baseUrl = api.defaults.baseURL || '';
    window.open(`${baseUrl}/api/reports/export`, '_blank');
    setTimeout(() => setExporting(false), 1500);
  };

  return (
    <div>
      <PageHero
        icon={<FileText size={20} />}
        title="Reports & Export"
        subtitle="Generate executive summaries and export data"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Executive Summary Card */}
        <Panel delay={0}>
          <SectionHeader
            icon={<Sparkles size={16} />}
            title="Executive Summary"
            subtitle="AI-generated workforce overview"
          />

          <button
            onClick={handleGenerateSummary}
            disabled={generating}
            className="w-full flex items-center justify-center gap-2 transition-all duration-200"
            style={{
              padding: '12px 20px',
              borderRadius: 12,
              background: generating
                ? 'rgba(255,255,255,0.04)'
                : 'linear-gradient(135deg, rgba(255,138,76,0.15), rgba(232,93,4,0.15))',
              border: `1px solid ${generating ? 'rgba(255,255,255,0.06)' : 'rgba(255,138,76,0.25)'}`,
              color: generating ? '#71717a' : '#FF8A4C',
              fontSize: 13,
              fontWeight: 600,
              cursor: generating ? 'not-allowed' : 'pointer',
            }}
          >
            {generating ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Generating Summary...
              </>
            ) : (
              <>
                <Sparkles size={15} />
                Generate Executive Summary
              </>
            )}
          </button>

          {generateError && (
            <div
              className="mt-4"
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                background: 'rgba(251,113,133,0.08)',
                border: '1px solid rgba(251,113,133,0.15)',
              }}
            >
              <p style={{ fontSize: 12, color: '#fb7185' }}>{generateError}</p>
            </div>
          )}
        </Panel>

        {/* Export Card */}
        <Panel delay={80}>
          <SectionHeader
            icon={<Download size={16} />}
            title="Export Data Package"
            subtitle="Download complete workforce data bundle"
          />

          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full flex items-center justify-center gap-2 transition-all duration-200"
            style={{
              padding: '12px 20px',
              borderRadius: 12,
              background: exporting
                ? 'rgba(255,255,255,0.04)'
                : 'rgba(52,211,153,0.1)',
              border: `1px solid ${exporting ? 'rgba(255,255,255,0.06)' : 'rgba(52,211,153,0.2)'}`,
              color: exporting ? '#71717a' : '#34d399',
              fontSize: 13,
              fontWeight: 600,
              cursor: exporting ? 'not-allowed' : 'pointer',
            }}
          >
            {exporting ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Preparing Download...
              </>
            ) : (
              <>
                <Download size={15} />
                Export Data Package
              </>
            )}
          </button>

          <div className="mt-5 space-y-2">
            <p style={{ fontSize: 11, color: '#52525b' }}>Package includes:</p>
            {['Workforce snapshot (.csv)', 'Turnover analysis (.csv)', 'Flight risk scores (.csv)', 'Executive summary (.txt)'].map(item => (
              <div key={item} className="flex items-center gap-2" style={{ padding: '6px 0' }}>
                <div style={{ width: 4, height: 4, borderRadius: 2, background: '#34d399' }} />
                <span style={{ fontSize: 12, color: '#a1a1aa' }}>{item}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Summary display */}
      {summary && (
        <Panel delay={160}>
          <SectionHeader
            icon={<FileText size={16} />}
            title="Generated Executive Summary"
            subtitle="AI-generated overview of your workforce"
            action={
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 transition-all duration-200"
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  color: copied ? '#34d399' : '#a1a1aa',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {copied ? (
                  <>
                    <CheckCircle2 size={12} />
                    Copied
                  </>
                ) : (
                  <>
                    <ClipboardCopy size={12} />
                    Copy
                  </>
                )}
              </button>
            }
          />
          <div
            style={{
              padding: '16px 20px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.04)',
            }}
          >
            <p
              style={{
                fontSize: 13,
                lineHeight: 1.8,
                color: '#d4d4d8',
                whiteSpace: 'pre-wrap',
              }}
            >
              {summary}
            </p>
          </div>
        </Panel>
      )}

      {/* Loading state for summary */}
      {generating && (
        <Panel delay={160}>
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="relative">
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: 'rgba(255,138,76,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sparkles size={22} style={{ color: '#FF8A4C' }} className="animate-pulse" />
              </div>
            </div>
            <div className="text-center">
              <p style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>Analyzing workforce data...</p>
              <p style={{ fontSize: 12, color: '#52525b', marginTop: 4 }}>This may take a few seconds</p>
            </div>
            <div className="flex gap-1.5">
              {[0, 1, 2].map(dot => (
                <span
                  key={dot}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#FF8A4C',
                    animation: `pulse 1.4s ease-in-out ${dot * 0.2}s infinite`,
                    opacity: 0.6,
                  }}
                />
              ))}
            </div>
          </div>
          <style>{`
            @keyframes pulse {
              0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
              40% { transform: scale(1); opacity: 1; }
            }
          `}</style>
        </Panel>
      )}
    </div>
  );
}
