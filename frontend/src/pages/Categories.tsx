import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Treemap, Cell } from 'recharts';
import { TreePine } from 'lucide-react';
import api from '../lib/api';
import { PageHero } from '../components/ui/PageHero';
import { Panel } from '../components/ui/Panel';
import { SectionHeader } from '../components/ui/SectionHeader';
import { Badge } from '../components/ui/Badge';
import { ChartTooltip } from '../components/charts/ChartTooltip';

interface Category { id: string; name: string; count: number; percentage: number; avg_specificity: number; subcategories: { id: string; name: string; count: number; avg_specificity: number }[] }
interface HeatmapCell { function: string; category: string; count: number }

const PALETTE = ['#FF8A4C', '#34d399', '#a78bfa', '#60a5fa', '#fbbf24', '#fb7185', '#22d3ee', '#f472b6'];
const AXIS = { fill: '#52525b', fontSize: 10 };
const GRID = 'rgba(255,255,255,0.03)';
const Shimmer = ({ height = 280 }: { height?: number }) => <div style={{ height, background: 'rgba(255,255,255,0.03)', borderRadius: 8, animation: 'shimmer 2s infinite' }} />;

// Custom Treemap cell renderer
function CustomTreemapCell(props: any) {
  const { x, y, width, height, name, root } = props;
  if (width < 30 || height < 25) return null;
  const idx = root?.children?.findIndex((c: any) => c.name === name) ?? 0;
  const color = PALETTE[idx % PALETTE.length];
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={8} fill={color} fillOpacity={0.85} stroke="rgba(0,0,0,0.3)" strokeWidth={2} style={{ cursor: 'pointer' }} />
      {width > 80 && height > 45 && <>
        <text x={x + width / 2} y={y + height / 2 - 8} textAnchor="middle" fill="#fafafa" fontSize={width > 140 ? 13 : 11} fontWeight={700}>{name?.length > 25 ? name.slice(0, 22) + '...' : name}</text>
        <text x={x + width / 2} y={y + height / 2 + 12} textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize={12} fontWeight={600}>{props.count?.toLocaleString()}</text>
      </>}
    </g>
  );
}

export function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapCell[]>([]);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [catRes, fairRes] = await Promise.all([
          api.get('/api/recognition/categories'),
          api.get('/api/recognition/fairness'),
        ]);
        setCategories(catRes.data.categories ?? []);
        setHeatmap((fairRes.data.category_bias ?? []).map((c: any) => ({ function: c.function, category: c.category, count: c.count })));
      } catch {}
      setLoading(false);
    })();
  }, []);

  const selected = categories.find(c => c.id === selectedCat);
  const subcategories = selected?.subcategories ?? [];

  // Treemap data — Recharts Treemap expects flat array with size key
  const treemapData = categories.map(c => ({ name: c.name, count: c.count }));

  // Heatmap helpers
  const funcs = [...new Set(heatmap.map(h => h.function))].sort();
  const cats = categories.map(c => c.name);
  const maxCount = Math.max(...heatmap.map(h => h.count), 1);

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto' }}>
      <PageHero icon={<TreePine size={20} />} title="Categories & Taxonomy" subtitle="Recognition category distribution and drill-down" />

      {/* Category Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {loading ? [0,1,2,3].map(i => <Panel key={i} delay={i*40}><Shimmer height={90} /></Panel>) :
          categories.map((c, i) => (
            <Panel key={c.id} delay={i * 40}>
              <button onClick={() => setSelectedCat(selectedCat === c.id ? null : c.id)} style={{ width: '100%', textAlign: 'left', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>
                <div className="flex items-center gap-2 mb-2">
                  <div style={{ width: 10, height: 10, borderRadius: 4, background: PALETTE[i] }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.id}</span>
                  {selectedCat === c.id && <Badge label="Selected" color={PALETTE[i]} />}
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#fafafa', marginBottom: 4 }}>{c.name}</p>
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: 22, fontWeight: 800, color: PALETTE[i], letterSpacing: '-0.03em' }}>{c.count}</span>
                  <span style={{ fontSize: 11, color: '#52525b' }}>{c.percentage}%</span>
                </div>
              </button>
            </Panel>
          ))
        }
      </div>

      {/* Treemap */}
      <Panel delay={160} className="mb-4">
        <SectionHeader icon={<TreePine size={14} />} title="Category Treemap" subtitle="Sized by award count · click to drill down" />
        {loading ? <Shimmer height={260} /> : (
          <ResponsiveContainer width="100%" height={260}>
            <Treemap
              data={treemapData}
              dataKey="count"
              stroke="none"
              content={<CustomTreemapCell />}
              onClick={(node: any) => {
                if (node?.name) {
                  const cat = categories.find(c => c.name === node.name);
                  if (cat) setSelectedCat(selectedCat === cat.id ? null : cat.id);
                }
              }}
              isAnimationActive={false}
            />
          </ResponsiveContainer>
        )}
      </Panel>

      {/* Subcategory Drill-down */}
      {selected && subcategories.length > 0 && (
        <Panel delay={60} className="mb-4">
          <SectionHeader
            icon={<TreePine size={14} />}
            title={`Subcategories — ${selected.name}`}
            action={<button onClick={() => setSelectedCat(null)} style={{ color: '#71717a', fontSize: 11, cursor: 'pointer', background: 'none', border: 'none' }}>Clear ×</button>}
          />
          <ResponsiveContainer width="100%" height={Math.max(180, subcategories.length * 36)}>
            <BarChart data={subcategories} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
              <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 11 }} axisLine={false} tickLine={false} width={200} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {subcategories.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      )}

      {/* Category × Function Heatmap */}
      <Panel delay={220}>
        <SectionHeader icon={<TreePine size={14} />} title="Category × Function Heatmap" subtitle="Which functions get recognized for which behaviors" />
        {loading || heatmap.length === 0 ? <Shimmer height={300} /> : (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: `160px repeat(${cats.length}, 1fr)`, gap: 2, marginBottom: 2 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#52525b', padding: 4 }}>FUNCTION \ CATEGORY</span>
              {cats.map(c => <span key={c} style={{ fontSize: 9, fontWeight: 700, color: '#71717a', textAlign: 'center', padding: 4, letterSpacing: '0.04em' }}>{c.split(' ')[0]}</span>)}
            </div>
            {funcs.map(f => (
              <div key={f} style={{ display: 'grid', gridTemplateColumns: `160px repeat(${cats.length}, 1fr)`, gap: 2, marginBottom: 2 }}>
                <span style={{ fontSize: 11, color: '#a1a1aa', padding: '6px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f}</span>
                {cats.map(c => {
                  const cell = heatmap.find(h => h.function === f && h.category === c);
                  const val = cell?.count ?? 0;
                  const opacity = val / maxCount;
                  return (
                    <div key={c} title={`${f} → ${c}: ${val}`} style={{
                      background: `rgba(255,138,76,${(opacity * 0.75).toFixed(2)})`,
                      borderRadius: 6, padding: '6px 4px', textAlign: 'center', fontSize: 11, fontWeight: 600,
                      color: opacity > 0.25 ? '#fafafa' : '#52525b',
                    }}>
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
