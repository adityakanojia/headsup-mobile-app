/**
 * React Query hooks for jobs — ported from web's features/jobs/api/jobs.ts.
 * Same query key structure for cache management.
 */
import {
  useQuery,
  useMutation,
  useInfiniteQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  fetchPublicJobs,
  fetchClientJobs,
  fetchJobById,
  fetchClientJobById,
  createJob,
  deleteJob,
  applyForJob,
  fetchMyApplications,
  fetchWorkerContractorDashboard,
  fetchClientDashboard,
  fetchTodayAttendance,
  markWorkerAttendance,
  fetchSkillCategories,
  fetchSkillsByCategory,
} from '@/services/jobService';
import { getNotifications } from '@/services/userService';
import { presentLocalPhoneNotification } from '@/services/pushNotificationService';
import {
  notificationKeys,
  useNotificationBannerStore,
} from '@/hooks/useNotifications';
import type {
  JobResponse,
  JobCreatePayload,
  JobApplicationCreatePayload,
  WorkerDashboardResponse,
  ContractorDashboardResponse,
  ClientDashboardData,
  AttendanceMarkPayload,
  AttendanceLog,
} from '@/types/jobs';

// ── Query Keys (same structure as web app) ─────────────────────────────────

export const jobKeys = {
  all: ['jobs'] as const,
  lists: () => [...jobKeys.all, 'list'] as const,
  list: (filters: string) => [...jobKeys.lists(), { filters }] as const,
  clientJobs: () => [...jobKeys.lists(), 'client'] as const,
  details: () => [...jobKeys.all, 'detail'] as const,
  detail: (id: string) => [...jobKeys.details(), id] as const,
  applications: () => ['job-applications'] as const,
  myApplications: () => [...jobKeys.applications(), 'mine'] as const,
  dashboard: () => [...jobKeys.all, 'dashboard'] as const,
  clientDashboard: () => [...jobKeys.all, 'client-dashboard'] as const,
  skills: () => ['skills', 'categories'] as const,
  skillsByCategory: (categoryId: string) => ['skills', 'category', categoryId] as const,
};

// ── Client Projects List ───────────────────────────────────────────────────

export function useClientJobs(limit = 50, enabled = true) {
  return useQuery<JobResponse[]>({
    queryKey: [...jobKeys.clientJobs(), limit],
    queryFn: () => fetchClientJobs(limit),
    enabled,
  });
}

// ── Job List (Infinite Scroll) ─────────────────────────────────────────────

export function useInfiniteJobs(role?: string | null, recommended = false) {
  return useInfiniteQuery({
    queryKey: [...jobKeys.lists(), role, recommended],
    queryFn: async ({ pageParam }) => {
      if (role === 'client') {
        const data = await fetchClientJobs();
        return { data, nextCursor: undefined };
      }
      const data = await fetchPublicJobs({
        limit: 10,
        before: pageParam,
        recommended,
      });
      const lastJob = data.length === 10 ? data[data.length - 1] : undefined;
      const nextCursor = lastJob?.published_at ?? lastJob?.created_at ?? undefined;
      return {
        data,
        nextCursor,
      };
    },
    getNextPageParam: (lastPage: { nextCursor?: string }) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
    enabled: !!role,
  });
}

// ── Job Detail ─────────────────────────────────────────────────────────────

export function useJobDetail(jobId: string, role?: string | null) {
  return useQuery({
    queryKey: [...jobKeys.detail(jobId), role],
    queryFn: () =>
      role === 'client' ? fetchClientJobById(jobId) : fetchJobById(jobId),
    enabled: !!jobId && !!role,
  });
}

// ── Create Job ─────────────────────────────────────────────────────────────

export function useCreateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      payload,
      idempotencyKey,
    }: {
      payload: JobCreatePayload;
      idempotencyKey?: string;
    }) => createJob(payload, idempotencyKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
      queryClient.invalidateQueries({ queryKey: jobKeys.clientDashboard() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

// ── Delete Job ─────────────────────────────────────────────────────────────

export function useDeleteJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => deleteJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
      queryClient.invalidateQueries({ queryKey: jobKeys.clientDashboard() });
      queryClient.invalidateQueries({ queryKey: jobKeys.all });
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

// ── Apply for Job ──────────────────────────────────────────────────────────

export function useApplyJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      jobId,
      payload,
    }: {
      jobId: string;
      payload: JobApplicationCreatePayload;
    }) => applyForJob(jobId, payload),
    onSuccess: async (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: jobKeys.detail(variables.jobId),
      });
      queryClient.invalidateQueries({ queryKey: jobKeys.applications() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });

      try {
        const recent = await getNotifications({ limit: 5 });
        const matched = recent.find(
          (n) =>
            n.notification_type === 'JOB_APPLICATION_SUBMITTED' &&
            n.data?.job_id === variables.jobId,
        );
        if (matched) {
          presentLocalPhoneNotification(matched).catch(() => null);
          useNotificationBannerStore.getState().showBanner(matched);
        }
      } catch {
        // Non-blocking
      }
    },
  });
}

// ── My Applications ────────────────────────────────────────────────────────

export function useMyApplications(limit = 50) {
  return useQuery({
    queryKey: [...jobKeys.myApplications(), limit],
    queryFn: () => fetchMyApplications(limit),
  });
}

// ── Dashboard ──────────────────────────────────────────────────────────────

export function useWorkerDashboard() {
  return useQuery<WorkerDashboardResponse>({
    queryKey: [...jobKeys.dashboard(), 'worker'],
    queryFn: () => fetchWorkerContractorDashboard<WorkerDashboardResponse>(),
  });
}

export function useContractorDashboard() {
  return useQuery<ContractorDashboardResponse>({
    queryKey: [...jobKeys.dashboard(), 'contractor'],
    queryFn: () => fetchWorkerContractorDashboard<ContractorDashboardResponse>(),
  });
}

export function useClientDashboard() {
  return useQuery<ClientDashboardData>({
    queryKey: jobKeys.clientDashboard(),
    queryFn: fetchClientDashboard,
  });
}

// ── Worker Attendance ──────────────────────────────────────────────────────

export const attendanceKeys = {
  all: ['attendance'] as const,
  today: (jobId: string) => [...attendanceKeys.all, 'today', jobId] as const,
};

export function useTodayAttendance(jobId: string, enabled = true) {
  return useQuery<AttendanceLog | null>({
    queryKey: attendanceKeys.today(jobId),
    queryFn: () => fetchTodayAttendance(jobId),
    enabled: !!jobId && enabled,
  });
}

export function useMarkAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AttendanceMarkPayload) => markWorkerAttendance(payload),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(attendanceKeys.today(variables.job_id), data);
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
      queryClient.invalidateQueries({ queryKey: jobKeys.dashboard() });
      queryClient.invalidateQueries({ queryKey: jobKeys.clientDashboard() });
    },
  });
}

// ── Skills ─────────────────────────────────────────────────────────────────

export function useSkillCategories() {
  return useQuery({
    queryKey: jobKeys.skills(),
    queryFn: fetchSkillCategories,
    staleTime: 30 * 60_000, // Reference data — rarely changes
  });
}

export function useSkillsByCategory(categoryId: string | null) {
  return useQuery({
    queryKey: jobKeys.skillsByCategory(categoryId ?? ''),
    queryFn: () => fetchSkillsByCategory(categoryId as string),
    enabled: !!categoryId,
    staleTime: 30 * 60_000,
  });
}
