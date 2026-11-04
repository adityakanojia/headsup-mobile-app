/**
 * Earnings Screen
 * Shared across roles.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Wallet } from 'lucide-react-native';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { EmptyState } from '@/components/EmptyState';
import { colors, typography, spacing } from '@/theme';

export default function EarningsScreen() {
  return (
    <ScreenWrapper
      edges={['top', 'left', 'right']}
      statusBarColor={colors.surface}
    >
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Earnings</Text>
        <Text style={styles.pageSubtitle}>
          Track payouts, invoices, and completed work settlements
        </Text>
      </View>
      <View style={styles.container}>
        <EmptyState
          title="No settlements recorded yet"
          description="Your completed work payouts and transaction statements will appear here once projects are settled."
          icon={<Wallet size={28} color={colors.primaryDark} />}
        />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  pageTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  pageSubtitle: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  container: {
    flex: 1,
  },
});
