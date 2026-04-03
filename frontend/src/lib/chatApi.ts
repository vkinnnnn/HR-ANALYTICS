import api from './api';

const BASE = '/api/brain';

export interface BrainChatPayload {
  message: string;
  conversation_id?: string;
  user_id?: string;
  current_page?: string;
  conversation_history?: { role: string; content: string }[];
}

export interface StreamCallback {
  onToken: (token: string) => void;
  onDone: (meta: {
    suggestions?: string[] | null;
    navigation?: { action: string; route: string; scroll_to?: string } | null;
    chart_data?: Record<string, unknown> | null;
    analysis_type?: string | null;
  }) => void;
  onError: (error: string) => void;
}

export async function streamChat(
  payload: BrainChatPayload,
  callbacks: StreamCallback,
): Promise<void> {
  const baseURL = api.defaults.baseURL || '';

  try {
    const response = await fetch(`${baseURL}${BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      callbacks.onError(errText || `HTTP ${response.status}`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      callbacks.onError('No response stream');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;

        try {
          const data = JSON.parse(jsonStr);
          if (data.token) {
            callbacks.onToken(data.token);
          }
          if (data.done) {
            callbacks.onDone({
              suggestions: data.suggestions,
              navigation: data.navigation,
              chart_data: data.chart_data,
              analysis_type: data.analysis_type,
            });
          }
        } catch {
          /* skip malformed JSON lines */
        }
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Network error';
    callbacks.onError(msg);
  }
}

export async function chatSync(payload: BrainChatPayload) {
  const res = await api.post(`${BASE}/chat/sync`, payload);
  return res.data;
}

export async function uploadFile(file: File, userId = 'anonymous') {
  const form = new FormData();
  form.append('file', file);
  form.append('user_id', userId);
  const res = await api.post(`${BASE}/upload`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function getMemories(userId: string) {
  const res = await api.get(`${BASE}/memory/${userId}`);
  return res.data;
}

export async function clearMemories(userId: string) {
  const res = await api.delete(`${BASE}/memory/${userId}`);
  return res.data;
}

export async function brainHealth() {
  const res = await api.get(`${BASE}/health`);
  return res.data;
}
