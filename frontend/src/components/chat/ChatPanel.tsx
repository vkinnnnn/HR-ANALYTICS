import { useRef, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { useChatStore, type ChatMessage } from '../../stores/chatStore';
import { ChatMessageBubble } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { streamChat, type BrainChatPayload } from '../../lib/chatApi';

const PAGE_PROMPTS: Record<string, string[]> = {
  '/': ['Summarize workforce health', 'Biggest risks?', 'Compare depts'],
  '/turnover': ['Why is turnover so high?', 'Trend vs last year', 'Predict next quarter'],
  '/tenure': ['Who has 10+ year tenure?', 'Short-tenure departure patterns', 'Retention curve'],
  '/flight-risk': ['Explain top risk factors', 'Who should we intervene with?', 'Risk by grade'],
  '/careers': ['Promotion velocity by dept', 'Stuck employees', 'Common career paths'],
  '/managers': ['Worst retention managers', 'Optimal span of control', 'Manager comparison'],
  '/org': ['How deep is our hierarchy?', 'Restructuring events', 'Dept growth trends'],
  '/workforce': ['Headcount by department', 'Grade distribution', 'Geographic breakdown'],
  '/categories': ['Explain taxonomy results', 'Category comparison', 'Under-recognized groups'],
  '/quality': ['Message quality trends', 'Best recognition examples', 'Specificity by seniority'],
  '/inequality': ['Explain the Gini coefficient', 'Most over-recognized roles', 'Fairness recommendations'],
};

const STARTER_CARDS = [
  { emoji: '📊', text: "What's our turnover rate?" },
  { emoji: '🔥', text: 'Which depts have highest risk?' },
  { emoji: '👥', text: "Who's been stuck in same role 3yr?" },
  { emoji: '📈', text: 'Show me the org health summary' },
];

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: string;
  prefillMessage?: string | null;
  onPrefillConsumed?: () => void;
  onNavigate?: (route: string) => void;
}

export function ChatPanel({
  isOpen, onClose, currentPage,
  prefillMessage, onPrefillConsumed, onNavigate,
}: ChatPanelProps) {
  const {
    messages, isStreaming, userId,
    addMessage, appendToLastAssistant, setStreaming,
    clearMessages,
  } = useChatStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    if (prefillMessage && isOpen) {
      sendMessage(prefillMessage);
      onPrefillConsumed?.();
    }
  }, [prefillMessage, isOpen]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  function handleNavigation(nav: { action?: string; route?: string; scroll_to?: string; highlight?: string } | null | undefined) {
    if (nav && onNavigate && nav.route) {
      onNavigate(nav.route);
      setTimeout(() => {
        if (nav.scroll_to) {
          document.getElementById(nav.scroll_to)?.scrollIntoView({ behavior: 'smooth' });
        }
        if (nav.highlight) {
          const el = document.getElementById(nav.highlight);
          if (el) {
            el.classList.add('ai-highlight-pulse');
            setTimeout(() => el.classList.remove('ai-highlight-pulse'), 3000);
          }
        }
      }, 500);
    }
  }

  async function sendMessage(text: string, files?: File[]) {
    const trimmed = text.trim();
    if (!trimmed && (!files || files.length === 0)) return;
    if (isStreaming) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
      files: files?.map(f => ({ name: f.name, type: f.type })),
    };
    addMessage(userMsg);
    setStreaming(true);

    const history = [...messages, userMsg]
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-8)
      .map(m => ({ role: m.role, content: m.content }));

    const placeholderMsg: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };
    addMessage(placeholderMsg);

    const payload: BrainChatPayload = {
      message: trimmed,
      user_id: userId,
      current_page: currentPage,
      conversation_history: history,
    };

    await streamChat(payload, {
      onToken: (token) => {
        appendToLastAssistant(token);
      },
      onDone: (meta) => {
        const msgs = useChatStore.getState().messages;
        const last = msgs[msgs.length - 1];
        if (last && last.role === 'assistant') {
          const updated = {
            ...last,
            suggestions: meta.suggestions || null,
            chart_data: meta.chart_data as ChatMessage['chart_data'],
            analysis_type: meta.analysis_type || null,
            navigation: meta.navigation as ChatMessage['navigation'],
          };
          const newMsgs = [...msgs.slice(0, -1), updated];
          useChatStore.getState().setMessages(newMsgs);
        }
        setStreaming(false);
        handleNavigation(meta.navigation);
      },
      onError: (error) => {
        appendToLastAssistant(`Sorry, I encountered an error: ${error}`);
        setStreaming(false);
      },
    });
  }

  const prompts = PAGE_PROMPTS[currentPage] || PAGE_PROMPTS['/'];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, right: 0,
        width: 420, height: '100vh', zIndex: 99,
        display: 'flex', flexDirection: 'column',
        background: 'rgba(9,9,11,0.97)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '-16px 0 48px rgba(0,0,0,0.4)',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
        }}
      >
        <div className="flex items-center gap-3">
          <div className="fire-orb" style={{ width: 28, height: 28, flexShrink: 0 }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: '#fafafa' }}>Workforce IQ</span>
          <span style={{
            fontSize: 9, fontWeight: 600, color: '#FF8A4C',
            padding: '2px 6px', borderRadius: 4,
            background: 'rgba(255,138,76,0.1)', border: '1px solid rgba(255,138,76,0.15)',
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            Brain
          </span>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              style={{
                fontSize: 11, color: '#52525b', background: 'none',
                border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 6,
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#a1a1aa'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#52525b'; }}
            >
              Clear
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'transparent', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#71717a',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Message Thread */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Empty State */}
        {messages.length === 0 && !isStreaming && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 20, paddingBottom: 20 }}>
            <div className="fire-orb" style={{ width: 120, height: 120, animation: 'orbGlow 3s ease-in-out infinite' }} />
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: '#fafafa', marginBottom: 6 }}>
                Ask me anything about your workforce
              </p>
              <p style={{ fontSize: 13, color: '#71717a', maxWidth: 300, lineHeight: 1.5 }}>
                I can analyze headcount, turnover, tenure, flight risk, career paths, recognition patterns, and more.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', maxWidth: 340 }}>
              {STARTER_CARDS.map((card, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(card.text)}
                  style={{
                    padding: '12px 16px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'border-color 150ms, background 150ms',
                    color: '#a1a1aa', fontSize: 12, lineHeight: 1.4,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(255,138,76,0.2)';
                    e.currentTarget.style.background = 'rgba(255,138,76,0.04)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  }}
                >
                  <span style={{ fontSize: 16, display: 'block', marginBottom: 4 }}>{card.emoji}</span>
                  {card.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => (
          <div key={i}>
            {(i === 0 || (msg.timestamp - messages[i - 1].timestamp > 60000)) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0 12px', justifyContent: 'center' }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.04)' }} />
                <span style={{ fontSize: 10, color: '#52525b', whiteSpace: 'nowrap' }}>
                  {new Date(msg.timestamp).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })}
                </span>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.04)' }} />
              </div>
            )}
            <ChatMessageBubble
              message={msg}
              onSuggestionClick={sendMessage}
              onNavigate={onNavigate}
              isLoading={isStreaming}
            />
          </div>
        ))}

        {/* Streaming indicator */}
        {isStreaming && messages.length > 0 && messages[messages.length - 1].content === '' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div className="fire-orb" style={{ width: 24, height: 24, flexShrink: 0, animation: 'orbThinking 2s linear infinite, flameShift 3s ease-in-out infinite' }} />
            <div style={{
              padding: '14px 18px', borderRadius: '16px 16px 16px 4px',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
              maxWidth: '85%', minWidth: 80,
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#FF8A4C' }}>Analyzing...</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[0.7, 0.5, 0.3].map((w, i) => (
                    <div key={i} style={{
                      height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.04)',
                      width: `${w * 100}%`, animation: `shimmer 2s ${i * 200}ms infinite`,
                    }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Contextual prompts */}
      {messages.length > 0 && (
        <div style={{ padding: '8px 16px', display: 'flex', gap: 8, overflowX: 'auto', flexShrink: 0 }}>
          {prompts.map((p, i) => (
            <button
              key={i}
              onClick={() => sendMessage(p)}
              disabled={isStreaming}
              style={{
                flexShrink: 0, padding: '6px 14px', borderRadius: 9999,
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                color: '#71717a', fontSize: 11, fontWeight: 500,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#FF8A4C'; e.currentTarget.style.borderColor = 'rgba(255,138,76,0.2)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#71717a'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input Bar */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <ChatInput
          onSend={sendMessage}
          isLoading={isStreaming}
          placeholder="Ask about your workforce..."
        />
      </div>
    </div>
  );
}

export type { ChatMessage };
