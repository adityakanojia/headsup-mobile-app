/**
 * EmptyState component — HeadsUp design system.
 * Displays when a list is empty or a filter yields no results.
 */
import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { FileSearch } from 'lucide-react-native';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export function EmptyState({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconContainer}>
        {icon || <FileSearch size={28} color={colors.primaryDark} />}
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionLabel && onAction && (
        <Button
          title={actionLabel}
          onPress={onAction}
          style={styles.actionBtn}
          variant="secondary"
          size="sm"
          fullWidth={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['2xl'],
    minHeight: 220,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: '#EFE0A6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.base,
  },
  title: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs + 2,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  description: {
    fontSize: typography.sizes.sm + 1,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 21,
    maxWidth: 300,
  },
  actionBtn: {
    minWidth: 150,
  },
});
