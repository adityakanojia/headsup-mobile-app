/**
 * MessageBubble — Individual chat bubble with date separators, sender grouping,
 * clickable URLs, delivery status indicators, and failed-message retry actions.
 */
import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Linking,
  Share,
  Alert,
} from 'react-native';
import {
  AlertCircle,
  Check,
  CheckCheck,
  RotateCcw,
  Trash2,
} from 'lucide-react-native';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { formatBubbleTime } from './formatChatTime';
import type { ChatMessage } from '@/types/chat';

const URL_REGEX = /(https?:\/\/[^\s]+)/gi;

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  dateSeparatorLabel?: string | null;
  onRetry?: (tempId: string) => void;
  onDiscard?: (tempId: string) => void;
}

export function MessageBubble({
  message,
  isOwn,
  isFirstInGroup,
  isLastInGroup,
  dateSeparatorLabel,
  onRetry,
  onDiscard,
}: MessageBubbleProps) {
  const status =
    message.delivery_status ?? (message.is_read ? 'read' : 'sent');
  const isFailed = status === 'failed';
  const isSending = status === 'sending';
  const timeText = formatBubbleTime(message.created_at);

  const textParts = useMemo(() => {
    const raw = message.content || '';
    const segments = raw.split(URL_REGEX);
    return segments.filter((part) => part.length > 0);
  }, [message.content]);

  const handleLongPress = () => {
    if (isFailed && (message.client_temp_id || message.id)) {
      const targetId = message.client_temp_id || message.id;
      Alert.alert('Message not sent', 'What would you like to do?', [
        {
          text: 'Retry Send',
          onPress: () => onRetry?.(targetId),
        },
        {
          text: 'Delete Draft',
          style: 'destructive',
          onPress: () => onDiscard?.(targetId),
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }

    Share.share({ message: message.content }).catch(() => null);
  };

  const handleConfirmDiscard = () => {
    const targetId = message.client_temp_id || message.id;
    Alert.alert(
      'Discard unsent message?',
      'This failed message will be removed from your conversation.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => onDiscard?.(targetId),
        },
      ],
    );
  };

  return (
    <View>
      {!!dateSeparatorLabel && (
        <View style={styles.dateSeparatorWrap}>
          <View style={styles.datePill}>
            <Text style={styles.datePillText}>{dateSeparatorLabel}</Text>
          </View>
        </View>
      )}

      <View
        style={[
          styles.row,
          isOwn ? styles.rowOwn : styles.rowOther,
          isFirstInGroup ? styles.groupStart : styles.groupMiddle,
        ]}
      >
        {!isOwn && isFirstInGroup && !!message.sender_name && (
          <Text style={styles.senderLabel} numberOfLines={1}>
            {message.sender_name}
          </Text>
        )}

        <Pressable
          onLongPress={handleLongPress}
          onPress={
            isFailed
              ? () => onRetry?.(message.client_temp_id || message.id)
              : undefined
          }
          delayLongPress={320}
          accessibilityRole="button"
          accessibilityLabel={`${isOwn ? 'Sent' : 'Received'} message: ${message.content}`}
          style={({ pressed }) => [
            styles.bubble,
            isOwn ? styles.bubbleOwn : styles.bubbleOther,
            isOwn && isLastInGroup && styles.bubbleOwnTail,
            !isOwn && isLastInGroup && styles.bubbleOtherTail,
            isFailed && styles.bubbleFailed,
            pressed && styles.bubblePressed,
          ]}
        >
          <Text style={styles.messageText} selectable>
            {textParts.map((part, idx) => {
              if (/^https?:\/\//i.test(part)) {
                return (
                  <Text
                    key={`${part}-${idx}`}
                    style={styles.linkText}
                    onPress={() => {
                      Linking.openURL(part).catch(() => null);
                    }}
                  >
                    {part}
                  </Text>
                );
              }
              return <React.Fragment key={idx}>{part}</React.Fragment>;
            })}
          </Text>

          <View style={styles.metaRow}>
            <Text style={[styles.timeText, isOwn && styles.timeTextOwn]}>
              {timeText}
            </Text>

            {isOwn && (
              <View style={styles.statusIconWrap}>
                {isSending ? (
                  <ActivityIndicator
                    size={11}
                    color={colors.primaryDark}
                    style={styles.spinner}
                  />
                ) : isFailed ? (
                  <AlertCircle size={13} color={colors.status.error} />
                ) : status === 'read' || message.is_read ? (
                  <CheckCheck size={14} color={colors.primaryDark} />
                ) : (
                  <Check size={13} color={colors.text.secondary} />
                )}
              </View>
            )}
          </View>
        </Pressable>

        {isOwn && isFailed && (
          <View style={styles.failedActionsRow}>
            <Pressable
              onPress={() => onRetry?.(message.client_temp_id || message.id)}
              style={({ pressed }) => [
                styles.failedActionBtn,
                pressed && { opacity: 0.7 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Retry sending message"
            >
              <RotateCcw size={12} color={colors.status.error} />
              <Text style={styles.failedActionText}>
                Failed to send · Tap to retry
              </Text>
            </Pressable>

            <Pressable
              onPress={handleConfirmDiscard}
              style={({ pressed }) => [
                styles.discardBtn,
                pressed && { opacity: 0.7 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Discard failed message"
            >
              <Trash2 size={12} color={colors.text.secondary} />
              <Text style={styles.discardBtnText}>Discard</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dateSeparatorWrap: {
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  datePill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  datePillText: {
    fontSize: 11,
    fontWeight: typography.weights.semibold,
    color: colors.text.secondary,
    letterSpacing: 0.2,
  },
  row: {
    maxWidth: '82%',
  },
  rowOwn: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  rowOther: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  groupStart: {
    marginTop: 10,
  },
  groupMiddle: {
    marginTop: 3,
  },
  senderLabel: {
    fontSize: 11,
    fontWeight: typography.weights.semibold,
    color: colors.text.secondary,
    marginBottom: 3,
    marginLeft: 4,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 76,
  },
  bubbleOwn: {
    backgroundColor: '#FFF5C0',
    borderColor: '#E8D790',
  },
  bubbleOwnTail: {
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: colors.surface,
    borderColor: colors.borderLight,
  },
  bubbleOtherTail: {
    borderBottomLeftRadius: 4,
  },
  bubbleFailed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  bubblePressed: {
    opacity: 0.88,
  },
  messageText: {
    fontSize: typography.sizes.base - 1,
    lineHeight: 21,
    color: colors.text.primary,
  },
  linkText: {
    color: colors.status.info,
    textDecorationLine: 'underline',
    fontWeight: typography.weights.medium,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  timeText: {
    fontSize: 10,
    fontWeight: typography.weights.medium,
    color: colors.text.muted,
  },
  timeTextOwn: {
    color: '#6B5918',
  },
  statusIconWrap: {
    marginLeft: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    transform: [{ scale: 0.8 }],
  },
  failedActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  failedActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  failedActionText: {
    fontSize: 11,
    fontWeight: typography.weights.semibold,
    color: colors.status.error,
  },
  discardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 2,
  },
  discardBtnText: {
    fontSize: 11,
    fontWeight: typography.weights.medium,
    color: colors.text.secondary,
  },
});
