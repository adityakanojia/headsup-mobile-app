/**
 * Profile Screen — Shared across Client, Worker, and Contractor roles.
 * Handles notifications inbox navigation and safe logout with token cleanup.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, ChevronRight, LogOut, MessageSquare } from 'lucide-react-native';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { Button } from '@/components/Button';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { useStore } from '@/store/useStore';
import {
  useNotificationBannerStore,
  useUnreadNotificationCount,
} from '@/hooks/useNotifications';
import {
  canRoleAccessChat,
  useChatUiStore,
  useUnreadChatCount,
} from '@/hooks/useChat';
import { chatSocketManager } from '@/services/chatSocketManager';
import { unregisterCurrentDevicePushToken } from '@/services/pushNotificationService';
import { logout } from '@/services/authService';
import { colors, typography, spacing, borderRadius } from '@/theme';

export default function ProfileScreen() {
  const { user, role, isAuthenticated, clearSession } = useStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: unreadCount = 0 } = useUnreadNotificationCount(isAuthenticated);
  const canAccessChat = canRoleAccessChat(role);
  const unreadChatCount = useUnreadChatCount(isAuthenticated && canAccessChat);

  const handleLogout = async () => {
    try {
      chatSocketManager.disconnect();
      useChatUiStore.getState().resetChatUi();
      await unregisterCurrentDevicePushToken();
      await logout();
    } catch {
      // Ignore storage or network cleanup errors on sign-out
    } finally {
      useNotificationBannerStore.getState().resetBanners();
      queryClient.clear();
      clearSession();
      router.replace('/(auth)/login');
    }
  };

  return (
    <ScreenWrapper
      edges={['top', 'left', 'right']}
      statusBarColor={colors.surface}
    >
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Profile</Text>
      </View>

      <View style={styles.container}>
        <Card style={styles.profileCard} padding="lg">
          <View style={styles.header}>
            <Avatar name={user?.name || 'User'} size={64} />
            <View style={styles.info}>
              <Text style={styles.name}>{user?.name || 'User'}</Text>
              <Text style={styles.role}>{role?.toUpperCase() || 'WORKER'}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.label}>Phone</Text>
            <Text style={styles.value}>{user?.phone_number}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.label}>Status</Text>
            <Text style={[styles.value, { color: colors.status.success }]}>
              {user?.is_verified ? 'Verified' : 'Pending'}
            </Text>
          </View>
        </Card>

        <Card style={styles.menuCard} padding="sm">
          {canAccessChat && (
            <>
              <Pressable
                onPress={() => router.push('/messages' as never)}
                accessibilityRole="button"
                accessibilityLabel="Open project messages inbox"
                style={({ pressed }) => [
                  styles.menuItem,
                  pressed && { opacity: 0.75 },
                ]}
              >
                <View style={styles.menuLeft}>
                  <View style={styles.menuIconBox}>
                    <MessageSquare size={18} color={colors.primaryDark} />
                  </View>
                  <Text style={styles.menuTitle}>Messages</Text>
                </View>
                <View style={styles.menuRight}>
                  {unreadChatCount > 0 && (
                    <View style={styles.unreadPill}>
                      <Text style={styles.unreadPillText}>
                        {unreadChatCount > 99 ? '99+' : unreadChatCount} new
                      </Text>
                    </View>
                  )}
                  <ChevronRight size={18} color={colors.text.muted} />
                </View>
              </Pressable>
              <View style={styles.menuDivider} />
            </>
          )}

          <Pressable
            onPress={() => router.push('/notifications')}
            accessibilityRole="button"
            accessibilityLabel="Open notifications inbox"
            style={({ pressed }) => [
              styles.menuItem,
              pressed && { opacity: 0.75 },
            ]}
          >
            <View style={styles.menuLeft}>
              <View style={styles.menuIconBox}>
                <Bell size={18} color={colors.primaryDark} />
              </View>
              <Text style={styles.menuTitle}>Notifications</Text>
            </View>
            <View style={styles.menuRight}>
              {unreadCount > 0 && (
                <View style={styles.unreadPill}>
                  <Text style={styles.unreadPillText}>
                    {unreadCount > 99 ? '99+' : unreadCount} new
                  </Text>
                </View>
              )}
              <ChevronRight size={18} color={colors.text.muted} />
            </View>
          </Pressable>
        </Card>

        <Button
          title="Sign Out"
          onPress={handleLogout}
          variant="outline"
          icon={<LogOut size={20} color={colors.text.primary} />}
          style={styles.logoutBtn}
        />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  pageTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
  },
  container: {
    flex: 1,
    padding: spacing.xl,
  },
  profileCard: {
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  info: {
    marginLeft: spacing.lg,
  },
  name: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    marginBottom: 4,
  },
  role: {
    fontSize: typography.sizes.sm,
    color: colors.primaryDark,
    fontWeight: typography.weights.bold,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  label: {
    fontSize: typography.sizes.base,
    color: colors.text.secondary,
  },
  value: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.text.primary,
  },
  menuCard: {
    marginBottom: spacing.xl,
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginHorizontal: spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
  },
  menuRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  unreadPill: {
    backgroundColor: colors.primary,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: borderRadius.full,
  },
  unreadPillText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
  },
  logoutBtn: {
    marginTop: 'auto',
    marginBottom: spacing.xl,
  },
});
