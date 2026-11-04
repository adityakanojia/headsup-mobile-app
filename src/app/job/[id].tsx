/**
 * Job Detail Screen
 * Supports both Client and Worker/Contractor views based on user role.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Share,
  Alert,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  MapPin,
  Calendar,
  Users,
  IndianRupee,
  Clock,
  Share2,
  AlertCircle,
  Trash2,
  MessageSquare,
} from 'lucide-react-native';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { StackHeader } from '@/components/Header';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { ErrorState } from '@/components/ErrorState';
import { useStore } from '@/store/useStore';
import { useJobDetail, useApplyJob, useDeleteJob } from '@/hooks/useJobs';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { ApplyWithTeamSheet } from '@/features/team';
import type { ClientJobDetailResponse } from '@/types/jobs';

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { role } = useStore();
  
  const { data: job, isLoading, isError, refetch } = useJobDetail(id, role);
  const applyJobMutation = useApplyJob();
  const deleteJobMutation = useDeleteJob();
  
  const [isApplying, setIsApplying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTeamSheetOpen, setIsTeamSheetOpen] = useState(false);

  const clientJob = role === 'client' ? (job as ClientJobDetailResponse | undefined) : undefined;

  const handleDeleteProject = () => {
    if (!job) return;
    Alert.alert(
      'Delete project?',
      'Only projects awaiting review with no applications can be deleted. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await deleteJobMutation.mutateAsync(job.id);
              Alert.alert('Project deleted', 'Your project has been removed.');
              router.back();
            } catch (err) {
              Alert.alert(
                'Could not delete project',
                err instanceof Error ? err.message : 'Failed to delete project',
              );
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  };

  const handleShare = async () => {
    if (!job) return;
    try {
      await Share.share({
        message: `Check out this job on HeadsUp: ${job.title} in ${job.location}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleApply = async () => {
    if (role === 'contractor') {
      // Contractors apply on behalf of verified team members
      setIsTeamSheetOpen(true);
      return;
    }

    // Individual worker — direct apply
    setIsApplying(true);
    try {
      await applyJobMutation.mutateAsync({
        jobId: id,
        payload: { member_ids: [], new_members: [] },
      });
      Alert.alert('Application submitted', 'The client will review your profile shortly.');
      router.push('/(tabs)/applications');
    } catch (err) {
      Alert.alert('Could not apply', err instanceof Error ? err.message : 'Failed to apply');
    } finally {
      setIsApplying(false);
    }
  };

  const handleTeamApplied = (count: number) => {
    Alert.alert(
      'Application submitted',
      `Your team of ${count} worker${count === 1 ? '' : 's'} has been submitted for review.`,
    );
  };

  if (isLoading) {
    return (
      <ScreenWrapper
        edges={['top', 'left', 'right', 'bottom']}
        statusBarColor={colors.surface}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <StackHeader title="Job Details" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenWrapper>
    );
  }

  if (isError || !job) {
    return (
      <ScreenWrapper
        edges={['top', 'left', 'right', 'bottom']}
        statusBarColor={colors.surface}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <StackHeader title="Error" />
        <ErrorState message="Could not load job details." onRetry={refetch} />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper
      edges={['top', 'left', 'right', 'bottom']}
      statusBarColor={colors.surface}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <StackHeader 
        title="Job Details" 
        rightElement={
          <Button 
            variant="ghost" 
            size="sm" 
            onPress={handleShare} 
            icon={<Share2 size={20} color={colors.text.primary} />} 
            title="" 
            fullWidth={false}
          />
        }
      />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View style={styles.headerSection}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{job.title}</Text>
            <StatusBadge
              status={
                role === 'client' && job.moderation_status === 'PENDING_REVIEW'
                  ? 'PENDING_REVIEW'
                  : job.operational_status
              }
            />
          </View>
          
          <Text style={styles.tradeType}>
            {job.trade_type_name || 'General'} · {job.worker_category} · {job.project_type}
          </Text>

          {role === 'client' && (
            <View style={styles.moderationBanner}>
              <Text style={styles.moderationLabel}>Moderation Status:</Text>
              <StatusBadge status={job.moderation_status} />
            </View>
          )}
          
          {job.client && (
            <View style={styles.clientInfo}>
              <View style={styles.clientAvatar}>
                <Text style={styles.clientInitials}>
                  {(job.client.name?.trim() || job.client.company_name?.trim() || 'C')
                    .charAt(0)
                    .toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={styles.clientName}>
                  {job.client.company_name?.trim() || job.client.name?.trim() || 'Verified Client'}
                </Text>
                {job.client.is_verified && (
                  <Text style={styles.verifiedText}>✓ Verified Client</Text>
                )}
              </View>
            </View>
          )}
        </View>

        {/* Project Photos */}
        {job.images && job.images.length > 0 && (
          <View style={styles.imagesSection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.imagesScroll}
            >
              {job.images.map((uri, idx) => (
                <Image
                  key={`${uri}-${idx}`}
                  source={{ uri }}
                  style={styles.projectImage}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Client Applications Summary & Project Chat */}
        {clientJob && (
          <Card style={styles.section} padding="lg">
            <Text style={styles.sectionTitle}>Applications Overview</Text>
            <Text style={styles.bodyText}>
              Total applications received: {clientJob.total_applications ?? 0}
            </Text>
            {clientJob.review?.reason ? (
              <Text style={[styles.bodyText, { marginTop: spacing.xs }]}>
                Review note: {clientJob.review.reason}
              </Text>
            ) : null}
            <Button
              title="Message Project Manager"
              variant="secondary"
              size="sm"
              onPress={() =>
                router.push({
                  pathname: '/messages/[jobId]',
                  params: {
                    jobId: job.id,
                    jobTitle: job.title,
                  },
                } as never)
              }
              icon={<MessageSquare size={16} color={colors.primaryDark} />}
              style={styles.messageManagerBtn}
            />
          </Card>
        )}

        {/* Key Details Grid */}
        <View style={styles.gridContainer}>
          <Card style={styles.gridItem} padding="md">
            <IndianRupee size={24} color={colors.primaryDark} style={styles.gridIcon} />
            <Text style={styles.gridLabel}>Compensation</Text>
            <Text style={styles.gridValue}>
              {job.wage_type === 'CONTRACTUAL' 
                ? `₹${job.contract_price}` 
                : `₹${job.wage_min}-${job.wage_max}/day`}
            </Text>
          </Card>
          
          <Card style={styles.gridItem} padding="md">
            <Users size={24} color={colors.primaryDark} style={styles.gridIcon} />
            <Text style={styles.gridLabel}>Workers</Text>
            <Text style={styles.gridValue}>{job.total_workers_required} needed</Text>
            <Text style={styles.gridSubValue}>{job.filled_workers} filled</Text>
          </Card>
          
          <Card style={styles.gridItem} padding="md">
            <Clock size={24} color={colors.primaryDark} style={styles.gridIcon} />
            <Text style={styles.gridLabel}>Duration</Text>
            <Text style={styles.gridValue}>{job.duration_days} days</Text>
          </Card>
          
          <Card style={styles.gridItem} padding="md">
            <Calendar size={24} color={colors.primaryDark} style={styles.gridIcon} />
            <Text style={styles.gridLabel}>Start Date</Text>
            <Text style={styles.gridValue}>
              {job.start_date ? new Date(job.start_date).toLocaleDateString() : 'Flexible'}
            </Text>
          </Card>
        </View>

        {/* Location Section */}
        <Card style={styles.section} padding="lg">
          <View style={styles.sectionHeader}>
            <MapPin size={20} color={colors.text.primary} />
            <Text style={styles.sectionTitle}>Location</Text>
          </View>
          <Text style={styles.bodyText}>{job.location}</Text>
        </Card>

        {/* Description Section */}
        <Card style={styles.section} padding="lg">
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Job Description</Text>
          </View>
          <Text style={styles.bodyText}>{job.description}</Text>
        </Card>

        {/* Requirements Section */}
        {job.special_requirements && (
          <Card style={styles.section} padding="lg">
            <View style={styles.sectionHeader}>
              <AlertCircle size={20} color={colors.text.primary} />
              <Text style={styles.sectionTitle}>Special Requirements</Text>
            </View>
            <Text style={styles.bodyText}>{job.special_requirements}</Text>
          </Card>
        )}

        {role === 'client' && job.moderation_status === 'PENDING_REVIEW' && (
          <Button
            title="Delete Project"
            variant="outline"
            onPress={handleDeleteProject}
            loading={isDeleting}
            icon={<Trash2 size={18} color={colors.status.error} />}
            style={styles.deleteBtn}
          />
        )}
        
        {/* Bottom Spacer */}
        <View style={{ height: spacing.xl }} />
      </ScrollView>

      {/* Action Footer */}
      {role !== 'client' && job.operational_status === 'OPEN' && (
        <View style={styles.footer}>
          <Button
            title={role === 'contractor' ? "Apply with Team" : "Apply Now"}
            onPress={handleApply}
            loading={isApplying}
          />
        </View>
      )}

      {role === 'contractor' && (
        <ApplyWithTeamSheet
          visible={isTeamSheetOpen}
          onClose={() => setIsTeamSheetOpen(false)}
          jobId={job.id}
          jobTitle={job.title}
          slotsAvailable={
            job.available_workers ?? Math.max(job.total_workers_required - job.filled_workers, 0)
          }
          onApplied={handleTeamApplied}
        />
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.xl,
  },
  headerSection: {
    marginBottom: spacing.xl,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  title: {
    flex: 1,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    letterSpacing: -0.3,
    lineHeight: 29,
    marginRight: spacing.md,
  },
  tradeType: {
    fontSize: typography.sizes.sm + 1,
    color: colors.primaryDark,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm,
  },
  moderationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  moderationLabel: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    fontWeight: typography.weights.medium,
  },
  imagesSection: {
    marginBottom: spacing.xl,
  },
  imagesScroll: {
    gap: spacing.md,
  },
  projectImage: {
    width: 220,
    height: 150,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surfaceMuted,
  },
  deleteBtn: {
    marginTop: spacing.md,
    borderColor: colors.status.error,
  },
  messageManagerBtn: {
    marginTop: spacing.md,
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  clientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  clientInitials: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  clientName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
  },
  verifiedText: {
    fontSize: typography.sizes.sm,
    color: colors.status.success,
    marginTop: 2,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  gridItem: {
    width: '48%',
  },
  gridIcon: {
    marginBottom: spacing.sm,
  },
  gridLabel: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  gridValue: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
  },
  gridSubValue: {
    fontSize: typography.sizes.xs,
    color: colors.text.muted,
    marginTop: 2,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  bodyText: {
    fontSize: typography.sizes.base,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.base,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 10,
  },
});
