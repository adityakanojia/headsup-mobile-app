/**
 * Client Status View — shows live moderation & operational status across client projects.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Users,
} from 'lucide-react-native';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/Skeleton';
import { useClientJobs } from '@/hooks/useJobs';
import { colors, typography, spacing, borderRadius } from '@/theme';

export default function StatusScreen() {
  const router = useRouter();
  const {
    data: jobs,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useClientJobs(50);

  const allJobs = jobs ?? [];
  const pendingReviewCount = allJobs.filter(
    (j) => j.moderation_status === 'PENDING_REVIEW',
  ).length;
  const approvedCount = allJobs.filter(
    (j) => j.moderation_status === 'APPROVED',
  ).length;
  const rejectedCount = allJobs.filter(
    (j) => j.moderation_status === 'REJECTED',
  ).length;

  return (
    <ScreenWrapper
      edges={['top', 'left', 'right']}
      statusBarColor={colors.surface}
    >
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Project Status</Text>
        <Text style={styles.pageSubtitle}>
          Track review approvals and workforce deployment
        </Text>
      </View>

      {isLoading && !jobs ? (
        <View style={styles.content}>
          <Skeleton height={90} style={{ marginBottom: spacing.md }} />
          <Skeleton height={120} style={{ marginBottom: spacing.md }} />
          <Skeleton height={120} />
        </View>
      ) : isError && !jobs ? (
        <ErrorState
          message={
            error instanceof Error
              ? error.message
              : 'Could not load project statuses.'
          }
          onRetry={refetch}
        />
      ) : allJobs.length === 0 ? (
        <EmptyState
          title="No projects to track"
          description="Once you submit a project, you can track its approval and workforce deployment status here."
          actionLabel="Create a project"
          onAction={() => router.push('/(tabs)/createJob')}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              colors={[colors.primaryDark]}
              tintColor={colors.primaryDark}
            />
          }
        >
          <View style={styles.summaryRow}>
            <Card style={styles.summaryCard} padding="md">
              <Clock size={18} color={colors.status.warning} />
              <Text style={styles.summaryCount}>{pendingReviewCount}</Text>
              <Text style={styles.summaryLabel}>In Review</Text>
            </Card>

            <Card style={styles.summaryCard} padding="md">
              <CheckCircle2 size={18} color={colors.status.success} />
              <Text style={styles.summaryCount}>{approvedCount}</Text>
              <Text style={styles.summaryLabel}>Approved</Text>
            </Card>

            <Card style={styles.summaryCard} padding="md">
              <AlertCircle size={18} color={colors.status.error} />
              <Text style={styles.summaryCount}>{rejectedCount}</Text>
              <Text style={styles.summaryLabel}>Needs Action</Text>
            </Card>
          </View>

          {allJobs.map((job) => (
            <Pressable
              key={job.id}
              onPress={() => router.push(`/job/${job.id}` as any)}
              style={({ pressed }) => [pressed && { opacity: 0.85 }]}
            >
              <Card style={styles.statusCard} padding="lg">
                <View style={styles.statusHeader}>
                  <Text style={styles.jobTitle} numberOfLines={1}>
                    {job.title}
                  </Text>
                  <StatusBadge status={job.moderation_status} />
                </View>

                <Text style={styles.subText}>
                  {job.trade_type_name || 'General Trade'} · {job.location}
                </Text>

                <View style={styles.footerRow}>
                  <View style={styles.workersRow}>
                    <Users size={15} color={colors.text.secondary} />
                    <Text style={styles.workersText}>
                      {job.filled_workers}/{job.total_workers_required} workers assigned
                    </Text>
                  </View>

                  <View style={styles.actionRow}>
                    <StatusBadge status={job.operational_status} />
                    <ArrowRight size={16} color={colors.primaryDark} />
                  </View>
                </View>
              </Card>
            </Pressable>
          ))}
        </ScrollView>
      )}
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
  },
  pageSubtitle: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  content: {
    padding: spacing.base,
    paddingBottom: spacing['4xl'],
    gap: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    borderRadius: borderRadius.lg,
  },
  summaryCount: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.heavy,
    color: colors.text.primary,
  },
  summaryLabel: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
  },
  statusCard: {
    borderRadius: borderRadius.xl,
    gap: spacing.sm,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  jobTitle: {
    flex: 1,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
  },
  subText: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  workersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  workersText: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    fontWeight: typography.weights.medium,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
