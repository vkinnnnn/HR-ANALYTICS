import { useState, useEffect } from 'react';
import { Sparkles, Layers, GitBranch, RefreshCw, Briefcase } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '../lib/api';
import { CHART_COLORS } from '../lib/utils';
import { PageHero } from '../components/ui/PageHero';
import { Panel } from '../components/ui/Panel';
import { SectionHeader } from '../components/ui/SectionHeader';
import { Badge } from '../components/ui/Badge';
import { KpiCard } from '../components/ui/KpiCard';
import { ChartTooltip } from '../components/charts/ChartTooltip';

export function Insights() {
  const [summary, setSummary] = useState<any>(null);
  const [grades, setGrades] = useState<any>(null);
  const [functions, setFunctions] = useState<any>(null);
  const [jobFamilies, setJobFamilies] = useState<any>(null);
  const [careerMoves, setCareerMoves] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      api.get('/api/taxonomy/summary'),
      api.get('/api/taxonomy/grades'),
      api.get('/api/taxonomy/functions'),
      api.get('/api/taxonomy/job-families'),
      api.get('/api/taxonomy/career-moves'),
    ]).then(([sumRes, gradeRes, funcRes, jfRes, moveRes]) => {
      setSummary(sumRes.data);
      setGrades(gradeRes.data);
      setFunctions(funcRes.data);
      setJobFamilies(jfRes.data);
      setCareerMoves(moveRes.data);
    }).catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  const handleRegenerate = () => {
    setRegenerating(true);
    api.post('/api/taxonomy/regenerate')
      .then(() => fetchAll())
      .finally(() => setRegenerating(false));
  };

  const gradeBandData = grades?.band_counts
    ? Object.entries(grades.band_counts).map(([band, count]) => ({ name: band, count: count as number })).sort((a, b) => b.count - a.count)
    : [];

  const functionFamilyData = functions?.family_counts
    ? Object.entries(functions.family_counts).map(([family, count]) => ({ name: family, count: count as number })).sort((a, b) => b.count - a.count)
    : [];

  const jobFamilyData = jobFamilies?.family_counts
    ? Object.entries(jobFamilies.family_counts).map(([family, count]) => ({ name: family, count: count as number })).sort((a, b) => b.count - a.count).slice(0, 15)
    : [];

  const moveTypeData = careerMoves?.move_type_counts
    ? Object.entries(careerMoves.move_type_counts).map(([type, count]) => ({ name: type, count: count as number }))
    : [];

  const moveColors: Record<string, string> = { promotion: '#34d399', lateral: '#60a5fa', lateral_transfer: '#a78bfa', demotion: '#fb7185', restructure: '#fbbf24', unknown: '#52525b' };

  return (
    <div>
      <div className="flex items-center justify-between">
        <PageHero icon={<Sparkles size={20} />} title="AI Insights & Taxonomy" subtitle="Auto-generated workforce classifications — grades, job families, career moves" />
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all"
          style={{ background: 'rgba(255,138,76,0.15)', border: '1px solid rgba(255,138,76,0.25)', color: '#FF8A4C' }}
        >
          <RefreshCw size={14} className={regenerating ? 'animate-spin' : ''} />
          {regenerating ? 'Regenerating...' : 'Regenerate Taxonomy'}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        <KpiCard label="Unique Grades" value={summary?.unique_grades || 0} delay={0} loading={loading} icon={<Layers size={18} />} />
        <KpiCard label="Function Families" value={Object.keys(functions?.families || {}).length || 0} delay={60} loading={loading} icon={<Briefcase size={18} />} color="#34d399" />
        <KpiCard label="Job Families" value={Object.keys(jobFamilies?.families || {}).length || 0} delay={120} loading={loading} icon={<Sparkles size={18} />} color="#a78bfa" />
        <KpiCard label="Career Moves Classified" value={careerMoves?.total_moves || 0} delay={180} loading={loading} icon={<GitBranch size={18} />} color="#fbbf24" />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5">
        {/* Grade Band Distribution */}
        <Panel delay={200}>
          <SectionHeader icon={<Layers size={16} />} title="Grade Band Distribution" subtitle="Employee count by career band" />
          {gradeBandData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={gradeBandData} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis type="number" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {gradeBandData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p style={{ color: '#52525b' }}>Loading...</p>}
        </Panel>

        {/* Career Move Types */}
        <Panel delay={260}>
          <SectionHeader icon={<GitBranch size={16} />} title="Career Move Types" subtitle="Classification of all title transitions" />
          {moveTypeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={moveTypeData} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={2}>
                  {moveTypeData.map((entry) => <Cell key={entry.name} fill={moveColors[entry.name] || '#52525b'} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p style={{ color: '#52525b' }}>Loading...</p>}
          <div className="flex flex-wrap gap-2 mt-3">
            {moveTypeData.map(m => (
              <Badge key={m.name} label={`${m.name}: ${m.count}`} color={moveColors[m.name] || '#52525b'} />
            ))}
          </div>
        </Panel>
      </div>

      {/* Function Families */}
      <Panel delay={320} className="mb-5">
        <SectionHeader icon={<Briefcase size={16} />} title="Function Family Classification" subtitle={`${functions?.total_functions || 0} functions → ${functions?.total_families || 0} families`} />
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={functionFamilyData} layout="vertical" margin={{ left: 160 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
            <XAxis type="number" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 11 }} axisLine={false} tickLine={false} width={160} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="count" fill="#FF8A4C" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      {/* Job Families */}
      <Panel delay={380} className="mb-5">
        <SectionHeader icon={<Sparkles size={16} />} title="Job Family Classification" subtitle={`${jobFamilies?.total_titles || 0} unique titles → ${jobFamilies?.total_families || 0} families`} />
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={jobFamilyData} layout="vertical" margin={{ left: 160 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
            <XAxis type="number" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 11 }} axisLine={false} tickLine={false} width={160} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="count" fill="#a78bfa" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      {/* Career Move Examples */}
      {careerMoves?.examples_by_type && (
        <Panel delay={440}>
          <SectionHeader icon={<GitBranch size={16} />} title="Career Move Examples" subtitle="Sample classified transitions by type" />
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(careerMoves.examples_by_type).map(([type, examples]: [string, any]) => (
              <div key={type}>
                <div className="flex items-center gap-2 mb-3">
                  <Badge label={type} color={moveColors[type] || '#52525b'} />
                  <span style={{ fontSize: 11, color: '#71717a' }}>{(examples as any[]).length} examples</span>
                </div>
                <div className="space-y-1.5">
                  {(examples as any[]).slice(0, 5).map((ex: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-[12px] bg-subtle" style={{ fontSize: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ color: '#a1a1aa' }}>{ex.from}</span>
                      <span style={{ color: '#52525b' }}>→</span>
                      <span style={{ color: '#fafafa', fontWeight: 500 }}>{ex.to}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
