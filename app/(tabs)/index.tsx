import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  Platform,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, spacing, radius, fontSize } from "../../src/theme";
import { useUserLocation } from "../../src/hooks/useUserLocation";
import { useNearbyStations } from "../../src/hooks/useNearbyStations";
import { useRankedStations } from "../../src/hooks/useRankedStations";
import { useStationSafety } from "../../src/hooks/useStationSafety";
import type { SafetyLevel } from "../../src/services/safetyApi";
import { useApp } from "../../src/context/AppContext";
import {
  mockGasStations,
  mockEVStations,
} from "../../src/data/mockStations";
import {
  isGasStation,
  Station,
  GasStation,
  EVStation,
} from "../../src/types";
import StationMap, {
  StationMapHandle,
} from "../../src/components/StationMap";
import StationMapFallback from "../../src/components/StationMapFallback";
import { ErrorBoundary } from "../../src/components/ErrorBoundary";
import { env } from "../../src/config/env";

const { width } = Dimensions.get("window");

export default function MapScreen() {
  const { state, dispatch } = useApp();
  const router = useRouter();
  const mapRef = useRef<StationMapHandle>(null);

  // 用户手动点了哪个 pin；null = 用户还没点，底部默认显示 AI 推荐
  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  const { coord: userLocation, error: locationError, refresh: refreshLocation } =
    useUserLocation({ watch: true });

  const isGas = state.fuelMode === "gas";
  const {
    stations: nearby,
    loading: stationsLoading,
    error: stationsError,
    gasInfo,
    refresh: refreshStations,
  } = useNearbyStations(userLocation, state.fuelMode);

  // 有真实数据用真实的；没定位 / API 失败 / 返回空 → 降级到 mock
  const stations: Station[] = useMemo(() => {
    const raw: Station[] =
      nearby.length > 0 ? nearby : isGas ? mockGasStations : mockEVStations;
    // 按 id dedup —— Google Places 偶尔返回同 POI 多条记录，id 冲突会让 Marker 漏 pin
    return Array.from(new Map(raw.map((s) => [s.id, s])).values());
  }, [nearby, isGas]);
  const usingFallback = nearby.length === 0;

  // FBI 安全数据（只对美国站点有效，没 key 返回空对象）
  const safetyById = useStationSafety(stations);

  // 打分排序 + 可选 AI 推荐层；key 缺失时 aiRecommend 内部返回 null
  const { ranked, ai, aiLoading } = useRankedStations(stations, {
    userCoord: userLocation,
    mode: state.fuelMode,
    useAI: true,
  });
  // AI 推荐的"最优"站点 id（用来高亮 pin 并且默认展示它的卡）
  const winnerId = ai?.winnerId ?? ranked.find((r) => r.rank === 1)?.station.id;

  /**
   * 底部到底显示哪张卡的来源：
   *   - 用户点过 pin → 显示用户选的那张
   *   - 用户没点过 → 显示 AI 推荐（winnerId）
   *   - 两者都没有 → null（例如数据还没到）
   */
  const displayStation = useMemo(() => {
    const manualPick = selectedStation
      ? ranked.find((r) => r.station.id === selectedStation)?.station
      : null;
    if (manualPick) return manualPick;
    if (!winnerId) return null;
    return ranked.find((r) => r.station.id === winnerId)?.station ?? null;
  }, [selectedStation, winnerId, ranked]);

  // 切换 gas/ev 时清掉手动选中，重新回到"显示 AI 推荐"的默认态
  useEffect(() => {
    setSelectedStation(null);
  }, [state.fuelMode]);

  // 如果用户选中的站点被新数据洗掉（换 tab / 位置变 / 刷新），重置
  useEffect(() => {
    if (!selectedStation) return;
    const exists = ranked.some((r) => r.station.id === selectedStation);
    if (!exists) setSelectedStation(null);
  }, [ranked, selectedStation]);

  // 默认态：AI 推荐确定后，把镜头飞到推荐站点（只在首次定位到 winner 时做一次）
  const flownToWinnerRef = useRef<string | null>(null);
  useEffect(() => {
    if (selectedStation) return; // 用户已经点了别的，不要抢镜头
    if (!winnerId) return;
    if (flownToWinnerRef.current === winnerId) return;
    const w = ranked.find((r) => r.station.id === winnerId)?.station;
    if (!w) return;
    flownToWinnerRef.current = winnerId;
    const t = setTimeout(() => {
      mapRef.current?.animateToCoordinate(
        { latitude: w.latitude, longitude: w.longitude },
        0.02,
      );
    }, 400);
    return () => clearTimeout(t);
  }, [winnerId, ranked, selectedStation]);

  const toggleMode = () => {
    dispatch({
      type: "SET_FUEL_MODE",
      payload: isGas ? "ev" : "gas",
    });
    setSelectedStation(null);
  };

  const handleStationDetail = (station: Station) => {
    router.push(
      `/station-detail?id=${station.id}&mode=${state.fuelMode}` as any,
    );
  };

  /**
   * 点地图 pin：记录选中 + 镜头飞过去。
   * useCallback 让 StationMap 的 React.memo 能生效 —— 否则每次父 render 都
   * 创建新函数引用，所有 marker 都会被迫重绘，导致 pin 闪/漂移。
   */
  const handleMarkerPress = useCallback((station: Station) => {
    setSelectedStation(station.id);
    mapRef.current?.animateToCoordinate(
      { latitude: station.latitude, longitude: station.longitude },
      0.015,
    );
  }, []);

  const handleLocate = async () => {
    if (userLocation) {
      mapRef.current?.animateToCoordinate(userLocation, 0.02);
      return;
    }
    const next = await refreshLocation();
    if (next) mapRef.current?.animateToCoordinate(next, 0.02);
  };

  const safetyColor = (level: SafetyLevel): string => {
    if (level === "low") return "#22C55E";
    if (level === "moderate") return "#F59E0B";
    if (level === "high") return "#EF4444";
    return colors.textMuted;
  };
  const safetyIcon = (
    level: SafetyLevel,
  ): "shield-checkmark" | "shield-half" | "warning" | "help" => {
    if (level === "low") return "shield-checkmark";
    if (level === "moderate") return "shield-half";
    if (level === "high") return "warning";
    return "help";
  };

  /** 底部唯一的详情卡：默认跟随 AI 推荐；用户点 pin 后跟随选中 */
  const renderStationCard = (station: Station) => {
    const isUserPick = selectedStation === station.id;
    const isWinner = winnerId === station.id;
    // 顶部小 label：提示这张卡是 AI 推的还是用户选的
    const label = isUserPick && !isWinner
      ? { text: "你选的", color: colors.primary, icon: "hand-left" as const }
      : isWinner
      ? { text: "AI 推荐", color: "#F59E0B", icon: "sparkles" as const }
      : null;

    if (isGasStation(station)) {
      const gs = station as GasStation;
      return (
        <TouchableOpacity
          style={[styles.card, styles.cardSelected]}
          onPress={() => handleStationDetail(gs)}
          activeOpacity={0.85}
        >
          {label && (
            <View style={[styles.cardLabel, { borderColor: label.color }]}>
              <Ionicons name={label.icon} size={11} color={label.color} />
              <Text style={[styles.cardLabelText, { color: label.color }]}>
                {label.text}
              </Text>
            </View>
          )}
          <View style={styles.cardHeader}>
            <View style={styles.cardBrand}>
              <MaterialCommunityIcons name="gas-station" size={20} color={colors.gas} />
              <Text style={styles.cardBrandText}>{gs.brand}</Text>
              {safetyById[gs.id] && safetyById[gs.id]!.level !== "unknown" && (
                <View
                  style={[
                    styles.safetyBadge,
                    { borderColor: safetyColor(safetyById[gs.id]!.level) },
                  ]}
                >
                  <Ionicons
                    name={safetyIcon(safetyById[gs.id]!.level)}
                    size={11}
                    color={safetyColor(safetyById[gs.id]!.level)}
                  />
                </View>
              )}
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
            {gs.prices.regular == null && gs.prices.premium == null && (
              <View style={[styles.priceTag, { backgroundColor: colors.bg }]}>
                <Text style={styles.priceLabel}>价格未知</Text>
              </View>
            )}
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
            {gs.rating > 0 && (
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={12} color="#FBBF24" />
                <Text style={styles.ratingText}>{gs.rating}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      );
    }
    const ev = station as EVStation;
    const available = ev.chargers.filter(
      (c) => c.status === "available",
    ).length;
    const total = ev.chargers.length;
    const hasDC = ev.chargers.some((c) => c.type === "DC");
    const hasAC = ev.chargers.some((c) => c.type === "AC");
    const validPrices = ev.chargers
      .map((c) => c.pricePerKwh)
      .filter((p) => Number.isFinite(p) && p > 0);
    const cheapest = validPrices.length > 0 ? Math.min(...validPrices) : null;

    return (
      <TouchableOpacity
        style={[styles.card, styles.cardSelected]}
        onPress={() => handleStationDetail(ev)}
        activeOpacity={0.85}
      >
        {label && (
          <View style={[styles.cardLabel, { borderColor: label.color }]}>
            <Ionicons name={label.icon} size={11} color={label.color} />
            <Text style={[styles.cardLabelText, { color: label.color }]}>
              {label.text}
            </Text>
          </View>
        )}
        <View style={styles.cardHeader}>
          <View style={styles.cardBrand}>
            <MaterialCommunityIcons name="ev-station" size={20} color={colors.ev} />
            <Text style={[styles.cardBrandText, { color: colors.ev }]}>
              {ev.network}
            </Text>
            {safetyById[ev.id] && safetyById[ev.id]!.level !== "unknown" && (
              <View
                style={[
                  styles.safetyBadge,
                  { borderColor: safetyColor(safetyById[ev.id]!.level) },
                ]}
              >
                <Ionicons
                  name={safetyIcon(safetyById[ev.id]!.level)}
                  size={11}
                  color={safetyColor(safetyById[ev.id]!.level)}
                />
              </View>
            )}
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
                {
                  backgroundColor:
                    available > 0 ? colors.available : colors.danger,
                },
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
                <Text style={[styles.typeText, { color: colors.primary }]}>
                  AC
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.priceValue}>
            {cheapest != null ? `$${cheapest.toFixed(2)}/kWh` : "—"}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // 地图上高亮的那根 pin：跟随底部卡片（displayStation），没卡片就没高亮
  const highlightedId = displayStation?.id ?? null;

  return (
    <View style={styles.container}>
      <ErrorBoundary
        name="StationMap"
        fallback={
          <StationMapFallback
            stations={stations}
            selectedId={highlightedId}
            onSelectStation={handleMarkerPress}
            bannerText="地图渲染失败，已切换到占位视图"
          />
        }
      >
        <StationMap
          ref={mapRef}
          stations={stations}
          selectedId={highlightedId}
          onSelectStation={handleMarkerPress}
          userLocation={userLocation}
        />
      </ErrorBoundary>

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

      {stationsLoading && (
        <View style={styles.infoBanner}>
          <Ionicons name="cloud-download" size={12} color={colors.textPrimary} />
          <Text style={styles.infoBannerText}>正在加载附近站点…</Text>
        </View>
      )}
      {!stationsLoading && usingFallback && userLocation && (
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={12} color={colors.textPrimary} />
          <Text style={styles.infoBannerText} numberOfLines={1}>
            {stationsError ? `拉取失败：${stationsError}` : "附近没找到站点"}，显示示例数据
          </Text>
        </View>
      )}

      {locationError && (
        <View style={styles.errorBanner}>
          <Ionicons name="warning" size={12} color={colors.textPrimary} />
          <Text style={styles.errorBannerText} numberOfLines={1}>
            {locationError}
          </Text>
        </View>
      )}

      {!usingFallback && !stationsLoading && (
        <View style={styles.sourcePill}>
          <Ionicons name="cloud-done" size={11} color={colors.textSecondary} />
          <Text style={styles.sourcePillText}>
            {isGas
              ? gasInfo?.source === "google" ? "Google Places" : "OSM"
              : "Open Charge Map"} · {nearby.length} 站点
          </Text>
        </View>
      )}

      {isGas && gasInfo?.googleError && env.hasGooglePlaces && (
        <View style={styles.googleErrorBanner}>
          <Ionicons name="warning" size={12} color="#F59E0B" />
          <Text style={styles.googleErrorText} numberOfLines={3}>
            Google 失败 → 回退 OSM：{gasInfo.googleError}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.refreshBtn}
        onPress={() => refreshStations()}
        activeOpacity={0.7}
        disabled={stationsLoading}
      >
        <Ionicons
          name="refresh"
          size={20}
          color={stationsLoading ? colors.textMuted : colors.primary}
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.locateBtn}
        onPress={handleLocate}
        activeOpacity={0.7}
      >
        <Ionicons name="locate" size={22} color={colors.primary} />
      </TouchableOpacity>

      {__DEV__ && userLocation && (
        <View style={styles.debugPill}>
          <Text style={styles.debugText}>
            {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}
            {" · "}{nearby.length}站点{usingFallback ? " (mock)" : ""}
            {" · GP="}{env.hasGooglePlaces ? "✓" : "✗"}
            {" AI="}{env.hasAnthropic ? "✓" : "✗"}
          </Text>
        </View>
      )}

      {/* 底部：AI 评论 + 单张卡片（默认 AI 推荐；用户点 pin 后切成选中的那张） */}
      <View style={styles.bottomPanel} pointerEvents="box-none">
        {(ai?.reason || aiLoading) && (
          <View style={styles.aiBanner}>
            <Ionicons
              name={aiLoading ? "sparkles-outline" : "sparkles"}
              size={15}
              color={colors.primary}
              style={{ marginTop: 2 }}
            />
            <Text style={styles.aiBannerText} numberOfLines={3}>
              {aiLoading
                ? "AI 正在为你挑选最合适的站点…"
                : ai?.reason + (ai?.tip ? ` · ${ai.tip}` : "")}
            </Text>
          </View>
        )}

        {displayStation && renderStationCard(displayStation)}

        {/* 用户选了别的（非 AI 推荐）时，给一条"返回推荐"的小入口 */}
        {selectedStation && selectedStation !== winnerId && winnerId && (
          <TouchableOpacity
            style={styles.backToAi}
            onPress={() => setSelectedStation(null)}
            activeOpacity={0.8}
          >
            <Ionicons name="sparkles" size={13} color={colors.primary} />
            <Text style={styles.backToAiText}>回到 AI 推荐</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

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

  infoBanner: {
    position: "absolute",
    top: Platform.OS === "ios" ? 115 : 95,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(15,23,42,0.92)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    maxWidth: width - 40,
    zIndex: 45,
  },
  infoBannerText: {
    color: colors.textPrimary,
    fontSize: fontSize.xs,
    fontWeight: "600",
  },

  errorBanner: {
    position: "absolute",
    top: Platform.OS === "ios" ? 115 : 95,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(239,68,68,0.92)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    maxWidth: width - 40,
    zIndex: 45,
  },
  errorBannerText: {
    color: colors.textPrimary,
    fontSize: fontSize.xs,
    fontWeight: "600",
  },

  locateBtn: {
    position: "absolute",
    right: spacing.lg,
    bottom: 310,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(15,23,42,0.92)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  refreshBtn: {
    position: "absolute",
    right: spacing.lg,
    bottom: 362,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(15,23,42,0.92)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  sourcePill: {
    position: "absolute",
    top: Platform.OS === "ios" ? 115 : 95,
    right: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(15,23,42,0.85)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    zIndex: 50,
  },
  sourcePillText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "600",
  },
  googleErrorBanner: {
    position: "absolute",
    top: Platform.OS === "ios" ? 150 : 130,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(245,158,11,0.15)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.5)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
    zIndex: 45,
  },
  googleErrorText: {
    flex: 1,
    color: "#FDE68A",
    fontSize: 11,
    fontWeight: "500",
  },
  debugPill: {
    position: "absolute",
    top: Platform.OS === "ios" ? 115 : 95,
    left: spacing.lg,
    backgroundColor: "rgba(15,23,42,0.85)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    zIndex: 50,
  },
  debugText: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },

  // Safety 徽章
  safetyBadge: {
    alignItems: "center",
    justifyContent: "center",
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    marginLeft: 6,
    backgroundColor: "rgba(15,23,42,0.5)",
  },

  // 底部面板
  bottomPanel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 90, // 留给 tab bar
    paddingHorizontal: spacing.lg,
    gap: 8,
  },
  aiBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(15,23,42,0.95)",
    borderWidth: 1,
    borderColor: "rgba(14,165,233,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  aiBannerText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: "500",
    lineHeight: 19,
  },

  // 返回 AI 推荐的小入口
  backToAi: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    alignSelf: "center",
    backgroundColor: "rgba(14,165,233,0.18)",
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.full,
  },
  backToAiText: {
    color: colors.textPrimary,
    fontSize: fontSize.xs,
    fontWeight: "700",
  },

  // 卡片
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardSelected: {
    borderColor: colors.primary,
  },
  cardLabel: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    marginBottom: 8,
    backgroundColor: "rgba(15,23,42,0.5)",
  },
  cardLabelText: {
    fontSize: 10,
    fontWeight: "700",
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
