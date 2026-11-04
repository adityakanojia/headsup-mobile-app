/**
 * Application Entry / Navigation shell.
 * Sets up providers, handles auth guards, routing, push token lifecycle,
 * foreground in-app notification banners, and notification tap deep-linking.
 */
import { useEffect } from "react";
import { Platform, View, StyleSheet, StatusBar as RNStatusBar } from "react-native";
import { Slot, useRouter, useSegments } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { colors } from "@/theme";
import { useStore } from "@/store/useStore";
import {
  getAccessToken,
  getRefreshToken,
  clearTokens,
} from "@/services/tokenStorage";
import { setSessionExpiredHandler } from "@/services/apiClient";
import { getMe } from "@/services/authService";
import {
  getNotifications,
  markNotificationRead,
} from "@/services/userService";
import {
  configureForegroundNotificationHandler,
  consumePendingColdStartNotification,
  isValidEntityId,
  markPhoneNotificationSeeded,
  navigateFromNotification,
  presentLocalPhoneNotification,
  registerDevicePushTokenForUser,
  setPendingColdStartNotification,
  subscribeToNotificationEvents,
  subscribeToPushTokenRefresh,
  unregisterCurrentDevicePushToken,
} from "@/services/pushNotificationService";
import {
  notificationKeys,
  useNotificationBannerStore,
} from "@/hooks/useNotifications";
import { jobKeys } from "@/hooks/useJobs";
import { useChatRealtimeSync, useChatUiStore } from "@/hooks/useChat";
import { chatSocketManager } from "@/services/chatSocketManager";
import { NotificationBanner } from "@/components/notifications";

function ChatRealtimeBridge() {
  useChatRealtimeSync();
  return null;
}

// Prevent splash screen from auto-hiding until we check auth state
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const msg =
          error instanceof Error ? error.message.toLowerCase() : "";
        if (msg.includes("too many requests") || msg.includes("429")) {
          return false;
        }
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  const {
    isAuthenticated,
    isRestoringSession,
    user,
    role,
    setAuthenticated,
    setUser,
    setRestoringSession,
    clearSession,
  } = useStore();

  const segments = useSegments();
  const router = useRouter();

  // 1. Initialize Auth State & Restore Session Profile
  useEffect(() => {
    let mounted = true;

    async function restoreSession() {
      try {
        const token = await getAccessToken();
        const refresh = await getRefreshToken();

        if (token || refresh) {
          const profile = await getMe();
          if (mounted) {
            setUser(profile);
            setAuthenticated(true);
          }
        } else if (mounted) {
          setAuthenticated(false);
        }
      } catch {
        await clearTokens();
        if (mounted) {
          clearSession();
        }
      } finally {
        if (mounted) {
          setRestoringSession(false);
        }
      }
    }

    restoreSession();

    return () => {
      mounted = false;
    };
  }, [setAuthenticated, setUser, setRestoringSession, clearSession]);

  // 2. Setup Global Session Expired Handler
  useEffect(() => {
    setSessionExpiredHandler(() => {
      chatSocketManager.disconnect();
      useChatUiStore.getState().resetChatUi();
      unregisterCurrentDevicePushToken().catch(() => null);
      useNotificationBannerStore.getState().resetBanners();
      queryClient.clear();
      clearSession();
    });
  }, [clearSession]);

  // 3. Register Device Push Token after Authentication & Onboarding
  useEffect(() => {
    if (
      Platform.OS === "web" ||
      isRestoringSession ||
      !isAuthenticated ||
      !user?.id ||
      user.onboarding_status !== "ACTIVE"
    ) {
      return;
    }

    const currentUserId = user.id;
    registerDevicePushTokenForUser(currentUserId).catch(() => null);

    let seededInitial = false;
    let active = true;

    const syncUnreadPhoneNotifications = async () => {
      try {
        const unread = await getNotifications({ limit: 10, unreadOnly: true });
        if (!active) return;

        if (!seededInitial) {
          seededInitial = true;
          unread.forEach((item) => markPhoneNotificationSeeded(item.id));
          return;
        }

        for (const item of unread) {
          await presentLocalPhoneNotification(item);
        }
      } catch {
        // Ignore transient network errors during background sync
      }
    };

    syncUnreadPhoneNotifications();
    const pollTimer = setInterval(syncUnreadPhoneNotifications, 45_000);
    const unsubscribeToken = subscribeToPushTokenRefresh(currentUserId);

    return () => {
      active = false;
      clearInterval(pollTimer);
      unsubscribeToken();
    };
  }, [isRestoringSession, isAuthenticated, user?.id, user?.onboarding_status]);

  // 4. Listen for Foreground Push Notifications & Notification Taps
  useEffect(() => {
    if (Platform.OS === "web") return;

    configureForegroundNotificationHandler();

    return subscribeToNotificationEvents({
      onReceived: (parsed) => {
        useNotificationBannerStore.getState().showBanner(parsed);
        queryClient.invalidateQueries({ queryKey: notificationKeys.all });
        queryClient.invalidateQueries({ queryKey: jobKeys.all });
      },
      onResponse: (tapPayload) => {
        const state = useStore.getState();
        if (
          state.isRestoringSession ||
          !state.isAuthenticated ||
          state.user?.onboarding_status !== "ACTIVE"
        ) {
          setPendingColdStartNotification(tapPayload);
          return;
        }

        if (isValidEntityId(tapPayload.id)) {
          markNotificationRead(tapPayload.id)
            .then(() => {
              queryClient.invalidateQueries({ queryKey: notificationKeys.all });
            })
            .catch(() => null);
        }

        navigateFromNotification(router, tapPayload, state.role);
      },
    });
  }, [router]);

  // 5. Auth & Onboarding Guard Routing + Flush Queued Cold-Start Notification Tap
  useEffect(() => {
    if (isRestoringSession) return;

    const inAuthGroup = segments[0] === "(auth)";
    const authScreen = segments[1];

    if (!isAuthenticated) {
      if (
        !inAuthGroup ||
        (authScreen !== "login" && authScreen !== "otp-verification")
      ) {
        router.replace("/(auth)/login");
      }
      return;
    }

    // Authenticated user: check onboarding requirements before entering tabs
    const needsRoleSelection =
      user !== null &&
      (!user.role || user.onboarding_status === "OTP_VERIFIED");
    const needsSkillSelection =
      user?.role === "worker" && user?.onboarding_status === "ROLE_SELECTED";

    if (needsRoleSelection) {
      if (!(inAuthGroup && authScreen === "role-selection")) {
        router.replace("/(auth)/role-selection");
      }
      return;
    }

    if (needsSkillSelection) {
      if (!(inAuthGroup && authScreen === "select-skill")) {
        router.replace("/(auth)/select-skill");
      }
      return;
    }

    if (inAuthGroup) {
      router.replace("/(tabs)");
      return;
    }

    // If a notification tap occurred while session was restoring, navigate now
    const pendingTap = consumePendingColdStartNotification();
    if (pendingTap) {
      if (isValidEntityId(pendingTap.id)) {
        markNotificationRead(pendingTap.id)
          .then(() => {
            queryClient.invalidateQueries({ queryKey: notificationKeys.all });
          })
          .catch(() => null);
      }
      navigateFromNotification(router, pendingTap, role);
    }
  }, [isAuthenticated, isRestoringSession, user, role, segments, router]);

  // 6. Hide Splash Screen when ready
  useEffect(() => {
    if (!isRestoringSession) {
      SplashScreen.hideAsync();
    }
  }, [isRestoringSession]);

  if (isRestoringSession) {
    return null; // Keep splash screen visible
  }

  return (
    <SafeAreaProvider>
      <RNStatusBar
        hidden={false}
        barStyle="dark-content"
        backgroundColor={colors.background}
        translucent
        animated
      />
      <QueryClientProvider client={queryClient}>
        <ChatRealtimeBridge />
        <View style={styles.root}>
          <Slot />
          <NotificationBanner />
        </View>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
