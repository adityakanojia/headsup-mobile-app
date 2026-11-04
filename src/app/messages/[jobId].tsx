/**
 * Individual Project Conversation Screen (`/messages/[jobId]`)
 *
 * Features:
 * - Real-time message sending & receiving backed by FastAPI + PostgreSQL + Redis Pub/Sub
 * - Optimistic sending with delivery states (`sending`, `sent`, `read`, `failed` + 1-tap retry)
 * - Consecutive sender grouping & calendar date separators
 * - Cursor pagination (`before`) for older history without scroll jumping
 * - Smart scroll-to-bottom behavior + floating "New messages" pill when reading history
 * - Per-conversation draft preservation
 * - Graceful handling when an RPL Manager is not yet assigned to the project
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Keyboard,
  Platform,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowDown,
  ArrowLeft,
  Briefcase,
  Clock,
  ExternalLink,
  History,
  MessageSquare,
  WifiOff,
} from 'lucide-react-native';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { ErrorState } from '@/components/ErrorState';
import {
  ChatComposer,
  MessageBubble,
  formatDateSeparator,
  isDifferentCalendarDay,
} from '@/components/chat';
import {
  useChatRooms,
  useChatThread,
  useChatUiStore,
} from '@/hooks/useChat';
import { chatSocketManager } from '@/services/chatSocketManager';
import { useStore } from '@/store/useStore';
import { colors, typography, spacing, borderRadius, hitSlop, shadows } from '@/theme';
import type { ChatMessage } from '@/types/chat';

const GROUP_WINDOW_MS = 3 * 60 * 1000; // 3 minutes

interface EnrichedMessageItem {
  message: ChatMessage;
  isOwn: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  dateSeparatorLabel: string | null;
}

export default function ConversationThreadScreen() {
  const params = useLocalSearchParams<{
    jobId: string;
    jobTitle?: string;
    participantName?: string;
  }>();
  const jobId = Array.isArray(params.jobId) ? params.jobId[0] : params.jobId;
  const router = useRouter();
  const { user, role } = useStore();

  const connectionState = useChatUiStore((s) => s.connectionState);
  const draft = useChatUiStore((s) => (jobId ? s.draftsByJobId[jobId] ?? '' : ''));
  const setDraft = useChatUiStore((s) => s.setDraft);
  const typingEntry = useChatUiStore((s) =>
    jobId ? s.typingByJobId[jobId] : undefined,
  );

  const { data: rooms = [] } = useChatRooms();
  const currentRoom = useMemo(
    () => rooms.find((r) => r.job_id === jobId),
    [rooms, jobId],
  );

  const isClient = role === 'client';
  const participantName =
    (isClient
      ? currentRoom?.rpl_manager_name
      : currentRoom?.client_name)?.trim() ||
    (typeof params.participantName === 'string' && params.participantName) ||
    (isClient ? 'RPL Project Manager' : 'Client');

  const projectTitle =
    currentRoom?.job_title ||
    (typeof params.jobTitle === 'string' && params.jobTitle) ||
    'Project Conversation';

  const {
    messages,
    isLoading,
    isError,
    error,
    refetch,
    hasMoreOlder,
    isLoadingOlder,
    olderError,
    loadOlderMessages,
    sendMessage,
    retryMessage,
    discardFailedMessage,
  } = useChatThread(jobId);

  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<EnrichedMessageItem>>(null);
  const isNearBottomRef = useRef(true);
  const prevMsgCountRef = useRef(0);
  const prevLastMsgIdRef = useRef<string | null>(null);
  const isLoadingOlderActionRef = useRef(false);
  const [unseenCountBelow, setUnseenCountBelow] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const initialScrolledRef = useRef(false);
  const currentUserId = user?.id;

  const enrichedMessages = useMemo<EnrichedMessageItem[]>(() => {
    return messages.map((msg, index) => {
      const prev = index > 0 ? messages[index - 1] : null;
      const next = index < messages.length - 1 ? messages[index + 1] : null;
      const isOwn = Boolean(currentUserId && msg.sender_id === currentUserId);

      const hasDateSeparator =
        !prev || isDifferentCalendarDay(prev.created_at, msg.created_at);

      const isFirstInGroup =
        hasDateSeparator ||
        !prev ||
        prev.sender_id !== msg.sender_id ||
        Math.abs(
          new Date(msg.created_at).getTime() -
            new Date(prev.created_at).getTime(),
        ) > GROUP_WINDOW_MS;

      const nextHasDateSeparator =
        !next || isDifferentCalendarDay(msg.created_at, next.created_at);

      const isLastInGroup =
        nextHasDateSeparator ||
        !next ||
        next.sender_id !== msg.sender_id ||
        Math.abs(
          new Date(next.created_at).getTime() -
            new Date(msg.created_at).getTime(),
        ) > GROUP_WINDOW_MS;

      return {
        message: msg,
        isOwn,
        isFirstInGroup,
        isLastInGroup,
        dateSeparatorLabel: hasDateSeparator
          ? formatDateSeparator(msg.created_at)
          : null,
      };
    });
  }, [messages, currentUserId]);

  const scrollToBottom = useCallback((animated = true) => {
    setUnseenCountBelow(0);
    isNearBottomRef.current = true;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, []);

  // Track keyboard visibility to remove redundant bottom safe-area inset and keep latest messages visible
  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => {
      setIsKeyboardVisible(true);
      if (isNearBottomRef.current) {
        setTimeout(() => scrollToBottom(true), 80);
      }
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [scrollToBottom]);

  // Scroll handling when new messages arrive vs when older messages are prepended
  useEffect(() => {
    const count = enrichedMessages.length;
    const lastId =
      count > 0 ? enrichedMessages[count - 1].message.id : null;

    if (count === 0) {
      prevMsgCountRef.current = 0;
      prevLastMsgIdRef.current = null;
      return;
    }

    // Initial load: jump to latest message
    if (!initialScrolledRef.current) {
      initialScrolledRef.current = true;
      prevMsgCountRef.current = count;
      prevLastMsgIdRef.current = lastId;
      setTimeout(() => scrollToBottom(false), 60);
      return;
    }

    // If older messages were prepended (`lastId` did not change), preserve current scroll position
    if (
      isLoadingOlderActionRef.current ||
      (lastId === prevLastMsgIdRef.current && count > prevMsgCountRef.current)
    ) {
      isLoadingOlderActionRef.current = false;
      prevMsgCountRef.current = count;
      prevLastMsgIdRef.current = lastId;
      return;
    }

    // A new message was appended at the bottom
    if (lastId !== prevLastMsgIdRef.current) {
      const latestItem = enrichedMessages[count - 1];
      if (latestItem.isOwn || isNearBottomRef.current) {
        setTimeout(() => scrollToBottom(true), 40);
      } else {
        setUnseenCountBelow((prev) => prev + 1);
      }
    }

    prevMsgCountRef.current = count;
    prevLastMsgIdRef.current = lastId;
  }, [enrichedMessages, scrollToBottom]);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
      const distanceFromBottom =
        contentSize.height - (layoutMeasurement.height + contentOffset.y);
      const nearBottom = distanceFromBottom <= 110;
      isNearBottomRef.current = nearBottom;
      if (nearBottom && unseenCountBelow > 0) {
        setUnseenCountBelow(0);
      }
    },
    [unseenCountBelow],
  );

  const handleLoadOlder = useCallback(async () => {
    isLoadingOlderActionRef.current = true;
    await loadOlderMessages();
  }, [loadOlderMessages]);

  const handleDraftChange = useCallback(
    (text: string) => {
      if (!jobId) return;
      setDraft(jobId, text);
    },
    [jobId, setDraft],
  );

  const handleSend = useCallback(
    (content: string) => {
      if (!jobId) return;
      setDraft(jobId, '');
      sendMessage(content).catch(() => {
        // Optimistic message in thread transitions to `failed` state with 1-tap retry
      });
    },
    [jobId, setDraft, sendMessage],
  );

  const isManagerNotAssignedError =
    isError &&
    (error?.code === 'RPL_MANAGER_NOT_ASSIGNED' ||
      error?.message?.toLowerCase().includes('rpl manager is not assigned'));

  const renderHeader = () => (
    <View style={styles.header}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={hitSlop}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={({ pressed }) => [
          styles.backBtn,
          pressed && styles.backBtnPressed,
        ]}
      >
        <ArrowLeft size={20} color={colors.text.primary} strokeWidth={2.2} />
      </Pressable>

      <Pressable
        onPress={() => {
          if (jobId) router.push(`/job/${jobId}` as never);
        }}
        style={styles.headerCenter}
        accessibilityRole="button"
        accessibilityLabel={`View project ${projectTitle}`}
      >
        <Avatar name={participantName} size={38} />
        <View style={styles.headerTitleCol}>
          <View style={styles.headerNameRow}>
            <Text style={styles.headerName} numberOfLines={1}>
              {participantName}
            </Text>
            <View
              style={[
                styles.statusDot,
                connectionState === 'connected'
                  ? styles.statusDotOnline
                  : connectionState === 'reconnecting' ||
                      connectionState === 'connecting'
                    ? styles.statusDotSyncing
                    : styles.statusDotOffline,
              ]}
            />
          </View>
          <View style={styles.headerJobRow}>
            <Briefcase size={11} color={colors.primaryDark} />
            <Text style={styles.headerJobTitle} numberOfLines={1}>
              {projectTitle}
            </Text>
          </View>
        </View>
      </Pressable>

      {!!jobId && (
        <Pressable
          onPress={() => router.push(`/job/${jobId}` as never)}
          hitSlop={hitSlop}
          accessibilityRole="button"
          accessibilityLabel="Open project details"
          style={({ pressed }) => [
            styles.projectLinkBtn,
            pressed && styles.backBtnPressed,
          ]}
        >
          <ExternalLink size={17} color={colors.text.primary} />
        </Pressable>
      )}
    </View>
  );

  const renderConnectionBanner = () => {
    if (
      connectionState === 'connected' ||
      connectionState === 'idle' ||
      isManagerNotAssignedError
    ) {
      return null;
    }

    return (
      <Pressable
        onPress={() => void chatSocketManager.reconnectNow()}
        style={styles.connectionBanner}
        accessibilityRole="button"
        accessibilityLabel="Reconnecting to live chat. Tap to retry now."
      >
        <WifiOff size={13} color={colors.primaryDark} />
        <Text style={styles.connectionBannerText}>
          {connectionState === 'reconnecting' || connectionState === 'connecting'
            ? 'Reconnecting to live messaging...'
            : 'Live connection paused · Tap to reconnect'}
        </Text>
      </Pressable>
    );
  };

  const renderListHeader = () => {
    if (messages.length === 0) return null;

    if (!hasMoreOlder) {
      return (
        <View style={styles.threadStartBanner}>
          <Text style={styles.threadStartTitle}>{projectTitle}</Text>
          <Text style={styles.threadStartSubtitle}>
            Messages are end-to-end synced with your HeadsUp web workspace.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.loadOlderWrap}>
        <Pressable
          onPress={handleLoadOlder}
          disabled={isLoadingOlder}
          style={({ pressed }) => [
            styles.loadOlderBtn,
            pressed && { opacity: 0.75 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Load earlier messages"
        >
          {isLoadingOlder ? (
            <ActivityIndicator size="small" color={colors.primaryDark} />
          ) : (
            <>
              <History size={14} color={colors.primaryDark} />
              <Text style={styles.loadOlderText}>Load earlier messages</Text>
            </>
          )}
        </Pressable>
        {!!olderError && (
          <Text style={styles.olderErrorText}>{olderError}</Text>
        )}
      </View>
    );
  };

  const renderEmptyThread = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyThreadBox}>
        <View style={styles.emptyThreadIcon}>
          <MessageSquare size={26} color={colors.primaryDark} />
        </View>
        <Text style={styles.emptyThreadTitle}>Start the conversation</Text>
        <Text style={styles.emptyThreadSubtitle}>
          Send a message about <Text style={styles.boldText}>{projectTitle}</Text>{' '}
          to coordinate timelines, site requirements, or workforce updates.
        </Text>
      </View>
    );
  };

  if (isManagerNotAssignedError) {
    return (
      <ScreenWrapper
        edges={['top', 'left', 'right', 'bottom']}
        statusBarColor={colors.surface}
      >
        {renderHeader()}
        <View style={styles.unassignedContainer}>
          <View style={styles.unassignedIconBox}>
            <Clock size={28} color={colors.primaryDark} />
          </View>
          <Text style={styles.unassignedTitle}>
            Awaiting RPL Manager Assignment
          </Text>
          <Text style={styles.unassignedText}>
            Direct project messaging for{' '}
            <Text style={styles.boldText}>{projectTitle}</Text> will unlock
            automatically as soon as an RPL Project Manager is assigned to your
            project.
          </Text>
          <View style={styles.unassignedActions}>
            <Button
              title="View Project Details"
              onPress={() => router.push(`/job/${jobId}` as never)}
              variant="primary"
              fullWidth={false}
            />
          </View>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper
      keyboardAvoiding
      edges={['top', 'left', 'right']}
      statusBarColor={colors.surface}
    >
      {renderHeader()}
      {renderConnectionBanner()}

      {isLoading && messages.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primaryDark} />
          <Text style={styles.loadingText}>Loading conversation...</Text>
        </View>
      ) : isError && messages.length === 0 ? (
        <ErrorState
          message={
            error?.message ||
            'Could not load messages for this project. Please try again.'
          }
          onRetry={refetch}
        />
      ) : (
        <View style={styles.threadContainer}>
          <FlatList
            ref={listRef}
            data={enrichedMessages}
            keyExtractor={(item) =>
              item.message.client_temp_id || item.message.id
            }
            renderItem={({ item }) => (
              <MessageBubble
                message={item.message}
                isOwn={item.isOwn}
                isFirstInGroup={item.isFirstInGroup}
                isLastInGroup={item.isLastInGroup}
                dateSeparatorLabel={item.dateSeparatorLabel}
                onRetry={retryMessage}
                onDiscard={discardFailedMessage}
              />
            )}
            ListHeaderComponent={renderListHeader}
            ListEmptyComponent={renderEmptyThread}
            contentContainerStyle={styles.messagesListContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onScroll={handleScroll}
            onLayout={() => {
              if (
                isKeyboardVisible &&
                isNearBottomRef.current &&
                !isLoadingOlderActionRef.current
              ) {
                scrollToBottom(false);
              }
            }}
            scrollEventThrottle={16}
          />

          {unseenCountBelow > 0 && (
            <Pressable
              onPress={() => scrollToBottom(true)}
              style={styles.newMessagesFloatingBtn}
              accessibilityRole="button"
              accessibilityLabel={`${unseenCountBelow} new messages below. Tap to scroll to bottom.`}
            >
              <ArrowDown size={14} color={colors.text.primary} />
              <Text style={styles.newMessagesFloatingText}>
                {unseenCountBelow === 1
                  ? '1 new message'
                  : `${unseenCountBelow} new messages`}
              </Text>
            </Pressable>
          )}

          {!!typingEntry && (
            <View style={styles.typingBar}>
              <Text style={styles.typingText}>
                {typingEntry.userName || participantName} is typing...
              </Text>
            </View>
          )}
        </View>
      )}

      <View
        style={[
          styles.composerBottomWrap,
          { paddingBottom: isKeyboardVisible ? 0 : insets.bottom },
        ]}
      >
        <ChatComposer
          jobId={jobId || ''}
          value={draft}
          onChangeText={handleDraftChange}
          onSend={handleSend}
          disabled={!jobId || isManagerNotAssignedError}
          placeholder={`Message ${participantName}...`}
        />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  composerBottomWrap: {
    backgroundColor: colors.surface,
  },
  header: {
    minHeight: 62,
    paddingHorizontal: spacing.base,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.sm + 2,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  headerTitleCol: {
    flex: 1,
    minWidth: 0,
  },
  headerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerName: {
    flexShrink: 1,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusDotOnline: {
    backgroundColor: colors.status.success,
  },
  statusDotSyncing: {
    backgroundColor: colors.status.warning,
  },
  statusDotOffline: {
    backgroundColor: colors.text.muted,
  },
  headerJobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  headerJobTitle: {
    flex: 1,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.text.secondary,
  },
  projectLinkBtn: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.sm + 2,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: spacing.base,
    backgroundColor: colors.primaryLight,
    borderBottomWidth: 1,
    borderBottomColor: '#EFE0A6',
  },
  connectionBannerText: {
    fontSize: 11,
    fontWeight: typography.weights.semibold,
    color: colors.primaryDark,
  },
  threadContainer: {
    flex: 1,
    position: 'relative',
  },
  messagesListContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    flexGrow: 1,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
  },
  threadStartBanner: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  threadStartTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  threadStartSubtitle: {
    fontSize: 11,
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: 2,
  },
  loadOlderWrap: {
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  loadOlderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  loadOlderText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.primaryDark,
  },
  olderErrorText: {
    fontSize: 11,
    color: colors.status.error,
    marginTop: 4,
  },
  emptyThreadBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing['3xl'],
  },
  emptyThreadIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: '#EFE0A6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyThreadTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  emptyThreadSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  boldText: {
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
  },
  newMessagesFloatingBtn: {
    position: 'absolute',
    bottom: 14,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: '#E5B800',
    ...shadows.md,
  },
  newMessagesFloatingText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
  },
  typingBar: {
    paddingHorizontal: spacing.xl,
    paddingVertical: 4,
    backgroundColor: colors.background,
  },
  typingText: {
    fontSize: 11,
    fontWeight: typography.weights.medium,
    color: colors.primaryDark,
  },
  unassignedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
  },
  unassignedIconBox: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: '#EFE0A6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  unassignedTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  unassignedText: {
    fontSize: typography.sizes.base - 1,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  unassignedActions: {
    alignItems: 'center',
  },
});
