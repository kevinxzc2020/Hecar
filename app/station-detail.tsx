import React from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, spacing, radius, fontSize } from "../src/theme";
import { useApp } from "../src/context/AppContext";
import { mockGasStations, mockEVStations } from "../src/data/mockStations";
import { getStationById } from "../src/services/stationsApi";
import { GasStation, EVStation, FuelMode, isGasStation } from "../src/types";

export default function StationDetailScreen() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode: FuelMode }>();
  const { state, dispatch } = useApp();
  const router = useRouter();

  // 优先从 API 缓存里找（id 形如 osm-gas-* / ocm-ev-*）；找不到再退到 mock 数据
  const cached = id ? getStationById(id) : null;
  const fallback = (mode === "gas" ? mockGasStations : mockEVStations).find(
    (s) => s.id === id,
  );
  const station = cached ?? fallback;
  const isGas = station ? isGasStation(station) : mode === "gas";

  if (!station) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Station not found</Text>
      </SafeAreaView>
    );
  }

  const isFav = state.favoriteStationIds.includes(station.id);

  const openNav = () => {
    // Web 上 Platform.select 没对应 key 会返回 undefined，补一个 Google Maps 网页版
    const url = Platform.select({
      ios: `maps:?daddr=${station.latitude},${station.longitude}`,
      android: `google.navigation:q=${station.latitude},${station.longitude}`,
      web: `https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`,
    });
    if (url) Linking.openURL(url);
  };

  if (isGas) {
    const gs = station as GasStation;
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>站点详情</Text>
          <TouchableOpacity
            onPress={() => dispatch({ type: "TOGGLE_FAVORITE", payload: gs.id })}
          >
            <Ionicons
              name={isFav ? "heart" : "heart-outline"}
              size={24}
              color={isFav ? colors.danger : colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Station info */}
          <View style={styles.stationHeader}>
            <View style={[styles.brandCircle, { backgroundColor: colors.gas + "20" }]}>
              <Ionicons name="flame" size={28} color={colors.gas} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stationName}>{gs.name}</Text>
              <Text style={styles.stationBrand}>{gs.brand}</Text>
              <Text style={styles.stationAddr}>{gs.address}</Text>
            </View>
          </View>

          {/* Distance + Rating */}
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="navigate" size={16} color={colors.primary} />
              <Text style={styles.metaText}>{gs.distance} km</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="star" size={16} color="#FBBF24" />
              <Text style={styles.metaText}>{gs.rating}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="time" size={16} color={colors.textSecondary} />
              <Text style={styles.metaText}>
                更新于 {new Date(gs.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
          </View>

          {/* Prices */}
          <Text style={styles.sectionTitle}>油价</Text>
          <View style={styles.priceGrid}>
            {Object.entries(gs.prices)
              // 过滤掉 undefined / 非数字的价格条目，避免渲染 "$undefined"
              .filter(
                (entry): entry is [string, number] =>
                  typeof entry[1] === "number" && Number.isFinite(entry[1]),
              )
              .map(([type, price]) => (
                <View key={type} style={styles.priceCard}>
                  <Text style={styles.priceType}>
                    {type === "regular"
                      ? "Regular"
                      : type === "midgrade"
                      ? "Mid"
                      : type === "premium"
                      ? "Premium"
                      : "Diesel"}
                  </Text>
                  <Text style={styles.priceAmount}>${price.toFixed(2)}</Text>
                  <Text style={styles.priceUnit}>/gal</Text>
                </View>
              ))}
          </View>

          {/* Navigate button */}
          <TouchableOpacity style={styles.navBtn} onPress={openNav}>
            <Ionicons name="navigate" size={20} color="#fff" />
            <Text style={styles.navBtnText}>导航前往</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // EV Station
  const ev = station as EVStation;
  const availCount = ev.chargers.filter((c) => c.status === "available").length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>站点详情</Text>
        <TouchableOpacity
          onPress={() => dispatch({ type: "TOGGLE_FAVORITE", payload: ev.id })}
        >
          <Ionicons
            name={isFav ? "heart" : "heart-outline"}
            size={24}
            color={isFav ? colors.danger : colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.stationHeader}>
          <View style={[styles.brandCircle, { backgroundColor: colors.ev + "20" }]}>
            <Ionicons name="flash" size={28} color={colors.ev} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.stationName}>{ev.name}</Text>
            <Text style={[styles.stationBrand, { color: colors.ev }]}>
              {ev.network}
            </Text>
            <Text style={styles.stationAddr}>{ev.address}</Text>
          </View>
        </View>

        {/* Meta */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="navigate" size={16} color={colors.primary} />
            <Text style={styles.metaText}>{ev.distance} km</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="star" size={16} color="#FBBF24" />
            <Text style={styles.metaText}>{ev.rating}</Text>
          </View>
          <View style={styles.metaItem}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    availCount > 0 ? colors.available : colors.danger,
                },
              ]}
            />
            <Text style={styles.metaText}>
              {availCount}/{ev.chargers.length} 可用
            </Text>
          </View>
        </View>

        {/* Charger list */}
        <Text style={styles.sectionTitle}>充电桩</Text>
        {ev.chargers.map((c) => (
          <View key={c.id} style={styles.chargerRow}>
            <View
              style={[
                styles.chargerTypeBadge,
                {
                  backgroundColor:
                    c.type === "DC" ? colors.ev + "20" : colors.primary + "20",
                },
              ]}
            >
              <Text
                style={[
                  styles.chargerTypeText,
                  { color: c.type === "DC" ? colors.ev : colors.primary },
                ]}
              >
                {c.type}
              </Text>
            </View>
            <View style={styles.chargerInfo}>
              <Text style={styles.chargerPower}>{c.power} kW</Text>
              <Text style={styles.chargerPrice}>
                ${c.pricePerKwh.toFixed(2)}/kWh
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    c.status === "available"
                      ? colors.available + "20"
                      : c.status === "occupied"
                      ? colors.occupied + "20"
                      : colors.offline + "20",
                },
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor:
                      c.status === "available"
                        ? colors.available
                        : c.status === "occupied"
                        ? colors.occupied
                        : colors.offline,
                  },
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  {
                    color:
                      c.status === "available"
                        ? colors.available
                        : c.status === "occupied"
                        ? colors.occupied
                        : colors.offline,
                  },
                ]}
              >
                {c.status === "available"
                  ? "空闲"
                  : c.status === "occupied"
                  ? "使用中"
                  : "离线"}
              </Text>
            </View>
          </View>
        ))}

        <TouchableOpacity style={[styles.navBtn, { backgroundColor: colors.ev }]} onPress={openNav}>
          <Ionicons name="navigate" size={20} color="#fff" />
          <Text style={styles.navBtnText}>导航前往</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  errorText: { color: colors.danger, textAlign: "center", marginTop: 100 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: "700",
  },

  scroll: { padding: spacing.lg, paddingBottom: 40 },

  stationHeader: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  brandCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  stationName: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: "700",
  },
  stationBrand: { color: colors.gas, fontSize: fontSize.sm, fontWeight: "600" },
  stationAddr: { color: colors.textSecondary, fontSize: fontSize.xs, marginTop: 2 },

  metaRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: spacing.xl,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { color: colors.textSecondary, fontSize: fontSize.xs },

  sectionTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: "700",
    marginBottom: spacing.md,
  },

  // Gas prices grid
  priceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.xxl,
  },
  priceCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
  },
  priceType: { color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: "600" },
  priceAmount: {
    color: colors.gas,
    fontSize: fontSize.xxl,
    fontWeight: "700",
    marginVertical: 2,
  },
  priceUnit: { color: colors.textMuted, fontSize: fontSize.xs },

  // EV charger list
  chargerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: 12,
  },
  chargerTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  chargerTypeText: { fontSize: fontSize.sm, fontWeight: "700" },
  chargerInfo: { flex: 1 },
  chargerPower: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: "600" },
  chargerPrice: { color: colors.textSecondary, fontSize: fontSize.xs },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: fontSize.xs, fontWeight: "600" },

  // Nav button
  navBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gas,
    borderRadius: radius.lg,
    paddingVertical: 16,
    marginTop: spacing.xl,
    gap: 8,
  },
  navBtnText: { color: "#fff", fontSize: fontSize.lg, fontWeight: "700" },
});
