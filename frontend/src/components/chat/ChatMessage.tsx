import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Volume2, Copy, Check } from 'lucide-react';
import { useState, useCallback } from 'react';
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid,
} from 'recharts';
import { ChartTooltip } from '../charts/ChartTooltip';
import type { ChatMessage as ChatMessageType } from '../../stores/chatStore';

const CHART_COLORS = ['#FF8A4C', '#34d399', '#a78bfa', '#60a5fa', '#fbbf24', '#fb7185', '#22d3ee', '#f472b6'];

interface ChatMessageProps {
  message: ChatMessageType;
  onSuggestionClick: (text: string) => void;
  onNavigate?: (route: string) => void;
  isLoading?: boolean;
}

export function ChatMessageBubble({ message, onSuggestionClick, onNavigate, isLoading }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [message.content]);

  const handleSpeak = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const cleaned = message.content
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/NAVIGATE:.*$/gm, '')
        .replace(/SUGGESTIONS:.*$/gm, '');
      const utterance = new SpeechSynthesisUtterance(cleaned);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }, [message.content]);

  const handleNavClick = useCallback((route: string) => {
    onNavigate?.(route);
  }, [onNavigate]);

  if (message.role === 'system') {
    return (
      <div
        style={{
          padding: '10px 14px', borderRadius: 12,
          background: 'rgba(255,138,76,0.06)', border: '1px solid rgba(255,138,76,0.12)',
          fontSize: 12, color: '#a1a1aa', lineHeight: 1.6,
        }}
      >
        <div className="chat-markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        </div>
      </div>
    );
  }

  const isUser = message.role === 'user';

  // Extract navigation from content for rendering as a button
  const navMatch = message.content.match(/NAVIGATE:\s*(\/\S+)/);
  const cleanContent = message.content
    .replace(/NAVIGATE:\s*\/\S+/g, '')
    .replace(/SUGGESTIONS:.*$/gm, '')
    .trim();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', gap: 8, alignItems: 'flex-end' }}>
        {!isUser && (
          <div className="fire-orb" style={{ width: 24, height: 24, flexShrink: 0, marginBottom: 2 }} />
        )}
        <div
          style={{
            maxWidth: isUser ? '82%' : '88%',
            padding: isUser ? '12px 16px' : '14px 18px',
            borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
            background: isUser ? 'rgba(255,138,76,0.10)' : 'rgba(255,255,255,0.03)',
            border: isUser ? '1px solid rgba(255,138,76,0.08)' : '1px solid rgba(255,255,255,0.06)',
            fontSize: 13,
            lineHeight: 1.7,
            color: isUser ? '#fafafa' : '#a1a1aa',
            wordBreak: 'break-word',
          }}
        >
          {isUser ? (
            <span>{message.content}</span>
          ) : (
            <div className="chat-markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{cleanContent}</ReactMarkdown>
            </div>
          )}

          {/* Inline chart */}
          {message.chart_data && <MiniChart data={message.chart_data} />}

          {/* Navigation button */}
          {!isUser && navMatch && (
            <button
              onClick={() => handleNavClick(navMatch[1])}
              style={{
                marginTop: 8, padding: '6px 14px', borderRadius: 8,
                background: 'rgba(255,138,76,0.08)', border: '1px solid rgba(255,138,76,0.2)',
                color: '#FF8A4C', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}
            >
              View on Dashboard →
            </button>
          )}

          {/* Action buttons */}
          {!isUser && message.content.length > 20 && (
            <div style={{ display: 'flex', gap: 4, marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              <ActionBtn onClick={handleCopy} title={copied ? 'Copied!' : 'Copy'}>
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </ActionBtn>
              {'speechSynthesis' in window && (
                <ActionBtn onClick={handleSpeak} title="Read aloud">
                  <Volume2 size={12} />
                </ActionBtn>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Follow-up suggestions */}
      {!isUser && message.suggestions && message.suggestions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, paddingLeft: 32 }}>
          {message.suggestions.map((s, si) => (
            <button
              key={si}
              onClick={() => onSuggestionClick(s)}
              disabled={isLoading}
              style={{
                padding: '5px 12px', borderRadius: 9999,
                background: 'rgba(255,138,76,0.06)', border: '1px solid rgba(255,138,76,0.15)',
                color: '#FF8A4C', fontSize: 11, fontWeight: 500,
                cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'background 150ms',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: '3px 8px', borderRadius: 6, border: 'none',
        background: 'rgba(255,255,255,0.04)', color: '#52525b',
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
        fontSize: 10, transition: 'color 150ms',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = '#a1a1aa'; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = '#52525b'; }}
    >
      {children}
    </button>
  );
}

function MiniChart({ data }: { data: NonNullable<ChatMessageType['chart_data']> }) {
  const chartData = data.labels.map((label, i) => ({ name: label, value: data.values[i] }));

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
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
