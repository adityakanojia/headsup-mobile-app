/**
 * App configuration.
 * API_BASE_URL is configurable via environment variables for staging/prod flexibility.
 * Expo Constants.expoConfig.extra can be used for env-specific values.
 */
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

export const Config = {
  API_BASE_URL:
    (extra.apiBaseUrl as string | undefined) ??
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    'https://headsup-backend-5iaj.onrender.com/api/v1',

  WS_BASE_URL:
    (extra.wsBaseUrl as string | undefined) ??
    process.env.EXPO_PUBLIC_WS_BASE_URL ??
    'wss://headsup-backend-5iaj.onrender.com/api/v1',
} as const;
