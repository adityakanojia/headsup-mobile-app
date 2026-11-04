/**
 * Team Management (Contractor)
 * Lists the contractor's workforce with search, infinite scroll, pull-to-refresh,
 * and an "Add Worker" sheet (phone → OTP consent → trade details).
 * Ported from web's app/(dashboard)/team/contractor-team-view.tsx.
 */
import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable } from 'react-native';
import { Plus, Search, Users, X, CheckCircle2 } from 'lucide-react-native';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Skeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { AddWorkerSheet, TeamMemberCard, type AddedWorkerInfo } from '@/features/team';
import { useContractorTeam, useContractorTeamSize } from '@/hooks/useTeam';
import { useStore } from '@/store/useStore';
import { colors, typography, spacing, borderRadius, hitSlop } from '@/theme';
import type { ContractorWorkerProfile } from '@/types/user';

const SUCCESS_BANNER_MS = 3500;

export default function TeamScreen() {
  const role = useStore((s) => s.role);
  const isContractor = role === 'contractor';

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);

  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useContractorTeam(isContractor);
  const { data: sizeData } = useContractorTeamSize(isContractor);

  const team = useMemo(() => data?.pages.flat() ?? [], [data]);

  const filteredTeam = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    if (!q) return team;
    const qDigits = q.replace(/\D/g, '');
    return team.filter((w) => {
      const haystack = [w.name, w.primary_skill_category_name, ...(w.skills?.map((s) => s.name) ?? [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q) || (!!qDigits && w.phone_number.includes(qDigits));
    });
  }, [team, deferredSearch]);

  const totalWorkers = sizeData?.total_workers ?? team.length;

  // Auto-dismiss success banner
  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(null), SUCCESS_BANNER_MS);
    return () => clearTimeout(t);
  }, [successMessage]);

  const handleAdded = useCallback((worker: AddedWorkerInfo) => {
    setSuccessMessage(`${worker.name || 'Worker'} added to your team`);
  }, []);

  const handleEndReached = useCallback(() => {
    // Don't paginate while filtering — results are client-side over loaded pages
    if (hasNextPage && !isFetchingNextPage && !deferredSearch) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, deferredSearch, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: ContractorWorkerProfile }) => <TeamMemberCard worker={item} />,
    [],
  );

  const keyExtractor = useCallback((item: ContractorWorkerProfile) => item.worker_id, []);

  // ── Sub-renders ──────────────────────────────────────────────────────────

  const renderSkeleton = () => (
    <View style={styles.listContent}>
      {[1, 2, 3, 4, 5].map((key) => (
        <Card key={key} style={styles.skeletonCard} padding="base">
          <View style={styles.skeletonRow}>
            <Skeleton width={48} height={48} variant="circular" />
            <View style={styles.skeletonText}>
              <Skeleton height={18} width="65%" />
              <Skeleton height={14} width="45%" />
            </View>
            <Skeleton height={22} width={60} style={{ borderRadius: borderRadius.full }} />
          </View>
        </Card>
      ))}
    </View>
  );

  const renderEmpty = () => {
    if (isError) {
      return <ErrorState message="Failed to load your team. Check your connection." onRetry={refetch} />;
    }
    if (deferredSearch) {
      return (
        <EmptyState
          title="No matches"
          description={`No workers match "${deferredSearch.trim()}".`}
          icon={<Search size={40} color={colors.primaryDark} />}
          actionLabel="Clear search"
          onAction={() => setSearch('')}
        />
      );
    }
    return (
      <EmptyState
        title="No workers yet"
        description="Add your first worker to start managing your team and deploying them to projects."
        icon={<Users size={44} color={colors.primaryDark} />}
        actionLabel="Add First Member"
        onAction={() => setIsAddOpen(true)}
      />
    );
  };

  const renderFooter = () =>
    isFetchingNextPage ? (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    ) : (
      <View style={{ height: spacing.xl }} />
    );

  // ── Role guard (tab is hidden for non-contractors, but deep links can land here)

  if (!isContractor) {
    return (
      <ScreenWrapper edges={['top', 'left', 'right']}>
        <EmptyState
          title="Contractors only"
          description="Team management is available for contractor accounts."
          icon={<Users size={44} color={colors.primaryDark} />}
        />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper
      edges={['top', 'left', 'right']}
      statusBarColor={colors.surface}
    >
      <View style={styles.pageHeader}>
        <View style={styles.titleRow}>
          <View style={styles.titleBlock}>
            <Text style={styles.pageTitle}>My Team</Text>
            <Text style={styles.pageSubtitle}>
              {isLoading
                ? 'Manage your workforce'
                : `${totalWorkers} ${totalWorkers === 1 ? 'worker' : 'workers'}`}
            </Text>
          </View>
          <Pressable
            onPress={() => setIsAddOpen(true)}
            style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
            hitSlop={hitSlop}
            accessibilityRole="button"
            accessibilityLabel="Add worker"
          >
            <Plus size={18} color={colors.text.primary} strokeWidth={2.5} />
            <Text style={styles.addBtnText}>Add</Text>
          </Pressable>
        </View>

        {team.length > 0 && (
          <Input
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name, phone or trade"
            leftIcon={<Search size={18} color={colors.text.muted} />}
            rightIcon={
              search ? (
                <Pressable
                  onPress={() => setSearch('')}
                  hitSlop={hitSlop}
                  accessibilityLabel="Clear search"
                >
                  <X size={18} color={colors.text.muted} />
                </Pressable>
              ) : undefined
            }
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            containerStyle={styles.searchField}
          />
        )}
      </View>

      {!!successMessage && (
        <View style={styles.successBanner} accessibilityLiveRegion="polite">
          <CheckCircle2 size={18} color={colors.status.success} />
          <Text style={styles.successText}>{successMessage}</Text>
        </View>
      )}

      {isLoading ? (
        renderSkeleton()
      ) : (
        <FlatList
          data={filteredTeam}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          refreshing={isRefetching && !isFetchingNextPage}
          onRefresh={refetch}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          initialNumToRender={10}
          windowSize={7}
          removeClippedSubviews
        />
      )}

      <AddWorkerSheet
        visible={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onAdded={handleAdded}
      />
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleBlock: {
    flex: 1,
  },
  pageTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
  },
  pageSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    fontWeight: typography.weights.medium,
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    minHeight: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
  },
  addBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  addBtnText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
  },
  searchField: {
    marginTop: spacing.md,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.status.successLight,
    borderWidth: 1,
    borderColor: colors.status.success,
  },
  successText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
  },
  listContent: {
    padding: spacing.xl,
    flexGrow: 1,
  },
  skeletonCard: {
    marginBottom: spacing.md,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  skeletonText: {
    flex: 1,
    gap: spacing.sm,
  },
  footerLoader: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
});
