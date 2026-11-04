/**
 * Button component — HeadsUp design system.
 * Supports primary, secondary, outline, ghost, and danger variants with loading state.
 */
import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { colors, typography, spacing, borderRadius } from '@/theme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
  fullWidth = true,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      android_ripple={{ color: colors.ripple, borderless: false }}
      style={({ pressed }) => [
        styles.base,
        sizeStyles[size],
        variantStyles[variant],
        fullWidth ? styles.fullWidth : undefined,
        pressed && !isDisabled ? variantPressedStyles[variant] : undefined,
        isDisabled ? styles.disabled : undefined,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === 'danger'
              ? colors.text.inverse
              : variant === 'secondary'
                ? colors.primaryDark
                : colors.text.primary
          }
          size="small"
        />
      ) : (
        <>
          {icon}
          {Boolean(title) && (
            <Text
              numberOfLines={1}
              style={[
                styles.text,
                sizeTextStyles[size],
                variantTextStyles[variant],
                isDisabled ? styles.disabledText : undefined,
                textStyle,
              ]}
            >
              {title}
            </Text>
          )}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: borderRadius.md,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.48,
  },
  text: {
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.1,
  },
  disabledText: {
    opacity: 0.8,
  },
});

const sizeStyles: Record<ButtonSize, ViewStyle> = {
  sm: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    minHeight: 38,
    borderRadius: borderRadius.sm + 2,
  },
  md: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    minHeight: 48,
  },
  lg: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.base,
    minHeight: 54,
  },
};

const sizeTextStyles: Record<ButtonSize, TextStyle> = {
  sm: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  md: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  lg: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
};

const variantStyles: Record<ButtonVariant, ViewStyle> = {
  primary: {
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: '#E5B800',
  },
  secondary: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: '#EFE0A6',
  },
  outline: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: colors.status.error,
    borderWidth: 1,
    borderColor: '#991B1B',
  },
};

const variantPressedStyles: Record<ButtonVariant, ViewStyle> = {
  primary: {
    backgroundColor: colors.primaryPressed,
    transform: [{ scale: 0.99 }],
  },
  secondary: {
    backgroundColor: '#FCEFA6',
    transform: [{ scale: 0.99 }],
  },
  outline: {
    backgroundColor: colors.surfaceMuted,
    transform: [{ scale: 0.99 }],
  },
  ghost: {
    backgroundColor: colors.surfaceMuted,
    opacity: 0.85,
  },
  danger: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
};

const variantTextStyles: Record<ButtonVariant, TextStyle> = {
  primary: {
    color: colors.text.primary,
    fontWeight: typography.weights.bold,
  },
  secondary: {
    color: colors.primaryDark,
    fontWeight: typography.weights.bold,
  },
  outline: {
    color: colors.text.primary,
    fontWeight: typography.weights.semibold,
  },
  ghost: {
    color: colors.text.secondary,
  },
  danger: {
    color: colors.text.inverse,
    fontWeight: typography.weights.bold,
  },
};
