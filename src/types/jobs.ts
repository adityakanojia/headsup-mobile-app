/**
 * Job-related types — ported from the existing web app.
 * Mirrors backend response shapes exactly.
 */

export type ProjectType = "INDUSTRIAL" | "RESIDENTIAL" | "COMMERCIAL";
export type WageType = "CONTRACTUAL" | "PER_DAY_WAGE";
export type ModerationStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED";
export type OperationalStatus =
  | "SCHEDULED"
  | "OPEN"
  | "FILLED"
  | "IN_PROGRESS"
  | "OVERTIME"
  | "DISPUTE"
  | "COMPLETED"
  | "CLOSED";
export type ApplicationStatus =
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "WITHDRAWN";
export type ApplicantType = "WORKER" | "CONTRACTOR";
export type ReviewDecision = "APPROVED" | "REJECTED";
export type LocationStatus =
  | "PRESENT_ON_SITE"
  | "OUT_OF_RANGE"
  | "LOW_ACCURACY"
  | "NO_LOCATION";

export interface JobResponse {
  id: string;
  created_by: string;
  title: string;
  description: string;
  project_type: ProjectType;
  worker_category: string;
  trade_type_id: string;
  trade_type_name: string | null;
  total_workers_required: number;
  filled_workers: number;
  available_workers: number;
  wage_type: WageType;
  wage_min: string | null;
  wage_max: string | null;
  contract_price: string | null;
  start_date: string | null;
  duration_days: number;
  location: string;
  geo_lat: number | null;
  geo_lng: number | null;
  special_requirements: string | null;
  images: string[];
  moderation_status: ModerationStatus;
  operational_status: OperationalStatus;
  created_at: string;
  published_at: string | null;
  client?: {
    id: string;
    name: string;
    company_name: string | null;
    avatar: string | null;
    is_verified: boolean;
  };
}

export interface ClientJobDetailResponse extends JobResponse {
  review: {
    decision: "APPROVE" | "REJECT";
    reason: string | null;
    reviewed_at: string | null;
  } | null;
  application_counts: {
    SUBMITTED: number;
    APPROVED: number;
    REJECTED: number;
    WITHDRAWN: number;
  };
  total_applications: number;
}

export interface JobCreatePayload {
  title: string;
  description: string;
  project_type: ProjectType;
  worker_category: string;
  trade_type: string;
  total_workers_required: number;
  wage_type: WageType;
  wage_min?: number | null;
  wage_max?: number | null;
  contract_price?: number | null;
  start_date?: string | null;
  duration_days: number;
  location: string;
  geo_lat?: number | null;
  geo_lng?: number | null;
  special_requirements?: string | null;
  images: string[];
}

export interface NewMemberInline {
  name: string;
  phone_number: string;
  primary_category_id?: string;
  skill_ids?: string[];
}

export interface JobApplicationCreatePayload {
  member_ids: string[];
  new_members: NewMemberInline[];
  note?: string | null;
}

export interface ApplicationMemberSnapshot {
  name: string | null;
  phone_number: string;
  experience_level: string | null;
  primary_skill_category: string | null;
  skill_ids: string[];
  rpl_certified: boolean;
}

export interface ApplicationResponse {
  id: string;
  job_id: string;
  applicant_type: ApplicantType;
  submitted_by: string;
  worker_id: string | null;
  contractor_id: string | null;
  requested_workers: number;
  status: ApplicationStatus;
  note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  members: {
    worker_id: string;
    status: string;
    worker_snapshot: ApplicationMemberSnapshot;
  }[];
  job: {
    id: string;
    title: string;
    description: string;
    location: string;
    total_workers_required: number;
    filled_workers: number;
    moderation_status: string;
    operational_status: string;
    wage_type: string;
    wage_min: string | null;
    wage_max: string | null;
    contract_price: string | null;
    start_date: string | null;
    duration_days: number;
  };
}

export interface ImageUploadResponse {
  upload_url: string;
  storage_path: string;
  public_url: string;
  content_type: string;
}

export interface WorkerDashboardResponse {
  total_accumulated_earnings: number;
  active_assignments_count: number;
  jobs: {
    assignment_id: string;
    job_id: string;
    job_title: string;
    location: string;
    operational_status: string;
    wage_type: string;
    daily_rate: number;
    duration_days: number;
    days_worked: number;
    days_remaining: number;
    earned_to_date: number;
    marked_today?: boolean;
  }[];
}

export interface AttendanceMarkPayload {
  job_id: string;
  geo_lat?: number | null;
  geo_lng?: number | null;
  geo_accuracy_m?: number | null;
}

export interface AttendanceLog {
  id: string;
  job_assignment_id: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'HALF_DAY';
  hours_worked: number | null;
  geo_lat: number | null;
  geo_lng: number | null;
  geo_accuracy_m: number | null;
  resolved_address: string | null;
  location_status: 'PRESENT_ON_SITE' | 'OUT_OF_RANGE' | 'LOW_ACCURACY' | 'NO_LOCATION';
  distance_from_site_m: number | null;
  marked_at: string | null;
}

export interface ContractorDashboardResponse {
  deployed_team_size: number;
  active_projects_count: number;
  total_team_days_worked: number;
  total_team_accumulated_earnings: number;
  jobs: {
    job_id: string;
    job_title: string;
    location: string;
    operational_status: string;
    wage_type: string;
    daily_rate_per_worker: number;
    duration_days: number;
    deployed_workers_count: number;
    total_team_days_worked: number;
    team_earned_to_date: number;
  }[];
}

export interface ClientDashboardData {
  client_id: string;
  client_name: string;
  total_projects: number;
  inspections: number;
  total_spend: number;
  formatted_spend: string;
  map_locations: {
    job_id: string;
    title: string;
    location: string;
    geo_lat: number;
    geo_lng: number;
    operational_status: string;
  }[];
  active_projects: {
    job_id: string;
    title: string;
    operational_status: string;
    duration_days: number;
    days_left: number | null;
    total_workers_required: number;
    filled_workers: number;
    attendance_today: number;
  }[];
}

export interface SkillCategory {
  id: string;
  name: string;
  slug: string;
}

export interface Skill {
  id: string;
  category_id: string;
  name: string;
  slug: string;
}

export interface SelectedImage {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
}
