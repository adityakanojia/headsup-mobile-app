/**
 * Job service — ported from web's features/jobs/api/jobs.ts.
 * Pure async functions; React Query hooks are in src/hooks/.
 */
import { apiFetch } from './apiClient';
import { extractApiError } from '@/types/api';
import type {
  JobResponse,
  ClientJobDetailResponse,
  JobCreatePayload,
  JobApplicationCreatePayload,
  ApplicationResponse,
  ImageUploadResponse,
  WorkerDashboardResponse,
  ContractorDashboardResponse,
  ClientDashboardData,
  AttendanceMarkPayload,
  AttendanceLog,
  SkillCategory,
  Skill,
} from '@/types/jobs';

async function throwResponseError(response: Response, fallback: string): Promise<never> {
  const errorData = await response.json().catch(() => null);
  throw new Error(extractApiError(errorData, fallback, response.status));
}

// ── Job Listings ──────────────────────────────────────────────────────────

export async function fetchPublicJobs(params?: {
  limit?: number;
  before?: string;
  location?: string;
  recommended?: boolean;
}): Promise<JobResponse[]> {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.before) searchParams.set('before', params.before);
  if (params?.location) searchParams.set('location', params.location);
  if (params?.recommended) searchParams.set('recommended', 'true');

  const qs = searchParams.toString();
  const response = await apiFetch(`/jobs${qs ? `?${qs}` : ''}`);
  if (!response.ok) await throwResponseError(response, 'Failed to fetch jobs');
  return response.json();
}

export async function fetchClientJobs(limit = 50): Promise<JobResponse[]> {
  const response = await apiFetch(`/jobs/client/mine?limit=${limit}`);
  if (!response.ok) await throwResponseError(response, 'Failed to fetch client projects');
  return response.json();
}

export async function fetchJobById(id: string): Promise<JobResponse> {
  const response = await apiFetch(`/jobs/${id}`);
  if (!response.ok) await throwResponseError(response, 'Failed to fetch job');
  return response.json();
}

export async function fetchClientJobById(id: string): Promise<ClientJobDetailResponse> {
  const response = await apiFetch(`/jobs/client/${id}`);
  if (!response.ok) await throwResponseError(response, 'Failed to fetch project details');
  return response.json();
}

// ── Job CRUD ──────────────────────────────────────────────────────────────

export async function createJob(
  payload: JobCreatePayload,
  idempotencyKey?: string,
): Promise<JobResponse> {
  const response = await apiFetch('/jobs', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Idempotency-Key': idempotencyKey || generateIdempotencyKey(),
    },
  });

  if (!response.ok) {
    await throwResponseError(response, 'Failed to create project');
  }
  return response.json();
}

export async function deleteJob(jobId: string): Promise<void> {
  const response = await apiFetch(`/jobs/client/${jobId}`, { method: 'DELETE' });
  if (!response.ok) {
    await throwResponseError(response, 'Failed to delete project');
  }
}

// ── Image Upload ──────────────────────────────────────────────────────────

export function normalizeImageMimeType(
  mimeType?: string,
  filename?: string,
): 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic' {
  const lower = (mimeType ?? '').toLowerCase().trim();
  if (lower === 'image/png') return 'image/png';
  if (lower === 'image/webp') return 'image/webp';
  if (lower === 'image/heic' || lower === 'image/heif') return 'image/heic';
  if (lower === 'image/jpeg' || lower === 'image/jpg') return 'image/jpeg';

  const ext = (filename ?? '').split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic' || ext === 'heif') return 'image/heic';
  return 'image/jpeg';
}

export function normalizeImageFilename(
  filename: string | undefined,
  contentType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic',
): string {
  const extMap: Record<typeof contentType, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
  };
  const ext = extMap[contentType];
  const base = (filename ?? `photo-${Date.now()}`)
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 80) || `photo-${Date.now()}`;
  return `${base}.${ext}`;
}

export async function getImageUploadUrl(
  filename: string,
  contentType: string,
): Promise<ImageUploadResponse> {
  const normalizedType = normalizeImageMimeType(contentType, filename);
  const normalizedFilename = normalizeImageFilename(filename, normalizedType);

  const response = await apiFetch('/jobs/images/upload-url', {
    method: 'POST',
    body: JSON.stringify({
      filename: normalizedFilename,
      content_type: normalizedType,
    }),
  });
  if (!response.ok) {
    await throwResponseError(response, 'Failed to generate image upload URL');
  }
  return response.json();
}

// ── Applications ──────────────────────────────────────────────────────────

export async function applyForJob(
  jobId: string,
  payload: JobApplicationCreatePayload,
): Promise<ApplicationResponse> {
  const response = await apiFetch(`/jobs/${jobId}/applications`, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Idempotency-Key': generateIdempotencyKey(),
    },
  });

  if (!response.ok) {
    await throwResponseError(response, 'Failed to submit application');
  }
  return response.json();
}

export async function fetchMyApplications(limit = 50): Promise<ApplicationResponse[]> {
  const response = await apiFetch(`/jobs/applications/mine?limit=${limit}`);
  if (!response.ok) {
    await throwResponseError(response, 'Failed to fetch applications');
  }
  return response.json();
}

// ── Dashboard ─────────────────────────────────────────────────────────────

export async function fetchWorkerContractorDashboard<
  T extends WorkerDashboardResponse | ContractorDashboardResponse,
>(): Promise<T> {
  const response = await apiFetch('/jobs/applications/dashboard');
  if (!response.ok) {
    await throwResponseError(response, 'Failed to fetch dashboard');
  }
  return response.json();
}

export async function fetchClientDashboard(): Promise<ClientDashboardData> {
  const response = await apiFetch('/jobs/client/dashboard', { method: 'GET' });
  if (!response.ok) {
    await throwResponseError(response, 'Failed to fetch client dashboard');
  }
  return response.json();
}

// ── Attendance ────────────────────────────────────────────────────────────

export async function fetchTodayAttendance(jobId: string): Promise<AttendanceLog | null> {
  const response = await apiFetch(`/attendance/today?job_id=${encodeURIComponent(jobId)}`, {
    method: 'GET',
  });
  if (!response.ok) {
    await throwResponseError(response, "Failed to fetch today's attendance");
  }
  return response.json();
}

export async function markWorkerAttendance(
  payload: AttendanceMarkPayload,
): Promise<AttendanceLog> {
  const response = await apiFetch('/attendance/mark', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    await throwResponseError(response, 'Failed to mark attendance');
  }
  return response.json();
}

// ── Skills ────────────────────────────────────────────────────────────────

export async function fetchSkillCategories(): Promise<SkillCategory[]> {
  const response = await apiFetch('/user/skills/categories', { method: 'GET' });
  if (!response.ok) {
    await throwResponseError(response, 'Failed to fetch skill categories');
  }
  return response.json();
}

export async function fetchSkillsByCategory(categoryId: string): Promise<Skill[]> {
  const response = await apiFetch(`/user/skills/${categoryId}/skills`, { method: 'GET' });
  if (!response.ok) {
    await throwResponseError(response, 'Failed to fetch skills');
  }
  return response.json();
}

export async function addWorkerSkills(
  primaryCategoryId: string,
  skillIds: string[],
): Promise<unknown> {
  const response = await apiFetch('/user/skills/add-skill', {
    method: 'POST',
    body: JSON.stringify({
      primary_category_id: primaryCategoryId,
      skill_ids: skillIds,
    }),
  });
  if (!response.ok) {
    await throwResponseError(response, 'Failed to add skills');
  }
  return response.json();
}

export async function getSkillsStatus(): Promise<{ has_selected_skills: boolean }> {
  const response = await apiFetch('/user/skills/status', { method: 'GET' });
  if (!response.ok) {
    await throwResponseError(response, 'Failed to check skills status');
  }
  return response.json();
}

// ── Helpers ───────────────────────────────────────────────────────────────

export function generateIdempotencyKey(): string {
  // crypto.randomUUID not available in all RN environments
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}
