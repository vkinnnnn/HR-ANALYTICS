import { useState, useEffect } from 'react';
import { Trophy } from 'lucide-react';
import api from '../lib/api';
import { PageHero } from '../components/ui/PageHero';
import { Panel } from '../components/ui/Panel';
import { SectionHeader } from '../components/ui/SectionHeader';
import { Badge } from '../components/ui/Badge';

/* ---------- types ---------- */
interface NominatorRow {
  role: string;
  total_awards: number;
  avg_specificity: number;
  category_diversity: number;
  composite_score: number;
  blind_spot: boolean;
}

interface NominatorsData {
  leaderboard: NominatorRow[];
  coaching_candidates: NominatorRow[];
}

/* ---------- constants ---------- */
const PALETTE = ['#FF8A4C', '#34d399', '#a78bfa', '#60a5fa', '#fbbf24', '#fb7185', '#22d3ee', '#f472b6'];

const Shimmer = ({ height = 44 }: { height?: number }) => (
  <div style={{ height, background: 'rgba(255,255,255,0.03)', borderRadius: 12, animation: 'shimmer 2s infinite' }} />
);

const TableLabel = ({ children }: { children: string }) => (
  <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: '#52525b' }}>
    {children}
  </span>
);

function scoreColor(score: number): string {
  if (score >= 0.7) return '#34d399';
  if (score >= 0.4) return '#fbbf24';
  return '#fb7185';
}

export function Nominators() {
  const [data, setData] = useState<NominatorsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<NominatorsData>('/api/recognition/nominators')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const leaderboard = data?.leaderboard ?? [];
  const coaching = data?.coaching_candidates ?? [];

  const gridCols = '50px 2fr 80px 90px 90px 100px 80px';

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 28px 44px' }}>
      <PageHero icon={<Trophy size={20} />} title="Nominator Effectiveness" subtitle="Who gives the best recognition?" />

      {/* Leaderboard */}
      <Panel delay={0} className="mb-4">
        <SectionHeader icon={<Trophy size={14} />} title="Nominator Leaderboard" subtitle="Ranked by composite score" />

        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: gridCols, padding: '8px 14px', gap: 8 }}>
          <TableLabel>Rank</TableLabel>
          <TableLabel>Role</TableLabel>
          <TableLabel>Awards</TableLabel>
          <TableLabel>Avg Spec</TableLabel>
          <TableLabel>Diversity</TableLabel>
          <TableLabel>Composite</TableLabel>
          <TableLabel>Blind Spot</TableLabel>
        </div>

        {loading ? (
          <div className="space-y-2">{Array.from({ length: 10 }, (_, i) => <Shimmer key={i} />)}</div>
        ) : leaderboard.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#52525b' }}>No data available</div>
        ) : (
          leaderboard.map((row, i) => {
            const isTop = i < 3;
            return (
              <div
                key={row.role}
                style={{
                  display: 'grid',
                  gridTemplateColumns: gridCols,
                  padding: '10px 14px',
                  gap: 8,
                  borderRadius: 12,
                  background: isTop ? 'rgba(255,138,76,0.06)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${isTop ? 'rgba(255,138,76,0.1)' : 'rgba(255,255,255,0.06)'}`,
                  marginBottom: 4,
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 800, color: isTop ? PALETTE[0] : '#a1a1aa' }}>
                  #{i + 1}
                </span>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#fafafa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.role}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fafafa' }}>
                  {row.total_awards}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: scoreColor(row.avg_specificity) }}>
                  {row.avg_specificity.toFixed(2)}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: scoreColor(row.category_diversity) }}>
                  {row.category_diversity.toFixed(2)}
                </span>
                <span style={{ fontSize: 12, fontWeight: 800, color: scoreColor(row.composite_score) }}>
                  {row.composite_score.toFixed(2)}
                </span>
                <span>
                  {row.blind_spot && <Badge label="Blind Spot" color="#fb7185" dot />}
                </span>
              </div>
            );
          })
        )}
      </Panel>

      {/* Coaching Candidates */}
      <Panel delay={60}>
        <SectionHeader
          icon={<Trophy size={14} />}
          title="Coaching Candidates"
          subtitle="Low specificity + low category diversity — would benefit from training"
          action={<Badge label={`${coaching.length} identified`} color="#fbbf24" />}
        />

        {loading ? (
          <div className="space-y-2">{Array.from({ length: 5 }, (_, i) => <Shimmer key={i} />)}</div>
        ) : coaching.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#52525b' }}>No coaching candidates identified</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 90px 90px 100px', padding: '8px 14px', gap: 8 }}>
              <TableLabel>Role</TableLabel>
              <TableLabel>Awards</TableLabel>
              <TableLabel>Avg Spec</TableLabel>
              <TableLabel>Diversity</TableLabel>
              <TableLabel>Composite</TableLabel>
            </div>
            {coaching.map((row) => (
              <div
                key={row.role}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 80px 90px 90px 100px',
                  padding: '10px 14px',
                  gap: 8,
                  borderRadius: 12,
                  background: 'rgba(251,113,133,0.04)',
                  border: '1px solid rgba(251,113,133,0.1)',
                  marginBottom: 4,
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 500, color: '#fafafa' }}>{row.role}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fafafa' }}>{row.total_awards}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fb7185' }}>{row.avg_specificity.toFixed(2)}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fb7185' }}>{row.category_diversity.toFixed(2)}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#fb7185' }}>{row.composite_score.toFixed(2)}</span>
              </div>
            ))}
          </>
        )}
      </Panel>
    </div>
  );
}
