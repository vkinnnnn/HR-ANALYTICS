import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  loading?: boolean;
}

export interface ChatState {
  messages: ChatMessage[];
  isOpen: boolean;
  isStreaming: boolean;
  conversationId: string;
  userId: string;
  currentPage: string;

  // Actions
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  updateLastMessage: (content: string) => void;
  appendToLastMessage: (token: string) => void;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  setStreaming: (streaming: boolean) => void;
  clearConversation: () => void;
  setCurrentPage: (page: string) => void;
  setUserId: (userId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isOpen: false,
  isStreaming: false,
  conversationId: `conv_${Date.now()}`,
  userId: 'default_user',
  currentPage: 'dashboard',

  addMessage: (message) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...message,
          id: `msg_${Date.now()}_${Math.random()}`,
          timestamp: Date.now(),
        },
      ],
    })),

  updateLastMessage: (content) =>
    set((state) => ({
      messages: state.messages.map((msg, idx) =>
        idx === state.messages.length - 1 ? { ...msg, content } : msg
      ),
    })),

  appendToLastMessage: (token) =>
    set((state) => ({
      messages: state.messages.map((msg, idx) =>
        idx === state.messages.length - 1
          ? { ...msg, content: msg.content + token }
          : msg
      ),
    })),

  togglePanel: () =>
    set((state) => ({
      isOpen: !state.isOpen,
    })),

  openPanel: () =>
    set({ isOpen: true }),

  closePanel: () =>
    set({ isOpen: false }),

  setStreaming: (streaming) =>
    set({ isStreaming: streaming }),

  clearConversation: () =>
    set({
      messages: [],
      conversationId: `conv_${Date.now()}`,
    }),

  setCurrentPage: (page) =>
    set({ currentPage: page }),

  setUserId: (userId) =>
    set({ userId }),
}));
