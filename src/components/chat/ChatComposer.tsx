/**
 * ChatComposer — Multiline message input bar anchored above the keyboard.
 *
 * Features:
 * - Natural multiline expansion up to 120px height
 * - Throttled typing indicator emission (at most once per 2.5 seconds)
 * - Draft persistence per conversation (`jobId`)
 * - Character limit guard (`5000` characters matching backend `ChatMessageSchema`)
 */
import React, { useCallback, useRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
  Text,
} from 'react-native';
import { Send } from 'lucide-react-native';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { chatSocketManager } from '@/services/chatSocketManager';

const MAX_MESSAGE_LENGTH = 5000;
const TYPING_THROTTLE_MS = 2500;

interface ChatComposerProps {
  jobId: string;
  value: string;
  onChangeText: (text: string) => void;
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatComposer({
  jobId,
  value,
  onChangeText,
  onSend,
  disabled = false,
  placeholder = 'Write a message...',
}: ChatComposerProps) {
  const lastTypingSentAtRef = useRef(0);
  const stopTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trimmed = value.trim();
  const canSend = !disabled && trimmed.length > 0 && trimmed.length <= MAX_MESSAGE_LENGTH;
  const showCharCounter = value.length >= 4500;

  const handleTextChange = useCallback(
    (nextText: string) => {
      onChangeText(nextText);

      if (!jobId) return;
      const now = Date.now();
      if (nextText.trim().length > 0) {
        if (now - lastTypingSentAtRef.current > TYPING_THROTTLE_MS) {
          lastTypingSentAtRef.current = now;
          chatSocketManager.sendTyping(jobId, true);
        }

        if (stopTypingTimerRef.current) {
          clearTimeout(stopTypingTimerRef.current);
        }
        stopTypingTimerRef.current = setTimeout(() => {
          chatSocketManager.sendTyping(jobId, false);
        }, 3000);
      } else {
        if (stopTypingTimerRef.current) {
          clearTimeout(stopTypingTimerRef.current);
          stopTypingTimerRef.current = null;
        }
        chatSocketManager.sendTyping(jobId, false);
      }
    },
    [jobId, onChangeText],
  );

  const handlePressSend = useCallback(() => {
    if (!canSend) return;
    if (stopTypingTimerRef.current) {
      clearTimeout(stopTypingTimerRef.current);
      stopTypingTimerRef.current = null;
    }
    if (jobId) {
      chatSocketManager.sendTyping(jobId, false);
    }
    onSend(trimmed);
  }, [canSend, jobId, onSend, trimmed]);

  return (
    <View style={styles.container}>
      {showCharCounter && (
        <Text
          style={[
            styles.charCounter,
            value.length > MAX_MESSAGE_LENGTH && styles.charCounterLimit,
          ]}
        >
          {value.length} / {MAX_MESSAGE_LENGTH}
        </Text>
      )}

      <View style={styles.composerRow}>
        <View style={styles.inputBox}>
          <TextInput
            value={value}
            onChangeText={handleTextChange}
            placeholder={placeholder}
            placeholderTextColor={colors.text.muted}
            multiline
            maxLength={MAX_MESSAGE_LENGTH}
            editable={!disabled}
            style={styles.textInput}
            textAlignVertical="center"
            accessibilityLabel="Message input"
          />
        </View>

        <Pressable
          onPress={handlePressSend}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{ disabled: !canSend }}
          style={({ pressed }) => [
            styles.sendBtn,
            !canSend && styles.sendBtnDisabled,
            pressed && canSend && styles.sendBtnPressed,
          ]}
        >
          <Send
            size={18}
            color={canSend ? colors.text.primary : colors.text.muted}
            strokeWidth={2.2}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingHorizontal: spacing.base,
    paddingTop: 10,
    paddingBottom: 10,
  },
  charCounter: {
    fontSize: 10,
    color: colors.text.muted,
    textAlign: 'right',
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  charCounterLimit: {
    color: colors.status.error,
    fontWeight: typography.weights.bold,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  inputBox: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  textInput: {
    fontSize: typography.sizes.base - 1,
    lineHeight: 20,
    color: colors.text.primary,
    maxHeight: 102,
    paddingTop: 0,
    paddingBottom: 0,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: '#E5B800',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderLight,
  },
  sendBtnPressed: {
    backgroundColor: colors.primaryHover,
    transform: [{ scale: 0.96 }],
  },
});
