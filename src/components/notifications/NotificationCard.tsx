/**
 * Reusable NotificationCard component — HeadsUp Design System.
 *
 * Supports:
 * - success, info, warning, and error status variants
 * - title, concise description, relative timestamp, and unread indicator
 * - contextual action pill (e.g. "View Project", "View Application")
 * - optional dismissal button
 * - accessible touch targets and responsive layout for small Android screens
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Bell,
  ChevronRight,
  X,
} from 'lucide-react-native';
import {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  hitSlop,
} from '@/theme';
import {
  formatNotificationTimestamp,
  getNotificationActionLabel,
  getNotificationVariant,
  type AppNotification,
  type NotificationVariant,
} from '@/types/notifications';

export interface NotificationCardProps {
  notification: AppNotification;
  variant?: NotificationVariant;
  actionLabel?: string | null;
  compact?: boolean;
  onPress?: (notification: AppNotification) => void;
  onDismiss?: (notification: AppNotification) => void;
  style?: StyleProp<ViewStyle>;
}

const VARIANT_CONFIG: Record<
  NotificationVariant,
  {
    iconBg: string;
    iconColor: string;
    accentBorder: string;
    IconComponent: typeof Bell;
  }
> = {
  success: {
    iconBg: colors.status.successLight,
    iconColor: colors.status.success,
    accentBorder: colors.status.success,
    IconComponent: CheckCircle2,
  },
  warning: {
    iconBg: colors.status.warningLight,
    iconColor: colors.status.warning,
    accentBorder: colors.primary,
    IconComponent: AlertTriangle,
  },
  error: {
    iconBg: colors.status.errorLight,
    iconColor: colors.status.error,
    accentBorder: colors.status.error,
    IconComponent: XCircle,
  },
  info: {
    iconBg: colors.primaryLight,
    iconColor: colors.primaryDark,
    accentBorder: colors.primaryDark,
    IconComponent: Bell,
  },
};

export function NotificationCard({
  notification,
  variant,
  actionLabel,
  compact = false,
  onPress,
  onDismiss,
  style,
}: NotificationCardProps) {
  const isUnread = !notification.read_at;
  const resolvedVariant =
    variant || getNotificationVariant(notification.notification_type);
  const config = VARIANT_CONFIG[resolvedVariant];
  const Icon = config.IconComponent;

  const resolvedActionLabel =
    actionLabel !== undefined
      ? actionLabel
      : getNotificationActionLabel(notification);
  const timeText = formatNotificationTimestamp(notification.created_at);

  return (
    <Pressable
      onPress={onPress ? () => onPress(notification) : undefined}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'summary'}
      accessibilityLabel={`${isUnread ? 'Unread notification: ' : ''}${notification.title}. ${notification.body}`}
      style={({ pressed }) => [
        styles.container,
        compact ? styles.containerCompact : styles.containerDefault,
        isUnread && !compact && styles.unreadContainer,
        pressed && onPress && styles.pressed,
        style,
      ]}
    >
      <View
        style={[
          styles.iconBadge,
          compact && styles.iconBadgeCompact,
          { backgroundColor: config.iconBg },
        ]}
      >
        <Icon size={compact ? 18 : 20} color={config.iconColor} />
      </View>

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text
            style={[
              styles.title,
              compact && styles.titleCompact,
              isUnread && styles.titleUnread,
            ]}
            numberOfLines={compact ? 1 : 2}
          >
            {notification.title}
          </Text>

          <View style={styles.metaRight}>
            {Boolean(timeText) && (
              <Text style={styles.timestamp} numberOfLines={1}>
                {timeText}
              </Text>
            )}
            {isUnread && !compact && <View style={styles.unreadDot} />}
            {onDismiss && (
              <Pressable
                onPress={() => onDismiss(notification)}
                hitSlop={hitSlop}
                accessibilityRole="button"
                accessibilityLabel="Dismiss notification"
                style={styles.dismissButton}
              >
                <X size={16} color={colors.text.muted} />
              </Pressable>
            )}
          </View>
        </View>

        <Text
          style={[styles.body, compact && styles.bodyCompact]}
          numberOfLines={compact ? 2 : 3}
        >
          {notification.body}
        </Text>

        {!compact && resolvedActionLabel && onPress && (
          <View style={styles.actionRow}>
            <Text style={styles.actionText}>{resolvedActionLabel}</Text>
            <ChevronRight size={14} color={colors.primaryDark} />
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.sm,
  },
  containerDefault: {
    padding: spacing.base,
    marginBottom: spacing.md,
  },
  containerCompact: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
  },
  unreadContainer: {
    backgroundColor: '#FFFDF5',
    borderColor: '#F3DF98',
  },
  pressed: {
    opacity: 0.86,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    flexShrink: 0,
  },
  iconBadgeCompact: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: 4,
  },
  title: {
    flex: 1,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
    lineHeight: 20,
  },
  titleCompact: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  titleUnread: {
    fontWeight: typography.weights.bold,
  },
  metaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  timestamp: {
    fontSize: typography.sizes.xs,
    color: colors.text.muted,
    fontWeight: typography.weights.medium,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primaryDark,
  },
  dismissButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  body: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    lineHeight: 19,
  },
  bodyCompact: {
    fontSize: typography.sizes.xs,
    lineHeight: 17,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primaryLight,
    gap: 4,
  },
  actionText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
});
