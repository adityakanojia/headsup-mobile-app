/**
 * LoadingOverlay component — HeadsUp design system.
 * Full-screen transparent overlay with a spinner.
 */
import React from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { colors } from '@/theme';

interface LoadingOverlayProps {
  visible: boolean;
}

export function LoadingOverlay({ visible }: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <View style={styles.container}>
      <View style={[styles.spinnerContainer, shadowStyle]}>
        <ActivityIndicator size="large" color={colors.primaryDark} />
      </View>
    </View>
  );
}

const shadowStyle = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  android: {
    elevation: 8,
  },
  default: {},
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  spinnerContainer: {
    backgroundColor: colors.surface,
    padding: 24,
    borderRadius: 16,
  },
});
