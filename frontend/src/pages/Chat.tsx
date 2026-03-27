import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Bot, User } from 'lucide-react';
import { PageHero } from '../components/ui/PageHero';
import { Panel } from '../components/ui/Panel';
import api from '../lib/api';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const SUGGESTED_PROMPTS = [
  "What's our turnover rate?",
  'Which department is growing fastest?',
  'Show employees stuck in same role',
  'Who are the top flight risks?',
];

export function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/api/chat/query', { question: text.trim() });
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: res.data.answer ?? res.data.response ?? JSON.stringify(res.data),
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${err?.response?.data?.detail ?? err.message ?? 'Failed to get response'}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 72px)' }}>
      <PageHero
        icon={<MessageSquare size={20} />}
        title="AI Chatbot"
        subtitle="Ask natural language questions about your workforce"
      />

      {/* Suggested prompts */}
      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2 mb-5" style={{ animation: 'fadeUp 0.45s ease-out both' }}>
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => sendMessage(prompt)}
              className="hover-lift"
              style={{
                padding: '8px 16px',
                borderRadius: 9999,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#a1a1aa',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,138,76,0.1)';
                e.currentTarget.style.borderColor = 'rgba(255,138,76,0.25)';
                e.currentTarget.style.color = '#FF8A4C';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.color = '#a1a1aa';
              }}
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-4 mb-4" style={{ scrollbarGutter: 'stable' }}>
        {messages.map((msg, i) => (
          <div
            key={msg.id}
            className="flex gap-3"
            style={{
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              animation: `fadeUp 0.3s ease-out ${i * 50}ms both`,
            }}
          >
            {msg.role === 'assistant' && (
              <div
                className="flex-shrink-0 w-8 h-8 rounded-[10px] flex items-center justify-center mt-1"
                style={{ background: 'linear-gradient(135deg, #FF8A4C, #e85d04)' }}
              >
                <Bot size={14} color="#fff" />
              </div>
            )}
            <div
              style={{
                maxWidth: '70%',
                padding: '12px 16px',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background:
                  msg.role === 'user'
                    ? 'rgba(255,138,76,0.12)'
                    : 'rgba(255,255,255,0.04)',
                border: `1px solid ${
                  msg.role === 'user'
                    ? 'rgba(255,138,76,0.2)'
                    : 'rgba(255,255,255,0.06)'
                }`,
                backdropFilter: 'blur(12px)',
              }}
            >
              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: msg.role === 'user' ? '#fafafa' : '#d4d4d8',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {msg.content}
              </p>
              <p style={{ fontSize: 10, color: '#52525b', marginTop: 6 }}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            {msg.role === 'user' && (
              <div
                className="flex-shrink-0 w-8 h-8 rounded-[10px] flex items-center justify-center mt-1"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <User size={14} color="#a1a1aa" />
              </div>
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="flex gap-3" style={{ animation: 'fadeUp 0.3s ease-out both' }}>
            <div
              className="flex-shrink-0 w-8 h-8 rounded-[10px] flex items-center justify-center mt-1"
              style={{ background: 'linear-gradient(135deg, #FF8A4C, #e85d04)' }}
            >
              <Bot size={14} color="#fff" />
            </div>
            <div
              style={{
                padding: '14px 20px',
                borderRadius: '16px 16px 16px 4px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <div className="flex gap-1.5 items-center">
                {[0, 1, 2].map(dot => (
                  <span
                    key={dot}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: '#FF8A4C',
                      animation: `pulse 1.4s ease-in-out ${dot * 0.2}s infinite`,
                      opacity: 0.6,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <Panel className="!p-2 flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about your workforce..."
          disabled={loading}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#fafafa',
            fontSize: 13,
            padding: '10px 12px',
          }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || loading}
          className="flex items-center justify-center transition-all duration-200"
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: input.trim() && !loading ? 'linear-gradient(135deg, #FF8A4C, #e85d04)' : 'rgba(255,255,255,0.06)',
            border: 'none',
            cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
            opacity: input.trim() && !loading ? 1 : 0.4,
          }}
        >
          <Send size={14} color="#fff" />
        </button>
      </Panel>

      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
