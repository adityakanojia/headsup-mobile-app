/**
 * Layout components — HeadsUp design system.
 * Consistent stack header with accessible back button and optional right action.
 */
import React from 'react';
import { View, StyleSheet, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, typography, spacing, borderRadius, hitSlop } from '@/theme';
import { ArrowLeft } from 'lucide-react-native';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  rightElement?: React.ReactNode;
}

export function StackHeader({ title, showBack = true, rightElement }: HeaderProps) {
  const router = useRouter();

  return (
    <View style={styles.headerContainer}>
      <View style={styles.leftSection}>
        {showBack && (
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
        )}
      </View>

      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      <View style={styles.rightSection}>{rightElement}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  leftSection: {
    flex: 1,
    alignItems: 'flex-start',
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
  title: {
    flex: 2,
    textAlign: 'center',
    fontSize: typography.sizes.base + 1,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  rightSection: {
    flex: 1,
    alignItems: 'flex-end',
  },
});
