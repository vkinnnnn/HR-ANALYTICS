import { Sparkles } from 'lucide-react';

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
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 20px',
        borderRadius: 9999,
        background: 'linear-gradient(135deg, #FF8A4C, #e85d04)',
        border: 'none',
        color: '#fff',
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
        boxShadow: '0 0 20px rgba(255,138,76,0.25), 0 0 40px rgba(255,138,76,0.10)',
        transition: 'transform 220ms cubic-bezier(.4,0,.2,1), box-shadow 220ms cubic-bezier(.4,0,.2,1)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'scale(1.03)';
        e.currentTarget.style.boxShadow = '0 0 28px rgba(255,138,76,0.35), 0 0 56px rgba(255,138,76,0.15)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = '0 0 20px rgba(255,138,76,0.25), 0 0 40px rgba(255,138,76,0.10)';
      }}
    >
      <Sparkles size={14} />
      Ask AI
      {hasNotification && (
        <span
          style={{
            position: 'absolute',
            top: -3,
            right: -3,
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
