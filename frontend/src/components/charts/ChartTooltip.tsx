interface ChartTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

export function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(19,19,24,0.95)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.14)',
      borderRadius: 12,
      padding: '10px 14px',
      fontSize: 12,
    }}>
      {label && <p style={{ color: '#71717a', marginBottom: 6, fontWeight: 600 }}>{label}</p>}
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2" style={{ marginTop: i > 0 ? 4 : 0 }}>
          <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span style={{ color: '#a1a1aa' }}>{entry.name}:</span>
          <span style={{ color: '#fafafa', fontWeight: 600 }}>{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}</span>
        </div>
      ))}
    </div>
  );
}
