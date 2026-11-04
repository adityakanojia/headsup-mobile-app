/**
 * User-related types — ported from the existing web app.
 * Mirrors backend User model exactly.
 */

export enum OnboardingStatus {
  PENDING = 'PENDING',
  OTP_VERIFIED = 'OTP_VERIFIED',
  PROFILE_COMPLETED = 'PROFILE_COMPLETED',
  ROLE_SELECTED = 'ROLE_SELECTED',
  KYC_PENDING = 'KYC_PENDING',
  ACTIVE = 'ACTIVE',
}

export enum UserRole {
  WORKER = 'worker',
  CONTRACTOR = 'contractor',
  CLIENT = 'client',
  ADMIN = 'admin',
}

export interface UserProfile {
  id: string;
  phone_number: string;
  name: string | null;
  role: UserRole | null;
  onboarding_status: OnboardingStatus;
  language: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  is_verified: boolean;
}

export interface WorkerSkillItem {
  id: string;
  name: string;
}

export interface ContractorWorkerProfile {
  worker_id: string;
  name: string | null;
  phone_number: string;
  status: string;
  skills: WorkerSkillItem[];
  primary_skill_category_name?: string;
}
