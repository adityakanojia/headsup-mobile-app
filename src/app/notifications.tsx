/**
 * Notification Inbox Screen — Persisted backend notifications across all roles.
 *
 * Features:
 * - Filter between All and Unread notifications
 * - Mark single notification as read on tap + navigate to destination
 * - Mark all notifications as read
 * - Non-intrusive push permission enablement card when permission is not granted
 * - Pull-to-refresh, loading skeletons, error retry, and empty states
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Linking,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { BellRing, CheckCheck } from 'lucide-react-native';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { StackHeader } from '@/components/Header';
import { Card } from '@/components/Card';
import { Skeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { NotificationCard } from '@/components/notifications';
import {
  useNotificationsList,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/hooks/useNotifications';
import {
  getNotificationPermissionStatus,
  navigateFromNotification,
  registerDevicePushTokenForUser,
} from '@/services/pushNotificationService';
import { useStore } from '@/store/useStore';
import { colors, typography, spacing, borderRadius } from '@/theme';
import type { AppNotification } from '@/types/notifications';

type FilterTab = 'ALL' | 'UNREAD';

export default function NotificationsScreen() {
  const router = useRouter();
  const { user, role, isAuthenticated } = useStore();
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [permissionStatus, setPermissionStatus] = useState<string>('granted');

  const {
    data: notifications = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useNotificationsList({
    limit: 50,
    unreadOnly: false,
    enabled: isAuthenticated,
  });

  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();

  useEffect(() => {
    let mounted = true;
    getNotificationPermissionStatus().then((status) => {
      if (mounted) {
        setPermissionStatus(status);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const unreadItems = useMemo(
    () => notifications.filter((item) => !item.read_at),
    [notifications],
  );
  const unreadCount = unreadItems.length;

  const filteredNotifications = useMemo(() => {
    if (activeTab === 'UNREAD') {
      return unreadItems;
    }
    return notifications;
  }, [activeTab, notifications, unreadItems]);

  const handlePressNotification = useCallback(
    (item: AppNotification) => {
      if (!item.read_at) {
        markReadMutation.mutate(item.id);
      }
      navigateFromNotification(router, item, role);
    },
    [markReadMutation, router, role],
  );

  const handleMarkAllRead = useCallback(() => {
    if (unreadCount === 0 || markAllReadMutation.isPending) return;
    markAllReadMutation.mutate(unreadItems.map((item) => item.id));
  }, [unreadCount, unreadItems, markAllReadMutation]);

  const userId = user?.id;

  const handleEnablePushAlerts = useCallback(async () => {
    if (!userId) return;
    const token = await registerDevicePushTokenForUser(userId, {
      forcePrompt: true,
    });
    const nextStatus = await getNotificationPermissionStatus();
    setPermissionStatus(nextStatus);
    if (!token && nextStatus === 'denied' && Platform.OS !== 'web') {
      Linking.openSettings().catch(() => null);
    }
  }, [userId]);

  const renderPermissionBanner = () => {
    if (
      Platform.OS === 'web' ||
      permissionStatus === 'granted' ||
      permissionStatus === 'unavailable'
    ) {
      return null;
    }

    return (
      <Card style={styles.permissionCard} padding="md">
        <View style={styles.permissionRow}>
          <View style={styles.permissionIconBox}>
            <BellRing size={20} color={colors.primaryDark} />
          </View>
          <View style={styles.permissionContent}>
            <Text style={styles.permissionTitle}>
              Stay updated on your projects
            </Text>
            <Text style={styles.permissionSubtitle}>
              Enable push notifications for instant alerts when jobs are reviewed,
              applications are decided, or workers are assigned.
            </Text>
          </View>
        </View>
        <Pressable
          onPress={handleEnablePushAlerts}
          accessibilityRole="button"
          accessibilityLabel="Enable push alerts"
          style={({ pressed }) => [
            styles.enableButton,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.enableButtonText}>
            {permissionStatus === 'denied' ? 'Open Settings' : 'Enable Alerts'}
          </Text>
        </Pressable>
      </Card>
    );
  };

  const renderEmpty = () => {
    if (isLoading) return null;
    if (isError) {
      return (
        <ErrorState
          message="Could not load notifications. Please check your connection and try again."
          onRetry={refetch}
        />
      );
    }
    return (
      <EmptyState
        title={
          activeTab === 'UNREAD'
            ? "You're all caught up"
            : 'No notifications yet'
        }
        description={
          activeTab === 'UNREAD'
            ? 'You have no unread notifications right now.'
            : 'Important updates about your projects, applications, and assignments will appear here.'
        }
        actionLabel={activeTab === 'UNREAD' ? 'View All' : undefined}
        onAction={
          activeTab === 'UNREAD' ? () => setActiveTab('ALL') : undefined
        }
      />
    );
  };

  return (
    <ScreenWrapper
      edges={['top', 'left', 'right', 'bottom']}
      statusBarColor={colors.surface}
    >
      <StackHeader
        title="Notifications"
        showBack
        rightElement={
          unreadCount > 0 ? (
            <Pressable
              onPress={handleMarkAllRead}
              disabled={markAllReadMutation.isPending}
              accessibilityRole="button"
              accessibilityLabel="Mark all notifications as read"
              style={({ pressed }) => [
                styles.markAllBtn,
                pressed && { opacity: 0.7 },
              ]}
            >
              <CheckCheck size={16} color={colors.primaryDark} />
              <Text style={styles.markAllText}>Mark all read</Text>
            </Pressable>
          ) : null
        }
      />

      <View style={styles.filterBar}>
        <Pressable
          onPress={() => setActiveTab('ALL')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'ALL' }}
          style={[styles.tabPill, activeTab === 'ALL' && styles.tabPillActive]}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'ALL' && styles.tabTextActive,
            ]}
          >
            All ({notifications.length})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('UNREAD')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'UNREAD' }}
          style={[
            styles.tabPill,
            activeTab === 'UNREAD' && styles.tabPillActive,
          ]}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'UNREAD' && styles.tabTextActive,
            ]}
          >
            Unread ({unreadCount})
          </Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.skeletonList}>
          {[1, 2, 3, 4].map((key) => (
            <Card key={key} style={styles.skeletonCard} padding="base">
              <View style={styles.skeletonRow}>
                <Skeleton
                  width={40}
                  height={40}
                  style={{ borderRadius: borderRadius.md }}
                />
                <View style={styles.skeletonTextCol}>
                  <Skeleton
                    width="65%"
                    height={18}
                    style={{ marginBottom: spacing.xs }}
                  />
                  <Skeleton width="90%" height={14} />
                </View>
              </View>
            </Card>
          ))}
        </View>
      ) : (
        <FlatList
          data={filteredNotifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotificationCard
              notification={item}
              onPress={handlePressNotification}
            />
          )}
          ListHeaderComponent={renderPermissionBanner}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={isRefetching}
          onRefresh={refetch}
        />
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: spacing.sm,
  },
  tabPill: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  tabPillActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  tabText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.text.secondary,
  },
  tabTextActive: {
    color: colors.primaryDark,
    fontWeight: typography.weights.bold,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primaryLight,
  },
  markAllText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  listContent: {
    padding: spacing.xl,
    flexGrow: 1,
  },
  permissionCard: {
    marginBottom: spacing.base,
    backgroundColor: '#FFFDF5',
    borderColor: colors.primary,
    borderWidth: 1,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  permissionIconBox: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionContent: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  permissionSubtitle: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    lineHeight: 17,
  },
  enableButton: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: spacing.base,
    borderRadius: borderRadius.sm,
  },
  enableButtonText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
  },
  skeletonList: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  skeletonCard: {
    marginBottom: spacing.sm,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  skeletonTextCol: {
    flex: 1,
  },
});
