export function AmbientBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0" style={{
      background: [
        'radial-gradient(ellipse 70% 50% at 30% -5%, rgba(255,138,76,0.04), transparent 55%)',
        'radial-gradient(ellipse 50% 40% at 85% 100%, rgba(167,139,250,0.03), transparent 50%)',
      ].join(', '),
    }} />
  );
}
