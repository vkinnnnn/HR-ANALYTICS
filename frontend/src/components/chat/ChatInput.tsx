import { useState, useRef, useCallback } from 'react';
import { Send, Paperclip } from 'lucide-react';
import { VoiceButton } from './VoiceButton';
import { FilePreview } from './FilePreview';

const ACCEPTED_TYPES = '.csv,.xlsx,.xls,.pdf,.docx,.txt,.md,.json,.png,.jpg,.jpeg';

interface ChatInputProps {
  onSend: (text: string, files?: File[]) => void;
  isLoading: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, isLoading, placeholder = 'Ask about your workforce...' }: ChatInputProps) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed && files.length === 0) return;
    if (isLoading) return;
    onSend(trimmed, files.length > 0 ? files : undefined);
    setText('');
    setFiles([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = '40px';
    }
  }, [text, files, isLoading, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = '40px';
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...selected]);
    e.target.value = '';
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleVoiceTranscript = useCallback((transcript: string) => {
    setText(prev => (prev ? prev + ' ' : '') + transcript);
    textareaRef.current?.focus();
  }, []);

  const canSend = (text.trim().length > 0 || files.length > 0) && !isLoading;

  return (
    <div>
      <FilePreview files={files} onRemove={removeFile} />
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 4,
          padding: '6px 8px',
          borderRadius: 14,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          transition: 'border-color 200ms',
        }}
      >
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          title="Attach file"
          style={{
            width: 32, height: 32, borderRadius: 8,
            border: 'none', background: 'transparent',
            color: '#71717a', cursor: isLoading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: isLoading ? 0.4 : 1,
          }}
        >
          <Paperclip size={15} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          multiple
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        <VoiceButton onTranscript={handleVoiceTranscript} disabled={isLoading} />

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={placeholder}
          disabled={isLoading}
          rows={1}
          style={{
            flex: 1,
            resize: 'none',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: '#fafafa',
            fontSize: 13,
            lineHeight: '20px',
            height: 40,
            maxHeight: 120,
            padding: '10px 4px',
            fontFamily: 'inherit',
          }}
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          title="Send message"
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: 'none',
            background: canSend ? '#FF8A4C' : 'rgba(255,255,255,0.04)',
            color: canSend ? '#09090b' : '#3f3f46',
            cursor: canSend ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 150ms, color 150ms',
            flexShrink: 0,
          }}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
