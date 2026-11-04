/**
 * API error shape from the backend.
 */

export interface ApiErrorDetail {
  loc: (string | number)[];
  msg: string;
  type: string;
}

export interface ApiError {
  detail?: string | ApiErrorDetail[];
  error?: {
    code?: string;
    message?: string;
  };
  message?: string;
}

/**
 * Extract a human-readable message from a backend JSON error body and HTTP status.
 */
export function extractApiError(
  errorData: unknown,
  fallbackMessage: string,
  status?: number,
): string {
  if (errorData && typeof errorData === 'object') {
    const data = errorData as ApiError;

    // 1. Custom AppError / RateLimitMiddleware format: { error: { code, message } }
    if (data.error && typeof data.error.message === 'string' && data.error.message.trim()) {
      return data.error.message;
    }

    // 2. FastAPI HTTPException string detail: { detail: "..." }
    if (typeof data.detail === 'string' && data.detail.trim()) {
      return data.detail;
    }

    // 3. FastAPI / Pydantic 422 validation errors: { detail: [{ loc, msg, type }] }
    if (Array.isArray(data.detail) && data.detail.length > 0) {
      const messages = data.detail
        .map((item) => {
          if (!item || typeof item !== 'object') return '';
          const fieldPath = Array.isArray(item.loc)
            ? item.loc.filter((part) => part !== 'body' && part !== 'query').join('.')
            : '';
          const cleanMsg = typeof item.msg === 'string' ? item.msg.replace(/^Value error,\s*/i, '') : '';
          return fieldPath ? `${fieldPath}: ${cleanMsg}` : cleanMsg;
        })
        .filter(Boolean);

      if (messages.length > 0) {
        return messages.join('; ');
      }
    }

    // 4. Generic { message: "..." }
    if (typeof data.message === 'string' && data.message.trim()) {
      return data.message;
    }
  }

  if (status === 401) {
    return 'Session expired. Please log in again.';
  }
  if (status === 403) {
    return 'You do not have permission to perform this action.';
  }
  if (status === 422) {
    return 'Please check your input and try again.';
  }
  if (status === 429) {
    return 'Too many requests. Please wait a moment and try again.';
  }
  if (status && status >= 500) {
    return 'Server is temporarily unavailable. Please try again shortly.';
  }

  return fallbackMessage;
}

/**
 * Extract a human-readable message from a thrown error.
 */
export function parseApiError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Something went wrong';
}
