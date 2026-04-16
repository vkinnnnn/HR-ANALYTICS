/**
 * Simple, reliable chat API client.
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
}

/**
 * Send chat message and get response (simple, no streaming).
 */
export async function streamChat(
  request: ChatRequest,
  onToken: (token: string) => void,
  onComplete: (response: string, suggestions?: string[]) => void,
  onError: (error: string) => void
): Promise<void> {
  try {
    console.log('Sending chat request:', request);

    const response = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    console.log('Chat response status:', response.status);

    if (!response.ok) {
      throw new Error(`Chat error: ${response.statusText}`);
    }

    const data: ChatResponse = await response.json();
    console.log('Chat data:', data);

    if (!data.response) {
      throw new Error('No response from server');
    }

    // Simulate streaming by breaking into chunks
    const text = data.response;
    const words = text.split(' ');

    for (const word of words) {
      onToken(word + ' ');
      await new Promise(resolve => setTimeout(resolve, 15));
    }

    onComplete(text, data.suggestions);
  } catch (error) {
    console.error('Chat error:', error);
    onError(error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Send chat message (non-streaming fallback).
 */
export async function sendChat(request: ChatRequest): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE}/chat`, {
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
