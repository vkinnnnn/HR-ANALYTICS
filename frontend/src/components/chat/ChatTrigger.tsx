interface ChatTriggerProps {
  onClick: () => void;
  hasNotification?: boolean;
  isOpen: boolean;
}

export function ChatTrigger({ onClick, hasNotification, isOpen }: ChatTriggerProps) {
  if (isOpen) return null;

  return (
    <button
      onClick={onClick}
      aria-label="Open AI Assistant"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 100,
        width: 56,
        height: 56,
        borderRadius: '50%',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        background: 'transparent',
        animation: 'orbGlow 3s ease-in-out infinite',
        transition: 'transform 200ms cubic-bezier(.4,0,.2,1), box-shadow 200ms',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'scale(1.05)';
        e.currentTarget.style.boxShadow = '0 0 32px rgba(255,138,76,0.5), 0 0 64px rgba(255,138,76,0.2)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = '';
      }}
    >
      <img
        src="/assets/fire-orb-md.png"
        alt="AI Assistant"
        style={{ width: 48, height: 48, borderRadius: '50%', display: 'block', margin: '4px auto' }}
        onError={e => {
          // CSS fallback if image missing
          const el = e.currentTarget;
          el.style.display = 'none';
          el.parentElement!.classList.add('fire-orb-fallback');
        }}
      />
      {hasNotification && (
        <span
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: '#FF8A4C',
            border: '2px solid #09090b',
            animation: 'glowPulse 2s infinite',
          }}
        />
      )}
    </button>
  );
}
