/**
 * React Query hooks for contractor team management.
 * Ported from web's app/(dashboard)/team/contractor-team-view.tsx + utils/api/team.ts,
 * replacing ad-hoc useState fetching with cached, deduplicated queries.
 */
import {
  useQuery,
  useMutation,
  useInfiniteQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  getContractorTeam,
  getContractorTeamSize,
  initiateWorkerOtp,
  verifyWorkerOtp,
  addWorkerToTeam,
} from '@/services/userService';
import { jobKeys } from '@/hooks/useJobs';

export const TEAM_PAGE_SIZE = 20;

// ── Query Keys ─────────────────────────────────────────────────────────────

export const teamKeys = {
  all: ['contractor-team'] as const,
  list: () => [...teamKeys.all, 'list'] as const,
  size: () => [...teamKeys.all, 'size'] as const,
};

// ── Team List (page-based infinite scroll) ─────────────────────────────────

export function useContractorTeam(enabled = true) {
  return useInfiniteQuery({
    queryKey: teamKeys.list(),
    queryFn: ({ pageParam }) => getContractorTeam(pageParam, TEAM_PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.length === TEAM_PAGE_SIZE ? lastPageParam + 1 : undefined,
    enabled,
    staleTime: 60_000,
  });
}

// ── Team Size ──────────────────────────────────────────────────────────────

export function useContractorTeamSize(enabled = true) {
  return useQuery({
    queryKey: teamKeys.size(),
    queryFn: getContractorTeamSize,
    enabled,
    staleTime: 60_000,
  });
}

// ── Add Worker Flow ────────────────────────────────────────────────────────

export function useInitiateWorkerOtp() {
  return useMutation({
    mutationFn: (phoneNumber: string) => initiateWorkerOtp(phoneNumber),
  });
}

export function useVerifyWorkerOtp() {
  return useMutation({
    mutationFn: ({ phoneNumber, otpCode }: { phoneNumber: string; otpCode: string }) =>
      verifyWorkerOtp(phoneNumber, otpCode),
  });
}

export function useAddWorkerToTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addWorkerToTeam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.all });
      // Contractor dashboard shows team-derived stats
      queryClient.invalidateQueries({ queryKey: jobKeys.dashboard() });
    },
  });
}
