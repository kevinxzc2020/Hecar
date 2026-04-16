import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, spacing, radius, fontSize } from "../../src/theme";
import { useApp } from "../../src/context/AppContext";
import { mockGasStations, mockEVStations } from "../../src/data/mockStations";
import { isGasStation, Station, GasStation, EVStation } from "../../src/types";

const { width, height } = Dimensions.get("window");
const CARD_WIDTH = width - 40;

export default function MapScreen() {
  const { state, dispatch } = useApp();
  const router = useRouter();
  const [selectedStation, setSelectedStation] = useState<string | null>(null);

  const isGas = state.fuelMode === "gas";
  const stations: Station[] = isGas ? mockGasStations : mockEVStations;

  const toggleMode = () => {
    dispatch({
      type: "SET_FUEL_MODE",
      payload: isGas ? "ev" : "gas",
    });
    setSelectedStation(null);
  };

  const handleStationDetail = (station: Station) => {
    router.push(
      `/station-detail?id=${station.id}&mode=${state.fuelMode}` as any
    );
  };

  const renderStationCard = (station: Station) => {
    if (isGasStation(station)) {
      const gs = station as GasStation;
      return (
        <TouchableOpacity
          key={gs.id}
          style={[
            styles.card,
            selectedStation === gs.id && styles.cardSelected,
          ]}
          onPress={() => handleStationDetail(gs)}
          activeOpacity={0.8}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardBrand}>
              <Ionicons name="flame" size={18} color={colors.gas} />
              <Text style={styles.cardBrandText}>{gs.brand}</Text>
            </View>
            <Text style={styles.cardDistance}>{gs.distance} km</Text>
          </View>
          <Text style={styles.cardName} numberOfLines={1}>
            {gs.name}
          </Text>
          <Text style={styles.cardAddress} numberOfLines={1}>
            {gs.address}
          </Text>
          <View style={styles.priceRow}>
            {gs.prices.regular != null && (
              <View style={styles.priceTag}>
                <Text style={styles.priceLabel}>Regular</Text>
                <Text style={styles.priceValue}>
                  ${gs.prices.regular.toFixed(2)}
                </Text>
              </View>
            )}
            {gs.prices.premium != null && (
              <View style={styles.priceTag}>
                <Text style={styles.priceLabel}>Premium</Text>
                <Text style={styles.priceValue}>
                  ${gs.prices.premium.toFixed(2)}
                </Text>
              </View>
            )}
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={12} color="#FBBF24" />
              <Text style={styles.ratingText}>{gs.rating}</Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    }
    // EV station card
    const ev = station as EVStation;
    const available = ev.chargers.filter((c) => c.status === "available").length;
    const total = ev.chargers.length;
    const hasDC = ev.chargers.some((c) => c.type === "DC");
    const hasAC = ev.chargers.some((c) => c.type === "AC");
    const cheapest = Math.min(...ev.chargers.map((c) => c.pricePerKwh));

    return (
      <TouchableOpacity
        key={ev.id}
        style={[
          styles.card,
          selectedStation === ev.id && styles.cardSelected,
        ]}
        onPress={() => handleStationDetail(ev)}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardBrand}>
            <Ionicons name="flash" size={18} color={colors.ev} />
            <Text style={[styles.cardBrandText, { color: colors.ev }]}>
              {ev.network}
            </Text>
          </View>
          <Text style={styles.cardDistance}>{ev.distance} km</Text>
        </View>
        <Text style={styles.cardName} numberOfLines={1}>
          {ev.name}
        </Text>
        <Text style={styles.cardAddress} numberOfLines={1}>
          {ev.address}
        </Text>
        <View style={styles.priceRow}>
          <View style={styles.availBadge}>
            <View
              style={[
                styles.dot,
                { backgroundColor: available > 0 ? colors.available : colors.danger },
              ]}
            />
            <Text style={styles.availText}>
              {available}/{total} 可用
            </Text>
          </View>
          <View style={styles.chargerTypes}>
            {hasDC && (
              <View style={[styles.typeBadge, { borderColor: colors.ev }]}>
                <Text style={[styles.typeText, { color: colors.ev }]}>DC</Text>
              </View>
            )}
            {hasAC && (
              <View style={[styles.typeBadge, { borderColor: colors.primary }]}>
                <Text style={[styles.typeText, { color: colors.primary }]}>AC</Text>
              </View>
            )}
          </View>
          <Text style={styles.priceValue}>${cheapest.toFixed(2)}/kWh</Text>
        </View>
      </TouchableOpacity>
    );
  };

  // --- Mock map: station pins on a grid background ---
  const renderMockMap = () => {
    return (
      <View style={styles.mockMap}>
        {/* Grid lines to suggest a map */}
        {[0.2, 0.35, 0.5, 0.65, 0.8].map((ratio, i) => (
          <View
            key={`h-${i}`}
            style={[styles.gridLine, { top: height * ratio, left: 0, right: 0, height: 1 }]}
          />
        ))}
        {[0.15, 0.35, 0.55, 0.75, 0.9].map((ratio, i) => (
          <View
            key={`v-${i}`}
            style={[styles.gridLine, { left: width * ratio, top: 0, bottom: 0, width: 1 }]}
          />
        ))}

        {/* Station pins scattered on the "map" */}
        {stations.map((s, i) => {
          // Distribute pins visually across the screen
          const row = Math.floor(i / 3);
          const col = i % 3;
          const top = 120 + row * 140 + (col % 2) * 40;
          const left = 30 + col * ((width - 80) / 3) + (row % 2) * 20;
          const markerColor = isGasStation(s) ? colors.gas : colors.ev;

          return (
            <TouchableOpacity
              key={s.id}
              style={[styles.pin, { top, left }]}
              onPress={() => {
                setSelectedStation(s.id);
                handleStationDetail(s);
              }}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.marker,
                  {
                    backgroundColor: markerColor,
                    borderColor:
                      selectedStation === s.id ? colors.textPrimary : "transparent",
                  },
                ]}
              >
                <Ionicons
                  name={isGas ? "flame" : "flash"}
                  size={16}
                  color="#fff"
                />
              </View>
              <Text style={styles.pinLabel} numberOfLines={1}>
                {isGasStation(s)
                  ? `$${(s as GasStation).prices.regular?.toFixed(2) ?? "—"}`
                  : `$${Math.min(...(s as EVStation).chargers.map((c) => c.pricePerKwh)).toFixed(2)}`}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* "You are here" dot */}
        <View style={styles.userDot}>
          <View style={styles.userDotInner} />
          <View style={styles.userDotPulse} />
        </View>

        {/* Map placeholder text */}
        <View style={styles.mapBanner}>
          <Ionicons name="map-outline" size={14} color={colors.textMuted} />
          <Text style={styles.mapBannerText}>
            地图将在接入 Google Maps API 后显示
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Mock Map */}
      {renderMockMap()}

      {/* Top controls — Gas/EV toggle */}
      <View style={styles.topBar}>
        <View style={styles.modeSwitcher}>
          <TouchableOpacity
            style={[styles.modeBtn, isGas && styles.modeBtnActiveGas]}
            onPress={() => !isGas && toggleMode()}
          >
            <Ionicons
              name="flame"
              size={16}
              color={isGas ? "#fff" : colors.textSecondary}
            />
            <Text
              style={[styles.modeBtnText, isGas && styles.modeBtnTextActive]}
            >
              加油
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, !isGas && styles.modeBtnActiveEV]}
            onPress={() => isGas && toggleMode()}
          >
            <Ionicons
              name="flash"
              size={16}
              color={!isGas ? "#fff" : colors.textSecondary}
            />
            <Text
              style={[styles.modeBtnText, !isGas && styles.modeBtnTextActive]}
            >
              充电
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* My location button */}
      <TouchableOpacity style={styles.locateBtn}>
        <Ionicons name="locate" size={22} color={colors.primary} />
      </TouchableOpacity>

      {/* Bottom card carousel */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.cardScroll}
        contentContainerStyle={styles.cardScrollContent}
        snapToInterval={CARD_WIDTH + 12}
        decelerationRate="fast"
      >
        {stations.map(renderStationCard)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  // Mock map
  mockMap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0B1120",
  },
  gridLine: {
    position: "absolute",
    backgroundColor: colors.border + "40",
  },
  pin: {
    position: "absolute",
    alignItems: "center",
    zIndex: 10,
  },
  pinLabel: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
    backgroundColor: "rgba(15,23,42,0.85)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: "hidden",
  },
  userDot: {
    position: "absolute",
    top: height * 0.38,
    left: width * 0.46,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  userDotInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary,
    borderWidth: 2.5,
    borderColor: "#fff",
  },
  userDotPulse: {
    position: "absolute",
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + "25",
  },
  mapBanner: {
    position: "absolute",
    top: Platform.OS === "ios" ? 110 : 90,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(15,23,42,0.85)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  mapBannerText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },

  // Top bar
  topBar: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 40,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    justifyContent: "center",
  },
  modeSwitcher: {
    flexDirection: "row",
    backgroundColor: "rgba(15,23,42,0.92)",
    borderRadius: radius.full,
    padding: 3,
    gap: 2,
  },
  modeBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.full,
    gap: 6,
  },
  modeBtnActiveGas: { backgroundColor: colors.gas },
  modeBtnActiveEV: { backgroundColor: colors.ev },
  modeBtnText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  modeBtnTextActive: { color: "#fff" },

  // Location button
  locateBtn: {
    position: "absolute",
    right: spacing.lg,
    bottom: 210,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(15,23,42,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Markers
  marker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },

  // Card carousel
  cardScroll: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 90,
  },
  cardScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 12,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardSelected: {
    borderColor: colors.primary,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  cardBrand: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardBrandText: {
    color: colors.gas,
    fontSize: fontSize.sm,
    fontWeight: "700",
  },
  cardDistance: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
  },
  cardName: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: "700",
    marginBottom: 2,
  },
  cardAddress: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    marginBottom: spacing.sm,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  priceTag: {
    backgroundColor: colors.bgCard,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
    alignItems: "center",
  },
  priceLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "500",
  },
  priceValue: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: "700",
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginLeft: "auto",
  },
  ratingText: {
    color: "#FBBF24",
    fontSize: fontSize.xs,
    fontWeight: "600",
  },

  // EV-specific
  availBadge: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  availText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  chargerTypes: { flexDirection: "row", gap: 4 },
  typeBadge: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  typeText: { fontSize: fontSize.xs, fontWeight: "700" },
});
