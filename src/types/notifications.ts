/**
 * Notification types, event matrix constants, and presentation helpers.
 */

export type NotificationEventType =
  | 'JOB_SUBMITTED'
  | 'JOB_AWAITING_REVIEW'
  | 'JOB_APPROVED'
  | 'JOB_REJECTED'
  | 'NEW_JOB_AVAILABLE'
  | 'JOB_APPLICATION_SUBMITTED'
  | 'JOB_APPLICATION_UNDER_REVIEW'
  | 'JOB_APPLICATION_APPROVED'
  | 'JOB_APPLICATION_REJECTED'
  | 'JOB_ASSIGNED'
  | 'WORKERS_ASSIGNED'
  | 'JOB_FILLED'
  | 'JOB_STARTED'
  | 'JOB_COMPLETED'
  | 'JOB_CLOSED'
  | 'WORKER_TERMINATED'
  | string;

export type NotificationVariant = 'success' | 'info' | 'warning' | 'error';

export type NotificationEntityType =
  | 'job'
  | 'job_application'
  | 'job_assignment'
  | string;

export interface NotificationMetadata {
  v?: number;
  notification_id?: string;
  event_type?: NotificationEventType;
  entity_type?: NotificationEntityType;
  entity_id?: string;
  job_id?: string;
  application_id?: string;
  assignment_id?: string;
  route?: string;
  decision?: string;
  reason?: string | null;
  event_key?: string;
  delivery_status?: string;
  [key: string]: unknown;
}

export interface AppNotification {
  id: string;
  notification_type: NotificationEventType;
  title: string;
  body: string;
  data: NotificationMetadata;
  read_at: string | null;
  created_at: string;
}

export interface PushTokenRegistrationPayload {
  token: string;
  provider?: 'expo';
  platform?: 'android' | 'ios' | 'web';
  device_id?: string | null;
  device_name?: string | null;
  app_version?: string | null;
}

export interface PushTokenResponse {
  id: string;
  provider: string;
  platform: string | null;
  device_id: string | null;
  is_active: boolean;
  last_seen_at: string;
  created_at: string;
}

export interface UnreadNotificationCountResponse {
  unread_count: number;
}

export function getNotificationVariant(
  notificationType: string,
): NotificationVariant {
  const normalized = notificationType.toUpperCase();
  if (
    normalized === 'JOB_APPROVED' ||
    normalized === 'JOB_APPLICATION_APPROVED' ||
    normalized === 'JOB_COMPLETED' ||
    normalized === 'JOB_FILLED'
  ) {
    return 'success';
  }
  if (
    normalized === 'JOB_REJECTED' ||
    normalized === 'JOB_APPLICATION_REJECTED' ||
    normalized === 'WORKER_TERMINATED'
  ) {
    return 'error';
  }
  if (
    normalized === 'JOB_SUBMITTED' ||
    normalized === 'JOB_AWAITING_REVIEW' ||
    normalized === 'JOB_APPLICATION_UNDER_REVIEW'
  ) {
    return 'warning';
  }
  return 'info';
}

export function getNotificationActionLabel(
  notification: Pick<AppNotification, 'notification_type' | 'data'>,
): string | null {
  const type = notification.notification_type.toUpperCase();
  const data = notification.data || {};

  if (
    type === 'JOB_APPLICATION_SUBMITTED' ||
    type === 'JOB_APPLICATION_UNDER_REVIEW' ||
    type === 'JOB_APPLICATION_APPROVED' ||
    type === 'JOB_APPLICATION_REJECTED'
  ) {
    return data.job_id ? 'View Job' : 'View Application';
  }
  if (
    type === 'JOB_SUBMITTED' ||
    type === 'JOB_AWAITING_REVIEW' ||
    type === 'JOB_APPROVED' ||
    type === 'JOB_REJECTED' ||
    type === 'NEW_JOB_AVAILABLE' ||
    type === 'JOB_ASSIGNED' ||
    type === 'WORKERS_ASSIGNED' ||
    type === 'JOB_FILLED' ||
    type === 'JOB_STARTED' ||
    type === 'JOB_COMPLETED' ||
    type === 'JOB_CLOSED' ||
    type === 'WORKER_TERMINATED' ||
    Boolean(data.job_id)
  ) {
    return 'View Project';
  }
  return null;
}

export function formatNotificationTimestamp(isoString?: string | null): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';

  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 45) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}
