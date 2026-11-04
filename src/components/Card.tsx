/**
 * Card component — HeadsUp design system.
 * Clean surface container with subtle warm border and restrained elevation.
 */
import React from 'react';
import { View, StyleSheet, type ViewProps } from 'react-native';
import { colors, spacing, borderRadius, shadows } from '@/theme';

interface CardProps extends ViewProps {
  elevated?: boolean;
  padding?: keyof typeof spacing | 'none';
}

export function Card({
  style,
  elevated = false,
  padding = 'base',
  children,
  ...props
}: CardProps) {
  return (
    <View
      style={[
        styles.container,
        elevated ? styles.elevated : undefined,
        padding !== 'none' ? { padding: spacing[padding] } : undefined,
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const baseShadow = shadows.sm ?? {};
const elevatedShadow = shadows.md ?? {};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    ...baseShadow,
  },
  elevated: {
    borderColor: colors.border,
    ...elevatedShadow,
  },
});
