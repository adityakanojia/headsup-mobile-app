/**
 * TeamMemberCard — single row in the contractor's team list.
 * Memoised because it's rendered inside a potentially long FlatList.
 */
import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Phone, Briefcase } from 'lucide-react-native';
import { Card } from '@/components/Card';
import { Avatar } from '@/components/Avatar';
import { colors, typography, spacing, borderRadius } from '@/theme';
import type { ContractorWorkerProfile } from '@/types/user';
import { formatPhoneForDisplay } from './validation';

interface TeamMemberCardProps {
  worker: ContractorWorkerProfile;
}

function getStatusColors(status: string): { bg: string; fg: string } {
  switch (status?.toUpperCase()) {
    case 'ACTIVE':
    case 'AVAILABLE':
    case 'VERIFIED':
      return { bg: colors.status.successLight, fg: colors.status.success };
    case 'DEPLOYED':
    case 'ASSIGNED':
      return { bg: colors.status.infoLight, fg: colors.status.info };
    case 'PENDING':
    case 'INVITED':
      return { bg: colors.status.warningLight, fg: colors.status.warning };
    case 'INACTIVE':
    case 'REMOVED':
      return { bg: colors.status.errorLight, fg: colors.status.error };
    default:
      return { bg: colors.skeleton, fg: colors.text.secondary };
  }
}

function TeamMemberCardBase({ worker }: TeamMemberCardProps) {
  const displayName = worker.name?.trim() || 'Unnamed Worker';
  // Primary trade is the source of truth for matching; fall back to first sub-skill
  const trade = worker.primary_skill_category_name || worker.skills?.[0]?.name;
  const statusColors = getStatusColors(worker.status);

  return (
    <Card style={styles.card} padding="base">
      <View style={styles.row}>
        <Avatar name={displayName} size={48} />

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>

          <View style={styles.metaRow}>
            <Phone size={12} color={colors.text.secondary} />
            <Text style={styles.metaText} numberOfLines={1}>
              {formatPhoneForDisplay(worker.phone_number)}
            </Text>
          </View>

          {!!trade && (
            <View style={styles.metaRow}>
              <Briefcase size={12} color={colors.primaryDark} />
              <Text style={[styles.metaText, styles.tradeText]} numberOfLines={1}>
                {trade}
              </Text>
            </View>
          )}
        </View>

        {!!worker.status && (
          <View style={[styles.statusPill, { backgroundColor: statusColors.bg }]}>
            <Text style={[styles.statusText, { color: statusColors.fg }]}>
              {worker.status.replace(/_/g, ' ')}
            </Text>
          </View>
        )}
      </View>
    </Card>
  );
}

export const TeamMemberCard = memo(TeamMemberCardBase);

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  info: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    flexShrink: 1,
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    fontWeight: typography.weights.medium,
  },
  tradeText: {
    color: colors.primaryDark,
    fontWeight: typography.weights.semibold,
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
