/**
 * StatusBadge component — HeadsUp design system.
 * Displays semantic status pills for jobs, moderation, and applications.
 */
import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { colors, typography, spacing, borderRadius } from '@/theme';

interface StatusBadgeProps {
  status: string;
  type?: 'job' | 'application';
  style?: ViewStyle;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: 'In Review',
  PENDING_APPROVAL: 'In Review',
  UNDER_REVIEW: 'In Review',
  IN_PROGRESS: 'In Progress',
};

export function StatusBadge({ status, type = 'job', style }: StatusBadgeProps) {
  const normalized = (status || '').toUpperCase();
  let bgColor: string = colors.surfaceMuted;
  let textColor: string = colors.text.secondary;
  let borderColor: string = colors.borderLight;
  const label = STATUS_LABELS[normalized] || normalized.replace(/_/g, ' ');

  if (type === 'job') {
    switch (normalized) {
      case 'OPEN':
      case 'IN_PROGRESS':
        bgColor = colors.status.infoLight;
        textColor = colors.status.info;
        borderColor = '#BFDBFE';
        break;
      case 'SCHEDULED':
      case 'PENDING_REVIEW':
      case 'PENDING_APPROVAL':
      case 'OVERTIME':
        bgColor = colors.status.warningLight;
        textColor = colors.status.warning;
        borderColor = '#FDE68A';
        break;
      case 'FILLED':
      case 'COMPLETED':
      case 'APPROVED':
        bgColor = colors.status.successLight;
        textColor = colors.status.success;
        borderColor = '#BBF7D0';
        break;
      case 'DISPUTE':
      case 'REJECTED':
        bgColor = colors.status.errorLight;
        textColor = colors.status.error;
        borderColor = '#FECACA';
        break;
      case 'CLOSED':
        bgColor = colors.surfaceMuted;
        textColor = colors.text.secondary;
        borderColor = colors.borderLight;
        break;
    }
  } else {
    switch (normalized) {
      case 'SUBMITTED':
      case 'UNDER_REVIEW':
        bgColor = colors.status.warningLight;
        textColor = colors.status.warning;
        borderColor = '#FDE68A';
        break;
      case 'APPROVED':
        bgColor = colors.status.successLight;
        textColor = colors.status.success;
        borderColor = '#BBF7D0';
        break;
      case 'REJECTED':
      case 'WITHDRAWN':
      case 'CANCELLED':
        bgColor = colors.status.errorLight;
        textColor = colors.status.error;
        borderColor = '#FECACA';
        break;
    }
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: bgColor, borderColor },
        style,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: textColor }]} />
      <Text numberOfLines={1} style={[styles.text, { color: textColor }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  text: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
