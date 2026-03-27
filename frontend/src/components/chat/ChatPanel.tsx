import { useState, useRef, useEffect, useCallback } from 'react';
import { X, ArrowUp } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from 'recharts';
import api from '../../lib/api';
import { Badge } from '../ui/Badge';
import { ChartTooltip } from '../charts/ChartTooltip';

const CHART_COLORS = ['#FF8A4C', '#34d399', '#a78bfa', '#60a5fa', '#fbbf24', '#fb7185', '#22d3ee', '#f472b6'];

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  chart_data?: {
    chart_type: 'bar' | 'pie' | 'line';
    labels: string[];
    values: number[];
    title?: string;
  } | null;
  timestamp: number;
}

const PAGE_PROMPTS: Record<string, string[]> = {
  '/': [
    'Summarize workforce health',
    'Which dept needs attention?',
    'Biggest risks right now?',
    'Compare turnover across departments',
  ],
  '/turnover': [
    'Why is turnover so high?',
    'Compare top 3 departments',
    'Predict next quarter turnover',
    'Which locations have highest attrition?',
  ],
  '/careers': [
    "Who's overdue for promotion?",
    'Most common career paths',
    'Stuck employees analysis',
    'Promotion velocity by department',
  ],
  '/managers': [
    'Most effective managers',
    'Flag retention issues',
    'Span of control analysis',
    'Revolving door managers',
  ],
  '/tenure': [
    'Tenure distribution insights',
    'Early attrition patterns',
    'Long-tenured risk assessment',
    'Retention curve analysis',
  ],
  '/flight-risk': [
    'Top risk factors',
    'Which departments are at risk?',
    'Compare risk profiles',
    'Recommend retention actions',
  ],
};

function getPrompts(path: string): string[] {
  return PAGE_PROMPTS[path] || PAGE_PROMPTS['/'];
}

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (msg: ChatMessage) => void;
  currentPage: string;
  prefillMessage?: string | null;
  onPrefillConsumed?: () => void;
}

export function ChatPanel({
  isOpen, onClose, messages, onSendMessage, currentPage, prefillMessage, onPrefillConsumed,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 100) + 'px';
    }
  }, [input]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: trimmed, timestamp: Date.now() };
    onSendMessage(userMsg);
    setInput('');
    setIsLoading(true);

    try {
      const res = await api.post('/api/chat/query', {
        question: trimmed,
        current_page: currentPage,
      });
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: res.data.answer || res.data.text || 'No response.',
        chart_data: res.data.data || null,
        timestamp: Date.now(),
      };
      onSendMessage(assistantMsg);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: err?.response?.data?.detail || 'Sorry, I encountered an error. Please check that OPENAI_API_KEY is set.',
        timestamp: Date.now(),
      };
      onSendMessage(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const prompts = getPrompts(currentPage);

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
        boxShadow: '-20px 0 60px rgba(0,0,0,0.4)',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 280ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}
      >
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fafafa' }}>AI Assistant</span>
          <Badge label="GPT-4o-mini" color="#a78bfa" />
        </div>
        <button
          onClick={onClose}
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#71717a',
            transition: 'background 150ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Message Thread */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 40, color: '#52525b', fontSize: 13 }}>
            <p style={{ fontWeight: 600, color: '#71717a', marginBottom: 4 }}>Ask anything about your workforce</p>
            <p>I can analyze headcount, turnover, tenure, flight risk, and more.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div
              style={{
                maxWidth: '85%',
                padding: '12px 16px',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: msg.role === 'user' ? 'rgba(255,138,76,0.10)' : 'rgba(255,255,255,0.03)',
                border: msg.role === 'assistant' ? '1px solid rgba(255,255,255,0.06)' : 'none',
                fontSize: 13,
                lineHeight: 1.6,
                color: msg.role === 'user' ? '#fafafa' : '#a1a1aa',
                wordBreak: 'break-word',
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
        ))}
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '12px 16px',
              borderRadius: '16px 16px 16px 4px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              gap: 4,
            }}>
              {[0, 1, 2].map(j => (
                <span
                  key={j}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#71717a',
                    animation: `glowPulse 1.4s ${j * 200}ms infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompts */}
      <div style={{ padding: '8px 16px', display: 'flex', gap: 8, overflowX: 'auto', flexShrink: 0 }}>
        {prompts.map((p, i) => (
          <button
            key={i}
            onClick={() => sendMessage(p)}
            disabled={isLoading}
            style={{
              flexShrink: 0,
              padding: '6px 14px',
              borderRadius: 9999,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: '#71717a',
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'color 150ms, border-color 150ms',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#FF8A4C';
              e.currentTarget.style.borderColor = 'rgba(255,138,76,0.25)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = '#71717a';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your workforce..."
            rows={1}
            style={{
              width: '100%',
              resize: 'none',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 12,
              padding: '10px 44px 10px 14px',
              color: '#fafafa',
              fontSize: 13,
              lineHeight: 1.5,
              outline: 'none',
              fontFamily: 'inherit',
              maxHeight: 100,
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,138,76,0.5)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; }}
          />
          {input.trim() && (
            <button
              onClick={() => sendMessage(input)}
              disabled={isLoading}
              style={{
                position: 'absolute',
                right: 8,
                bottom: 8,
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #FF8A4C, #e85d04)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
            >
              <ArrowUp size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function formatMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#fafafa">$1</strong>')
    .replace(/`(.*?)`/g, '<code style="background:rgba(255,255,255,0.06);padding:1px 5px;border-radius:4px;font-size:12px">$1</code>')
    .replace(/^- (.*)/gm, '<li style="margin-left:16px;list-style:disc">$1</li>')
    .replace(/\n/g, '<br/>');
}

function MiniChart({ data }: { data: NonNullable<ChatMessage['chart_data']> }) {
  const chartData = data.labels.map((label, i) => ({ name: label, value: data.values[i] }));

  return (
    <div style={{ marginTop: 12, borderRadius: 12, background: 'rgba(255,255,255,0.02)', padding: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
      {data.title && <p style={{ fontSize: 10, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>{data.title}</p>}
      <ResponsiveContainer width="100%" height={160}>
        {data.chart_type === 'pie' ? (
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} strokeWidth={0}>
              {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        ) : data.chart_type === 'line' ? (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
            <XAxis dataKey="name" tick={{ fill: '#52525b', fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#52525b', fontSize: 9 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Line type="monotone" dataKey="value" stroke="#FF8A4C" strokeWidth={2} dot={false} />
          </LineChart>
        ) : (
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
            <XAxis dataKey="name" tick={{ fill: '#52525b', fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#52525b', fontSize: 9 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
