/**
 * Chat API client with SSE streaming support.
 * Handles real-time token-by-token response streaming from backend.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8119/api';

export interface ChatRequest {
  message: string;
  user_id: string;
  conversation_id?: string;
  current_page?: string;
}

export interface ChatResponse {
  response: string;
  suggestions?: string[];
  data?: Record<string, any>;
}

/**
 * Send chat message and stream response tokens via Server-Sent Events.
 * Calls onToken for each streamed chunk, onComplete when done.
 */
export async function streamChat(
  request: ChatRequest,
  onToken: (token: string) => void,
  onComplete: (response: string) => void,
  onError: (error: string) => void
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Chat error: ${response.statusText}`);
    }

    let fullText = '';
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE format: "data: {...}\n\n"
      const lines = buffer.split('\n');
      buffer = lines[lines.length - 1]; // Keep incomplete line

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.token) {
              onToken(data.token);
              fullText += data.token;
            }
            if (data.done) {
              onComplete(fullText);
              return;
            }
            if (data.error) {
              throw new Error(data.error);
            }
          } catch (parseError) {
            console.error('SSE parse error:', parseError);
          }
        }
      }
    }

    onComplete(fullText);
  } catch (error) {
    onError(error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Simple (non-streaming) chat request.
 */
export async function sendChat(request: ChatRequest): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE}/brain/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Chat error: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Check health of chat service.
 */
export async function checkChatHealth() {
  const response = await fetch(`${API_BASE}/brain/health`);
  if (!response.ok) throw new Error('Chat service unavailable');
  return response.json();
}

/**
 * Get user memories.
 */
export async function getUserMemories(userId: string) {
  const response = await fetch(`${API_BASE}/brain/memory/${userId}`);
  if (!response.ok) throw new Error('Failed to fetch memories');
  return response.json();
}
