/**
 * Avatar component — HeadsUp design system.
 * Displays user image or fallback initials.
 */
import React from 'react';
import { View, Text, StyleSheet, type ImageStyle, type ViewStyle, type StyleProp } from 'react-native';
import { Image } from 'expo-image';
import { colors, typography } from '@/theme';

interface AvatarProps {
  url?: string | null;
  name?: string | null;
  size?: number;
  style?: ViewStyle;
}

export function Avatar({ url, name, size = 40, style }: AvatarProps) {
  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={[styles.container, containerStyle, style] as StyleProp<ImageStyle>}
        contentFit="cover"
        transition={200}
      />
    );
  }

  // Fallback to initials
  const initials = (name || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <View style={[styles.container, styles.fallback, containerStyle, style]}>
      <Text
        style={[
          styles.text,
          { fontSize: Math.max(typography.sizes.xs, size * 0.4) },
        ]}
      >
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.skeleton,
    overflow: 'hidden',
  },
  fallback: {
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  text: {
    color: colors.primaryDark,
    fontWeight: typography.weights.bold,
  },
});
