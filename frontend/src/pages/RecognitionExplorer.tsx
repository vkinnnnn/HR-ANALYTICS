import { useState, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';
import api from '../lib/api';
import { PageHero } from '../components/ui/PageHero';
import { Panel } from '../components/ui/Panel';
import { SectionHeader } from '../components/ui/SectionHeader';
import { Badge } from '../components/ui/Badge';

/* ---------- types ---------- */
interface Award {
  award_title: string;
  recipient_title: string;
  nominator_title: string;
  category: string;
  specificity: number;
  word_count: number;
  message: string;
  full_message: string;
}

interface ExplorerResponse {
  awards: Award[];
  total: number;
  limit: number;
  offset: number;
}

/* ---------- constants ---------- */
const CATEGORY_COLORS: Record<string, string> = {
  A: '#FF8A4C', B: '#34d399', C: '#a78bfa', D: '#60a5fa',
};
const CATEGORIES = ['All', 'A', 'B', 'C', 'D'];
const SPEC_BANDS = ['All', '0-0.2', '0.2-0.4', '0.4-0.6', '0.6-0.8', '0.8-1.0'];
const LIMIT = 50;

const Shimmer = ({ height = 44 }: { height?: number }) => (
  <div style={{ height, background: 'rgba(255,255,255,0.03)', borderRadius: 12, animation: 'shimmer 2s infinite' }} />
);

const selectStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 9999,
  padding: '6px 14px',
  color: '#a1a1aa',
  fontSize: 11,
  fontWeight: 600,
  outline: 'none',
};

const inputStyle: React.CSSProperties = {
  ...selectStyle,
  borderRadius: 9999,
  minWidth: 200,
  color: '#fafafa',
};

export function RecognitionExplorer() {
  const [data, setData] = useState<ExplorerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [func, setFunc] = useState('All');
  const [specBand, setSpecBand] = useState('All');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const functions = ['Engineering & Technology','Customer Service','Product & Design','Finance & Operations','Marketing & Brand','Data & Analytics','People & HR','Sales','Legal & Compliance','Operations','Other'];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: LIMIT, offset };
      if (category !== 'All') params.category = category;
      if (func !== 'All') params.function = func;
      if (specBand !== 'All') params.spec_band = specBand;
      if (search.trim()) params.search = search.trim();
      const res = await api.get<ExplorerResponse>('/api/recognition/explorer', { params });
      setData(res.data);
    } catch { setData(null); }
    setLoading(false);
  }, [category, func, specBand, search, offset]);

  useEffect(() => {
  }, []);

  useEffect(() => { setOffset(0); }, [category, func, specBand, search]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const total = data?.total ?? 0;
  const results = data?.awards ?? [];

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 28px 44px' }}>
      <PageHero icon={<Search size={20} />} title="Recognition Explorer" subtitle="Browse and filter all 1,000 awards" />

      {/* Filter Bar */}
      <Panel delay={0} className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <select style={selectStyle} value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c === 'All' ? 'All Categories' : `Category ${c}`}</option>)}
          </select>
          <select style={selectStyle} value={func} onChange={e => setFunc(e.target.value)}>
            <option value="All">All Functions</option>
            {functions.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <select style={selectStyle} value={specBand} onChange={e => setSpecBand(e.target.value)}>
            {SPEC_BANDS.map(b => <option key={b} value={b}>{b === 'All' ? 'All Specificity' : b}</option>)}
          </select>
          <input
            style={inputStyle}
            placeholder="Search awards..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <span style={{ fontSize: 11, color: '#71717a', marginLeft: 'auto' }}>
            {total.toLocaleString()} results
          </span>
        </div>
      </Panel>

      {/* Results Table */}
      <Panel delay={60}>
        <SectionHeader icon={<Search size={14} />} title="Results" subtitle={`Showing ${results.length} of ${total}`} />

        {/* Header Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1.2fr 1.2fr 80px 90px 70px',
            padding: '8px 14px',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase' as const,
            color: '#52525b',
          }}
        >
          <span>Award Title</span><span>Recipient</span><span>Nominator</span>
          <span>Category</span><span>Specificity</span><span>Words</span>
        </div>

        {loading ? (
          <div className="space-y-2">{Array.from({ length: 8 }, (_, i) => <Shimmer key={i} />)}</div>
        ) : results.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#52525b' }}>No results found</div>
        ) : (
          results.map((r, idx) => (
            <div key={idx}>
              <div
                onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1.2fr 1.2fr 80px 90px 70px',
                  padding: '10px 14px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  marginBottom: 4,
                  cursor: 'pointer',
                  alignItems: 'center',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
              >
                <span style={{ color: '#fafafa', fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.award_title}</span>
                <span style={{ color: '#a1a1aa', fontSize: 12 }}>{r.recipient_title}</span>
                <span style={{ color: '#a1a1aa', fontSize: 12 }}>{r.nominator_title}</span>
                <span><Badge label={r.category} color={CATEGORY_COLORS[r.category] ?? '#FF8A4C'} /></span>
                <span style={{ color: r.specificity >= 0.6 ? '#34d399' : r.specificity >= 0.3 ? '#fbbf24' : '#fb7185', fontSize: 12, fontWeight: 700 }}>
                  {r.specificity.toFixed(2)}
                </span>
                <span style={{ color: '#a1a1aa', fontSize: 12 }}>{r.word_count}</span>
              </div>
              {expandedIdx === idx && (
                <div style={{
                  padding: '12px 14px 12px 28px',
                  marginBottom: 8,
                  fontSize: 12,
                  lineHeight: 1.6,
                  color: '#a1a1aa',
                  background: 'rgba(255,255,255,0.01)',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  {r.full_message || r.message}
                </div>
              )}
            </div>
          ))
        )}

        {/* Pagination */}
        {total > LIMIT && (
          <div className="flex items-center justify-center gap-4 mt-4">
            <button
              onClick={() => setOffset(Math.max(0, offset - LIMIT))}
              disabled={offset === 0}
              style={{
                ...selectStyle,
                cursor: offset === 0 ? 'not-allowed' : 'pointer',
                opacity: offset === 0 ? 0.4 : 1,
              }}
            >
              Previous
            </button>
            <span style={{ color: '#71717a', fontSize: 11 }}>
              {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
            </span>
            <button
              onClick={() => setOffset(offset + LIMIT)}
              disabled={offset + LIMIT >= total}
              style={{
                ...selectStyle,
                cursor: offset + LIMIT >= total ? 'not-allowed' : 'pointer',
                opacity: offset + LIMIT >= total ? 0.4 : 1,
              }}
            >
              Next
            </button>
          </div>
        )}
      </Panel>
    </div>
  );
}
