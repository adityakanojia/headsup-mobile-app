/**
 * Input component — HeadsUp design system.
 * Styled text input with label, focus state, error state, and icon support.
 */
import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors, typography, spacing, borderRadius } from '@/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
}

export function Input({
  label,
  error,
  leftIcon,
  rightIcon,
  containerStyle,
  ...textInputProps
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          !!error && styles.inputError,
        ]}
      >
        {!!leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
        <TextInput
          style={[styles.input, !!leftIcon && styles.inputWithLeftIcon]}
          placeholderTextColor={colors.text.muted}
          onFocus={(e) => {
            setIsFocused(true);
            textInputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            textInputProps.onBlur?.(e);
          }}
          {...textInputProps}
        />
        {!!rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
      </View>
      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
    letterSpacing: 0.2,
    marginBottom: 6,
    marginLeft: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    minHeight: 50,
    paddingHorizontal: spacing.base,
  },
  inputFocused: {
    borderColor: colors.focusRing,
    backgroundColor: '#FFFDF8',
  },
  inputError: {
    borderColor: colors.status.error,
    backgroundColor: '#FFFBFB',
  },
  input: {
    flex: 1,
    fontSize: typography.sizes.base,
    color: colors.text.primary,
    paddingVertical: spacing.md,
  },
  inputWithLeftIcon: {
    marginLeft: spacing.sm,
  },
  iconLeft: {
    marginRight: spacing.xs,
  },
  iconRight: {
    marginLeft: spacing.xs,
  },
  errorText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.status.error,
    marginTop: 5,
    marginLeft: 2,
  },
});
