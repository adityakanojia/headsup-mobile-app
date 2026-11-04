/**
 * Auth service — ported from web's utils/api/auth.ts.
 * Same endpoints, same request/response shapes.
 */
import { apiFetch } from './apiClient';
import { setAccessToken, setRefreshToken, clearTokens } from './tokenStorage';
import { extractApiError } from '@/types/api';
import { OnboardingStatus, type UserProfile, type UserRole } from '@/types/user';

export async function sendOtp(phoneNumber: string): Promise<{ message: string }> {
  const response = await apiFetch('/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ phone_number: phoneNumber }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(extractApiError(errorData, 'Failed to send OTP', response.status));
  }
  return response.json();
}

export async function verifyOtp(
  phoneNumber: string,
  otp: string,
): Promise<{ access_token: string; refresh_token: string }> {
  const response = await apiFetch('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone_number: phoneNumber, otp }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(extractApiError(errorData, 'Invalid OTP', response.status));
  }

  const data = await response.json();

  if (!data?.access_token) {
    throw new Error('Authentication failed: missing access token');
  }

  // Store tokens securely
  await setAccessToken(data.access_token);
  if (data.refresh_token) {
    await setRefreshToken(data.refresh_token);
  }

  return data;
}

export async function selectRole(
  role: UserRole,
): Promise<{ message: string }> {
  const response = await apiFetch('/user/role-selection', {
    method: 'POST',
    body: JSON.stringify({ user_role: role }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(extractApiError(errorData, 'Failed to select role', response.status));
  }
  return response.json();
}

export async function getMe(): Promise<UserProfile> {
  const response = await apiFetch('/user/me', { method: 'GET' });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      extractApiError(errorData, 'Failed to fetch profile', response.status),
    );
  }
  const profile = (await response.json()) as UserProfile;

  // Backend keeps onboarding_status as ROLE_SELECTED after role & skill selection.
  // Normalize to ACTIVE once role onboarding requirements are satisfied.
  if (
    (profile.role === 'client' || profile.role === 'contractor') &&
    profile.onboarding_status === OnboardingStatus.ROLE_SELECTED
  ) {
    profile.onboarding_status = OnboardingStatus.ACTIVE;
  } else if (
    profile.role === 'worker' &&
    profile.onboarding_status === OnboardingStatus.ROLE_SELECTED
  ) {
    try {
      const skillRes = await apiFetch('/user/skills/status', { method: 'GET' });
      if (skillRes.ok) {
        const { has_selected_skills } = (await skillRes.json()) as {
          has_selected_skills?: boolean;
        };
        if (has_selected_skills) {
          profile.onboarding_status = OnboardingStatus.ACTIVE;
        }
      }
    } catch {
      // Preserve existing onboarding_status if skill status check fails
    }
  }

  return profile;
}

export async function logout(): Promise<void> {
  await clearTokens();
}
