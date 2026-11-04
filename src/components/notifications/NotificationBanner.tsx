/**
 * Foreground In-App Notification Banner — HeadsUp Design System.
 *
 * Appears at the top of the screen when a push notification or real-time
 * event arrives while the app is open. Respects safe-area top inset,
 * auto-dismisses after 4.5s, and navigates to the destination on tap.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing, shadows, borderRadius } from '@/theme';
import { NotificationCard } from './NotificationCard';
import {
  useNotificationBannerStore,
  useMarkNotificationRead,
} from '@/hooks/useNotifications';
import {
  isValidEntityId,
  navigateFromNotification,
} from '@/services/pushNotificationService';
import { useStore } from '@/store/useStore';
import type { AppNotification } from '@/types/notifications';

const AUTO_DISMISS_MS = 4500;

export function NotificationBanner() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { role } = useStore();
  const { activeBanner, dismissBanner } = useNotificationBannerStore();
  const markReadMutation = useMarkNotificationRead();

  const [translateY] = useState(() => new Animated.Value(-140));
  const [opacity] = useState(() => new Animated.Value(0));

  const animateOut = useCallback(
    (onDone?: () => void) => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -140,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        dismissBanner();
        onDone?.();
      });
    },
    [translateY, opacity, dismissBanner],
  );

  useEffect(() => {
    if (!activeBanner) return;

    translateY.setValue(-140);
    opacity.setValue(0);

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 18,
        stiffness: 180,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      animateOut();
    }, AUTO_DISMISS_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [activeBanner, translateY, opacity, animateOut]);

  if (!activeBanner) {
    return null;
  }

  const handlePress = (notification: AppNotification) => {
    const persistedId = isValidEntityId(notification.id)
      ? notification.id
      : isValidEntityId(notification.data?.notification_id)
        ? String(notification.data.notification_id)
        : null;

    if (persistedId && !notification.read_at) {
      markReadMutation.mutate(persistedId);
    }

    animateOut(() => {
      navigateFromNotification(router, notification, role);
    });
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.overlay, { paddingTop: Math.max(insets.top + 8, 16) }]}
    >
      <Animated.View
        style={[
          styles.bannerWrapper,
          {
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <NotificationCard
          notification={activeBanner}
          compact
          onPress={handlePress}
          onDismiss={() => animateOut()}
          style={styles.cardOverride}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: spacing.base,
    alignItems: 'center',
  },
  bannerWrapper: {
    width: '100%',
    maxWidth: 520,
  },
  cardOverride: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderLeftWidth: 3.5,
    borderLeftColor: colors.primary,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    marginBottom: 0,
    ...shadows.lg,
  },
});
