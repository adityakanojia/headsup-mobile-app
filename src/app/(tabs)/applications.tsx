/**
 * Applications List (Worker)
 */
import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowRight, Calendar, IndianRupee } from 'lucide-react-native';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { useMyApplications } from '@/hooks/useJobs';
import { colors, typography, spacing } from '@/theme';
import type { ApplicationResponse } from '@/types/jobs';

export default function ApplicationsScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch, isRefetching } = useMyApplications();

  const renderApplication = ({ item: app }: { item: ApplicationResponse }) => (
    <Card style={styles.card} padding="lg">
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={2}>
          {app.job.title}
        </Text>
        <StatusBadge status={app.status} type="application" />
      </View>

      <Text style={styles.date}>
        Applied {new Date(app.created_at).toLocaleDateString()}
      </Text>

      <View style={styles.details}>
        <View style={styles.detailItem}>
          <IndianRupee size={16} color={colors.text.secondary} />
          <Text style={styles.detailText}>
            {app.job.wage_type === 'CONTRACTUAL' 
              ? `₹${app.job.contract_price}` 
              : `₹${app.job.wage_min}-${app.job.wage_max}/day`}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Calendar size={16} color={colors.text.secondary} />
          <Text style={styles.detailText}>{app.job.duration_days} days</Text>
        </View>
      </View>

      {app.rejection_reason && app.status === 'REJECTED' && (
        <View style={styles.rejectionContainer}>
          <Text style={styles.rejectionText}>Reason: {app.rejection_reason}</Text>
        </View>
      )}

      <Button
        title="View Job"
        onPress={() => router.push(`/job/${app.job.id}`)}
        variant="secondary"
        icon={<ArrowRight size={18} color={colors.primaryDark} />}
        style={styles.viewBtn}
      />
    </Card>
  );

  const renderEmpty = () => {
    if (isLoading) return null;
    if (isError) {
      return (
        <ErrorState 
          message="Failed to load your applications."
          onRetry={refetch}
        />
      );
    }
    return (
      <EmptyState
        title="No Applications"
        description="You haven't applied to any jobs yet."
        actionLabel="Find Jobs"
        onAction={() => router.push('/(tabs)/jobs')}
      />
    );
  };

  return (
    <ScreenWrapper
      edges={['top', 'left', 'right']}
      statusBarColor={colors.surface}
    >
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>My Applications</Text>
      </View>

      {isLoading ? (
        <View style={styles.skeletonContainer}>
          {[1, 2, 3].map((key) => (
            <Card key={key} style={styles.skeletonCard} padding="lg">
              <Skeleton height={24} width="60%" style={{ marginBottom: spacing.md }} />
              <Skeleton height={16} width="40%" style={{ marginBottom: spacing.lg }} />
              <Skeleton height={48} width="100%" />
            </Card>
          ))}
        </View>
      ) : (
        <FlatList
          data={data || []}
          keyExtractor={(item) => item.id}
          renderItem={renderApplication}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={isRefetching}
          onRefresh={refetch}
          ListEmptyComponent={renderEmpty}
        />
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
  listContent: {
    padding: spacing.xl,
    flexGrow: 1,
  },
  skeletonContainer: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  skeletonCard: {
    marginBottom: spacing.lg,
  },
  card: {
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  title: {
    flex: 1,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    marginRight: spacing.sm,
  },
  date: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  details: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  detailText: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    fontWeight: typography.weights.medium,
  },
  rejectionContainer: {
    backgroundColor: colors.status.errorLight,
    padding: spacing.sm,
    borderRadius: spacing.sm,
    marginBottom: spacing.lg,
  },
  rejectionText: {
    fontSize: typography.sizes.sm,
    color: colors.status.error,
  },
  viewBtn: {
    flexDirection: 'row-reverse',
  },
});
