/**
 * Central API client — mobile equivalent of the web app's utils/api/apiClient.ts.
 *
 * Key differences from the web version:
 * - Uses expo-secure-store instead of js-cookie
 * - Uses Config.API_BASE_URL instead of NEXT_PUBLIC_API_URL
 * - No window.location.href redirect — uses the auth store's clearSession + router
 *
 * Preserves the same 401 → refresh → retry queue pattern from the web app.
 */
import { Config } from '@/constants/config';
import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  clearTokens,
} from './tokenStorage';

const DEFAULT_TIMEOUT_MS = 30_000;

let isRefreshing = false;
let failedQueue: {
  resolve: (value: string) => void;
  reject: (reason?: unknown) => void;
}[] = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error || !token) {
      prom.reject(error ?? new Error('Token refresh failed'));
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

/**
 * Called when session is irrecoverably expired.
 * The auth store listener in _layout.tsx will handle navigation to login.
 */
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const externalSignal = options.signal;

  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort);
    }
  }

  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      if (externalSignal?.aborted) {
        throw err;
      }
      throw new Error('Request timed out. Please check your connection and try again.');
    }
    throw new Error('Network error. Please check your internet connection and try again.');
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

function isAuthPublicEndpoint(endpoint: string): boolean {
  return (
    endpoint.includes('/auth/send-otp') ||
    endpoint.includes('/auth/verify-otp') ||
    endpoint.includes('/auth/refresh')
  );
}

export async function apiFetch(
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = await getAccessToken();

  const headers = new Headers(options.headers);

  if (options.body instanceof FormData) {
    // Let fetch set the multipart boundary automatically
    headers.delete('Content-Type');
  } else if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token && !isAuthPublicEndpoint(endpoint)) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response = await fetchWithTimeout(`${Config.API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle 401 on protected endpoints by attempting token refresh
  if (response.status === 401 && !isAuthPublicEndpoint(endpoint)) {
    // If another concurrent request already refreshed the token while we were in flight,
    // immediately retry with the updated access token.
    const latestAccessToken = await getAccessToken();
    if (latestAccessToken && token && latestAccessToken !== token) {
      headers.set('Authorization', `Bearer ${latestAccessToken}`);
      return await fetchWithTimeout(`${Config.API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });
    }

    const refreshToken = await getRefreshToken();

    if (refreshToken) {
      if (isRefreshing) {
        try {
          const newToken = await new Promise<string>((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          });
          headers.set('Authorization', `Bearer ${newToken}`);
          return await fetchWithTimeout(`${Config.API_BASE_URL}${endpoint}`, {
            ...options,
            headers,
          });
        } catch {
          throw new Error('Session expired. Please log in again.');
        }
      }

      isRefreshing = true;

      const attemptRefresh = async (): Promise<{
        token: string | null;
        shouldRetry: boolean;
      }> => {
        const currentRefresh = await getRefreshToken();
        if (!currentRefresh) {
          return { token: null, shouldRetry: false };
        }

        try {
          const refreshResponse = await fetchWithTimeout(
            `${Config.API_BASE_URL}/auth/refresh`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refresh_token: currentRefresh }),
            },
          );

          if (refreshResponse.ok) {
            const data = await refreshResponse.json();
            const newAccessToken: string | undefined = data?.access_token;
            if (!newAccessToken) {
              return { token: null, shouldRetry: false };
            }

            await setAccessToken(newAccessToken);
            if (data.refresh_token) {
              await setRefreshToken(data.refresh_token);
            }
            return { token: newAccessToken, shouldRetry: false };
          }

          // Do not retry if refresh token was explicitly rejected (400/401/403/422)
          const shouldRetry = refreshResponse.status >= 500 || refreshResponse.status === 429;
          return { token: null, shouldRetry };
        } catch {
          // Network/timeout failure — worth a single retry
          return { token: null, shouldRetry: true };
        }
      };

      try {
        let result = await attemptRefresh();

        // Retry once after 1.5s only on transient network/5xx failure
        if (!result.token && result.shouldRetry) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          result = await attemptRefresh();
        }

        if (result.token) {
          processQueue(null, result.token);
          headers.set('Authorization', `Bearer ${result.token}`);
          response = await fetchWithTimeout(`${Config.API_BASE_URL}${endpoint}`, {
            ...options,
            headers,
          });
          return response;
        } else {
          processQueue(new Error('Token refresh failed'), null);
        }
      } catch (err) {
        processQueue(err as Error, null);
      } finally {
        isRefreshing = false;
      }
    }

    // No refresh token or refresh failed — session expired
    await clearTokens();
    onSessionExpired?.();
    throw new Error('Session expired. Please log in again.');
  }

  return response;
}
