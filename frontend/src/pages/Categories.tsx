import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Treemap } from 'recharts';
import { TreePine } from 'lucide-react';
import api from '../lib/api';
import { PageHero } from '../components/ui/PageHero';
import { Panel } from '../components/ui/Panel';
import { SectionHeader } from '../components/ui/SectionHeader';
import { ChartTooltip } from '../components/charts/ChartTooltip';

/* ---------- types ---------- */
interface Category {
  id: string;
  name: string;
  count: number;
  percentage: number;
  avg_specificity: number;
}

interface Subcategory {
  name: string;
  count: number;
  avg_specificity: number;
}

interface HeatmapCell {
  category: string;
  function: string;
  count: number;
}

/* ---------- constants ---------- */
const PALETTE = ['#FF8A4C', '#34d399', '#a78bfa', '#60a5fa', '#fbbf24', '#fb7185', '#22d3ee', '#f472b6'];
const AXIS = { fill: '#52525b', fontSize: 10 };
const GRID = 'rgba(255,255,255,0.03)';

const Shimmer = ({ height = 280 }: { height?: number }) => (
  <div style={{ height, background: 'rgba(255,255,255,0.03)', borderRadius: 8, animation: 'shimmer 2s infinite' }} />
);

/* ---------- treemap content ---------- */
interface TreemapContentProps {
  x: number; y: number; width: number; height: number;
  name: string; count: number; index: number;
}

function TreemapContent({ x, y, width, height, name, count, index }: TreemapContentProps) {
  if (width < 40 || height < 30) return null;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={8}
        style={{ fill: PALETTE[index % PALETTE.length], opacity: 0.8, stroke: 'rgba(0,0,0,0.3)', strokeWidth: 2 }} />
      {width > 60 && height > 40 && (
        <>
          <text x={x + width / 2} y={y + height / 2 - 6} textAnchor="middle" fill="#fafafa" fontSize={13} fontWeight={700}>
            {name}
          </text>
          <text x={x + width / 2} y={y + height / 2 + 12} textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize={11}>
            {count.toLocaleString()}
          </text>
        </>
      )}
    </g>
  );
}

export function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapCell[]>([]);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [subLoading, setSubLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<{ categories: Category[]; heatmap: HeatmapCell[] }>('/api/recognition/categories');
        setCategories(res.data.categories ?? []);
        setHeatmap(res.data.heatmap ?? []);
      } catch {}
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!selectedCat) { setSubcategories([]); return; }
    setSubLoading(true);
    api.get<{ subcategories: Subcategory[] }>(`/api/recognition/subcategories`, { params: { category_id: selectedCat } })
      .then(r => setSubcategories(r.data.subcategories ?? []))
      .catch(() => setSubcategories([]))
      .finally(() => setSubLoading(false));
  }, [selectedCat]);

  const treemapData = categories.map((c, i) => ({ name: c.name, count: c.count, index: i }));

  // Heatmap helpers
  const funcs = [...new Set(heatmap.map(h => h.function))];
  const cats = [...new Set(heatmap.map(h => h.category))];
  const maxCount = Math.max(...heatmap.map(h => h.count), 1);

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 28px 44px' }}>
      <PageHero icon={<TreePine size={20} />} title="Categories & Taxonomy" subtitle="Recognition category distribution and drill-down" />

      {/* Treemap */}
      <Panel delay={0} className="mb-4">
        <SectionHeader icon={<TreePine size={14} />} title="Category Distribution" subtitle="Click a category to drill down" />
        {loading ? <Shimmer height={300} /> : (
          <ResponsiveContainer width="100%" height={300}>
            <Treemap
              data={treemapData}
              dataKey="count"
              stroke="none"
              content={<TreemapContent x={0} y={0} width={0} height={0} name="" count={0} index={0} />}
              onClick={(node: any) => node?.name && setSelectedCat(categories.find(c => c.name === node.name)?.id ?? null)}
              isAnimationActive={false}
            />
          </ResponsiveContainer>
        )}
      </Panel>

      {/* Subcategory Drill-down */}
      {selectedCat && (
        <Panel delay={60} className="mb-4">
          <SectionHeader
            icon={<TreePine size={14} />}
            title={`Subcategories — ${categories.find(c => c.id === selectedCat)?.name ?? selectedCat}`}
            action={<button onClick={() => setSelectedCat(null)} style={{ color: '#71717a', fontSize: 11, cursor: 'pointer' }}>Clear</button>}
          />
          {subLoading ? <Shimmer height={220} /> : (
            <ResponsiveContainer width="100%" height={Math.max(200, subcategories.length * 36)}>
              <BarChart data={subcategories} layout="vertical" margin={{ left: 120 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
                <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={AXIS} axisLine={false} tickLine={false} width={110} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" fill={PALETTE[0]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      )}

      {/* Heatmap */}
      <Panel delay={120}>
        <SectionHeader icon={<TreePine size={14} />} title="Category × Function Heatmap" />
        {loading ? <Shimmer height={200} /> : (
          <div style={{ overflowX: 'auto' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: `100px repeat(${cats.length}, 1fr)`, gap: 2, marginBottom: 2 }}>
              <span />
              {cats.map(c => (
                <span key={c} style={{ fontSize: 10, fontWeight: 700, color: '#71717a', textAlign: 'center', padding: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {c}
                </span>
              ))}
            </div>
            {/* Rows */}
            {funcs.map(f => (
              <div key={f} style={{ display: 'grid', gridTemplateColumns: `100px repeat(${cats.length}, 1fr)`, gap: 2, marginBottom: 2 }}>
                <span style={{ fontSize: 11, color: '#a1a1aa', padding: '6px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f}</span>
                {cats.map(c => {
                  const cell = heatmap.find(h => h.function === f && h.category === c);
                  const val = cell?.count ?? 0;
                  const opacity = val / maxCount;
                  return (
                    <div
                      key={c}
                      style={{
                        background: `rgba(255,138,76,${(opacity * 0.7).toFixed(2)})`,
                        borderRadius: 6,
                        padding: '6px 4px',
                        textAlign: 'center',
                        fontSize: 11,
                        fontWeight: 600,
                        color: opacity > 0.3 ? '#fafafa' : '#52525b',
                      }}
                    >
                      {val > 0 ? val : ''}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
