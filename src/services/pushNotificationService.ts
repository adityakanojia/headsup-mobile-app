/**
 * Centralized Push Notification & Deep-Link Navigation Service.
 *
 * Responsibilities:
 * 1. Safely load `expo-notifications` across both standalone builds/dev-clients
 *    AND Expo Go on Android (by stubbing `ExpoTopicSubscriptionModule` if absent
 *    from `globalThis.expo.modules` before requiring `expo-notifications`).
 * 2. Configure Android notification channels (MAX/HIGH importance, brand color)
 *    and OS foreground presentation (`shouldShowBanner: true`, `shouldShowList: true`)
 *    so real phone notifications appear in the Android status bar & shade.
 * 3. Manage push permission requests and remote Expo push token registration
 *    (`POST /user/push-tokens`) + local OS notification presentation fallback
 *    (`Notifications.scheduleNotificationAsync`) when running in Expo Go.
 * 4. Resolve versioned push payloads into safe Expo Router destinations with
 *    UUID validation, tap deduplication, and cold-start queue support.
 */
import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import { requireOptionalNativeModule } from 'expo-modules-core';
import type * as NotificationsTypes from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { useRouter } from 'expo-router';
import { registerPushToken, unregisterPushToken } from './userService';
import type { AppNotification, NotificationMetadata } from '@/types/notifications';
import type { UserRole } from '@/types/user';

type AppRouter = ReturnType<typeof useRouter>;

export const ANDROID_DEFAULT_CHANNEL_ID = 'headsup-default';
export const ANDROID_UPDATES_CHANNEL_ID = 'headsup-updates';

const STORAGE_PUSH_TOKEN_KEY = 'headsup_registered_push_token_v1';
const STORAGE_PUSH_PROMPTED_PREFIX = 'headsup_push_prompted_v1_';

let cachedNotificationsModule: typeof NotificationsTypes | null | undefined;
let currentRegisteredToken: string | null = null;
let currentRegisteredUserId: string | null = null;
let lastHandledTapKey: string | null = null;
let lastHandledTapAt = 0;
const presentedPhoneNotificationIds = new Set<string>();
let pendingColdStartNotification: {
  id?: string;
  notification_type?: string;
  data?: NotificationMetadata;
} | null = null;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidEntityId(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value.trim());
}

/**
 * Returns true when running inside Expo Go on Android, where remote FCM push
 * token retrieval is disabled since Expo SDK 53+, while local OS phone
 * notifications remain available.
 */
export function isExpoGoOnAndroid(): boolean {
  if (Platform.OS !== 'android') return false;
  try {
    if (isRunningInExpoGo()) return true;
  } catch {
    // ignore
  }
  return (
    Constants.executionEnvironment === 'storeClient' ||
    Constants.appOwnership === 'expo'
  );
}

/**
 * Ensures optional native submodules that may be absent in older Expo Go / dev
 * client binaries (`ExpoTopicSubscriptionModule`, etc.) have safe no-op stubs
 * on `globalThis.expo.modules` before `require('expo-notifications')` runs.
 */
function ensureOptionalNativeModuleStubs(): void {
  const expoGlobal = (
    globalThis as unknown as {
      expo?: { modules?: Record<string, unknown> };
    }
  ).expo;

  if (!expoGlobal?.modules) return;

  if (!expoGlobal.modules.ExpoTopicSubscriptionModule) {
    expoGlobal.modules.ExpoTopicSubscriptionModule = {
      addListener: () => {},
      removeListeners: () => {},
      subscribeToTopicAsync: async () => null,
      unsubscribeFromTopicAsync: async () => null,
    };
  }

  if (!expoGlobal.modules.ExpoPushTokenManager) {
    expoGlobal.modules.ExpoPushTokenManager = {
      addListener: () => {},
      removeListeners: () => {},
      getDevicePushTokenAsync: async () => null,
      unregisterForNotificationsAsync: async () => null,
    };
  }

  if (!expoGlobal.modules.NotificationsServerRegistrationModule) {
    expoGlobal.modules.NotificationsServerRegistrationModule = {
      addListener: () => {},
      removeListeners: () => {},
      getInstallationIdAsync: async () => null,
      getRegistrationInfoAsync: async () => null,
      setRegistrationInfoAsync: async () => null,
    };
  }

  if (!expoGlobal.modules.ExpoBackgroundNotificationTasksModule) {
    expoGlobal.modules.ExpoBackgroundNotificationTasksModule = {
      addListener: () => {},
      removeListeners: () => {},
      registerTaskAsync: async () => null,
      unregisterTaskAsync: async () => null,
    };
  }
}

/**
 * Checks whether the current native binary supports OS notification permissions
 * and presentation/scheduling.
 */
export function hasNativeNotificationsSupport(): boolean {
  if (Platform.OS === 'web') {
    return false;
  }
  try {
    ensureOptionalNativeModuleStubs();
    return Boolean(
      requireOptionalNativeModule('ExpoNotificationPermissionsModule') &&
        requireOptionalNativeModule('ExpoNotificationScheduler') &&
        requireOptionalNativeModule('ExpoNotificationsEmitter'),
    );
  } catch {
    return false;
  }
}

/**
 * Lazily and safely loads `expo-notifications` at runtime.
 */
export function getExpoNotificationsModule(): typeof NotificationsTypes | null {
  if (cachedNotificationsModule !== undefined) {
    return cachedNotificationsModule;
  }
  if (!hasNativeNotificationsSupport()) {
    cachedNotificationsModule = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedNotificationsModule = require('expo-notifications') as typeof NotificationsTypes;
    return cachedNotificationsModule;
  } catch {
    cachedNotificationsModule = null;
    return null;
  }
}

/**
 * Configure foreground notification behavior so the phone's native system
 * notification banner, sound, and notification shade item are shown.
 */
let handlerConfigured = false;
export function configureForegroundNotificationHandler(): void {
  if (handlerConfigured || Platform.OS === 'web') return;
  const Notifications = getExpoNotificationsModule();
  if (!Notifications) return;

  handlerConfigured = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {
    // Ignore on unsupported runtimes
  }
}

export async function setupAndroidNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const Notifications = getExpoNotificationsModule();
  if (!Notifications) return;

  try {
    await Notifications.setNotificationChannelAsync(ANDROID_DEFAULT_CHANNEL_ID, {
      name: 'Job & Project Alerts',
      description: 'Important updates about job submissions, approvals, and assignments',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FFCC00',
      enableVibrate: true,
      showBadge: true,
    });

    await Notifications.setNotificationChannelAsync(ANDROID_UPDATES_CHANNEL_ID, {
      name: 'Application & Status Updates',
      description: 'Updates on worker and contractor applications and project progress',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 120, 180],
      lightColor: '#FFCC00',
      enableVibrate: true,
      showBadge: true,
    });
  } catch {
    // Non-fatal on emulators or unsupported environments
  }
}

export async function getNotificationPermissionStatus(): Promise<
  NotificationsTypes.PermissionStatus | 'unavailable'
> {
  const Notifications = getExpoNotificationsModule();
  if (!Notifications) return 'unavailable';

  try {
    const settings = await Notifications.getPermissionsAsync();
    return settings.status;
  } catch {
    return 'unavailable';
  }
}

/**
 * Present a real OS phone notification in the Android/iOS notification tray
 * and status bar. Deduplicated by notification ID so the same notification
 * never triggers two phone alerts.
 */
export async function presentLocalPhoneNotification(
  notification: AppNotification,
): Promise<void> {
  if (Platform.OS === 'web') return;
  if (notification.id && presentedPhoneNotificationIds.has(notification.id)) {
    return;
  }

  const Notifications = getExpoNotificationsModule();
  if (!Notifications) return;

  try {
    if (notification.id) {
      presentedPhoneNotificationIds.add(notification.id);
    }

    await setupAndroidNotificationChannels();

    const perm = await Notifications.getPermissionsAsync();
    if (perm.status !== 'granted') {
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: notification.title,
        body: notification.body,
        sound: 'default',
        data: {
          ...(notification.data || {}),
          notification_id: notification.id,
          event_type:
            notification.notification_type ||
            notification.data?.event_type ||
            'INFO',
        },
        ...(Platform.OS === 'android'
          ? { channelId: ANDROID_DEFAULT_CHANNEL_ID, color: '#FFCC00' }
          : {}),
      },
      trigger: null,
    });
  } catch {
    // Ignore on unsupported runtimes
  }
}

export function markPhoneNotificationSeeded(notificationId: string): void {
  if (notificationId) {
    presentedPhoneNotificationIds.add(notificationId);
  }
}

/**
 * Request notification permission and register the Expo push token with the backend.
 * In Expo Go on Android, permissions and Android notification channels are still
 * configured so phone notifications work via `presentLocalPhoneNotification`,
 * while remote FCM token retrieval (`getExpoPushTokenAsync`) runs in standalone
 * APK and development builds.
 */
export async function registerDevicePushTokenForUser(
  userId: string,
  options: { forcePrompt?: boolean } = {},
): Promise<string | null> {
  const Notifications = getExpoNotificationsModule();
  if (!Notifications) return null;

  try {
    await setupAndroidNotificationChannels();

    const existingPerm = await Notifications.getPermissionsAsync();
    let finalStatus = existingPerm.status;

    if (finalStatus !== 'granted') {
      const promptKey = `${STORAGE_PUSH_PROMPTED_PREFIX}${userId}`;
      const alreadyPrompted = await AsyncStorage.getItem(promptKey);

      if ((!alreadyPrompted || options.forcePrompt) && existingPerm.canAskAgain !== false) {
        await AsyncStorage.setItem(promptKey, 'true');
        const requested = await Notifications.requestPermissionsAsync();
        finalStatus = requested.status;
      }
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    // Remote push token retrieval requires a standalone APK or development build on Android (SDK 53+)
    if (isExpoGoOnAndroid()) {
      return null;
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId ??
      process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

    if (!projectId) {
      return null;
    }

    const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenResult?.data?.trim();
    if (!token) {
      return null;
    }

    if (currentRegisteredToken === token && currentRegisteredUserId === userId) {
      return token;
    }

    await registerPushToken({
      token,
      provider: 'expo',
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      device_id: Device.osBuildId || Device.modelId || null,
      device_name: Device.deviceName || Device.modelName || null,
      app_version: Constants.expoConfig?.version || '1.0.0',
    });

    currentRegisteredToken = token;
    currentRegisteredUserId = userId;
    await AsyncStorage.setItem(STORAGE_PUSH_TOKEN_KEY, token);
    return token;
  } catch {
    // Gracefully degrade on emulators without Google Play Services or offline devices
    return null;
  }
}

/**
 * Sync an updated push token emitted by `Notifications.addPushTokenListener`.
 */
export async function syncRefreshedPushToken(
  userId: string,
  newToken: string,
): Promise<void> {
  const trimmed = newToken.trim();
  if (!trimmed || Platform.OS === 'web' || isExpoGoOnAndroid()) return;
  if (
    !trimmed.startsWith('ExponentPushToken[') &&
    !trimmed.startsWith('ExpoPushToken[')
  ) {
    return;
  }

  try {
    await registerPushToken({
      token: trimmed,
      provider: 'expo',
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      device_id: Device.osBuildId || Device.modelId || null,
      device_name: Device.deviceName || Device.modelName || null,
      app_version: Constants.expoConfig?.version || '1.0.0',
    });
    currentRegisteredToken = trimmed;
    currentRegisteredUserId = userId;
    await AsyncStorage.setItem(STORAGE_PUSH_TOKEN_KEY, trimmed);
  } catch {
    // Ignore transient network errors during background token refresh
  }
}

/**
 * Unregister the current device's push token from the backend on logout or session expiry.
 */
export async function unregisterCurrentDevicePushToken(): Promise<void> {
  try {
    const token =
      currentRegisteredToken ||
      (await AsyncStorage.getItem(STORAGE_PUSH_TOKEN_KEY));

    currentRegisteredToken = null;
    currentRegisteredUserId = null;
    presentedPhoneNotificationIds.clear();
    await AsyncStorage.removeItem(STORAGE_PUSH_TOKEN_KEY);

    if (token) {
      await unregisterPushToken(token);
    }
  } catch {
    // Best-effort cleanup on logout; never block local session clearing
  }
}

/**
 * Subscribe to native push token rotation events when supported by the runtime.
 */
export function subscribeToPushTokenRefresh(userId: string): () => void {
  if (isExpoGoOnAndroid()) {
    return () => {};
  }
  const Notifications = getExpoNotificationsModule();
  if (!Notifications) {
    return () => {};
  }

  try {
    const sub = Notifications.addPushTokenListener((event) => {
      if (typeof event.data === 'string') {
        syncRefreshedPushToken(userId, event.data).catch(() => null);
      }
    });
    return () => {
      try {
        sub.remove();
      } catch {
        // ignore
      }
    };
  } catch {
    return () => {};
  }
}

/**
 * Subscribe to foreground notifications, background taps, and cold-start tap events.
 */
export function subscribeToNotificationEvents(handlers: {
  onReceived: (notification: AppNotification) => void;
  onResponse: (tapPayload: {
    id?: string;
    notification_type?: string;
    data?: NotificationMetadata;
  }) => void;
}): () => void {
  const Notifications = getExpoNotificationsModule();
  if (!Notifications) {
    return () => {};
  }

  const extractTapPayload = (
    response: NotificationsTypes.NotificationResponse | null,
  ) => {
    if (!response?.notification) return;
    const parsed = parseExpoNotificationToAppNotification(response.notification);
    const data = (parsed.data || {}) as NotificationMetadata;
    const persistedId = isValidEntityId(parsed.id)
      ? parsed.id
      : isValidEntityId(data.notification_id)
        ? String(data.notification_id)
        : undefined;

    handlers.onResponse({
      id: persistedId || parsed.id,
      notification_type: parsed.notification_type,
      data,
    });
  };

  try {
    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse) {
      extractTapPayload(lastResponse);
    }
  } catch {
    // ignore on unsupported runtimes
  }

  let receivedSub: { remove: () => void } | null = null;
  let responseSub: { remove: () => void } | null = null;

  try {
    receivedSub = Notifications.addNotificationReceivedListener(
      (notification) => {
        const parsed = parseExpoNotificationToAppNotification(notification);
        if (parsed.id) {
          presentedPhoneNotificationIds.add(parsed.id);
        }
        handlers.onReceived(parsed);
      },
    );
  } catch {
    // ignore
  }

  try {
    responseSub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        extractTapPayload(response);
      },
    );
  } catch {
    // ignore
  }

  return () => {
    try {
      receivedSub?.remove();
    } catch {
      // ignore
    }
    try {
      responseSub?.remove();
    } catch {
      // ignore
    }
  };
}

/**
 * Resolve a notification or push payload into a safe Expo Router path.
 */
export function resolveNotificationDestination(
  notification: {
    notification_type?: string;
    data?: NotificationMetadata | null;
  },
  role?: UserRole | null,
): string {
  const data = notification.data || {};
  const eventType = String(
    notification.notification_type || data.event_type || '',
  ).toUpperCase();

  const jobId = isValidEntityId(data.job_id)
    ? data.job_id.trim()
    : data.entity_type === 'job' && isValidEntityId(data.entity_id)
      ? data.entity_id.trim()
      : null;

  // 0. Chat message events open `/messages/[jobId]` (or `/messages` inbox)
  if (
    eventType === 'CHAT_MESSAGE' ||
    eventType === 'NEW_MESSAGE' ||
    data.entity_type === 'chat'
  ) {
    return jobId ? `/messages/${jobId}` : '/messages';
  }

  // 1. Job-centric events open `/job/[id]` directly when a valid job UUID is present
  if (jobId) {
    return `/job/${jobId}`;
  }

  // 2. Role-aware fallback routes by event type when job_id is missing or invalid
  if (
    eventType.startsWith('JOB_APPLICATION_') &&
    role === 'worker'
  ) {
    return '/(tabs)/applications';
  }

  if (
    eventType === 'JOB_SUBMITTED' ||
    eventType === 'JOB_APPROVED' ||
    eventType === 'JOB_REJECTED' ||
    eventType === 'JOB_COMPLETED' ||
    eventType === 'JOB_CLOSED'
  ) {
    return role === 'client' ? '/(tabs)/projects' : '/(tabs)/jobs';
  }

  if (eventType === 'NEW_JOB_AVAILABLE') {
    return '/(tabs)/jobs';
  }

  return '/notifications';
}

/**
 * Navigate to the appropriate screen for a tapped notification with duplicate-tap protection.
 */
export function navigateFromNotification(
  router: AppRouter,
  notification: {
    id?: string;
    notification_type?: string;
    data?: NotificationMetadata | null;
  },
  role?: UserRole | null,
): string | null {
  const destination = resolveNotificationDestination(notification, role);
  const tapKey = `${notification.id || ''}:${notification.notification_type || ''}:${destination}`;
  const now = Date.now();

  if (lastHandledTapKey === tapKey && now - lastHandledTapAt < 1500) {
    return null;
  }

  lastHandledTapKey = tapKey;
  lastHandledTapAt = now;

  router.push(destination as never);
  return destination;
}

export function setPendingColdStartNotification(
  payload: {
    id?: string;
    notification_type?: string;
    data?: NotificationMetadata;
  } | null,
): void {
  pendingColdStartNotification = payload;
}

export function consumePendingColdStartNotification(): {
  id?: string;
  notification_type?: string;
  data?: NotificationMetadata;
} | null {
  const item = pendingColdStartNotification;
  pendingColdStartNotification = null;
  return item;
}

/**
 * Convert an incoming Expo push notification into our `AppNotification` shape
 * for immediate display in `NotificationBanner`.
 */
export function parseExpoNotificationToAppNotification(
  notification: NotificationsTypes.Notification,
): AppNotification {
  const content = notification.request.content;
  const rawData = (content.data || {}) as NotificationMetadata;
  const id =
    (typeof rawData.notification_id === 'string' && rawData.notification_id) ||
    notification.request.identifier ||
    `local-${Date.now()}`;
  const notificationType =
    (typeof rawData.event_type === 'string' && rawData.event_type) ||
    (typeof rawData.notification_type === 'string' && rawData.notification_type) ||
    'INFO';

  return {
    id,
    notification_type: notificationType,
    title: content.title || 'HeadsUp Notification',
    body: content.body || '',
    data: rawData,
    read_at: null,
    created_at: new Date(notification.date || Date.now()).toISOString(),
  };
}
