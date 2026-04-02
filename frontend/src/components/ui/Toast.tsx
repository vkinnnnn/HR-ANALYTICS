import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  addToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({ addToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const TYPE_COLORS: Record<ToastType, string> = {
  success: '#34d399',
  error: '#fb7185',
  info: '#60a5fa',
  warning: '#fbbf24',
};

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = nextId++;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Toast container — bottom-left to avoid chat FAB */}
      <div style={{
        position: 'fixed', bottom: 24, left: 24, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 8,
        pointerEvents: 'none',
      }}>
        {toasts.map(t => {
          const color = TYPE_COLORS[t.type];
          return (
            <div
              key={t.id}
              style={{
                pointerEvents: 'auto',
                padding: '12px 18px',
                borderRadius: 12,
                background: 'rgba(19,19,24,0.92)',
                backdropFilter: 'blur(16px)',
                border: `1px solid ${color}30`,
                boxShadow: `0 4px 20px rgba(0,0,0,0.4), 0 0 8px ${color}15`,
                display: 'flex', alignItems: 'center', gap: 10,
                animation: 'fadeUp 0.35s ease-out both',
                maxWidth: 360,
              }}
            >
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: color, flexShrink: 0,
              }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: '#e4e4e7' }}>
                {t.message}
              </span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
