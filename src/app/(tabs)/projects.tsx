/**
 * Client Projects Screen — connected to GET /jobs/client/mine
 */
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  MapPin,
  Plus,
  Users,
  CalendarDays,
  IndianRupee,
  ArrowRight,
  Building2,
} from 'lucide-react-native';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { useClientJobs } from '@/hooks/useJobs';
import { colors, typography, spacing, borderRadius } from '@/theme';
import type { JobResponse } from '@/types/jobs';

type FilterTab = 'ALL' | 'PENDING_REVIEW' | 'ACTIVE' | 'COMPLETED';

const FILTERS: { key: FilterTab; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING_REVIEW', label: 'In Review' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'COMPLETED', label: 'Completed' },
];

function formatCurrency(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === '') return '0';
  const num = Number(val);
  if (!Number.isFinite(num)) return String(val);
  return num.toLocaleString('en-IN');
}

export default function ProjectsScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('ALL');

  const {
    data: jobs,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useClientJobs(50);

  const allJobs = useMemo(() => jobs ?? [], [jobs]);

  const filteredJobs = useMemo(() => {
    if (activeFilter === 'ALL') return allJobs;
    if (activeFilter === 'PENDING_REVIEW') {
      return allJobs.filter((j) => j.moderation_status === 'PENDING_REVIEW');
    }
    if (activeFilter === 'ACTIVE') {
      return allJobs.filter(
        (j) =>
          j.moderation_status === 'APPROVED' &&
          ['SCHEDULED', 'OPEN', 'FILLED', 'IN_PROGRESS', 'OVERTIME'].includes(
            j.operational_status,
          ),
      );
    }
    return allJobs.filter(
      (j) =>
        j.operational_status === 'COMPLETED' ||
        j.operational_status === 'CLOSED' ||
        j.moderation_status === 'REJECTED',
    );
  }, [allJobs, activeFilter]);

  const handleCreateProject = () => {
    router.push('/(tabs)/createJob');
  };

  const renderProjectCard = ({ item: job }: { item: JobResponse }) => {
    const primaryStatus =
      job.moderation_status === 'PENDING_REVIEW'
        ? 'PENDING_REVIEW'
        : job.moderation_status === 'REJECTED'
          ? 'REJECTED'
          : job.operational_status;

    const firstImage = job.images?.[0];

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View project ${job.title}`}
        onPress={() => router.push(`/job/${job.id}` as any)}
        style={({ pressed }) => [
          styles.cardPressable,
          pressed && styles.cardPressed,
        ]}
      >
        <Card style={styles.projectCard} padding="lg">
          <View style={styles.cardTopRow}>
            {firstImage ? (
              <Image source={{ uri: firstImage }} style={styles.thumbnail} />
            ) : (
              <View style={styles.thumbnailPlaceholder}>
                <Building2 size={22} color={colors.primaryDark} />
              </View>
            )}

            <View style={styles.titleContainer}>
              <View style={styles.badgesRow}>
                <Text style={styles.projectTypeTag}>{job.project_type}</Text>
                <StatusBadge status={primaryStatus} />
              </View>

              <Text style={styles.projectTitle} numberOfLines={2}>
                {job.title}
              </Text>

              <Text style={styles.tradeText} numberOfLines={1}>
                {job.trade_type_name || 'General Trade'} · {job.worker_category}
              </Text>
            </View>
          </View>

          <View style={styles.locationRow}>
            <MapPin size={15} color={colors.text.secondary} />
            <Text style={styles.locationText} numberOfLines={1}>
              {job.location}
            </Text>
          </View>

          <View style={styles.metricsBox}>
            <View style={styles.metricItem}>
              <View style={styles.metricLabelRow}>
                <IndianRupee size={13} color={colors.text.secondary} />
                <Text style={styles.metricLabel}>Compensation</Text>
              </View>
              <Text style={styles.metricValue} numberOfLines={1}>
                {job.wage_type === 'CONTRACTUAL'
                  ? `₹${formatCurrency(job.contract_price)}`
                  : `₹${formatCurrency(job.wage_min)}–${formatCurrency(job.wage_max)}/d`}
              </Text>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricItem}>
              <View style={styles.metricLabelRow}>
                <Users size={13} color={colors.text.secondary} />
                <Text style={styles.metricLabel}>Workforce</Text>
              </View>
              <Text style={styles.metricValue}>
                {job.filled_workers}/{job.total_workers_required} workers
              </Text>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricItem}>
              <View style={styles.metricLabelRow}>
                <CalendarDays size={13} color={colors.text.secondary} />
                <Text style={styles.metricLabel}>Duration</Text>
              </View>
              <Text style={styles.metricValue}>{job.duration_days} days</Text>
            </View>
          </View>

          <View style={styles.cardFooter}>
            <Text style={styles.dateText}>
              {job.start_date
                ? `Starts ${job.start_date}`
                : `Posted ${new Date(job.created_at).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}`}
            </Text>

            <View style={styles.viewDetailsAction}>
              <Text style={styles.viewDetailsText}>View details</Text>
              <ArrowRight size={16} color={colors.primaryDark} />
            </View>
          </View>
        </Card>
      </Pressable>
    );
  };

  const renderEmpty = () => {
    if (isLoading) return null;
    if (isError) {
      return (
        <ErrorState
          message={
            error instanceof Error
              ? error.message
              : 'Failed to load your projects. Check your connection and try again.'
          }
          onRetry={refetch}
        />
      );
    }

    if (activeFilter !== 'ALL' && allJobs.length > 0) {
      return (
        <EmptyState
          title="No matching projects"
          description="You don't have any projects in this category yet."
          actionLabel="Show all projects"
          onAction={() => setActiveFilter('ALL')}
        />
      );
    }

    return (
      <EmptyState
        title="No projects posted yet"
        description="Create your first project to start hiring verified workers and contractors."
        actionLabel="Post a project"
        onAction={handleCreateProject}
      />
    );
  };

  return (
    <ScreenWrapper
      edges={['top', 'left', 'right']}
      statusBarColor={colors.surface}
    >
      <View style={styles.pageHeader}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.pageTitle}>My Projects</Text>
            <Text style={styles.pageSubtitle}>
              {allJobs.length === 1
                ? '1 project total'
                : `${allJobs.length} projects total`}
            </Text>
          </View>

          <Button
            title="New Project"
            onPress={handleCreateProject}
            size="sm"
            icon={<Plus size={16} color={colors.text.primary} />}
            fullWidth={false}
          />
        </View>

        <View style={styles.filterTabs}>
          {FILTERS.map((tab) => {
            const isActive = activeFilter === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveFilter(tab.key)}
                style={[styles.filterTab, isActive && styles.filterTabActive]}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    isActive && styles.filterTabTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {isLoading && !jobs ? (
        <View style={styles.skeletonContainer}>
          {[1, 2, 3].map((key) => (
            <Card key={key} style={styles.projectCard} padding="lg">
              <Skeleton
                height={22}
                width="65%"
                style={{ marginBottom: spacing.sm }}
              />
              <Skeleton
                height={16}
                width="45%"
                style={{ marginBottom: spacing.md }}
              />
              <Skeleton
                height={56}
                width="100%"
                style={{ marginBottom: spacing.md }}
              />
              <Skeleton height={20} width="40%" />
            </Card>
          ))}
        </View>
      ) : (
        <FlatList
          data={filteredJobs}
          keyExtractor={(item) => item.id}
          renderItem={renderProjectCard}
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
    gap: spacing.md,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
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
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 3,
    gap: 4,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  filterTabActive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  filterTabText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.text.secondary,
  },
  filterTabTextActive: {
    color: colors.text.primary,
    fontWeight: typography.weights.bold,
  },
  skeletonContainer: {
    padding: spacing.base,
    gap: spacing.md,
  },
  listContent: {
    padding: spacing.base,
    paddingBottom: spacing['4xl'],
    flexGrow: 1,
    gap: spacing.md,
  },
  cardPressable: {
    borderRadius: borderRadius.xl,
  },
  cardPressed: {
    opacity: 0.85,
  },
  projectCard: {
    borderRadius: borderRadius.xl,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceMuted,
  },
  thumbnailPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
    gap: 4,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  projectTypeTag: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
    letterSpacing: 0.6,
  },
  projectTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    lineHeight: 22,
  },
  tradeText: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    fontWeight: typography.weights.medium,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.md,
  },
  locationText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
  },
  metricsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  metricItem: {
    flex: 1,
    gap: 3,
  },
  metricLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metricLabel: {
    fontSize: 10,
    color: colors.text.secondary,
  },
  metricValue: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.borderLight,
    marginHorizontal: spacing.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  dateText: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
  },
  viewDetailsAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewDetailsText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
});
