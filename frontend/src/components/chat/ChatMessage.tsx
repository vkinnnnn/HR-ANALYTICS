import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, Download, Volume2 } from 'lucide-react';
import type { ChatMessage } from '@/stores/chatStore';

interface ChatMessageProps {
  message: ChatMessage;
  isLoading?: boolean;
}

export const ChatMessageComponent: React.FC<ChatMessageProps> = ({
  message,
  isLoading = false,
}) => {
  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
  };

  const handleSpeak = () => {
    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(message.content);
    speechSynthesis.speak(utterance);
  };

  const handleDownloadPDF = () => {
    // Placeholder: would integrate jsPDF here
    console.log('Download PDF:', message.content);
  };

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-xs bg-gradient-to-br from-[#FF8A4C] to-[#e85d04] text-white rounded-2xl px-4 py-3 shadow-md">
          <p className="text-sm break-words">{message.content}</p>
          <span className="text-xs opacity-70 mt-1 block">
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
        </div>
      </div>
    );
  }

  // Route badge emoji mapping
  const routeBadges: Record<string, string> = {
    pandas_query: '📊 Analytical',
    semantic_search: '🔍 Search',
    profile_and_replace: '👤 Profile',
    llm_synthesis: '💡 Insight',
    chart_generator: '📈 Chart',
    graph_query: '🕸️ Graph',
    dashboard_navigate: '🗺️ Navigate',
    run_pipeline: '⚙️ Pipeline',
    process_file: '📄 File',
  };

  const routeLabel = message.routeUsed ? (routeBadges[message.routeUsed] || message.routeUsed) : null;

  return (
    <div className="flex gap-3 mb-4">
      {/* Fire orb avatar */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF8A4C] to-[#a78bfa] flex-shrink-0 flex items-center justify-center">
        <div className="w-4 h-4 rounded-full bg-white/30 animate-pulse" />
      </div>

      <div className="flex-1 max-w-md">
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-3 bg-gray-700 rounded-full w-3/4 animate-pulse" />
            <div className="h-3 bg-gray-700 rounded-full w-full animate-pulse" />
            <div className="h-3 bg-gray-700 rounded-full w-2/3 animate-pulse" />
          </div>
        ) : (
          <>
            {/* Route badge */}
            {routeLabel && (
              <div className="mb-2">
                <span className="inline-block text-xs bg-[#FF8A4C]/10 border border-[#FF8A4C]/25 text-[#FFB088] px-2 py-1 rounded-full">
                  {routeLabel}
                </span>
              </div>
            )}

            {/* Hallucination warning */}
            {message.hallucinationFlag && message.hallucinationScore && message.hallucinationScore >= 0.4 && message.hallucinationScore < 0.6 && (
              <div className="mb-2 p-2 bg-[#fbbf24]/10 border border-[#fbbf24]/25 rounded-md text-xs text-[#fbbf24]">
                ⚠️ This response has low confidence. Verify the facts before acting on them.
              </div>
            )}

            <div className="bg-[#131318] border border-gray-600 rounded-lg px-4 py-3 mb-2">
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 text-gray-400 text-xs">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 hover:text-[#FF8A4C] transition-colors"
              >
                <Copy size={14} />
                Copy
              </button>
              <button
                onClick={handleSpeak}
                className="flex items-center gap-1 hover:text-[#FF8A4C] transition-colors"
              >
                <Volume2 size={14} />
                Speak
              </button>
              <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-1 hover:text-[#FF8A4C] transition-colors"
              >
                <Download size={14} />
                PDF
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ChatMessageComponent;
