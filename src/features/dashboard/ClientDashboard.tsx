import React, { memo, useCallback, useMemo } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  HardHat,
  IndianRupee,
  Plus,
  RotateCcw,
  Users,
} from "lucide-react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Skeleton } from "@/components/Skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { OlaMap, type OlaMapMarker } from "@/components/map/OlaMap";
import { useClientDashboard, useClientJobs } from "@/hooks/useJobs";
import { colors, typography, spacing, borderRadius } from "@/theme";

type Project = {
  job_id: string | number;
  title: string;
  operational_status: string;
  moderation_status?: string;
  duration_days: number;
  filled_workers: number;
  total_workers_required: number;
  attendance_today: number;
  location?: string;
};

type MapLocation = {
  job_id: string;
  title: string;
  location: string;
  geo_lat: number;
  geo_lng: number;
  operational_status: string;
};

type DashboardData = {
  active_projects?: Project[];
  map_locations?: MapLocation[];
  total_projects?: number;
  inspections?: number;
  formatted_spend?: string;
};

// Demo location for development only.
// Replace with an appropriate regional map center for production.
const MAP_CENTER = {
  latitude: 28.628,
  longitude: 77.376,
};

// Demo markers for UI testing only; not actual worker locations.
const DEMO_WORKERS: OlaMapMarker[] = [
  { latitude: 28.6369, longitude: 77.3763, color: "#208AEF" },
  { latitude: 28.6412, longitude: 77.3698, color: "#208AEF" },
  { latitude: 28.6284, longitude: 77.3821, color: "#208AEF" },
  { latitude: 28.6471, longitude: 77.3882, color: "#208AEF" },
  { latitude: 28.6208, longitude: 77.3732, color: "#208AEF" },
  { latitude: 28.6502, longitude: 77.3605, color: "#208AEF" },
  { latitude: 28.6314, longitude: 77.3588, color: "#208AEF" },
  { latitude: 28.6158, longitude: 77.3904, color: "#208AEF" },
];

function formatCount(value: number | undefined) {
  return (value ?? 0).toLocaleString("en-IN");
}

function DashboardSkeleton() {
  return (
    <View style={styles.content}>
      <Skeleton height={280} style={styles.skeletonBlock} />
      <Skeleton height={82} style={styles.skeletonBlock} />

      <View style={styles.statsRow}>
        {[1, 2, 3].map((item) => (
          <Skeleton key={item} height={105} style={styles.statSkeleton} />
        ))}
      </View>

      <Skeleton height={180} style={styles.skeletonBlock} />
    </View>
  );
}

const StatCard = memo(function StatCard({
  label,
  value,
  icon,
  iconBackground,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconBackground: string;
}) {
  return (
    <Card style={styles.statCard} padding="md">
      <View style={[styles.statIcon, { backgroundColor: iconBackground }]}>
        {icon}
      </View>
      <Text numberOfLines={1} style={styles.statLabel}>
        {label}
      </Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.statValue}>
        {value}
      </Text>
    </Card>
  );
});

const ProjectCard = memo(function ProjectCard({
  project,
  onPress,
}: {
  project: Project;
  onPress: () => void;
}) {
  const required = Math.max(0, project.total_workers_required || 0);
  const filled = Math.max(0, project.filled_workers || 0);
  const progress = required > 0 ? Math.min(filled / required, 1) : 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Manage project ${project.title}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.projectPressable,
        pressed && styles.pressed,
      ]}
    >
      <Card style={styles.projectCard} padding="lg">
        <View style={styles.projectHeader}>
          <View style={styles.projectTitleArea}>
            <Text numberOfLines={2} style={styles.projectTitle}>
              {project.title}
            </Text>

            <View style={styles.durationRow}>
              <CalendarDays size={14} color={colors.text.secondary} />
              <Text style={styles.durationText}>
                {project.duration_days} days
              </Text>
            </View>
          </View>

          <StatusBadge status={project.operational_status} />
        </View>

        <View style={styles.workerStatsHeader}>
          <View style={styles.inlineLabel}>
            <Users size={16} color={colors.text.secondary} />
            <Text style={styles.secondaryLabel}>Workers assigned</Text>
          </View>

          <Text style={styles.workerCount}>
            {filled}/{required}
          </Text>
        </View>

        <View
          style={styles.progressTrack}
          accessibilityRole="progressbar"
          accessibilityValue={{
            min: 0,
            max: 100,
            now: Math.round(progress * 100),
          }}
        >
          <View
            style={[styles.progressFill, { width: `${progress * 100}%` }]}
          />
        </View>

        <View style={styles.projectFooter}>
          <View style={styles.attendanceGroup}>
            <View style={styles.attendanceIcon}>
              <CheckCircle2 size={16} color={colors.status.success} />
            </View>

            <View>
              <Text style={styles.secondaryLabel}>Attendance today</Text>
              <Text style={styles.attendanceValue}>
                {formatCount(project.attendance_today)} workers
              </Text>
            </View>
          </View>

          <View style={styles.manageAction}>
            <Text style={styles.manageText}>Manage</Text>
            <ArrowRight size={17} color={colors.primaryDark} />
          </View>
        </View>
      </Card>
    </Pressable>
  );
});

export function ClientDashboard() {
  const router = useRouter();

  const {
    data,
    isLoading,
    isRefetching,
    refetch,
    isError,
    error,
  } = useClientDashboard();

  const {
    data: clientJobs,
    isRefetching: isRefetchingJobs,
    refetch: refetchJobs,
  } = useClientJobs(20);

  const dashboard = data as DashboardData | undefined;

  // Combine active projects from dashboard with recently submitted projects from /jobs/client/mine
  // so newly created (SCHEDULED / PENDING_REVIEW) projects are immediately visible on the dashboard.
  const displayedProjects = useMemo<Project[]>(() => {
    const active = dashboard?.active_projects ?? [];
    const seenIds = new Set(active.map((p) => String(p.job_id)));
    const combined: Project[] = [...active];

    if (clientJobs && clientJobs.length > 0) {
      for (const job of clientJobs) {
        if (!seenIds.has(String(job.id))) {
          seenIds.add(String(job.id));
          combined.push({
            job_id: job.id,
            title: job.title,
            operational_status:
              job.moderation_status === "PENDING_REVIEW"
                ? "PENDING_REVIEW"
                : job.operational_status,
            moderation_status: job.moderation_status,
            duration_days: job.duration_days,
            filled_workers: job.filled_workers,
            total_workers_required: job.total_workers_required,
            attendance_today: 0,
            location: job.location,
          });
        }
      }
    }

    return combined;
  }, [dashboard?.active_projects, clientJobs]);

  const mapMarkers = useMemo<OlaMapMarker[]>(() => {
    const projectMarkers: OlaMapMarker[] = (dashboard?.map_locations ?? [])
      .filter(
        (loc) =>
          Number.isFinite(loc.geo_lat) &&
          Number.isFinite(loc.geo_lng) &&
          Math.abs(loc.geo_lat) <= 90 &&
          Math.abs(loc.geo_lng) <= 180,
      )
      .map((loc) => ({
        latitude: loc.geo_lat,
        longitude: loc.geo_lng,
        color: "#16A34A",
        label: loc.title,
      }));

    return [...projectMarkers, ...DEMO_WORKERS];
  }, [dashboard?.map_locations]);

  const mapCenter = useMemo(() => {
    const first = dashboard?.map_locations?.[0];
    if (
      first &&
      Number.isFinite(first.geo_lat) &&
      Number.isFinite(first.geo_lng)
    ) {
      return { latitude: first.geo_lat, longitude: first.geo_lng };
    }
    return MAP_CENTER;
  }, [dashboard?.map_locations]);

  const CreateJobWizard = useCallback(() => {
    router.push("/(tabs)/createJob");
  }, [router]);

  const viewAllProjects = useCallback(() => {
    router.push("/(tabs)/projects");
  }, [router]);

  const retryDashboard = useCallback(() => {
    void refetch();
    void refetchJobs();
  }, [refetch, refetchJobs]);

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={isRefetching || isRefetchingJobs}
        onRefresh={retryDashboard}
        colors={[colors.primaryDark]}
        tintColor={colors.primaryDark}
      />
    ),
    [isRefetching, isRefetchingJobs, retryDashboard],
  );

  if (isLoading && !data) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <DashboardSkeleton />
      </ScrollView>
    );
  }

  if (isError && !data) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.emptyIcon}>
          <RotateCcw size={26} color={colors.text.secondary} />
        </View>
        <Text style={styles.emptyTitle}>Dashboard unavailable</Text>
        <Text style={styles.emptyDescription}>
          {error instanceof Error
            ? error.message
            : "We couldn't load your projects. Check your connection and try again."}
        </Text>
        <Button title="Try again" onPress={retryDashboard} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      {/* Primary action */}
      <Pressable
        accessibilityRole="button"
        onPress={CreateJobWizard}
        style={({ pressed }) => [
          styles.createBanner,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.createIcon}>
          <Plus size={21} color={colors.primaryDark} />
        </View>

        <View style={styles.createCopy}>
          <Text style={styles.createTitle}>Start a new project</Text>
          <Text style={styles.createSubtitle}>
            Post a job and find the right workforce.
          </Text>
        </View>

        <ArrowRight size={18} color={colors.text.primary} />
      </Pressable>

      {/* Workforce discovery map */}
      <OlaMap
        latitude={mapCenter.latitude}
        longitude={mapCenter.longitude}
        markers={mapMarkers}
        zoom={12}
        height={210}
        coverageKm={5}
        title="Your next crew is nearby"
        subtitle="Discover workforce availability around you"
      />

      {/* Analytics */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Overview</Text>
        {(dashboard?.total_projects ?? 0) > 0 && (
          <Pressable onPress={viewAllProjects} hitSlop={8}>
            <Text style={styles.manageText}>View all projects →</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.statsRow}>
        <StatCard
          label="Total spend"
          value={dashboard?.formatted_spend ?? "₹0"}
          icon={<IndianRupee size={18} color={colors.primaryDark} />}
          iconBackground={colors.primaryLight}
        />

        <StatCard
          label="Projects"
          value={formatCount(
            Math.max(dashboard?.total_projects ?? 0, displayedProjects.length),
          )}
          icon={<Building2 size={18} color={colors.status.info} />}
          iconBackground={colors.status.infoLight}
        />

        <StatCard
          label="Inspections"
          value={formatCount(dashboard?.inspections)}
          icon={<HardHat size={18} color={colors.status.success} />}
          iconBackground={colors.status.successLight}
        />
      </View>

      {/* Projects list */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleArea}>
          <Text style={styles.sectionTitle}>Your projects</Text>
          <Text style={styles.sectionSubtitle}>
            {displayedProjects.length} currently listed
          </Text>
        </View>

        <Button
          title="Post job"
          onPress={CreateJobWizard}
          variant="outline"
          size="sm"
          icon={<Plus size={16} color={colors.text.primary} />}
          fullWidth={false}
        />
      </View>

      {displayedProjects.length === 0 ? (
        <Card style={styles.emptyCard} padding="xl">
          <View style={styles.emptyIcon}>
            <Building2 size={26} color={colors.text.secondary} />
          </View>

          <Text style={styles.emptyTitle}>No projects yet</Text>
          <Text style={styles.emptyDescription}>
            Your projects will appear here when you post your first job.
          </Text>

          <Button
            title="Post your first job"
            onPress={CreateJobWizard}
            style={styles.emptyButton}
          />
        </Card>
      ) : (
        <View style={styles.projectsList}>
          {displayedProjects.map((project) => (
            <ProjectCard
              key={project.job_id}
              project={project}
              onPress={() => router.push(`/job/${project.job_id}` as any)}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing["4xl"],
    gap: spacing.md,
  },
  skeletonBlock: {
    marginBottom: spacing.md,
  },
  header: {
    gap: spacing.xs,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: borderRadius.lg,
  },
  statSkeleton: {
    flex: 1,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.sm + 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  createBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: "#FFF9DC",
    borderWidth: 1,
    borderColor: "#E8D790",
    borderRadius: borderRadius.lg,
    minHeight: 70,
  },
  createIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: "#E5B800",
    alignItems: "center",
    justifyContent: "center",
  },
  createCopy: {
    flex: 1,
    gap: 3,
  },
  createTitle: {
    fontSize: typography.sizes.base + 1,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  createSubtitle: {
    fontSize: typography.sizes.xs + 1,
    lineHeight: 17,
    color: colors.text.secondary,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  sectionTitleArea: {
    flex: 1,
    gap: 2,
  },
  sectionTitle: {
    fontSize: typography.sizes.md + 1,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: typography.sizes.xs,
    lineHeight: 16,
    color: colors.text.secondary,
  },
  projectsList: {
    gap: spacing.md,
  },
  projectPressable: {
    borderRadius: borderRadius.lg,
  },
  projectCard: {
    borderRadius: borderRadius.lg,
  },
  projectHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  projectTitleArea: {
    flex: 1,
    gap: spacing.sm,
  },
  projectTitle: {
    fontSize: typography.sizes.md,
    lineHeight: 23,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
  },
  durationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  durationText: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
  },
  workerStatsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  inlineLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  secondaryLabel: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
  },
  workerCount: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
  },
  progressTrack: {
    height: 7,
    borderRadius: borderRadius.full,
    overflow: "hidden",
    backgroundColor: colors.borderLight,
    marginBottom: spacing.lg,
  },
  progressFill: {
    height: "100%",
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
  },
  projectFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  attendanceGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  attendanceIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.status.successLight,
  },
  attendanceValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.status.success,
    marginTop: 3,
  },
  manageAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  manageText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  emptyCard: {
    alignItems: "center",
    borderRadius: borderRadius.xl,
  },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  emptyDescription: {
    fontSize: typography.sizes.sm,
    lineHeight: 21,
    color: colors.text.secondary,
    textAlign: "center",
  },
  emptyButton: {
    marginTop: spacing.lg,
  },
  errorContainer: {
    flex: 1,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  pressed: {
    opacity: 0.82,
  },
});
