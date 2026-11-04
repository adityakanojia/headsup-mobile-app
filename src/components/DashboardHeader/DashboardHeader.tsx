import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, typography, borderRadius } from "@/theme";

type DashboardRole = "client" | "contractor" | "worker";

interface DashboardHeaderProps {
  name?: string | null;
  role: DashboardRole;
  unreadMessages?: number;
  unreadNotifications?: number;
  onPressChat?: () => void;
  onPressNotifications?: () => void;
  onPressSettings?: () => void;
}

function HeaderIcon({
  icon,
  label,
  count,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  count?: number;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={count ? `${label}, ${count} unread` : label}
      hitSlop={8}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={21} color={colors.text.primary} />

      {!!count && count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? "99+" : count}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function DashboardHeader({
  name,
  role,
  unreadMessages = 0,
  unreadNotifications = 0,
  onPressChat,
  onPressNotifications,
  onPressSettings,
}: DashboardHeaderProps) {
  const firstName = name?.trim().split(/\s+/)[0] || "there";

  const date = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <View style={styles.container}>
      <View style={styles.greetingContainer}>
        <Text style={styles.greeting} numberOfLines={1}>
          Hello, {firstName}
        </Text>

        <Text style={styles.date} numberOfLines={1}>
          {date}
        </Text>
      </View>

      <View style={styles.actions}>
        {role === "client" && (
          <HeaderIcon
            icon="chatbubble-ellipses-outline"
            label="Messages"
            count={unreadMessages}
            onPress={onPressChat}
          />
        )}

        <HeaderIcon
          icon="notifications-outline"
          label="Notifications"
          count={unreadNotifications}
          onPress={onPressNotifications}
        />

        <HeaderIcon
          icon="settings-outline"
          label="Settings"
          onPress={onPressSettings}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 84,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  greetingContainer: {
    flex: 1,
    minWidth: 0,
  },
  greeting: {
    fontSize: 22,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    letterSpacing: -0.4,
  },
  date: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text.secondary,
    marginTop: 3,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.sm + 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: colors.text.primary,
    fontSize: 9,
    fontWeight: typography.weights.heavy,
  },
  pressed: {
    opacity: 0.72,
    backgroundColor: colors.surfaceMuted,
  },
});
