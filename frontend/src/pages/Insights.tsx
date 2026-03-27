import { useState } from 'react';
import { Sparkles, Layers, Award, GitBranch, CheckCircle2, Loader2 } from 'lucide-react';
import { PageHero } from '../components/ui/PageHero';
import { Panel } from '../components/ui/Panel';
import { SectionHeader } from '../components/ui/SectionHeader';
import { Badge } from '../components/ui/Badge';

interface TaxonomyPanel {
  key: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  status: 'idle' | 'generating' | 'generated';
  sampleData: { label: string; value: string }[];
}

const INITIAL_PANELS: TaxonomyPanel[] = [
  {
    key: 'job-family',
    title: 'Job Family Taxonomy',
    subtitle: 'Classify roles into standardized job families',
    icon: <Layers size={16} />,
    color: '#FF8A4C',
    status: 'idle',
    sampleData: [
      { label: 'Software Engineer II', value: 'Engineering > Software Development' },
      { label: 'Sr. Data Analyst', value: 'Analytics > Data Science' },
      { label: 'Marketing Manager', value: 'Marketing > Brand Management' },
      { label: 'HR Business Partner', value: 'Human Resources > HR Advisory' },
      { label: 'Product Owner', value: 'Product > Product Management' },
    ],
  },
  {
    key: 'grade',
    title: 'Grade Standardization',
    subtitle: 'Normalize disparate grading scales across business units',
    icon: <Award size={16} />,
    color: '#a78bfa',
    status: 'idle',
    sampleData: [
      { label: 'IC1 / Junior', value: 'Grade 5 — Individual Contributor Entry' },
      { label: 'IC2 / Mid-Level', value: 'Grade 6 — Individual Contributor Core' },
      { label: 'IC3 / Senior', value: 'Grade 7 — Individual Contributor Senior' },
      { label: 'M1 / Team Lead', value: 'Grade 8 — Manager Entry' },
      { label: 'M2 / Director', value: 'Grade 9 — Manager Senior' },
    ],
  },
  {
    key: 'career-move',
    title: 'Career Move Classification',
    subtitle: 'Categorize internal movements as promotions, lateral, or demotions',
    icon: <GitBranch size={16} />,
    color: '#34d399',
    status: 'idle',
    sampleData: [
      { label: 'Analyst → Sr. Analyst (same dept)', value: 'Promotion — Vertical' },
      { label: 'Engineer → Product Manager', value: 'Lateral — Cross-function' },
      { label: 'Director → Sr. Manager', value: 'Demotion — Downlevel' },
      { label: 'IC3 → Team Lead', value: 'Promotion — Management Track' },
      { label: 'Ops Lead → Ops Lead (new BU)', value: 'Lateral — Cross-unit' },
    ],
  },
];

export function Insights() {
  const [panels, setPanels] = useState<TaxonomyPanel[]>(INITIAL_PANELS);

  const handleGenerate = (key: string) => {
    setPanels(prev =>
      prev.map(p => (p.key === key ? { ...p, status: 'generating' as const } : p))
    );

    // Simulate generation (will connect to /api/taxonomy in the future)
    setTimeout(() => {
      setPanels(prev =>
        prev.map(p => (p.key === key ? { ...p, status: 'generated' as const } : p))
      );
    }, 2200);
  };

  return (
    <div>
      <PageHero
        icon={<Sparkles size={20} />}
        title="AI Insights & Taxonomy"
        subtitle="Auto-generated workforce classifications"
      />

      <div className="space-y-6">
        {panels.map((panel, i) => (
          <Panel key={panel.key} delay={i * 80}>
            <SectionHeader
              icon={panel.icon}
              title={panel.title}
              subtitle={panel.subtitle}
              action={
                <div className="flex items-center gap-3">
                  {panel.status === 'generated' && (
                    <Badge label="Generated" color={panel.color} dot />
                  )}
                  {panel.status === 'idle' && (
                    <Badge label="Not yet generated" color="#71717a" />
                  )}
                  <button
                    onClick={() => handleGenerate(panel.key)}
                    disabled={panel.status === 'generating'}
                    className="flex items-center gap-2 transition-all duration-200"
                    style={{
                      padding: '7px 16px',
                      borderRadius: 10,
                      background:
                        panel.status === 'generating'
                          ? 'rgba(255,255,255,0.04)'
                          : `${panel.color}18`,
                      border: `1px solid ${
                        panel.status === 'generating'
                          ? 'rgba(255,255,255,0.06)'
                          : `${panel.color}30`
                      }`,
                      color: panel.status === 'generating' ? '#71717a' : panel.color,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: panel.status === 'generating' ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {panel.status === 'generating' ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles size={13} />
                        {panel.status === 'generated' ? 'Regenerate' : 'Generate'}
                      </>
                    )}
                  </button>
                </div>
              }
            />

            {/* Sample classifications */}
            <div
              style={{
                borderRadius: 10,
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <div
                className="grid grid-cols-2"
                style={{
                  padding: '8px 14px',
                  background: 'rgba(255,255,255,0.02)',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Input
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Classification
                </span>
              </div>
              {panel.sampleData.map((row, j) => (
                <div
                  key={j}
                  className="grid grid-cols-2"
                  style={{
                    padding: '10px 14px',
                    borderBottom: j < panel.sampleData.length - 1 ? '1px solid rgba(255,255,255,0.03)' : undefined,
                    opacity: panel.status === 'generated' ? 1 : 0.45,
                    transition: 'opacity 0.4s ease',
                  }}
                >
                  <span style={{ fontSize: 12, color: '#d4d4d8' }}>{row.label}</span>
                  <div className="flex items-center gap-2">
                    {panel.status === 'generated' && (
                      <CheckCircle2 size={12} style={{ color: panel.color, flexShrink: 0 }} />
                    )}
                    <span style={{ fontSize: 12, color: panel.status === 'generated' ? '#fafafa' : '#71717a' }}>
                      {row.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {panel.status === 'idle' && (
              <p style={{ fontSize: 11, color: '#52525b', marginTop: 12, fontStyle: 'italic' }}>
                Sample data shown for demonstration. Click "Generate" to classify your actual workforce data.
              </p>
            )}
          </Panel>
        ))}
      </div>
    </div>
  );
}
