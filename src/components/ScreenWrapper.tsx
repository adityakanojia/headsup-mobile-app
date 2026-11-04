/**
 * Screen wrapper with SafeArea + background color.
 * Every screen should wrap in this for consistent safe area handling.
 */
import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors } from '@/theme';

interface ScreenWrapperProps {
  children: React.ReactNode;
  style?: ViewStyle;
  edges?: Edge[];
  keyboardAvoiding?: boolean;
  scrollable?: boolean;
  /**
   * Optional background color for the top status-bar safe area inset.
   * Ensures the system status bar area matches headers with `colors.surface` or `colors.primary`
   * without applying duplicate top padding.
   */
  statusBarColor?: string;
}

export function ScreenWrapper({
  children,
  style,
  edges = ['top', 'left', 'right'],
  keyboardAvoiding = false,
  scrollable = false,
  statusBarColor,
}: ScreenWrapperProps) {
  const topColor = statusBarColor ?? colors.background;
  const hasTopEdge = edges.includes('top');
  const bodyEdges: Edge[] =
    hasTopEdge && statusBarColor
      ? edges.filter((edge) => edge !== 'top')
      : edges;

  const content = (
    <>
      <StatusBar
        hidden={false}
        barStyle="dark-content"
        backgroundColor={topColor}
        translucent
        animated
      />
      {hasTopEdge && statusBarColor ? (
        <SafeAreaView
          edges={['top']}
          style={[styles.topInset, { backgroundColor: statusBarColor }]}
        />
      ) : null}
      <SafeAreaView edges={bodyEdges} style={[styles.container, style]}>
        {scrollable ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          children
        )}
      </SafeAreaView>
    </>
  );

  if (keyboardAvoiding) {
    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {content}
      </KeyboardAvoidingView>
    );
  }

  return <View style={styles.flex}>{content}</View>;
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topInset: {
    flexGrow: 0,
    flexShrink: 0,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
