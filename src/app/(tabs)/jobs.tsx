/**
 * Jobs Feed (Worker / Contractor)
 * Uses infinite scrolling to load jobs from the API.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { MapPin, ArrowRight } from 'lucide-react-native';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { useStore } from '@/store/useStore';
import { useInfiniteJobs } from '@/hooks/useJobs';
import { colors, typography, spacing, borderRadius } from '@/theme';
import type { JobResponse } from '@/types/jobs';

export default function JobsScreen() {
  const router = useRouter();
  const { role } = useStore();
  const [recommended, setRecommended] = useState(false);

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
  } = useInfiniteJobs(role, recommended);

  // Flatten infinite pages into a single deduplicated array
  const jobs = React.useMemo(() => {
    const raw = data?.pages.flatMap((page) => page.data) || [];
    const seen = new Set<string>();
    return raw.filter((job) => {
      if (seen.has(job.id)) return false;
      seen.add(job.id);
      return true;
    });
  }, [data]);

  const renderJobCard = ({ item: job }: { item: JobResponse }) => (
    <Card style={styles.jobCard} padding="lg">
      <View style={styles.jobHeader}>
        <Text style={styles.jobTitle} numberOfLines={2}>
          {job.title}
        </Text>
        <StatusBadge status={job.operational_status} />
      </View>

      <Text style={styles.tradeType}>{job.trade_type_name || 'General'}</Text>

      <View style={styles.locationContainer}>
        <MapPin size={16} color={colors.text.secondary} />
        <Text style={styles.locationText} numberOfLines={1}>
          {job.location}
        </Text>
      </View>

      <View style={styles.jobDetails}>
        <View style={styles.jobDetailItem}>
          <Text style={styles.detailLabel}>Rate</Text>
          <Text style={styles.detailValue}>
            {job.wage_type === 'CONTRACTUAL' 
              ? `₹${job.contract_price} (Total)`
              : `₹${job.wage_min}-${job.wage_max}/day`}
          </Text>
        </View>
        <View style={styles.jobDetailItem}>
          <Text style={styles.detailLabel}>Required</Text>
          <Text style={styles.detailValue}>{job.total_workers_required} workers</Text>
        </View>
        <View style={styles.jobDetailItem}>
          <Text style={styles.detailLabel}>Duration</Text>
          <Text style={styles.detailValue}>{job.duration_days} days</Text>
        </View>
      </View>

      <Button
        title="View Job"
        onPress={() => router.push(`/job/${job.id}`)}
        variant="secondary"
        icon={<ArrowRight size={18} color={colors.primaryDark} />}
        style={styles.viewBtn}
      />
    </Card>
  );

  const renderFooter = () => {
    if (!isFetchingNextPage) return <View style={{ height: spacing.xl }} />;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) return null; // handled separately
    if (isError) {
      return (
        <ErrorState 
          message="Failed to load jobs. Check your connection."
          onRetry={refetch}
        />
      );
    }
    return (
      <EmptyState
        title="No jobs found"
        description={
          recommended
            ? "We couldn't find any jobs matching your skills right now."
            : "There are no open jobs at the moment."
        }
        actionLabel={recommended ? "View all jobs" : undefined}
        onAction={recommended ? () => setRecommended(false) : undefined}
      />
    );
  };

  return (
    <ScreenWrapper
      edges={['top', 'left', 'right']}
      statusBarColor={colors.surface}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Find Jobs</Text>
        <View style={styles.filterTabs}>
          <Pressable
            style={[styles.tab, !recommended && styles.tabActive]}
            onPress={() => setRecommended(false)}
          >
            <Text style={[styles.tabText, !recommended && styles.tabTextActive]}>
              All Jobs
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, recommended && styles.tabActive]}
            onPress={() => setRecommended(true)}
          >
            <Text style={[styles.tabText, recommended && styles.tabTextActive]}>
              Recommended
            </Text>
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.skeletonContainer}>
          {[1, 2, 3].map((key) => (
            <Card key={key} style={styles.skeletonCard} padding="lg">
              <Skeleton height={24} width="70%" style={{ marginBottom: spacing.md }} />
              <Skeleton height={16} width="40%" style={{ marginBottom: spacing.lg }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg }}>
                <Skeleton height={40} width="30%" />
                <Skeleton height={40} width="30%" />
                <Skeleton height={40} width="30%" />
              </View>
              <Skeleton height={48} width="100%" />
            </Card>
          ))}
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          renderItem={renderJobCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          refreshing={isRefetching && !isFetchingNextPage}
          onRefresh={refetch}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
        />
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  tabActive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  tabText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text.secondary,
  },
  tabTextActive: {
    color: colors.text.primary,
    fontWeight: typography.weights.bold,
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
  jobCard: {
    marginBottom: spacing.lg,
  },
  jobHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  jobTitle: {
    flex: 1,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    marginRight: spacing.sm,
  },
  tradeType: {
    fontSize: typography.sizes.sm,
    color: colors.primaryDark,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  locationText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginLeft: 6,
  },
  jobDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  jobDetailItem: {
    alignItems: 'center',
    flex: 1,
  },
  detailLabel: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
  },
  viewBtn: {
    flexDirection: 'row-reverse',
  },
  footerLoader: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
});
