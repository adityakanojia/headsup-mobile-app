/**
 * Contractor Dashboard View
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Briefcase, ArrowRight, Wallet, Users } from 'lucide-react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/Skeleton';
import { StatusBadge } from '@/components/StatusBadge';
import { useContractorDashboard } from '@/hooks/useJobs';
import { colors, typography, spacing } from '@/theme';

export function ContractorDashboard() {
  const router = useRouter();
  const { data, isLoading, isError, isRefetching, refetch } = useContractorDashboard();

  if (isLoading && !data) {
    return (
      <View style={styles.container}>
        <View style={styles.statsRow}>
          <Skeleton height={100} style={styles.statCard} />
          <Skeleton height={100} style={styles.statCard} />
          <Skeleton height={100} style={styles.statCard} />
        </View>
        <Skeleton height={24} width={150} style={{ margin: spacing.xl }} />
        <Skeleton height={140} style={{ marginHorizontal: spacing.xl, marginBottom: spacing.md }} />
      </View>
    );
  }

  if (isError && !data) {
    return (
      <ErrorState
        message="Could not load your dashboard. Check your connection and try again."
        onRetry={refetch}
      />
    );
  }

  const activeJobs = data?.jobs || [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[colors.primary]} />
      }
    >
      <View style={styles.statsRow}>
        <Card style={styles.statCard} padding="md">
          <View style={styles.statIconContainer}>
            <Wallet size={16} color={colors.primaryDark} />
          </View>
          <Text style={styles.statLabel}>Team Earned</Text>
          <Text style={styles.statValue}>₹{data?.total_team_accumulated_earnings || 0}</Text>
        </Card>
        
        <Card style={styles.statCard} padding="md">
          <View style={[styles.statIconContainer, { backgroundColor: colors.status.infoLight }]}>
            <Briefcase size={16} color={colors.status.info} />
          </View>
          <Text style={styles.statLabel}>Active</Text>
          <Text style={styles.statValue}>{data?.active_projects_count || 0}</Text>
        </Card>

        <Card style={styles.statCard} padding="md">
          <View style={[styles.statIconContainer, { backgroundColor: colors.status.successLight }]}>
            <Users size={16} color={colors.status.success} />
          </View>
          <Text style={styles.statLabel}>Deployed</Text>
          <Text style={styles.statValue}>{data?.deployed_team_size || 0}</Text>
        </Card>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Active Projects</Text>
      </View>

      {activeJobs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>You don't have any active projects right now.</Text>
          <Button
            title="Find Projects"
            onPress={() => router.push('/(tabs)/jobs')}
            style={styles.findJobsBtn}
          />
        </View>
      ) : (
        <View style={styles.jobsList}>
          {activeJobs.map((job) => (
            <Card key={job.job_id} style={styles.jobCard}>
              <View style={styles.jobHeader}>
                <Text style={styles.jobTitle} numberOfLines={1}>
                  {job.job_title}
                </Text>
                <StatusBadge status={job.operational_status} />
              </View>
              
              <Text style={styles.jobLocation} numberOfLines={1}>
                {job.location}
              </Text>
              
              <View style={styles.jobDetails}>
                <View style={styles.jobDetailItem}>
                  <Text style={styles.detailLabel}>Rate/Worker</Text>
                  <Text style={styles.detailValue}>₹{job.daily_rate_per_worker}</Text>
                </View>
                <View style={styles.jobDetailItem}>
                  <Text style={styles.detailLabel}>Deployed</Text>
                  <Text style={styles.detailValue}>{job.deployed_workers_count} Workers</Text>
                </View>
                <View style={styles.jobDetailItem}>
                  <Text style={styles.detailLabel}>Team Earned</Text>
                  <Text style={[styles.detailValue, { color: colors.status.success }]}>
                    ₹{job.team_earned_to_date}
                  </Text>
                </View>
              </View>

              <Button
                title="Manage Project"
                variant="outline"
                size="sm"
                icon={<ArrowRight size={16} color={colors.text.primary} />}
                onPress={() => router.push(`/job/${job.job_id}`)}
                style={styles.viewBtn}
              />
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing['4xl'],
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
  },
  statIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs + 2,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  statValue: {
    fontSize: typography.sizes.md + 1,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.sizes.md + 1,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: spacing['2xl'],
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  emptyText: {
    fontSize: typography.sizes.sm + 1,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  findJobsBtn: {
    minWidth: 160,
  },
  jobsList: {
    gap: spacing.md,
  },
  jobCard: {
    padding: spacing.lg,
  },
  jobHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  jobTitle: {
    flex: 1,
    fontSize: typography.sizes.base + 1,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    marginRight: spacing.sm,
  },
  jobLocation: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  jobDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    borderRadius: 10,
    marginBottom: spacing.md,
  },
  jobDetailItem: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
  },
  viewBtn: {
    flexDirection: 'row-reverse',
  },
});
