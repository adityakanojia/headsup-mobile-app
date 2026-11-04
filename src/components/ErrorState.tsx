/**
 * ErrorState component — HeadsUp design system.
 * Displays when an API request fails, with a retry button.
 */
import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  style?: ViewStyle;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  style,
}: ErrorStateProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconContainer}>
        <AlertTriangle size={26} color={colors.status.error} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {!!onRetry && (
        <Button
          title="Try Again"
          onPress={onRetry}
          style={styles.retryBtn}
          variant="outline"
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
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.status.errorLight,
    borderWidth: 1,
    borderColor: '#FECACA',
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
  message: {
    fontSize: typography.sizes.sm + 1,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 21,
    maxWidth: 300,
  },
  retryBtn: {
    minWidth: 140,
  },
});
