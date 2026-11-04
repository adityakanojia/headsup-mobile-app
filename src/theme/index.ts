/**
 * HeadsUp Enterprise Design System
 * React Native + Expo
 * Light mode | Refined B2B workforce platform
 */
import { Platform } from "react-native";

export const colors = {
  primary: "#FFCC00",
  primaryDark: "#7A5D00",
  primaryHover: "#E6B800",
  primaryLight: "#FFF8D6",
  primaryPressed: "#EBB800",

  background: "#FCFAF6",
  surface: "#FFFFFF",
  surfaceElevated: "#FFFFFF",
  surfaceMuted: "#F5F2EB",

  border: "#DDD3C0",
  borderLight: "#EAE2D3",
  divider: "#EFE9DD",
  focusRing: "#C99E00",

  text: {
    primary: "#141413",
    secondary: "#5C616B",
    muted: "#8C919C",
    inverse: "#FFFFFF",
    link: "#1D4ED8",
    disabled: "#A3A3A3",
  },

  status: {
    error: "#B91C1C",
    errorLight: "#FEF2F2",
    success: "#15803D",
    successLight: "#F0FDF4",
    warning: "#B45309",
    warningLight: "#FFFBEB",
    info: "#1D4ED8",
    infoLight: "#EFF6FF",
  },

  map: {
    worker: "#208AEF",
    available: "#16A34A",
    unavailable: "#9CA3AF",
    radius: "rgba(32, 138, 239, 0.12)",
  },

  overlay: "rgba(20, 20, 19, 0.48)",
  skeleton: "#EAE5DC",
  ripple: "rgba(122, 93, 0, 0.10)",
} as const;

export const typography = {
  fontFamily: Platform.select({
    ios: "System",
    android: "sans-serif",
    default: "System",
  }),
  fontFamilyMono: Platform.select({
    ios: "Menlo",
    android: "monospace",
    default: "monospace",
  }),

  sizes: {
    "2xs": 10,
    xs: 11,
    sm: 13,
    base: 15,
    md: 17,
    lg: 20,
    xl: 23,
    "2xl": 27,
    "3xl": 32,
    "4xl": 38,
  },

  weights: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
    heavy: "800" as const,
  },

  /**
   * Pixel line-heights safe for React Native Text styles.
   */
  lineHeights: {
    tight: 18,
    normal: 20,
    relaxed: 22,
  },

  letterSpacing: {
    tight: -0.4,
    normal: 0,
    wide: 0.4,
    wider: 0.8,
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  "2xl": 32,
  "3xl": 40,
  "4xl": 48,
  "5xl": 64,
} as const;

export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 18,
  "2xl": 22,
  full: 9999,
} as const;

export const shadows = {
  sm: Platform.select({
    ios: {
      shadowColor: "#141413",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 3,
    },
    android: { elevation: 1 },
    default: {},
  }),

  md: Platform.select({
    ios: {
      shadowColor: "#141413",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
    },
    android: { elevation: 2 },
    default: {},
  }),

  lg: Platform.select({
    ios: {
      shadowColor: "#141413",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.09,
      shadowRadius: 12,
    },
    android: { elevation: 4 },
    default: {},
  }),
} as const;

export const animation = {
  instant: 100,
  fast: 150,
  normal: 220,
  slow: 320,
} as const;

export const hitSlop = {
  top: 8,
  right: 8,
  bottom: 8,
  left: 8,
} as const;

export const iconSizes = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
} as const;

export const layout = {
  screenPadding: 20,
  contentMaxWidth: 560,
  inputHeight: 52,
  buttonHeight: 48,
  buttonHeightSmall: 38,
  minimumTouchTarget: 44,
  headerHeight: 60,
  tabBarHeight: 64,
} as const;
