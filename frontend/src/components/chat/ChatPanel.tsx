import React, { useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import ChatMessageComponent from './ChatMessage';
import ChatInput from './ChatInput';
import { useChatStore } from '@/stores/chatStore';
import { streamChat, sendChat } from '@/lib/chatApi';
import { useLocation } from 'react-router-dom';

export const ChatPanel: React.FC = () => {
  const {
    messages,
    isOpen,
    isStreaming,
    conversationId,
    userId,
    currentPage,
    togglePanel,
    setStreaming,
    addMessage,
    appendToLastMessage,
    setCurrentPage,
  } = useChatStore();

  const location = useLocation();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Update current page when route changes
  useEffect(() => {
    const pageName = location.pathname.split('/')[1] || 'dashboard';
    setCurrentPage(pageName);
  }, [location, setCurrentPage]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Keyboard shortcut: Cmd+K / Ctrl+K to toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        togglePanel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePanel]);

  const handleSendMessage = async (messageText: string, files?: File[]) => {
    // Add user message
    addMessage({
      role: 'user',
      content: messageText,
      loading: false,
    });

    // Add placeholder for assistant
    addMessage({
      role: 'assistant',
      content: '',
      loading: true,
    });

    setStreaming(true);

    try {
      await streamChat(
        {
          message: messageText,
          user_id: userId,
          conversation_id: conversationId,
          current_page: currentPage,
        },
        (token) => {
          appendToLastMessage(token);
        },
        (fullResponse) => {
          console.log('Response complete:', fullResponse);
        },
        (error) => {
          console.error('Chat error:', error);
          appendToLastMessage(`\n\n[Error: ${error}]`);
        }
      );
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setStreaming(false);
    }
  };

  return (
    <>
      {/* Fire orb FAB trigger */}
      {!isOpen && (
        <button
          onClick={togglePanel}
          className="fixed bottom-6 right-6 z-40 w-16 h-16 rounded-full bg-gradient-to-br from-[#FF8A4C] to-[#a78bfa] shadow-2xl shadow-[#FF8A4C]/50 hover:shadow-[#FF8A4C]/75 transition-all transform hover:scale-110 flex items-center justify-center"
        >
          <div className="text-2xl">🔥</div>
        </button>
      )}

      {/* Chat sheet */}
      <Sheet open={isOpen} onOpenChange={togglePanel}>
        <SheetContent side="right" className="w-96 bg-[#09090b] border-l border-gray-700 p-0 flex flex-col">
          <SheetHeader className="border-b border-gray-700 px-6 py-4">
            <SheetTitle className="text-white flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#FF8A4C] to-[#a78bfa]" />
              Workforce IQ Brain
            </SheetTitle>
            <p className="text-xs text-gray-400 mt-1">Your HR analytics assistant</p>
          </SheetHeader>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">🧠</div>
                <h3 className="text-white font-semibold mb-2">Welcome to The Brain</h3>
                <p className="text-gray-400 text-sm">
                  Ask questions about headcount, turnover, career progression, managers, recognition—anything about your workforce.
                </p>
                <div className="mt-6 space-y-2">
                  <p className="text-gray-500 text-xs">Try asking:</p>
                  <button
                    onClick={() => handleSendMessage('What is our headcount by department?')}
                    className="block w-full text-left text-xs text-[#FF8A4C] hover:text-[#FFB088] transition-colors py-1"
                  >
                    → What is our headcount by department?
                  </button>
                  <button
                    onClick={() => handleSendMessage('Who is at flight risk?')}
                    className="block w-full text-left text-xs text-[#FF8A4C] hover:text-[#FFB088] transition-colors py-1"
                  >
                    → Who is at flight risk?
                  </button>
                  <button
                    onClick={() => handleSendMessage('Show promotion velocity trends')}
                    className="block w-full text-left text-xs text-[#FF8A4C] hover:text-[#FFB088] transition-colors py-1"
                  >
                    → Show promotion velocity trends
                  </button>
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <ChatMessageComponent key={msg.id} message={msg} isLoading={msg.loading} />
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input area */}
          <ChatInput
            onSend={handleSendMessage}
            isLoading={isStreaming}
            disabled={isStreaming}
          />
        </SheetContent>
      </Sheet>
    </>
  );
};

export default ChatPanel;
