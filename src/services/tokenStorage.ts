/**
 * Secure token storage for mobile.
 * Uses expo-secure-store for JWT tokens — encrypted at rest on both platforms.
 * Falls back to in-memory storage on web (for dev only).
 */
import { Platform } from 'react-native';

const ACCESS_TOKEN_KEY = 'headsup_access_token';
const REFRESH_TOKEN_KEY = 'headsup_refresh_token';

// In-memory fallback for web (development only — web should use httpOnly cookies in prod)
const memoryStore: Record<string, string> = {};

async function getSecureStore() {
  if (Platform.OS === 'web') {
    return null;
  }
  return await import('expo-secure-store');
}

export async function getAccessToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return memoryStore[ACCESS_TOKEN_KEY] ?? null;
  }
  try {
    const SecureStore = await getSecureStore();
    return (await SecureStore?.getItemAsync(ACCESS_TOKEN_KEY)) ?? null;
  } catch {
    return memoryStore[ACCESS_TOKEN_KEY] ?? null;
  }
}

export async function setAccessToken(token: string): Promise<void> {
  memoryStore[ACCESS_TOKEN_KEY] = token;
  if (Platform.OS === 'web') {
    return;
  }
  try {
    const SecureStore = await getSecureStore();
    await SecureStore?.setItemAsync(ACCESS_TOKEN_KEY, token);
  } catch {
    // Keep in-memory fallback if SecureStore write fails
  }
}

export async function getRefreshToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return memoryStore[REFRESH_TOKEN_KEY] ?? null;
  }
  try {
    const SecureStore = await getSecureStore();
    return (await SecureStore?.getItemAsync(REFRESH_TOKEN_KEY)) ?? null;
  } catch {
    return memoryStore[REFRESH_TOKEN_KEY] ?? null;
  }
}

export async function setRefreshToken(token: string): Promise<void> {
  memoryStore[REFRESH_TOKEN_KEY] = token;
  if (Platform.OS === 'web') {
    return;
  }
  try {
    const SecureStore = await getSecureStore();
    await SecureStore?.setItemAsync(REFRESH_TOKEN_KEY, token);
  } catch {
    // Keep in-memory fallback if SecureStore write fails
  }
}

export async function clearTokens(): Promise<void> {
  delete memoryStore[ACCESS_TOKEN_KEY];
  delete memoryStore[REFRESH_TOKEN_KEY];
  if (Platform.OS === 'web') {
    return;
  }
  try {
    const SecureStore = await getSecureStore();
    await SecureStore?.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore?.deleteItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    // Ignore delete errors on cleanup
  }
}
