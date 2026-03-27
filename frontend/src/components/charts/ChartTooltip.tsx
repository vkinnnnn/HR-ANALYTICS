interface ChartTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

export function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'rgba(19,19,24,0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.14)',
        borderRadius: 12,
        padding: '10px 14px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
      }}
    >
      {label && (
        <p style={{
          color: '#a1a1aa',
          marginBottom: 6,
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}>
          {label}
        </p>
      )}
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2" style={{ marginTop: i > 0 ? 4 : 0 }}>
          <span
            className="shrink-0"
            style={{ width: 6, height: 6, borderRadius: '50%', background: entry.color }}
          />
          <span style={{ color: '#a1a1aa', fontSize: 11 }}>{entry.name}:</span>
          <span style={{ color: '#fafafa', fontWeight: 700, fontSize: 11 }}>
            {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}
