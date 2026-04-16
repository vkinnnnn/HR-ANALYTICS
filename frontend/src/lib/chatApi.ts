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
 * Send chat message and stream response tokens.
 * Uses the non-streaming endpoint and simulates streaming by character.
 */
export async function streamChat(
  request: ChatRequest,
  onToken: (token: string) => void,
  onComplete: (response: string) => void,
  onError: (error: string) => void
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/brain/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Chat error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    // Simulate streaming by breaking response into chunks
    const fullText = data.response || '';

    // Stream by words (faster, more readable)
    const words = fullText.split(' ');
    for (const word of words) {
      onToken(word + ' ');
      // Small delay between words for visual effect
      await new Promise(resolve => setTimeout(resolve, 20));
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
