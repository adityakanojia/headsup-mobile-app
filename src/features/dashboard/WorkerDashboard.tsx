/**
 * Worker Dashboard View
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Briefcase, ArrowRight, Wallet, CheckCircle2, MapPin, Clock } from 'lucide-react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/Skeleton';
import { StatusBadge } from '@/components/StatusBadge';
import { useWorkerDashboard, useTodayAttendance, useMarkAttendance } from '@/hooks/useJobs';
import { colors, typography, spacing } from '@/theme';

function tryGetDeviceCoordinates(): Promise<{
  geo_lat: number | null;
  geo_lng: number | null;
  geo_accuracy_m: number | null;
}> {
  return new Promise((resolve) => {
    const geo = (globalThis as any)?.navigator?.geolocation;
    if (!geo || typeof geo.getCurrentPosition !== 'function') {
      resolve({ geo_lat: null, geo_lng: null, geo_accuracy_m: null });
      return;
    }
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve({ geo_lat: null, geo_lng: null, geo_accuracy_m: null });
      }
    }, 5000);

    geo.getCurrentPosition(
      (pos: any) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({
          geo_lat: typeof pos?.coords?.latitude === 'number' ? pos.coords.latitude : null,
          geo_lng: typeof pos?.coords?.longitude === 'number' ? pos.coords.longitude : null,
          geo_accuracy_m: typeof pos?.coords?.accuracy === 'number' ? pos.coords.accuracy : null,
        });
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ geo_lat: null, geo_lng: null, geo_accuracy_m: null });
      },
      { enableHighAccuracy: true, timeout: 4500, maximumAge: 60000 },
    );
  });
}

function WorkerAssignmentAttendanceBar({
  jobId,
  operationalStatus,
  markedTodayFromDashboard,
}: {
  jobId: string;
  operationalStatus: string;
  markedTodayFromDashboard?: boolean;
}) {
  const isJobStarted =
    operationalStatus === 'IN_PROGRESS' || operationalStatus === 'OVERTIME';
  const { data: todayLog, isLoading: isChecking } = useTodayAttendance(
    jobId,
    isJobStarted,
  );
  const markMutation = useMarkAttendance();
  const [isLocating, setIsLocating] = useState(false);

  const isMarked = Boolean(markedTodayFromDashboard) || Boolean(todayLog && todayLog.status);

  if (!isJobStarted) {
    return (
      <View style={styles.attendancePendingBanner}>
        <Clock size={15} color="#B45309" />
        <Text style={styles.attendancePendingText}>
          Assigned — Attendance opens once the project starts
        </Text>
      </View>
    );
  }

  if (isMarked) {
    return (
      <View style={styles.attendanceMarkedBanner}>
        <CheckCircle2 size={16} color={colors.status.success} />
        <Text style={styles.attendanceMarkedText}>
          Attendance Marked Today
        </Text>
      </View>
    );
  }

  const handleMark = async () => {
    try {
      setIsLocating(true);
      const coords = await tryGetDeviceCoordinates();
      setIsLocating(false);
      await markMutation.mutateAsync({
        job_id: jobId,
        geo_lat: coords.geo_lat,
        geo_lng: coords.geo_lng,
        geo_accuracy_m: coords.geo_accuracy_m,
      });
    } catch (err: any) {
      setIsLocating(false);
      Alert.alert(
        'Attendance Error',
        err?.message || 'Could not mark attendance. Please try again.',
      );
    }
  };

  return (
    <Button
      title={isLocating ? 'Checking Location...' : 'Mark Attendance'}
      onPress={handleMark}
      loading={isChecking || isLocating || markMutation.isPending}
      disabled={isChecking || isLocating || markMutation.isPending}
      icon={<MapPin size={16} color={colors.text.primary} />}
      style={styles.markAttendanceBtn}
    />
  );
}

export function WorkerDashboard() {
  const router = useRouter();
  const { data, isLoading, isError, isRefetching, refetch } = useWorkerDashboard();

  if (isLoading && !data) {
    return (
      <View style={styles.container}>
        <View style={styles.statsContainer}>
          <Skeleton height={100} style={styles.statCard} />
          <Skeleton height={100} style={styles.statCard} />
        </View>
        <Skeleton height={24} width={150} style={{ margin: spacing.xl }} />
        <Skeleton height={120} style={{ marginHorizontal: spacing.xl, marginBottom: spacing.md }} />
        <Skeleton height={120} style={{ marginHorizontal: spacing.xl }} />
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
      <View style={styles.statsContainer}>
        <Card style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <Wallet size={20} color={colors.primaryDark} />
          </View>
          <Text style={styles.statLabel}>Earnings</Text>
          <Text style={styles.statValue}>₹{data?.total_accumulated_earnings || 0}</Text>
        </Card>
        
        <Card style={styles.statCard}>
          <View style={[styles.statIconContainer, { backgroundColor: colors.status.infoLight }]}>
            <Briefcase size={20} color={colors.status.info} />
          </View>
          <Text style={styles.statLabel}>Active Jobs</Text>
          <Text style={styles.statValue}>{data?.active_assignments_count || 0}</Text>
        </Card>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Current Assignments</Text>
      </View>

      {activeJobs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>You don't have any active jobs right now.</Text>
          <Button
            title="Find Jobs"
            onPress={() => router.push('/(tabs)/jobs')}
            style={styles.findJobsBtn}
          />
        </View>
      ) : (
        <View style={styles.jobsList}>
          {activeJobs.map((job) => (
            <Card key={job.assignment_id} style={styles.jobCard}>
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
                  <Text style={styles.detailLabel}>Rate</Text>
                  <Text style={styles.detailValue}>₹{job.daily_rate}/day</Text>
                </View>
                <View style={styles.jobDetailItem}>
                  <Text style={styles.detailLabel}>Worked</Text>
                  <Text style={styles.detailValue}>{job.days_worked}/{job.duration_days} days</Text>
                </View>
                <View style={styles.jobDetailItem}>
                  <Text style={styles.detailLabel}>Earned</Text>
                  <Text style={[styles.detailValue, { color: colors.status.success }]}>
                    ₹{job.earned_to_date}
                  </Text>
                </View>
              </View>

              <WorkerAssignmentAttendanceBar
                jobId={job.job_id}
                operationalStatus={job.operational_status}
                markedTodayFromDashboard={job.marked_today}
              />

              <Button
                title="View Details"
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
  statsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    padding: spacing.lg,
  },
  statIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: typography.sizes.xl,
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
  markAttendanceBtn: {
    marginBottom: spacing.sm,
  },
  attendanceMarkedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  attendanceMarkedText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.status.success,
  },
  attendancePendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  attendancePendingText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: '#B45309',
  },
});
