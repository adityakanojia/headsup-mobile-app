/**
 * Chat REST API Service — connects to `/api/v1/chat` endpoints.
 *
 * Uses the shared `apiFetch` client so Bearer token injection, 401 refresh,
 * and request timeouts behave identically across the app.
 */
import { apiFetch } from './apiClient';
import type {
  ChatMessage,
  ChatRoom,
  MarkMessagesReadResponse,
} from '@/types/chat';

export class ChatServiceError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code = 'CHAT_ERROR') {
    super(message);
    this.name = 'ChatServiceError';
    this.status = status;
    this.code = code;
  }
}

async function parseChatError(
  response: Response,
  fallbackMessage: string,
): Promise<ChatServiceError> {
  try {
    const body = await response.json();
    const message =
      body?.error?.message ||
      (typeof body?.detail === 'string' ? body.detail : null) ||
      body?.message ||
      fallbackMessage;
    const code =
      body?.error?.code ||
      (response.status === 403 ? 'FORBIDDEN' : 'CHAT_ERROR');
    return new ChatServiceError(String(message), response.status, String(code));
  } catch {
    return new ChatServiceError(fallbackMessage, response.status);
  }
}

/**
 * Normalize a raw message object from the backend into a typed `ChatMessage`.
 */
export function normalizeChatMessage(raw: ChatMessage): ChatMessage {
  return {
    id: String(raw.id),
    room_id: String(raw.room_id),
    job_id: raw.job_id ? String(raw.job_id) : null,
    sender_id: String(raw.sender_id),
    sender_name: raw.sender_name ?? null,
    sender_role: raw.sender_role ?? null,
    content: String(raw.content ?? ''),
    is_read: Boolean(raw.is_read),
    created_at: raw.created_at || new Date().toISOString(),
    delivery_status: raw.is_read ? 'read' : 'sent',
  };
}

/**
 * List all active chat rooms for the authenticated Client, RPL Manager, or Admin.
 * Endpoint: `GET /chat/rooms`
 */
export async function listChatRooms(): Promise<ChatRoom[]> {
  const response = await apiFetch('/chat/rooms');
  if (!response.ok) {
    throw await parseChatError(response, 'Failed to load conversations.');
  }
  const data = (await response.json()) as ChatRoom[];
  if (!Array.isArray(data)) {
    return [];
  }
  return data.map((room) => ({
    ...room,
    unread_count: Number(room.unread_count ?? 0),
    last_message: room.last_message
      ? normalizeChatMessage(room.last_message)
      : null,
  }));
}

/**
 * Fetch cursor-paginated message history for a job's chat room.
 * Endpoint: `GET /chat/rooms/{job_id}/messages?limit=50&before=<ISO-8601>`
 */
export async function getRoomMessages(
  jobId: string,
  options?: { limit?: number; before?: string },
): Promise<ChatMessage[]> {
  const params = new URLSearchParams();
  params.set('limit', String(options?.limit ?? 50));
  if (options?.before) {
    params.set('before', options.before);
  }

  const response = await apiFetch(
    `/chat/rooms/${encodeURIComponent(jobId)}/messages?${params.toString()}`,
  );

  if (!response.ok) {
    throw await parseChatError(response, 'Failed to load message history.');
  }

  const data = (await response.json()) as ChatMessage[];
  if (!Array.isArray(data)) {
    return [];
  }
  return data.map(normalizeChatMessage);
}

/**
 * Send a new message in a job's chat room.
 * Persists in PostgreSQL first, then broadcasts via Redis Pub/Sub -> WebSocket.
 * Endpoint: `POST /chat/rooms/{job_id}/messages`
 */
export async function sendChatMessage(
  jobId: string,
  content: string,
): Promise<ChatMessage> {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new ChatServiceError('Message cannot be empty.', 400, 'EMPTY_MESSAGE');
  }
  if (trimmed.length > 5000) {
    throw new ChatServiceError(
      'Message cannot exceed 5,000 characters.',
      400,
      'MESSAGE_TOO_LONG',
    );
  }

  const response = await apiFetch(
    `/chat/rooms/${encodeURIComponent(jobId)}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({ content: trimmed }),
    },
  );

  if (!response.ok) {
    throw await parseChatError(response, 'Failed to send message.');
  }

  const data = (await response.json()) as ChatMessage;
  return normalizeChatMessage(data);
}

/**
 * Mark unread messages from the other participant in a job's room as read.
 * Endpoint: `PATCH /chat/rooms/{job_id}/read`
 */
export async function markRoomMessagesRead(
  jobId: string,
): Promise<MarkMessagesReadResponse> {
  const response = await apiFetch(
    `/chat/rooms/${encodeURIComponent(jobId)}/read`,
    {
      method: 'PATCH',
    },
  );

  if (!response.ok) {
    throw await parseChatError(response, 'Failed to mark messages as read.');
  }

  return (await response.json()) as MarkMessagesReadResponse;
}

/**
 * Soft-delete a chat room (RPL Manager / Admin only).
 * Endpoint: `DELETE /chat/rooms/{job_id}`
 */
export async function deleteChatRoom(jobId: string): Promise<void> {
  const response = await apiFetch(`/chat/rooms/${encodeURIComponent(jobId)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw await parseChatError(response, 'Failed to delete conversation.');
  }
}
