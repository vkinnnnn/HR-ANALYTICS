import { create } from 'zustand';

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
  navigation?: { action: string; route: string; scroll_to?: string; highlight?: string } | null;
  timestamp: number;
  files?: { name: string; type: string }[];
}

interface ChatState {
  messages: ChatMessage[];
  conversationId: string;
  isOpen: boolean;
  isStreaming: boolean;
  suggestions: string[];
  navigationCommand: { route: string; section?: string } | null;
  userId: string;

  addMessage: (msg: ChatMessage) => void;
  setMessages: (msgs: ChatMessage[]) => void;
  clearMessages: () => void;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  setStreaming: (streaming: boolean) => void;
  setSuggestions: (suggestions: string[]) => void;
  setNavigation: (nav: { route: string; section?: string } | null) => void;
  setUserId: (id: string) => void;
  appendToLastAssistant: (token: string) => void;
}

function loadMessages(): ChatMessage[] {
  try {
    const saved = sessionStorage.getItem('wiq_brain_chat');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveMessages(messages: ChatMessage[]) {
  try {
    sessionStorage.setItem('wiq_brain_chat', JSON.stringify(messages.slice(-50)));
  } catch { /* ignore quota errors */ }
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: loadMessages(),
  conversationId: crypto.randomUUID(),
  isOpen: false,
  isStreaming: false,
  suggestions: [],
  navigationCommand: null,
  userId: 'anonymous',

  addMessage: (msg) => {
    const updated = [...get().messages, msg];
    saveMessages(updated);
    set({ messages: updated });
  },

  setMessages: (msgs) => {
    saveMessages(msgs);
    set({ messages: msgs });
  },

  clearMessages: () => {
    sessionStorage.removeItem('wiq_brain_chat');
    set({ messages: [], conversationId: crypto.randomUUID(), suggestions: [] });
  },

  togglePanel: () => set((s) => ({ isOpen: !s.isOpen })),
  openPanel: () => set({ isOpen: true }),
  closePanel: () => set({ isOpen: false }),
  setStreaming: (streaming) => set({ isStreaming: streaming }),
  setSuggestions: (suggestions) => set({ suggestions }),
  setNavigation: (nav) => set({ navigationCommand: nav }),
  setUserId: (id) => set({ userId: id }),

  appendToLastAssistant: (token) => {
    const msgs = get().messages;
    const last = msgs[msgs.length - 1];
    if (last && last.role === 'assistant') {
      const updated = [...msgs.slice(0, -1), { ...last, content: last.content + token }];
      set({ messages: updated });
    }
  },
}));
