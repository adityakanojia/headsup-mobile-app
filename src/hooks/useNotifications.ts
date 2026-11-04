/**
 * React Query hooks and foreground banner store for HeadsUp notifications.
 */
import { create } from 'zustand';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/services/userService';
import type { AppNotification } from '@/types/notifications';

export const notificationKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationKeys.all, 'list'] as const,
  list: (limit = 50, unreadOnly = false) =>
    [...notificationKeys.lists(), { limit, unreadOnly }] as const,
  unreadCount: () => [...notificationKeys.all, 'unread-count'] as const,
};

// ── Foreground In-App Banner State (with Deduplication) ──────────────────

interface NotificationBannerState {
  activeBanner: AppNotification | null;
  queue: AppNotification[];
  seenIds: Record<string, boolean>;
  showBanner: (notification: AppNotification) => void;
  dismissBanner: () => void;
  resetBanners: () => void;
}

export const useNotificationBannerStore = create<NotificationBannerState>()(
  (set, get) => ({
    activeBanner: null,
    queue: [],
    seenIds: {},
    showBanner: (notification) => {
      const id = notification.id;
      if (!id || get().seenIds[id]) {
        return;
      }

      set((state) => {
        const nextSeen = { ...state.seenIds, [id]: true };
        if (!state.activeBanner) {
          return {
            activeBanner: notification,
            seenIds: nextSeen,
          };
        }
        return {
          queue: [...state.queue, notification],
          seenIds: nextSeen,
        };
      });
    },
    dismissBanner: () => {
      set((state) => {
        if (state.queue.length > 0) {
          const [next, ...rest] = state.queue;
          return {
            activeBanner: next,
            queue: rest,
          };
        }
        return {
          activeBanner: null,
        };
      });
    },
    resetBanners: () =>
      set({
        activeBanner: null,
        queue: [],
        seenIds: {},
      }),
  }),
);

// ── Queries & Mutations ──────────────────────────────────────────────────

export function useNotificationsList(options?: {
  limit?: number;
  unreadOnly?: boolean;
  enabled?: boolean;
}) {
  const limit = options?.limit ?? 50;
  const unreadOnly = options?.unreadOnly ?? false;
  const enabled = options?.enabled ?? true;

  return useQuery({
    queryKey: notificationKeys.list(limit, unreadOnly),
    queryFn: () => getNotifications({ limit, unreadOnly }),
    enabled,
    staleTime: 15_000,
  });
}

export function useUnreadNotificationCount(enabled = true) {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: async () => {
      const res = await getUnreadNotificationCount();
      return res.unread_count;
    },
    enabled,
    staleTime: 25_000,
    refetchInterval: 45_000,
    retry: false,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => markNotificationRead(notificationId),
    onMutate: async (notificationId: string) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.all });
      const nowIso = new Date().toISOString();

      queryClient.setQueriesData<AppNotification[]>(
        { queryKey: notificationKeys.lists() },
        (old) =>
          old
            ? old.map((item) =>
                item.id === notificationId && !item.read_at
                  ? { ...item, read_at: nowIso }
                  : item,
              )
            : old,
      );

      queryClient.setQueryData<number>(
        notificationKeys.unreadCount(),
        (old) => (typeof old === 'number' ? Math.max(0, old - 1) : old),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (unreadIds?: string[]) => {
      try {
        return await markAllNotificationsRead();
      } catch {
        // Fallback for older deployments: mark individual unread items read
        if (unreadIds && unreadIds.length > 0) {
          await Promise.allSettled(
            unreadIds.map((id) => markNotificationRead(id)),
          );
          return { marked_read: unreadIds.length };
        }
        return { marked_read: 0 };
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.all });
      const nowIso = new Date().toISOString();

      queryClient.setQueriesData<AppNotification[]>(
        { queryKey: notificationKeys.lists() },
        (old) =>
          old
            ? old.map((item) =>
                item.read_at ? item : { ...item, read_at: nowIso },
              )
            : old,
      );

      queryClient.setQueryData<number>(notificationKeys.unreadCount(), 0);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
