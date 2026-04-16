/**
 * Brain API client — SSE streaming for LangGraph agent
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8119';

export interface BrainResponse {
  route_used?: string;
  hallucination_score?: number;
  hallucination_flag?: boolean;
  was_refused?: boolean;
  navigation?: string;
  suggestions?: string[];
  time_taken?: number;
}

export async function streamChat(
  message: string,
  sessionId: string,
  currentPage: string,
  onToken: (text: string) => void,
  onDone: (metadata: BrainResponse) => void,
  onError: (err: string) => void,
): Promise<void> {
  const formData = new FormData();
  formData.append('message', message);
  formData.append('session_id', sessionId);
  formData.append('current_page', currentPage);
  formData.append('user_id', 'frontend-user');

  try {
    const response = await fetch(`${API_BASE}/api/brain/chat`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      onError(`HTTP ${response.status}`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onError('No response body');
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
        if (line.startsWith('event: token')) continue;
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.text) onToken(data.text);
          } catch (e) {
            // Ignore parse errors
          }
        } else if (line.startsWith('event: done')) continue;
      }
    }

    // Parse final metadata from last line
    if (buffer && buffer.startsWith('data: ')) {
      try {
        const metadata = JSON.parse(buffer.slice(6));
        onDone(metadata);
      } catch (e) {
        onError(`Parse error: ${e}`);
      }
    }
  } catch (err) {
    onError(err instanceof Error ? err.message : String(err));
  }
}

export async function syncChat(
  message: string,
  sessionId: string,
  currentPage: string,
): Promise<BrainResponse & { answer: string }> {
  const formData = new FormData();
  formData.append('message', message);
  formData.append('session_id', sessionId);
  formData.append('current_page', currentPage);

  const response = await fetch(`${API_BASE}/api/brain/chat/sync`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function clearSession(sessionId: string): Promise<void> {
  await fetch(`${API_BASE}/api/brain/session/clear`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId }),
  });
}
