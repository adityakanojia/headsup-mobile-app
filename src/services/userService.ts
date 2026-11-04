/**
 * User service — profile updates, team management, notifications.
 * Ported from web's utils/api/profile.ts, team.ts, notifications.ts.
 */
import { apiFetch } from './apiClient';
import { extractApiError } from '@/types/api';
import type { ContractorWorkerProfile } from '@/types/user';
import type {
  AppNotification,
  PushTokenRegistrationPayload,
  PushTokenResponse,
  UnreadNotificationCountResponse,
} from '@/types/notifications';

// ── Profile ───────────────────────────────────────────────────────────────

export interface ProfileUpdatePayload {
  name?: string;
  location?: string;
  company_name?: string;
  business_type?: string;
  address?: string;
}

export async function updateProfile(data: ProfileUpdatePayload): Promise<unknown> {
  const response = await apiFetch('/user/profile', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(extractApiError(errorData, 'Failed to update profile', response.status));
  }
  return response.json();
}

// ── Contractor Team ───────────────────────────────────────────────────────

export async function getContractorTeamSize(): Promise<{ total_workers: number }> {
  const response = await apiFetch('/user/contractor/workers/count');
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || 'Failed to fetch team size');
  }
  return response.json();
}

export async function getContractorTeam(
  page = 1,
  pageSize = 20,
): Promise<ContractorWorkerProfile[]> {
  const response = await apiFetch(
    `/user/contractor/workers?page=${page}&page_size=${pageSize}`,
  );
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || 'Failed to fetch team');
  }
  return response.json();
}

export async function initiateWorkerOtp(phoneNumber: string): Promise<unknown> {
  const response = await apiFetch('/user/contractor/workers/initiate', {
    method: 'POST',
    body: JSON.stringify({ phone_number: phoneNumber }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const errorMsg =
      errorData?.detail ||
      errorData?.error?.message ||
      errorData?.message ||
      'Failed to send OTP';
    throw new Error(typeof errorMsg === 'string' ? errorMsg : 'Failed to send OTP');
  }
  return response.json();
}

export async function verifyWorkerOtp(
  phoneNumber: string,
  otpCode: string,
): Promise<unknown> {
  const response = await apiFetch('/user/contractor/workers/verify', {
    method: 'POST',
    body: JSON.stringify({ phone_number: phoneNumber, otp_code: otpCode }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const errorMsg =
      errorData?.detail ||
      errorData?.error?.message ||
      errorData?.message ||
      'Failed to verify OTP';
    throw new Error(typeof errorMsg === 'string' ? errorMsg : 'Failed to verify OTP');
  }
  return response.json();
}

export async function addWorkerToTeam(payload: {
  name?: string;
  phone_number: string;
  primary_category_id?: string;
  skill_ids?: string[];
  aadhaar_number?: string;
  pan_number?: string;
}): Promise<unknown> {
  const response = await apiFetch('/user/contractor/workers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const errorMsg =
      errorData?.detail ||
      errorData?.error?.message ||
      errorData?.message ||
      'Failed to add worker';
    throw new Error(typeof errorMsg === 'string' ? errorMsg : 'Failed to add worker');
  }
  return response.json();
}

// ── Notifications & Push Tokens ───────────────────────────────────────────

export interface GetNotificationsOptions {
  limit?: number;
  before?: string;
  unreadOnly?: boolean;
}

export async function getNotifications(
  options: number | GetNotificationsOptions = 50,
): Promise<AppNotification[]> {
  const opts: GetNotificationsOptions =
    typeof options === 'number' ? { limit: options } : options;
  const params = new URLSearchParams();
  params.set('limit', String(opts.limit ?? 50));
  if (opts.before) {
    params.set('before', opts.before);
  }
  if (opts.unreadOnly) {
    params.set('unread_only', 'true');
  }

  const response = await apiFetch(`/user/notifications?${params.toString()}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      extractApiError(errorData, 'Failed to fetch notifications', response.status),
    );
  }
  return response.json();
}

export async function getUnreadNotificationCount(): Promise<UnreadNotificationCountResponse> {
  const response = await apiFetch('/user/notifications/unread-count');
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      extractApiError(
        errorData,
        'Failed to fetch unread notification count',
        response.status,
      ),
    );
  }
  return response.json();
}

export async function markNotificationRead(
  notificationId: string,
): Promise<AppNotification> {
  const response = await apiFetch(`/user/notifications/${notificationId}/read`, {
    method: 'PATCH',
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      extractApiError(
        errorData,
        'Failed to mark notification as read',
        response.status,
      ),
    );
  }
  return response.json();
}

export async function markAllNotificationsRead(): Promise<{ marked_read: number }> {
  const response = await apiFetch('/user/notifications/read-all', {
    method: 'PATCH',
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      extractApiError(
        errorData,
        'Failed to mark all notifications as read',
        response.status,
      ),
    );
  }
  return response.json();
}

export async function registerPushToken(
  payload: PushTokenRegistrationPayload,
): Promise<PushTokenResponse> {
  const response = await apiFetch('/user/push-tokens', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      extractApiError(
        errorData,
        'Failed to register device push token',
        response.status,
      ),
    );
  }
  return response.json();
}

export async function unregisterPushToken(
  token: string,
): Promise<{ status: string; deactivated: boolean }> {
  const response = await apiFetch('/user/push-tokens', {
    method: 'DELETE',
    body: JSON.stringify({ token }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      extractApiError(
        errorData,
        'Failed to remove device push token',
        response.status,
      ),
    );
  }
  return response.json();
}
