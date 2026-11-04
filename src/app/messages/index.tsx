/**
 * Conversations Inbox Screen (`/messages`)
 *
 * Displays all authorized project conversations for Clients, RPL Managers, and Admins.
 * - Real-time preview, ordering,unread badge, and typing indicator updates via Redis Pub/Sub WebSocket
 * - Search by project title, participant name, or message preview
 * - Filter between All and Unread conversations
 * - Quick-start project chat for approved client projects
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Briefcase,
  MessageSquare,
  MessageSquarePlus,
  Search,
  WifiOff,
  X,
  ArrowRight,
} from 'lucide-react-native';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { StackHeader } from '@/components/Header';
import { Card } from '@/components/Card';
import { Skeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { ConversationItem } from '@/components/chat';
import {
  canRoleAccessChat,
  useChatRooms,
  useChatUiStore,
  useUnreadChatCount,
} from '@/hooks/useChat';
import { useClientJobs } from '@/hooks/useJobs';
import { chatSocketManager } from '@/services/chatSocketManager';
import { useStore } from '@/store/useStore';
import { colors, typography, spacing, borderRadius, hitSlop } from '@/theme';
import type { ChatRoom } from '@/types/chat';
import type { JobResponse } from '@/types/jobs';

type InboxFilter = 'ALL' | 'UNREAD';

export default function MessagesInboxScreen() {
  const router = useRouter();
  const { user, role } = useStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<InboxFilter>('ALL');

  const canAccess = canRoleAccessChat(role);
  const connectionState = useChatUiStore((s) => s.connectionState);
  const typingByJobId = useChatUiStore((s) => s.typingByJobId);

  const {
    data: rooms = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useChatRooms(canAccess);

  const totalUnread = useUnreadChatCount(canAccess);

  // For Clients, also load their approved projects so they can initiate a chat
  // on any approved project whose room hasn't been created yet
  const isClient = role === 'client';
  const { data: clientJobs = [] } = useClientJobs(50);

  const startableProjects = useMemo<JobResponse[]>(() => {
    if (!isClient || !clientJobs.length) return [];
    const existingJobIds = new Set(rooms.map((r) => r.job_id));
    return clientJobs.filter(
      (job) =>
        job.moderation_status === 'APPROVED' && !existingJobIds.has(job.id),
    );
  }, [isClient, clientJobs, rooms]);

  const filteredRooms = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rooms.filter((room) => {
      if (filter === 'UNREAD' && room.unread_count <= 0) {
        return false;
      }
      if (!query) return true;

      const haystack = [
        room.job_title,
        room.rpl_manager_name,
        room.client_name,
        room.last_message?.content,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [rooms, filter, search]);

  const handleOpenRoom = useCallback(
    (room: ChatRoom) => {
      const partnerName =
        role === 'client'
          ? room.rpl_manager_name || 'RPL Project Manager'
          : room.client_name || 'Client';

      router.push({
        pathname: '/messages/[jobId]',
        params: {
          jobId: room.job_id,
          jobTitle: room.job_title || 'Project Chat',
          participantName: partnerName,
        },
      } as never);
    },
    [router, role],
  );

  const handleStartProjectChat = useCallback(
    (job: JobResponse) => {
      router.push({
        pathname: '/messages/[jobId]',
        params: {
          jobId: job.id,
          jobTitle: job.title,
          participantName: 'RPL Project Manager',
        },
      } as never);
    },
    [router],
  );

  const handleRefresh = useCallback(() => {
    void chatSocketManager.reconnectNow();
    void refetch();
  }, [refetch]);

  const renderConnectionBadge = () => {
    if (!canAccess) return null;

    if (connectionState === 'connected') {
      return (
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.livePillText}>Live</Text>
        </View>
      );
    }

    if (connectionState === 'reconnecting' || connectionState === 'connecting') {
      return (
        <View style={styles.reconnectingPill}>
          <View style={styles.reconnectingDot} />
          <Text style={styles.reconnectingText}>Syncing</Text>
        </View>
      );
    }

    if (connectionState === 'disconnected') {
      return (
        <Pressable
          onPress={() => void chatSocketManager.reconnectNow()}
          style={styles.offlinePill}
          accessibilityRole="button"
          accessibilityLabel="Offline. Tap to reconnect"
        >
          <WifiOff size={12} color={colors.status.error} />
          <Text style={styles.offlineText}>Reconnect</Text>
        </Pressable>
      );
    }

    return null;
  };

  if (!canAccess) {
    return (
      <ScreenWrapper
        edges={['top', 'left', 'right', 'bottom']}
        statusBarColor={colors.surface}
      >
        <StackHeader title="Messages" showBack />
        <EmptyState
          title="Project messaging is for Clients & RPL Managers"
          description="Worker and contractor job applications and assignments are managed through your Jobs and Applications tabs."
          icon={<MessageSquare size={28} color={colors.primaryDark} />}
          actionLabel="Go Home"
          onAction={() => router.replace('/(tabs)')}
        />
      </ScreenWrapper>
    );
  }

  const renderListFooter = () => {
    if (startableProjects.length === 0 || filter === 'UNREAD') {
      return <View style={{ height: spacing['2xl'] }} />;
    }

    return (
      <View style={styles.startSection}>
        <View style={styles.startSectionHeader}>
          <MessageSquarePlus size={16} color={colors.primaryDark} />
          <Text style={styles.startSectionTitle}>
            Start a conversation on an approved project
          </Text>
        </View>
        <Text style={styles.startSectionSubtitle}>
          Connect directly with your assigned RPL Project Manager.
        </Text>

        <View style={styles.startProjectsList}>
          {startableProjects.map((job) => (
            <Pressable
              key={job.id}
              onPress={() => handleStartProjectChat(job)}
              style={({ pressed }) => [
                styles.startProjectCard,
                pressed && { backgroundColor: colors.surfaceMuted },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Message RPL Manager about ${job.title}`}
            >
              <View style={styles.startProjectIcon}>
                <Briefcase size={16} color={colors.primaryDark} />
              </View>
              <View style={styles.startProjectBody}>
                <Text style={styles.startProjectTitle} numberOfLines={1}>
                  {job.title}
                </Text>
                <Text style={styles.startProjectMeta} numberOfLines={1}>
                  {job.trade_type_name || 'General Trade'} · {job.location}
                </Text>
              </View>
              <View style={styles.startProjectCta}>
                <Text style={styles.startProjectCtaText}>Message</Text>
                <ArrowRight size={14} color={colors.primaryDark} />
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) return null;

    if (isError) {
      return (
        <ErrorState
          message={
            error?.message ||
            'Could not load your conversations. Check your connection and try again.'
          }
          onRetry={handleRefresh}
        />
      );
    }

    if (search.trim()) {
      return (
        <EmptyState
          title="No matching conversations"
          description={`No project chats match "${search.trim()}".`}
          icon={<Search size={28} color={colors.primaryDark} />}
          actionLabel="Clear search"
          onAction={() => setSearch('')}
        />
      );
    }

    if (filter === 'UNREAD') {
      return (
        <EmptyState
          title="No unread messages"
          description="You're all caught up across your project conversations."
          icon={<MessageSquare size={28} color={colors.primaryDark} />}
          actionLabel="View all chats"
          onAction={() => setFilter('ALL')}
        />
      );
    }

    if (startableProjects.length > 0) {
      return null;
    }

    return (
      <EmptyState
        title="No project conversations yet"
        description="Once a project is reviewed and assigned an RPL Project Manager, your direct project chat will appear here."
        icon={<MessageSquare size={28} color={colors.primaryDark} />}
        actionLabel={isClient ? 'View My Projects' : undefined}
        onAction={isClient ? () => router.push('/(tabs)/projects') : undefined}
      />
    );
  };

  return (
    <ScreenWrapper
      edges={['top', 'left', 'right', 'bottom']}
      statusBarColor={colors.surface}
    >
      <StackHeader
        title="Messages"
        showBack
        rightElement={renderConnectionBadge()}
      />

      <View style={styles.toolbar}>
        <View style={styles.searchBar}>
          <Search size={17} color={colors.text.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search projects, managers, or messages"
            placeholderTextColor={colors.text.muted}
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <Pressable
              onPress={() => setSearch('')}
              hitSlop={hitSlop}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <X size={16} color={colors.text.muted} />
            </Pressable>
          )}
        </View>

        <View style={styles.filterRow}>
          <Pressable
            onPress={() => setFilter('ALL')}
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === 'ALL' }}
            style={[styles.filterPill, filter === 'ALL' && styles.filterPillActive]}
          >
            <Text
              style={[
                styles.filterPillText,
                filter === 'ALL' && styles.filterPillTextActive,
              ]}
            >
              All ({rooms.length})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setFilter('UNREAD')}
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === 'UNREAD' }}
            style={[
              styles.filterPill,
              filter === 'UNREAD' && styles.filterPillActive,
            ]}
          >
            <Text
              style={[
                styles.filterPillText,
                filter === 'UNREAD' && styles.filterPillTextActive,
              ]}
            >
              Unread ({totalUnread})
            </Text>
          </Pressable>
        </View>
      </View>

      {isLoading && rooms.length === 0 ? (
        <View style={styles.skeletonContainer}>
          {[1, 2, 3, 4].map((key) => (
            <Card key={key} style={styles.skeletonCard} padding="base">
              <View style={styles.skeletonRow}>
                <Skeleton width={48} height={48} variant="circular" />
                <View style={styles.skeletonCol}>
                  <Skeleton
                    width="55%"
                    height={16}
                    style={{ marginBottom: 6 }}
                  />
                  <Skeleton
                    width="40%"
                    height={12}
                    style={{ marginBottom: 6 }}
                  />
                  <Skeleton width="85%" height={14} />
                </View>
              </View>
            </Card>
          ))}
        </View>
      ) : (
        <FlatList
          data={filteredRooms}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ConversationItem
              room={item}
              currentUserId={user?.id}
              currentUserRole={role}
              isTyping={Boolean(typingByJobId[item.job_id])}
              onPress={handleOpenRoom}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={isRefetching}
          onRefresh={handleRefresh}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderListFooter}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.text.primary,
    paddingVertical: 0,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  filterPillActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  filterPillText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.text.secondary,
  },
  filterPillTextActive: {
    color: colors.primaryDark,
    fontWeight: typography.weights.bold,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    backgroundColor: colors.status.successLight,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.status.success,
  },
  livePillText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.status.success,
  },
  reconnectingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    backgroundColor: colors.status.warningLight,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  reconnectingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.status.warning,
  },
  reconnectingText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.status.warning,
  },
  offlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    backgroundColor: colors.status.errorLight,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  offlineText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.status.error,
  },
  listContent: {
    flexGrow: 1,
  },
  skeletonContainer: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  skeletonCard: {
    marginBottom: spacing.xs,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  skeletonCol: {
    flex: 1,
  },
  startSection: {
    padding: spacing.xl,
    paddingTop: spacing.lg,
  },
  startSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  startSectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
  },
  startSectionSubtitle: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  startProjectsList: {
    gap: spacing.sm,
  },
  startProjectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: spacing.md,
  },
  startProjectIcon: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: '#EFE0A6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startProjectBody: {
    flex: 1,
    minWidth: 0,
  },
  startProjectTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
  },
  startProjectMeta: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  startProjectCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: '#EFE0A6',
  },
  startProjectCtaText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
});
