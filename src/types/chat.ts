/**
 * Chat & Real-Time Messaging Types — aligned with backend `/api/v1/chat`
 * and Redis Pub/Sub WebSocket payloads (`modules/chat/schema.py`, `chat_service.py`).
 */

export type ChatMessageDeliveryStatus = 'sending' | 'sent' | 'read' | 'failed';

export interface ChatMessage {
  id: string;
  room_id: string;
  job_id?: string | null;
  sender_id: string;
  sender_name: string | null;
  sender_role: string | null;
  content: string;
  is_read: boolean;
  created_at: string;
  /** Client-only fields for optimistic rendering, deduplication, and retry */
  client_temp_id?: string;
  delivery_status?: ChatMessageDeliveryStatus;
  error_message?: string;
}

export interface ChatRoom {
  id: string;
  job_id: string;
  job_title: string;
  client_id: string;
  client_name: string | null;
  rpl_manager_id: string;
  rpl_manager_name: string | null;
  is_active: boolean;
  unread_count: number;
  last_message: ChatMessage | null;
  created_at: string;
}

export interface MarkMessagesReadResponse {
  status: string;
  marked_read: number;
}

export type ChatConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

export interface ChatWsNewMessageEvent {
  type: 'new_message';
  message: ChatMessage;
}

export interface ChatWsMessagesReadEvent {
  type: 'messages_read';
  room_id: string;
  job_id?: string;
  reader_id?: string;
}

export interface ChatWsTypingEvent {
  type: 'typing';
  room_id?: string;
  job_id: string;
  user_id: string;
  user_name?: string | null;
  is_typing: boolean;
}

export type ChatWsEvent =
  | ChatWsNewMessageEvent
  | ChatWsMessagesReadEvent
  | ChatWsTypingEvent;
