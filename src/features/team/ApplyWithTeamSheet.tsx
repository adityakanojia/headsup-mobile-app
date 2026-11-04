/**
 * ApplyWithTeamSheet — contractor applies to a job by selecting verified team members.
 * Ported from web's components/jobs/ApplicationModal (contractor branch).
 *
 * - Only OTP-verified team members can be submitted (member_ids). new_members stays
 *   empty, matching the web: we never bypass worker phone verification.
 * - Selection is capped at the job's open slots.
 * - Workers can be added inline via AddWorkerSheet; the newly added worker is
 *   auto-selected once the team list refetches (matched by phone number).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { X, Check, UserPlus, Users, Briefcase } from 'lucide-react-native';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Avatar } from '@/components/Avatar';
import { ErrorState } from '@/components/ErrorState';
import { useContractorTeam } from '@/hooks/useTeam';
import { useApplyJob } from '@/hooks/useJobs';
import { colors, typography, spacing, borderRadius, hitSlop } from '@/theme';
import type { ContractorWorkerProfile } from '@/types/user';
import { AddWorkerSheet, type AddedWorkerInfo } from './AddWorkerSheet';
import { formatPhoneForDisplay, getErrorMessage } from './validation';

const NOTE_MAX_LENGTH = 500;

interface ApplyWithTeamSheetProps {
  visible: boolean;
  onClose: () => void;
  jobId: string;
  jobTitle: string;
  /** Open slots on the job — selection is capped at this number. */
  slotsAvailable: number;
  onApplied?: (selectedCount: number) => void;
}

export function ApplyWithTeamSheet({
  visible,
  onClose,
  jobId,
  jobTitle,
  slotsAvailable,
  onApplied,
}: ApplyWithTeamSheetProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);

  const teamQuery = useContractorTeam(visible);
  const applyMutation = useApplyJob();

  const team = useMemo(() => teamQuery.data?.pages.flat() ?? [], [teamQuery.data]);
  const maxSelectable = Math.max(slotsAvailable, 0);
  const selectedCount = selectedIds.size;
  const atCapacity = selectedCount >= maxSelectable;

  // Reset on dismiss
  useEffect(() => {
    if (!visible) {
      setSelectedIds(new Set());
      setNote('');
      setError('');
      setIsAddOpen(false);
      setPendingPhone(null);
      applyMutation.reset();
    }
    // applyMutation.reset is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Auto-select a worker just added via the inline flow once they appear in the list
  useEffect(() => {
    if (!pendingPhone) return;
    const match = team.find((w) => w.phone_number === pendingPhone);
    if (!match) return;
    setSelectedIds((prev) => {
      if (prev.has(match.worker_id) || prev.size >= maxSelectable) return prev;
      const next = new Set(prev);
      next.add(match.worker_id);
      return next;
    });
    setPendingPhone(null);
  }, [team, pendingPhone, maxSelectable]);

  const toggle = useCallback(
    (workerId: string) => {
      setError('');
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(workerId)) {
          next.delete(workerId);
        } else if (next.size < maxSelectable) {
          next.add(workerId);
        }
        return next;
      });
    },
    [maxSelectable],
  );

  const handleClose = () => {
    if (applyMutation.isPending) return;
    Keyboard.dismiss();
    onClose();
  };

  const handleWorkerAdded = useCallback((worker: AddedWorkerInfo) => {
    setPendingPhone(worker.phoneNumber);
  }, []);

  const submit = async () => {
    if (selectedCount === 0) {
      setError('Select at least one team member to apply.');
      return;
    }
    if (selectedCount > maxSelectable) {
      setError(`This job only has ${maxSelectable} open slot${maxSelectable === 1 ? '' : 's'}.`);
      return;
    }
    Keyboard.dismiss();
    setError('');
    try {
      await applyMutation.mutateAsync({
        jobId,
        payload: {
          member_ids: Array.from(selectedIds),
          new_members: [], // Inline unverified members are intentionally not supported
          note: note.trim() || null,
        },
      });
      onApplied?.(selectedCount);
      onClose();
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to submit application. Please try again.'));
    }
  };

  // ── Render helpers ───────────────────────────────────────────────────────

  const renderMember = ({ item }: { item: ContractorWorkerProfile }) => {
    const selected = selectedIds.has(item.worker_id);
    const disabled = !selected && atCapacity;
    const name = item.name?.trim() || 'Unnamed Worker';
    const trade = item.primary_skill_category_name || item.skills?.[0]?.name;

    return (
      <Pressable
        onPress={() => toggle(item.worker_id)}
        disabled={disabled}
        style={({ pressed }) => [
          styles.memberRow,
          selected && styles.memberRowSelected,
          disabled && styles.memberRowDisabled,
          pressed && !disabled && styles.memberRowPressed,
        ]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected, disabled }}
        accessibilityLabel={`${name}, ${trade ?? 'no trade'}`}
      >
        <View style={[styles.checkbox, selected && styles.checkboxChecked]}>
          {selected && <Check size={14} color={colors.text.primary} strokeWidth={3} />}
        </View>
        <Avatar name={name} size={40} />
        <View style={styles.memberInfo}>
          <Text style={styles.memberName} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.memberMeta} numberOfLines={1}>
            {formatPhoneForDisplay(item.phone_number)}
          </Text>
          {!!trade && (
            <View style={styles.tradeRow}>
              <Briefcase size={11} color={colors.primaryDark} />
              <Text style={styles.tradeText} numberOfLines={1}>
                {trade}
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  const renderListHeader = () => (
    <View>
      <View style={styles.jobBanner}>
        <Text style={styles.jobBannerLabel}>Applying to</Text>
        <Text style={styles.jobBannerTitle} numberOfLines={2}>
          {jobTitle}
        </Text>
      </View>

      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionTitleRow}>
          <Users size={16} color={colors.primaryDark} />
          <Text style={styles.sectionTitle}>Verified team members</Text>
        </View>
        <Pressable
          onPress={() => setIsAddOpen(true)}
          hitSlop={hitSlop}
          style={styles.addLink}
          accessibilityRole="button"
        >
          <UserPlus size={14} color={colors.primaryDark} />
          <Text style={styles.addLinkText}>Add worker</Text>
        </Pressable>
      </View>
      {atCapacity && maxSelectable > 0 && (
        <Text style={styles.capacityHint}>
          All {maxSelectable} open slot{maxSelectable === 1 ? '' : 's'} selected.
        </Text>
      )}
    </View>
  );

  const renderListEmpty = () => {
    if (teamQuery.isLoading) {
      return <ActivityIndicator color={colors.primary} style={styles.listLoader} />;
    }
    if (teamQuery.isError) {
      return <ErrorState message="Couldn't load your team." onRetry={teamQuery.refetch} />;
    }
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyTitle}>No team members yet</Text>
        <Text style={styles.emptyText}>
          Add and verify a worker to include them in this application.
        </Text>
        <Button
          title="Add Worker"
          onPress={() => setIsAddOpen(true)}
          variant="secondary"
          fullWidth={false}
          icon={<UserPlus size={18} color={colors.primaryDark} />}
          style={styles.emptyBtn}
        />
      </View>
    );
  };

  const renderListFooter = () => (
    <View>
      {teamQuery.isFetchingNextPage && (
        <ActivityIndicator color={colors.primary} style={styles.listLoader} />
      )}
      {team.length > 0 && (
        <Input
          label="Note to client (optional)"
          value={note}
          onChangeText={(t) => setNote(t.slice(0, NOTE_MAX_LENGTH))}
          placeholder="e.g. Team available from Monday, own tools"
          multiline
          numberOfLines={3}
          maxLength={NOTE_MAX_LENGTH}
          containerStyle={styles.noteField}
        />
      )}
    </View>
  );

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaProvider>
        <SafeAreaView
          style={styles.container}
          edges={['top', 'left', 'right', 'bottom']}
        >
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.header}>
              <View style={styles.flex}>
                <Text style={styles.headerTitle}>Select Your Team</Text>
                <Text style={styles.headerSubtitle}>
                  Selected{' '}
                  <Text style={selectedCount > 0 ? styles.countActive : undefined}>
                    {selectedCount}
                  </Text>{' '}
                  / {maxSelectable} open slot{maxSelectable === 1 ? '' : 's'}
                </Text>
              </View>
              <Pressable
                onPress={handleClose}
                disabled={applyMutation.isPending}
                style={styles.closeBtn}
                hitSlop={hitSlop}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <X size={22} color={colors.text.secondary} />
              </Pressable>
            </View>

            <FlatList
              data={team}
              keyExtractor={(item) => item.worker_id}
              renderItem={renderMember}
              extraData={selectedIds}
              ListHeaderComponent={renderListHeader}
              ListEmptyComponent={renderListEmpty}
              ListFooterComponent={renderListFooter}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              onEndReached={() => {
                if (teamQuery.hasNextPage && !teamQuery.isFetchingNextPage) {
                  teamQuery.fetchNextPage();
                }
              }}
              onEndReachedThreshold={0.5}
            />

            <View style={styles.footer}>
              {!!error && <Text style={styles.errorText}>{error}</Text>}
              <Text style={styles.footerHint}>
                Only OTP-verified members can be deployed.
              </Text>
              <Button
                title={selectedCount > 0 ? `Apply with ${selectedCount} worker${selectedCount === 1 ? '' : 's'}` : 'Apply'}
                onPress={submit}
                loading={applyMutation.isPending}
                disabled={selectedCount === 0 || maxSelectable === 0}
                size="lg"
              />
            </View>
          </KeyboardAvoidingView>

          {/* Nested so it presents above this sheet on iOS */}
          <AddWorkerSheet
            visible={isAddOpen}
            onClose={() => setIsAddOpen(false)}
            onAdded={handleWorkerAdded}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.base,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.heavy,
    color: colors.text.primary,
  },
  headerSubtitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text.secondary,
    marginTop: 2,
  },
  countActive: {
    color: colors.status.success,
    fontWeight: typography.weights.heavy,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: spacing.xl,
    flexGrow: 1,
  },
  jobBanner: {
    padding: spacing.base,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
    marginBottom: spacing.xl,
  },
  jobBannerLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  jobBannerTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.heavy,
    color: colors.text.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  addLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  addLinkText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  capacityHint: {
    fontSize: typography.sizes.xs,
    color: colors.status.warning,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.md,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  memberRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  memberRowDisabled: {
    opacity: 0.45,
  },
  memberRowPressed: {
    transform: [{ scale: 0.99 }],
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  memberInfo: {
    flex: 1,
    minWidth: 0,
  },
  memberName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
  },
  memberMeta: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.text.secondary,
    marginTop: 1,
  },
  tradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  tradeText: {
    flexShrink: 1,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.primaryDark,
  },
  listLoader: {
    marginVertical: spacing.xl,
  },
  emptyBox: {
    alignItems: 'center',
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  emptyTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  emptyBtn: {
    minWidth: 160,
  },
  noteField: {
    marginTop: spacing.lg,
  },
  footer: {
    padding: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  footerHint: {
    fontSize: typography.sizes.xs,
    color: colors.text.muted,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  errorText: {
    fontSize: typography.sizes.sm,
    color: colors.status.error,
    fontWeight: typography.weights.medium,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
});
