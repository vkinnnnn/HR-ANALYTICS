import { useState, useRef, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { PromptInputBox } from '../ui/ai-prompt-box';
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid,
} from 'recharts';
import api from '../../lib/api';
import { ChartTooltip } from '../charts/ChartTooltip';

const CHART_COLORS = ['#FF8A4C', '#34d399', '#a78bfa', '#60a5fa', '#fbbf24', '#fb7185', '#22d3ee', '#f472b6'];

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  chart_data?: {
    chart_type: 'bar' | 'pie' | 'line' | 'area';
    labels: string[];
    values: number[];
    title?: string;
    highlight?: string;
  } | null;
  suggestions?: string[] | null;
  analysis_type?: string | null;
  timestamp: number;
}

// Page-specific suggested prompts
const PAGE_PROMPTS: Record<string, string[]> = {
  '/': ['Summarize workforce health', 'Biggest risks?', 'Compare depts'],
  '/turnover': ['Why is turnover so high?', 'Trend vs last year', 'Predict next quarter'],
  '/tenure': ['Who has 10+ year tenure?', 'Short-tenure departure patterns', 'Retention curve'],
  '/flight-risk': ['Explain top risk factors', 'Who should we intervene with?', 'Risk by grade'],
  '/careers': ['Promotion velocity by dept', 'Stuck employees', 'Common career paths'],
  '/managers': ['Worst retention managers', 'Optimal span of control', 'Manager comparison'],
  '/org': ['How deep is our hierarchy?', 'Restructuring events', 'Dept growth trends'],
  '/workforce': ['Headcount by department', 'Grade distribution', 'Geographic breakdown'],
  '/reports': ['Generate executive summary', 'Key metrics overview'],
  '/insights': ['Explain taxonomy results', 'Grade band breakdown'],
};

// Empty state starter cards
const STARTER_CARDS = [
  { emoji: '📊', text: "What's our turnover rate?" },
  { emoji: '🔥', text: 'Which depts have highest risk?' },
  { emoji: '👥', text: "Who's been stuck in same role 3yr?" },
  { emoji: '📈', text: 'Show me the org health summary' },
];

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (msg: ChatMessage) => void;
  onClearChat: () => void;
  currentPage: string;
  prefillMessage?: string | null;
  onPrefillConsumed?: () => void;
  onNavigate?: (route: string) => void;
}

export function ChatPanel({
  isOpen, onClose, messages, onSendMessage, onClearChat,
  currentPage, prefillMessage, onPrefillConsumed, onNavigate,
}: ChatPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // Handle prefill from chart click
  useEffect(() => {
    if (prefillMessage && isOpen) {
      sendMessage(prefillMessage);
      onPrefillConsumed?.();
    }
  }, [prefillMessage, isOpen]);

  // Escape to close
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // (Auto-resize handled by PromptInputBox)

  function handleNavigation(nav: any) {
    if (nav && onNavigate && nav.action === 'navigate' && nav.route) {
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

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: trimmed, timestamp: Date.now() };
    onSendMessage(userMsg);
    setIsLoading(true);
    setStreamingContent(null);

    const history = [...messages, userMsg]
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-6)
      .map(m => ({ role: m.role, content: m.content }));

    const body = JSON.stringify({
      question: trimmed,
      current_page: currentPage,
      conversation_history: history,
    });

    try {
      // Try SSE streaming first
      const baseURL = api.defaults.baseURL || '';
      const res = await fetch(`${baseURL}/api/chat/query/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      if (!res.ok || !res.body) throw new Error('Stream unavailable');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let finalMeta: any = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.done) {
              finalMeta = data;
            } else if (data.token) {
              accumulated += data.token;
              setStreamingContent(accumulated);
            }
          } catch { /* skip malformed lines */ }
        }
      }

      // Finalize the message
      const answer = accumulated || 'No response.';
      // Strip SUGGESTIONS: and NAVIGATE: from the streamed text for clean display
      let cleanAnswer = answer;
      if (cleanAnswer.includes('SUGGESTIONS:')) {
        cleanAnswer = cleanAnswer.split('SUGGESTIONS:')[0].trim();
      }
      if (cleanAnswer.includes('NAVIGATE:')) {
        cleanAnswer = cleanAnswer.split('NAVIGATE:')[0].trim();
      }
      // Strip chart JSON blocks
      cleanAnswer = cleanAnswer.replace(/```json[\s\S]*?```/g, '').trim();

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: cleanAnswer,
        chart_data: finalMeta?.chart_data || null,
        suggestions: finalMeta?.suggestions || null,
        analysis_type: finalMeta?.analysis_type || null,
        timestamp: Date.now(),
      };
      setStreamingContent(null);
      onSendMessage(assistantMsg);
      handleNavigation(finalMeta?.navigation);

    } catch {
      // Fallback to non-streaming endpoint
      try {
        const res = await api.post('/api/chat/query', {
          question: trimmed,
          current_page: currentPage,
          conversation_history: history,
        });
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: res.data.answer || res.data.text || 'No response.',
          chart_data: res.data.data || null,
          suggestions: res.data.suggestions || null,
          analysis_type: res.data.analysis_type || null,
          timestamp: Date.now(),
        };
        onSendMessage(assistantMsg);
        handleNavigation(res.data.navigation);
      } catch (err: any) {
        onSendMessage({
          role: 'assistant',
          content: err?.response?.data?.detail || 'Sorry, I encountered an error processing your request.',
          timestamp: Date.now(),
        });
      }
    } finally {
      setIsLoading(false);
      setStreamingContent(null);
    }
  }

  const prompts = PAGE_PROMPTS[currentPage] || PAGE_PROMPTS['/'];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: 420,
        height: '100vh',
        zIndex: 99,
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(9,9,11,0.97)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '-16px 0 48px rgba(0,0,0,0.4)',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* ─── Header (60px) ─── */}
      <div
        style={{
          height: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}
      >
        <div className="flex items-center gap-3">
          <div className="fire-orb" style={{ width: 28, height: 28, flexShrink: 0 }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: '#fafafa' }}>Workforce AI</span>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={onClearChat}
              style={{
                fontSize: 11,
                color: '#52525b',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 6,
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
              color: '#71717a', transition: 'background 150ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* ─── Message Thread ─── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Empty State */}
        {messages.length === 0 && !isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 20, paddingBottom: 20 }}>
            <div className="fire-orb" style={{ width: 120, height: 120, animation: 'orbGlow 3s ease-in-out infinite' }} />
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: '#fafafa', marginBottom: 6 }}>
                Ask me anything about your workforce
              </p>
              <p style={{ fontSize: 13, color: '#71717a', maxWidth: 300, lineHeight: 1.5 }}>
                I can analyze headcount, turnover, tenure, flight risk, career paths, manager effectiveness, and more.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', maxWidth: 340 }}>
              {STARTER_CARDS.map((card, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(card.text)}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'border-color 150ms, background 150ms',
                    color: '#a1a1aa',
                    fontSize: 12,
                    lineHeight: 1.4,
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
            {/* Timestamp separator */}
            {i === 0 || (msg.timestamp - messages[i - 1].timestamp > 60000) ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0 12px', justifyContent: 'center' }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.04)' }} />
                <span style={{ fontSize: 10, color: '#52525b', whiteSpace: 'nowrap' }}>
                  {new Date(msg.timestamp).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })}
                </span>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.04)' }} />
              </div>
            ) : null}

            {msg.role === 'system' ? (
              <div style={{
                padding: '10px 14px', borderRadius: 12,
                background: 'rgba(255,138,76,0.06)', border: '1px solid rgba(255,138,76,0.12)',
                fontSize: 12, color: '#a1a1aa', lineHeight: 1.6,
              }}>
                <div dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }} />
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 8, alignItems: 'flex-end' }}>
                {/* AI avatar */}
                {msg.role === 'assistant' && (
                  <div className="fire-orb" style={{ width: 24, height: 24, flexShrink: 0, marginBottom: 2 }} />
                )}
                <div
                  style={{
                    maxWidth: msg.role === 'user' ? '82%' : '85%',
                    padding: msg.role === 'assistant' ? '14px 18px' : '12px 16px',
                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: msg.role === 'user' ? 'rgba(255,138,76,0.10)' : 'rgba(255,255,255,0.03)',
                    border: msg.role === 'user' ? '1px solid rgba(255,138,76,0.08)' : '1px solid rgba(255,255,255,0.06)',
                    fontSize: 13,
                    lineHeight: msg.role === 'assistant' ? 1.7 : 1.6,
                    color: msg.role === 'user' ? '#fafafa' : '#a1a1aa',
                    wordBreak: 'break-word',
                    fontWeight: msg.role === 'user' ? 450 : 400,
                  }}
                >
                  {msg.role === 'assistant' ? (
                    <div dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }} />
                  ) : (
                    msg.content
                  )}
                  {msg.chart_data && <MiniChart data={msg.chart_data} />}
                </div>
              </div>
            )}
            {/* Follow-up suggestions from AI */}
            {msg.role === 'assistant' && msg.suggestions && msg.suggestions.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, paddingLeft: 32 }}>
                {msg.suggestions.map((s, si) => (
                  <button
                    key={si}
                    onClick={() => sendMessage(s)}
                    disabled={isLoading}
                    style={{
                      padding: '5px 12px', borderRadius: 9999,
                      background: 'rgba(255,138,76,0.06)',
                      border: '1px solid rgba(255,138,76,0.15)',
                      color: '#FF8A4C', fontSize: 11, fontWeight: 500,
                      cursor: 'pointer', whiteSpace: 'nowrap',
                      transition: 'background 150ms, border-color 150ms',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(255,138,76,0.12)';
                      e.currentTarget.style.borderColor = 'rgba(255,138,76,0.3)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(255,138,76,0.06)';
                      e.currentTarget.style.borderColor = 'rgba(255,138,76,0.15)';
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Streaming / Thinking indicator */}
        {isLoading && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div className="fire-orb" style={{ width: 24, height: 24, flexShrink: 0, animation: streamingContent ? 'flameShift 3s ease-in-out infinite' : 'orbThinking 2s linear infinite, flameShift 3s ease-in-out infinite' }} />
            <div style={{
              padding: '14px 18px',
              borderRadius: '16px 16px 16px 4px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              maxWidth: '85%',
              minWidth: 80,
            }}>
              {streamingContent ? (
                <div
                  style={{ fontSize: 13, lineHeight: 1.65, color: '#e4e4e7' }}
                  dangerouslySetInnerHTML={{ __html: formatMarkdown(streamingContent) }}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#FF8A4C' }}>Analyzing...</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[0.7, 0.5, 0.3].map((w, i) => (
                      <div
                        key={i}
                        style={{
                          height: 8, borderRadius: 4,
                          background: 'rgba(255,255,255,0.04)',
                          width: `${w * 100}%`,
                          animation: `shimmer 2s ${i * 200}ms infinite`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ─── Contextual Suggestions ─── */}
      {messages.length > 0 && (
        <div style={{ padding: '8px 16px', display: 'flex', gap: 8, overflowX: 'auto', flexShrink: 0 }}>
          {prompts.map((p, i) => (
            <button
              key={i}
              onClick={() => sendMessage(p)}
              disabled={isLoading}
              style={{
                flexShrink: 0, padding: '6px 14px', borderRadius: 9999,
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                color: '#71717a', fontSize: 11, fontWeight: 500,
                cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'color 150ms, border-color 150ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#FF8A4C'; e.currentTarget.style.borderColor = 'rgba(255,138,76,0.2)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#71717a'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* ─── Input Bar (AI Prompt Box) ─── */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <PromptInputBox
          onSend={(message) => sendMessage(message)}
          isLoading={isLoading}
          placeholder="Ask about your workforce..."
        />
      </div>
    </div>
  );
}

function formatMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#fafafa">$1</strong>')
    .replace(/`(.*?)`/g, '<code style="background:rgba(255,255,255,0.06);padding:1px 5px;border-radius:4px;font-size:12px">$1</code>')
    .replace(/^- (.*)/gm, '<li style="margin-left:16px;list-style:disc;margin-bottom:2px">$1</li>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

function MiniChart({ data }: { data: NonNullable<ChatMessage['chart_data']> }) {
  const chartData = data.labels.map((label, i) => ({ name: label, value: data.values[i] }));

  return (
    <div style={{
      marginTop: 12, paddingTop: 12,
      borderTop: '1px solid rgba(255,255,255,0.04)',
    }}>
      {data.title && (
        <p style={{ fontSize: 10, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
          {data.title}
        </p>
      )}
      <div style={{ borderRadius: 8, background: 'rgba(255,255,255,0.02)', padding: 8 }}>
        <ResponsiveContainer width="100%" height={160}>
          {data.chart_type === 'pie' ? (
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={55} innerRadius={30} strokeWidth={0}>
                {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          ) : data.chart_type === 'line' || data.chart_type === 'area' ? (
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="chatAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF8A4C" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#FF8A4C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
              <XAxis dataKey="name" tick={{ fill: '#52525b', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#52525b', fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="value" stroke="#FF8A4C" fill="url(#chatAreaGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          ) : (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
              <XAxis dataKey="name" tick={{ fill: '#52525b', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#52525b', fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={data.highlight && entry.name === data.highlight ? '#fb7185' : CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
