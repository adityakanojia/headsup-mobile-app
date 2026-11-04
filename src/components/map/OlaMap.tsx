import { useMemo, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { WebView } from "react-native-webview";
import { MapPin, LocateFixed, Layers } from "lucide-react-native";

import { colors, spacing, borderRadius, typography } from "@/theme";

export interface OlaMapMarker {
  latitude: number;
  longitude: number;
  color?: string;
  label?: string;
}

interface OlaMapProps {
  latitude: number;
  longitude: number;
  height?: number;
  markers?: OlaMapMarker[];
  style?: StyleProp<ViewStyle>;
  zoom?: number;
  coverageKm?: number;
  title?: string;
  subtitle?: string;
}

const OLA_MAPS_API_KEY = process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY;

function createMapHtml(
  apiKey: string,
  latitude: number,
  longitude: number,
  zoom: number,
  markers: OlaMapMarker[],
) {
  const config = JSON.stringify({
    apiKey,
    latitude,
    longitude,
    zoom,
    markers,
  }).replace(/</g, "\\u003c");

  return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>
    html, body, #map {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
    }
    body { background: #FCFAF6; font-family: Arial, sans-serif; }
    .map-error {
      display: flex;
      height: 100%;
      align-items: center;
      justify-content: center;
      padding: 24px;
      color: #6B7280;
      text-align: center;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://www.unpkg.com/olamaps-web-sdk@latest/dist/olamaps-web-sdk.umd.js"></script>
  <script>
    (async function () {
      const config = ${config};

      function report(type, message) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(
            JSON.stringify({ type, message })
          );
        }
      }

      try {
        if (!window.OlaMaps) {
          throw new Error('Map SDK failed to load.');
        }

        const olaMaps = new OlaMaps({ apiKey: config.apiKey });

        const map = await olaMaps.init({
          container: 'map',
          style: 'https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json',
          center: [config.longitude, config.latitude],
          zoom: config.zoom
        });

        config.markers.forEach(function (marker) {
          if (
            !Number.isFinite(marker.latitude) ||
            !Number.isFinite(marker.longitude) ||
            Math.abs(marker.latitude) > 90 ||
            Math.abs(marker.longitude) > 180
          ) return;

          olaMaps.addMarker({
            color: marker.color || '#208AEF'
          })
          .setLngLat([marker.longitude, marker.latitude])
          .addTo(map);
        });

        report('ready');
      } catch (error) {
        const message = error && error.message
          ? error.message
          : 'Unable to load Ola Maps.';

        document.getElementById('map').innerHTML =
          '<div class="map-error">Map unavailable. Please check your connection.</div>';

        report('error', message);
      }
    })();
  </script>
</body>
</html>`;
}

export function OlaMap({
  latitude,
  longitude,
  height = 230,
  markers = [],
  style,
  zoom = 12,
  coverageKm = 5,
  title = "Your next crew is nearby",
  subtitle = "Discover workforce availability around you",
}: OlaMapProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapType, setMapType] = useState<"map" | "satellite">("map");
  const [radius, setRadius] = useState(coverageKm);
  const [reloadKey, setReloadKey] = useState(0);

  const source = useMemo(() => {
    if (
      !OLA_MAPS_API_KEY ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      return null;
    }

    return createMapHtml(OLA_MAPS_API_KEY, latitude, longitude, zoom, markers);
  }, [latitude, longitude, zoom, markers]);

  const handleMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const message = JSON.parse(event.nativeEvent.data) as {
          type: string;
          message?: string;
        };

        if (message.type === "ready") {
          setIsLoading(false);
          setError(null);
        }

        if (message.type === "error") {
          setIsLoading(false);
          setError(message.message || "Unable to load Ola Maps.");
        }
      } catch {
        setIsLoading(false);
      }
    },
    [],
  );

  if (!source) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.header}>
          <View style={styles.brandIcon}>
            <MapPin size={20} color={colors.primaryDark} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
        </View>

        <View style={[styles.mapFallback, { height }]}>
          <MapPin size={28} color={colors.text.secondary} />
          <Text style={styles.feedbackText}>
            Map configuration is unavailable.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <View style={styles.brandIcon}>
          <MapPin size={20} color={colors.primaryDark} />
        </View>

        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        <View style={styles.networkBadge}>
          <View style={styles.networkDot} />
          <Text style={styles.networkText}>Network</Text>
        </View>
      </View>

      <View style={[styles.mapFrame, { height }]}>
        <WebView
          key={reloadKey}
          source={{ html: source }}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          setSupportMultipleWindows={false}
          onMessage={handleMessage}
          onError={() => {
            setIsLoading(false);
            setError("Unable to load the map. Check your connection.");
          }}
          onHttpError={() => {
            setIsLoading(false);
            setError("The map service returned an error.");
          }}
          style={styles.webView}
        />

        {isLoading && !error ? (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color={colors.primaryDark} />
            <Text style={styles.loadingText}>
              Connecting to the workforce network...
            </Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorOverlay}>
            <MapPin size={26} color={colors.text.secondary} />
            <Text style={styles.feedbackText}>
              Map unavailable. Please try again.
            </Text>
            <Pressable
              onPress={() => {
                setError(null);
                setIsLoading(true);
                setReloadKey((key) => key + 1);
              }}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>Reload map</Text>
            </Pressable>
          </View>
        ) : null}

        {!error && !isLoading ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change map radius display"
              onPress={() =>
                setRadius((current) => (current >= 10 ? 2 : current + 3))
              }
              style={styles.radiusControl}
            >
              <LocateFixed size={16} color={colors.text.primary} />
              <Text style={styles.controlText}>{radius} km</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Toggle map style"
              onPress={() =>
                setMapType((current) =>
                  current === "map" ? "satellite" : "map",
                )
              }
              style={styles.layerControl}
            >
              <Layers size={16} color={colors.text.primary} />
              <Text style={styles.controlText}>
                {mapType === "map" ? "Map" : "Satellite"}
              </Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    gap: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  brandIcon: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: typography.sizes.xs,
    lineHeight: 16,
    color: colors.text.secondary,
  },
  networkBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.status.successLight,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  networkDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.status.success,
  },
  networkText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.status.success,
  },
  mapFrame: {
    overflow: "hidden",
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background,
  },
  webView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mapFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  loadingText: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    textAlign: "center",
  },
  errorOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  feedbackText: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    textAlign: "center",
  },
  retryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
  },
  retryText: {
    color: colors.primaryDark,
    fontWeight: typography.weights.bold,
  },
  radiusControl: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    elevation: 2,
  },
  layerControl: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    elevation: 2,
  },
  controlText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
  },
});
