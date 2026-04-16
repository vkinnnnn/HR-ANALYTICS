import React, { useRef, useState, useEffect } from 'react';
import { Send, Paperclip, Mic, X } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string, files?: File[]) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  isLoading = false,
  disabled = false,
}) => {
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Auto-expand textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  const handleSend = () => {
    if (!message.trim() || isLoading) return;
    onSend(message, files.length > 0 ? files : undefined);
    setMessage('');
    setFiles([]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([blob], 'voice.webm', { type: 'audio/webm' });
        setFiles([audioFile]);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Microphone access denied:', error);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-gray-700 bg-[#09090b] p-4">
      {/* File previews */}
      {files.length > 0 && (
        <div className="mb-3 flex gap-2 flex-wrap">
          {files.map((file, idx) => (
            <div
              key={idx}
              className="inline-flex items-center gap-2 bg-[#131318] border border-gray-600 rounded-lg px-3 py-2"
            >
              <Paperclip size={14} className="text-gray-400" />
              <span className="text-xs text-gray-300">{file.name}</span>
              <button
                onClick={() => setFiles(files.filter((_, i) => i !== idx))}
                className="text-gray-500 hover:text-gray-300"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div className="flex gap-3 items-end">
        {/* Paperclip button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="text-gray-400 hover:text-[#FF8A4C] transition-colors disabled:opacity-50"
        >
          <Paperclip size={20} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={handleFileSelect}
          accept=".csv,.xlsx,.pdf,.txt,.jpg,.png"
        />

        {/* Mic button */}
        <button
          onClick={isRecording ? handleStopRecording : handleStartRecording}
          disabled={disabled}
          className={`transition-colors ${
            isRecording
              ? 'text-red-500 animate-pulse'
              : 'text-gray-400 hover:text-[#FF8A4C]'
          } disabled:opacity-50`}
        >
          <Mic size={20} />
        </button>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isRecording ? 'Recording...' : 'Ask about your workforce...'}
          disabled={disabled || isRecording}
          rows={1}
          className="flex-1 bg-[#131318] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#FF8A4C] focus:ring-1 focus:ring-[#FF8A4C] resize-none disabled:opacity-50"
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!message.trim() || isLoading || disabled}
          className="bg-gradient-to-r from-[#FF8A4C] to-[#e85d04] text-white rounded-lg px-4 py-2 hover:shadow-lg hover:shadow-[#FF8A4C]/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send size={18} />
        </button>
      </div>

      <p className="text-xs text-gray-500 mt-2">
        Tip: Press Shift+Enter for new line, Enter to send
      </p>
    </div>
  );
};

export default ChatInput;
