/**
 * Date & Time formatting utilities for HeadsUp Messaging.
 */

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isYesterday(date: Date, now: Date): boolean {
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  return isSameDay(date, yesterday);
}

/**
 * Format timestamp for inbox conversation rows (`10:42 AM`, `Yesterday`, `14 Oct`).
 */
export function formatInboxTimestamp(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (diffMs >= 0 && diffMs < 45_000) {
    return 'Just now';
  }

  if (isSameDay(date, now)) {
    return date.toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  if (isYesterday(date, now)) {
    return 'Yesterday';
  }

  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
  }

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });
}

/**
 * Format compact time for individual message bubbles (`10:42 AM`).
 */
export function formatBubbleTime(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format date separator pill label (`Today`, `Yesterday`, `Mon, 24 Oct`).
 */
export function formatDateSeparator(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  if (isSameDay(date, now)) {
    return 'Today';
  }
  if (isYesterday(date, now)) {
    return 'Yesterday';
  }

  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}

/**
 * Determine whether two ISO timestamps fall on different calendar days.
 */
export function isDifferentCalendarDay(
  isoA?: string | null,
  isoB?: string | null,
): boolean {
  if (!isoA || !isoB) return true;
  const dateA = new Date(isoA);
  const dateB = new Date(isoB);
  if (Number.isNaN(dateA.getTime()) || Number.isNaN(dateB.getTime())) {
    return false;
  }
  return !isSameDay(dateA, dateB);
}
