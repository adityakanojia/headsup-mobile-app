/**
 * React Query + Real-Time WebSocket Hooks for HeadsUp Messaging.
 *
 * Coordinates:
 * - Inbox rooms list (`GET /chat/rooms`) and live unread counts
 * - Cursor-paginated room message history (`GET /chat/rooms/{jobId}/messages`)
 * - Optimistic sending, deduplication, failure states, and 1-tap retry (`POST /chat/rooms/{jobId}/messages`)
 * - Read-receipt synchronization (`PATCH /chat/rooms/{jobId}/read`)
 * - Redis Pub/Sub -> WebSocket event reconciliation and foreground recovery
 * - Per-conversation draft persistence and expiring typing indicators
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { create } from 'zustand';
import {
  ChatServiceError,
  deleteChatRoom,
  getRoomMessages,
  listChatRooms,
  markRoomMessagesRead,
  sendChatMessage,
} from '@/services/chatService';
import { chatSocketManager } from '@/services/chatSocketManager';
import { useStore } from '@/store/useStore';
import { useNotificationBannerStore } from './useNotifications';
import type {
  ChatConnectionState,
  ChatMessage,
  ChatRoom,
  ChatWsEvent,
} from '@/types/chat';

const PAGE_SIZE = 50;
const TYPING_EXPIRY_MS = 4_000;

/**
 * Tracks message IDs that have already incremented unread counts in this session
 * to guarantee an incoming message never increments unread count twice.
 */
const countedUnreadMessageIds = new Set<string>();

export const chatKeys = {
  all: ['chat'] as const,
  rooms: () => [...chatKeys.all, 'rooms'] as const,
  messages: (jobId: string) => [...chatKeys.all, 'messages', jobId] as const,
};

export function canRoleAccessChat(role?: string | null): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase();
  return (
    normalized === 'client' ||
    normalized === 'admin' ||
    normalized === 'rpl_manager'
  );
}

interface TypingEntry {
  userId: string;
  userName: string | null;
  expiresAt: number;
}

interface ChatUiStoreState {
  activeJobId: string | null;
  connectionState: ChatConnectionState;
  draftsByJobId: Record<string, string>;
  typingByJobId: Record<string, TypingEntry | undefined>;
  setActiveJobId: (jobId: string | null) => void;
  setConnectionState: (state: ChatConnectionState) => void;
  setDraft: (jobId: string, text: string) => void;
  setTyping: (jobId: string, entry: TypingEntry | undefined) => void;
  resetChatUi: () => void;
}

export const useChatUiStore = create<ChatUiStoreState>((set) => ({
  activeJobId: null,
  connectionState: chatSocketManager.getState(),
  draftsByJobId: {},
  typingByJobId: {},
  setActiveJobId: (activeJobId) => set({ activeJobId }),
  setConnectionState: (connectionState) => set({ connectionState }),
  setDraft: (jobId, text) =>
    set((state) => ({
      draftsByJobId: {
        ...state.draftsByJobId,
        [jobId]: text,
      },
    })),
  setTyping: (jobId, entry) =>
    set((state) => ({
      typingByJobId: {
        ...state.typingByJobId,
        [jobId]: entry,
      },
    })),
  resetChatUi: () => {
    countedUnreadMessageIds.clear();
    set({
      activeJobId: null,
      connectionState: 'idle',
      draftsByJobId: {},
      typingByJobId: {},
    });
  },
}));

/**
 * Sort rooms descending by latest message timestamp (falling back to room creation time).
 */
export function sortChatRooms(rooms: ChatRoom[]): ChatRoom[] {
  return [...rooms].sort((a, b) => {
    const aTime = new Date(
      a.last_message?.created_at || a.created_at || 0,
    ).getTime();
    const bTime = new Date(
      b.last_message?.created_at || b.created_at || 0,
    ).getTime();
    return bTime - aTime;
  });
}

/**
 * Merge messages chronologically (`oldest -> newest`) while deduplicating by
 * server `id` and reconciling optimistic messages by `client_temp_id`.
 */
export function mergeChatMessages(
  existing: ChatMessage[],
  incoming: ChatMessage[],
): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();

  for (const item of existing) {
    const key = item.client_temp_id && item.id.startsWith('temp-')
      ? item.client_temp_id
      : item.id;
    byId.set(key, item);
  }

  for (const msg of incoming) {
    // If this incoming message reconciles an optimistic temp message, replace it
    if (msg.client_temp_id && byId.has(msg.client_temp_id)) {
      byId.delete(msg.client_temp_id);
    } else {
      // Also check if an existing optimistic message from the same sender has identical content
      for (const [key, prev] of byId.entries()) {
        if (
          prev.id.startsWith('temp-') &&
          prev.delivery_status !== 'failed' &&
          prev.sender_id === msg.sender_id &&
          prev.content === msg.content &&
          Math.abs(
            new Date(prev.created_at).getTime() -
              new Date(msg.created_at).getTime(),
          ) < 30_000
        ) {
          byId.delete(key);
          break;
        }
      }
    }

    const prevExisting = byId.get(msg.id);
    byId.set(msg.id, {
      ...prevExisting,
      ...msg,
      delivery_status:
        msg.delivery_status ?? (msg.is_read ? 'read' : 'sent'),
    });
  }

  return Array.from(byId.values()).sort((a, b) => {
    const aTime = new Date(a.created_at).getTime();
    const bTime = new Date(b.created_at).getTime();
    if (aTime !== bTime) return aTime - bTime;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Resolve the job_id for an incoming message using either `message.job_id` or
 * the cached `chatKeys.rooms()` list.
 */
function resolveMessageJobId(
  queryClient: QueryClient,
  message: ChatMessage,
): string | null {
  if (message.job_id) return message.job_id;
  const rooms = queryClient.getQueryData<ChatRoom[]>(chatKeys.rooms());
  const matched = rooms?.find((r) => r.id === message.room_id);
  return matched?.job_id ?? null;
}

/**
 * Update the cached inbox rooms list when a message is sent or received.
 */
function applyMessageToRoomsCache(
  queryClient: QueryClient,
  message: ChatMessage,
  options: {
    jobId: string;
    incrementUnread: boolean;
    resetUnread?: boolean;
  },
): boolean {
  const rooms = queryClient.getQueryData<ChatRoom[]>(chatKeys.rooms());
  if (!rooms) return false;

  let foundRoom = false;
  const updated = rooms.map((room) => {
    if (room.job_id !== options.jobId && room.id !== message.room_id) {
      return room;
    }
    foundRoom = true;
    const nextUnread = options.resetUnread
      ? 0
      : options.incrementUnread
        ? room.unread_count + 1
        : room.unread_count;

    return {
      ...room,
      unread_count: nextUnread,
      last_message: message,
    };
  });

  if (foundRoom) {
    queryClient.setQueryData<ChatRoom[]>(
      chatKeys.rooms(),
      sortChatRooms(updated),
    );
  }

  return foundRoom;
}

/**
 * Root-level real-time chat synchronization hook.
 * Mount once in `src/app/_layout.tsx` to manage the WebSocket lifecycle and
 * keep inbox/thread caches synchronized with Redis Pub/Sub events.
 */
export function useChatRealtimeSync(): void {
  const queryClient = useQueryClient();
  const { isAuthenticated, isRestoringSession, user, role } = useStore();
  const typingTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );

  const eligible =
    !isRestoringSession &&
    isAuthenticated &&
    Boolean(user?.id) &&
    user?.onboarding_status === 'ACTIVE' &&
    canRoleAccessChat(role);

  useEffect(() => {
    const unsubState = chatSocketManager.subscribeConnectionState((state) => {
      useChatUiStore.getState().setConnectionState(state);
    });
    return unsubState;
  }, []);

  useEffect(() => {
    const timers = typingTimersRef.current;
    if (!eligible || !user?.id) {
      chatSocketManager.disconnect();
      return;
    }

    const currentUserId = user.id;
    void chatSocketManager.connect(currentUserId);

    const unsubEvents = chatSocketManager.subscribeEvents(
      (event: ChatWsEvent) => {
        if (event.type === 'new_message') {
          const incoming = event.message;
          const jobId = resolveMessageJobId(queryClient, incoming);
          const activeJobId = useChatUiStore.getState().activeJobId;
          const isFromOther = incoming.sender_id !== currentUserId;
          const isViewingThisRoom = Boolean(jobId && activeJobId === jobId);

          // Clear any active typing indicator for this room when message arrives
          if (jobId) {
            useChatUiStore.getState().setTyping(jobId, undefined);
          }

          if (jobId) {
            // 1. Append/merge into the conversation's message cache if loaded
            const existingMsgs = queryClient.getQueryData<ChatMessage[]>(
              chatKeys.messages(jobId),
            );
            if (existingMsgs) {
              queryClient.setQueryData<ChatMessage[]>(
                chatKeys.messages(jobId),
                mergeChatMessages(existingMsgs, [incoming]),
              );
            }

            // 2. Determine whether this message should increment unread count
            let shouldIncrementUnread = false;
            if (
              isFromOther &&
              !isViewingThisRoom &&
              !countedUnreadMessageIds.has(incoming.id)
            ) {
              countedUnreadMessageIds.add(incoming.id);
              shouldIncrementUnread = true;
            }

            const roomUpdated = applyMessageToRoomsCache(
              queryClient,
              incoming,
              {
                jobId,
                incrementUnread: shouldIncrementUnread,
                resetUnread: isViewingThisRoom,
              },
            );

            if (!roomUpdated) {
              queryClient.invalidateQueries({ queryKey: chatKeys.rooms() });
            }

            // 3. If the user is actively viewing this conversation, mark it read on backend
            if (isFromOther && isViewingThisRoom) {
              markRoomMessagesRead(jobId).catch(() => null);
            } else if (isFromOther && shouldIncrementUnread) {
              // 4. Show in-app notification banner when not inside this chat thread
              const rooms = queryClient.getQueryData<ChatRoom[]>(
                chatKeys.rooms(),
              );
              const room = rooms?.find((r) => r.job_id === jobId);
              const senderLabel =
                incoming.sender_name ||
                room?.rpl_manager_name ||
                room?.client_name ||
                'Project Chat';
              const title = room?.job_title
                ? `${senderLabel} · ${room.job_title}`
                : senderLabel;

              useNotificationBannerStore.getState().showBanner({
                id: `chat-msg-${incoming.id}`,
                notification_type: 'CHAT_MESSAGE',
                title,
                body: incoming.content,
                data: {
                  event_type: 'CHAT_MESSAGE',
                  entity_type: 'chat',
                  job_id: jobId,
                  room_id: incoming.room_id,
                },
                read_at: null,
                created_at: incoming.created_at,
              });
            }
          } else {
            // Room not yet in local cache — refresh rooms list
            queryClient.invalidateQueries({ queryKey: chatKeys.rooms() });
          }
          return;
        }

        if (event.type === 'messages_read') {
          const targetJobId =
            event.job_id ||
            queryClient
              .getQueryData<ChatRoom[]>(chatKeys.rooms())
              ?.find((r) => r.id === event.room_id)?.job_id;

          if (targetJobId) {
            queryClient.setQueryData<ChatMessage[]>(
              chatKeys.messages(targetJobId),
              (prev) =>
                prev
                  ? prev.map((m) =>
                      m.sender_id === currentUserId
                        ? { ...m, is_read: true, delivery_status: 'read' }
                        : m,
                    )
                  : prev,
            );
          }
          return;
        }

        if (event.type === 'typing') {
          if (event.user_id === currentUserId) return;
          const { job_id: jobId, is_typing: isTyping } = event;

          if (timers[jobId]) {
            clearTimeout(timers[jobId]);
            delete timers[jobId];
          }

          if (!isTyping) {
            useChatUiStore.getState().setTyping(jobId, undefined);
            return;
          }

          useChatUiStore.getState().setTyping(jobId, {
            userId: event.user_id,
            userName: event.user_name ?? null,
            expiresAt: Date.now() + TYPING_EXPIRY_MS,
          });

          timers[jobId] = setTimeout(() => {
            useChatUiStore.getState().setTyping(jobId, undefined);
            delete timers[jobId];
          }, TYPING_EXPIRY_MS);
        }
      },
    );

    const unsubSync = chatSocketManager.subscribeReconnectSync(() => {
      // Reconcile inbox and active thread with PostgreSQL source of truth
      queryClient.invalidateQueries({ queryKey: chatKeys.rooms() });
      const activeJobId = useChatUiStore.getState().activeJobId;
      if (activeJobId) {
        queryClient.invalidateQueries({
          queryKey: chatKeys.messages(activeJobId),
        });
      }
    });

    return () => {
      unsubEvents();
      unsubSync();
      Object.values(timers).forEach(clearTimeout);
    };
  }, [eligible, user?.id, queryClient]);
}

/**
 * Fetch the authenticated user's chat rooms (`GET /chat/rooms`).
 */
export function useChatRooms(enabled = true) {
  const { isAuthenticated, role } = useStore();
  const canAccess = isAuthenticated && canRoleAccessChat(role) && enabled;

  return useQuery<ChatRoom[], ChatServiceError>({
    queryKey: chatKeys.rooms(),
    queryFn: async () => {
      const rooms = await listChatRooms();
      return sortChatRooms(rooms);
    },
    enabled: canAccess,
    staleTime: 15_000,
    retry: (failureCount, err) => {
      if (
        err instanceof ChatServiceError &&
        (err.status === 400 ||
          err.status === 403 ||
          err.status === 404 ||
          err.status === 429)
      ) {
        return false;
      }
      return failureCount < 1;
    },
  });
}

/**
 * Compute total unread messages across all active chat rooms.
 */
export function useUnreadChatCount(enabled = true): number {
  const { data: rooms } = useChatRooms(enabled);
  return useMemo(() => {
    if (!rooms) return 0;
    return rooms.reduce((sum, room) => sum + Math.max(0, room.unread_count), 0);
  }, [rooms]);
}

/**
 * Complete hook for an individual conversation thread (`/messages/[jobId]`).
 * Handles history loading, cursor pagination (`before`), read receipts,
 * optimistic sending, failure recovery, and retry without duplicate messages.
 */
export function useChatThread(jobId: string | undefined) {
  const queryClient = useQueryClient();
  const { user, role, isAuthenticated } = useStore();
  const validJobId = typeof jobId === 'string' && jobId.trim().length > 0 ? jobId.trim() : '';

  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState<string | null>(null);
  const markingReadRef = useRef(false);
  const lastMarkedReadKeyRef = useRef<string | null>(null);

  const canAccess =
    isAuthenticated && Boolean(validJobId) && canRoleAccessChat(role);

  const messagesQuery = useQuery<ChatMessage[], ChatServiceError>({
    queryKey: chatKeys.messages(validJobId),
    queryFn: async () => {
      const fetched = await getRoomMessages(validJobId, { limit: PAGE_SIZE });
      setHasMoreOlder(fetched.length >= PAGE_SIZE);

      // Preserve any existing failed/sending optimistic messages in cache
      const existing =
        queryClient.getQueryData<ChatMessage[]>(
          chatKeys.messages(validJobId),
        ) ?? [];
      const pendingLocal = existing.filter(
        (m) =>
          m.id.startsWith('temp-') &&
          (m.delivery_status === 'sending' || m.delivery_status === 'failed'),
      );

      return mergeChatMessages(pendingLocal, fetched);
    },
    enabled: canAccess,
    staleTime: 5_000,
    refetchInterval: canAccess ? 6_000 : false,
    retry: (failureCount, err) => {
      // Do not retry 400 (RPL_MANAGER_NOT_ASSIGNED), 403 (FORBIDDEN), 404, or 429 (RATE_LIMITED)
      if (
        err instanceof ChatServiceError &&
        (err.status === 400 ||
          err.status === 403 ||
          err.status === 404 ||
          err.status === 429)
      ) {
        return false;
      }
      return failureCount < 1;
    },
  });

  // Register this room as active while mounted and mark incoming unread messages as read
  useEffect(() => {
    if (!validJobId || !canAccess) return;
    useChatUiStore.getState().setActiveJobId(validJobId);

    return () => {
      if (useChatUiStore.getState().activeJobId === validJobId) {
        useChatUiStore.getState().setActiveJobId(null);
      }
    };
  }, [validJobId, canAccess]);

  // Synchronize read state when messages load or new unread messages arrive
  const messages = useMemo(
    () => messagesQuery.data ?? [],
    [messagesQuery.data],
  );

  useEffect(() => {
    if (!validJobId || !user?.id || messages.length === 0) return;

    const unreadFromOther = messages.filter(
      (m) =>
        !m.id.startsWith('temp-') &&
        m.sender_id !== user.id &&
        !m.is_read,
    );

    const rooms = queryClient.getQueryData<ChatRoom[]>(chatKeys.rooms());
    const roomUnreadCount =
      rooms?.find((r) => r.job_id === validJobId)?.unread_count ?? 0;

    if (unreadFromOther.length === 0 && roomUnreadCount === 0) {
      return;
    }

    // Optimistically clear unread badge in rooms cache
    if (rooms && roomUnreadCount > 0) {
      queryClient.setQueryData<ChatRoom[]>(
        chatKeys.rooms(),
        rooms.map((r) =>
          r.job_id === validJobId ? { ...r, unread_count: 0 } : r,
        ),
      );
    }

    const latestUnreadId =
      unreadFromOther.length > 0
        ? unreadFromOther[unreadFromOther.length - 1].id
        : 'room-unread';
    const markKey = `${validJobId}:${latestUnreadId}`;

    if (markingReadRef.current || lastMarkedReadKeyRef.current === markKey) {
      return;
    }
    markingReadRef.current = true;
    lastMarkedReadKeyRef.current = markKey;

    markRoomMessagesRead(validJobId)
      .then(() => {
        queryClient.setQueryData<ChatMessage[]>(
          chatKeys.messages(validJobId),
          (prev) =>
            prev
              ? prev.map((m) =>
                  m.sender_id !== user.id ? { ...m, is_read: true } : m,
                )
              : prev,
        );
      })
      .catch(() => null)
      .finally(() => {
        markingReadRef.current = false;
      });
  }, [validJobId, user?.id, messages, queryClient]);

  // Cursor pagination for older messages (`before` oldest persisted message timestamp)
  const isInitialMessagesLoading = messagesQuery.isLoading;
  const loadOlderMessages = useCallback(async () => {
    if (
      !validJobId ||
      isLoadingOlder ||
      !hasMoreOlder ||
      isInitialMessagesLoading
    ) {
      return;
    }

    const current =
      queryClient.getQueryData<ChatMessage[]>(chatKeys.messages(validJobId)) ??
      [];
    const oldestPersisted = current.find((m) => !m.id.startsWith('temp-'));
    if (!oldestPersisted?.created_at) {
      setHasMoreOlder(false);
      return;
    }

    setIsLoadingOlder(true);
    setOlderError(null);

    try {
      const older = await getRoomMessages(validJobId, {
        limit: PAGE_SIZE,
        before: oldestPersisted.created_at,
      });

      if (older.length < PAGE_SIZE) {
        setHasMoreOlder(false);
      }

      if (older.length > 0) {
        queryClient.setQueryData<ChatMessage[]>(
          chatKeys.messages(validJobId),
          (prev) => mergeChatMessages(older, prev ?? []),
        );
      }
    } catch (err) {
      setOlderError(
        err instanceof Error
          ? err.message
          : 'Could not load earlier messages.',
      );
    } finally {
      setIsLoadingOlder(false);
    }
  }, [
    validJobId,
    isLoadingOlder,
    hasMoreOlder,
    isInitialMessagesLoading,
    queryClient,
    setHasMoreOlder,
    setIsLoadingOlder,
    setOlderError,
  ]);

  // Send or retry a message with optimistic state
  const performSend = useCallback(
    async (
      content: string,
      existingTempId?: string,
    ): Promise<ChatMessage | null> => {
      if (!validJobId || !user) {
        return null;
      }

      const trimmed = content.trim();
      const tempId =
        existingTempId ||
        `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const optimisticMessage: ChatMessage = {
        id: tempId,
        client_temp_id: tempId,
        room_id: `room-${validJobId}`,
        job_id: validJobId,
        sender_id: user.id,
        sender_name: user.name ?? 'You',
        sender_role: role?.toUpperCase() ?? null,
        content: trimmed,
        is_read: false,
        created_at: new Date().toISOString(),
        delivery_status: 'sending',
        error_message: undefined,
      };

      queryClient.setQueryData<ChatMessage[]>(
        chatKeys.messages(validJobId),
        (prev) => mergeChatMessages(prev ?? [], [optimisticMessage]),
      );

      try {
        const confirmed = await sendChatMessage(validJobId, trimmed);
        const reconciled: ChatMessage = {
          ...confirmed,
          job_id: confirmed.job_id || validJobId,
          client_temp_id: tempId,
          delivery_status: confirmed.is_read ? 'read' : 'sent',
        };

        queryClient.setQueryData<ChatMessage[]>(
          chatKeys.messages(validJobId),
          (prev) => mergeChatMessages(prev ?? [], [reconciled]),
        );

        const roomUpdated = applyMessageToRoomsCache(queryClient, reconciled, {
          jobId: validJobId,
          incrementUnread: false,
          resetUnread: true,
        });

        if (!roomUpdated) {
          queryClient.invalidateQueries({ queryKey: chatKeys.rooms() });
        }

        return reconciled;
      } catch (err) {
        const errMsg =
          err instanceof Error
            ? err.message
            : 'Message failed to send. Tap to retry.';

        queryClient.setQueryData<ChatMessage[]>(
          chatKeys.messages(validJobId),
          (prev) =>
            (prev ?? []).map((m) =>
              m.client_temp_id === tempId || m.id === tempId
                ? {
                    ...m,
                    delivery_status: 'failed',
                    error_message: errMsg,
                  }
                : m,
            ),
        );
        return null;
      }
    },
    [validJobId, user, role, queryClient],
  );

  const sendMessage = useCallback(
    async (content: string) => {
      return performSend(content);
    },
    [performSend],
  );

  const retryMessage = useCallback(
    async (clientTempId: string) => {
      const current =
        queryClient.getQueryData<ChatMessage[]>(
          chatKeys.messages(validJobId),
        ) ?? [];
      const target = current.find(
        (m) => m.client_temp_id === clientTempId || m.id === clientTempId,
      );
      if (!target) return;
      await performSend(target.content, clientTempId);
    },
    [validJobId, queryClient, performSend],
  );

  const discardFailedMessage = useCallback(
    (clientTempId: string) => {
      queryClient.setQueryData<ChatMessage[]>(
        chatKeys.messages(validJobId),
        (prev) =>
          (prev ?? []).filter(
            (m) => m.client_temp_id !== clientTempId && m.id !== clientTempId,
          ),
      );
    },
    [validJobId, queryClient],
  );

  return {
    messages,
    isLoading: messagesQuery.isLoading,
    isError: messagesQuery.isError,
    error: messagesQuery.error,
    isRefetching: messagesQuery.isRefetching,
    refetch: messagesQuery.refetch,
    hasMoreOlder,
    isLoadingOlder,
    olderError,
    loadOlderMessages,
    sendMessage,
    retryMessage,
    discardFailedMessage,
  };
}

/**
 * Mutation hook to soft-delete a chat room (`RPL_MANAGER` / `ADMIN` only).
 */
export function useDeleteChatRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jobId: string) => deleteChatRoom(jobId),
    onSuccess: (_data, jobId) => {
      queryClient.setQueryData<ChatRoom[]>(chatKeys.rooms(), (prev) =>
        prev ? prev.filter((r) => r.job_id !== jobId) : prev,
      );
      queryClient.removeQueries({ queryKey: chatKeys.messages(jobId) });
    },
  });
}
