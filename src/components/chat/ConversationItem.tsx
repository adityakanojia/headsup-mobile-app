/**
 * ConversationItem — Polished inbox row for a Job Chat Room.
 *
 * Displays:
 * - Counterparty avatar and name (RPL Manager for Clients, Client for RPL Managers/Admins)
 * - Associated project/job badge (`job_title`)
 * - Latest message preview (`You: ...`) or live typing indicator (`Typing...`)
 * - Relative/formatted timestamp and unread count badge
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Briefcase, Check, CheckCheck } from 'lucide-react-native';
import { Avatar } from '@/components/Avatar';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { formatInboxTimestamp } from './formatChatTime';
import type { ChatRoom } from '@/types/chat';

interface ConversationItemProps {
  room: ChatRoom;
  currentUserId?: string | null;
  currentUserRole?: string | null;
  isTyping?: boolean;
  onPress: (room: ChatRoom) => void;
}

export function ConversationItem({
  room,
  currentUserId,
  currentUserRole,
  isTyping = false,
  onPress,
}: ConversationItemProps) {
  const isClient = currentUserRole?.toLowerCase() === 'client';

  const participantName = isClient
    ? room.rpl_manager_name?.trim() || 'RPL Project Manager'
    : room.client_name?.trim() || 'Client';

  const participantRoleTag = isClient ? 'RPL Manager' : 'Client';
  const hasUnread = room.unread_count > 0;
  const lastMsg = room.last_message;
  const isLastFromMe = Boolean(
    lastMsg && currentUserId && lastMsg.sender_id === currentUserId,
  );

  const timestamp = formatInboxTimestamp(
    lastMsg?.created_at || room.created_at,
  );

  const previewText = isTyping
    ? 'Typing a message...'
    : lastMsg?.content
      ? lastMsg.content.replace(/\s+/g, ' ').trim()
      : 'Tap to start project conversation';

  return (
    <Pressable
      onPress={() => onPress(room)}
      accessibilityRole="button"
      accessibilityLabel={`Conversation with ${participantName} for project ${room.job_title}${hasUnread ? `, ${room.unread_count} unread messages` : ''}`}
      android_ripple={{ color: 'rgba(20, 20, 19, 0.05)' }}
      style={({ pressed }) => [
        styles.row,
        hasUnread && styles.rowUnread,
        pressed && styles.rowPressed,
      ]}
    >
      <View style={styles.avatarWrap}>
        <Avatar name={participantName} size={48} />
        {hasUnread && <View style={styles.unreadDotOverlay} />}
      </View>

      <View style={styles.body}>
        <View style={styles.topLine}>
          <View style={styles.nameRow}>
            <Text
              style={[styles.name, hasUnread && styles.nameUnread]}
              numberOfLines={1}
            >
              {participantName}
            </Text>
            <View style={styles.rolePill}>
              <Text style={styles.rolePillText}>{participantRoleTag}</Text>
            </View>
          </View>

          {!!timestamp && (
            <Text
              style={[styles.timestamp, hasUnread && styles.timestampUnread]}
            >
              {timestamp}
            </Text>
          )}
        </View>

        {!!room.job_title && (
          <View style={styles.jobBadgeRow}>
            <Briefcase size={12} color={colors.primaryDark} />
            <Text style={styles.jobTitle} numberOfLines={1}>
              {room.job_title}
            </Text>
          </View>
        )}

        <View style={styles.bottomLine}>
          <View style={styles.previewRow}>
            {!isTyping && isLastFromMe && lastMsg && (
              <View style={styles.receiptIcon}>
                {lastMsg.is_read ? (
                  <CheckCheck size={14} color={colors.primaryDark} />
                ) : (
                  <Check size={14} color={colors.text.muted} />
                )}
              </View>
            )}
            <Text
              style={[
                styles.preview,
                hasUnread && styles.previewUnread,
                isTyping && styles.previewTyping,
                !lastMsg && !isTyping && styles.previewEmpty,
              ]}
              numberOfLines={1}
            >
              {!isTyping && isLastFromMe ? `You: ${previewText}` : previewText}
            </Text>
          </View>

          {hasUnread && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {room.unread_count > 99 ? '99+' : room.unread_count}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: 14,
  },
  rowUnread: {
    backgroundColor: '#FFFDF7',
  },
  rowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  avatarWrap: {
    position: 'relative',
  },
  unreadDotOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  nameRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  name: {
    flexShrink: 1,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  nameUnread: {
    fontWeight: typography.weights.bold,
  },
  rolePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  rolePillText: {
    fontSize: 10,
    fontWeight: typography.weights.semibold,
    color: colors.text.secondary,
  },
  timestamp: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.text.muted,
  },
  timestampUnread: {
    color: colors.primaryDark,
    fontWeight: typography.weights.bold,
  },
  jobBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  jobTitle: {
    flex: 1,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.primaryDark,
  },
  bottomLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: 1,
  },
  previewRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  receiptIcon: {
    marginRight: 4,
  },
  preview: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    lineHeight: 19,
  },
  previewUnread: {
    color: colors.text.primary,
    fontWeight: typography.weights.semibold,
  },
  previewTyping: {
    color: colors.primaryDark,
    fontWeight: typography.weights.semibold,
  },
  previewEmpty: {
    color: colors.text.muted,
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: '#E5B800',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
  },
});
