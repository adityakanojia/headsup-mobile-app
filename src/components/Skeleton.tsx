/**
 * Skeleton component — HeadsUp design system.
 * Simple animated placeholder for loading states.
 */
import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, type ViewStyle, type StyleProp, type DimensionValue } from 'react-native';
import { colors, borderRadius } from '@/theme';

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  style?: StyleProp<ViewStyle>;
  variant?: 'rectangular' | 'circular';
}

export function Skeleton({
  width,
  height,
  style,
  variant = 'rectangular',
}: SkeletonProps) {
  const [opacity] = useState(() => new Animated.Value(0.3));

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.base,
        width !== undefined ? { width: width as any } : undefined,
        height !== undefined ? { height: height as any } : undefined,
        variant === 'circular' ? { borderRadius: 9999 } : undefined,
        style,
        { opacity },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.skeleton,
    borderRadius: borderRadius.md,
  },
});
