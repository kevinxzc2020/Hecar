import React, { forwardRef, useImperativeHandle, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, radius, fontSize } from "../theme";
import { GasStation, EVStation, isGasStation } from "../types";
import type { StationMapHandle, StationMapProps } from "./StationMap.types";

const { width, height } = Dimensions.get("window");

/**
 * 通用地图占位组件。
 * 在两种场景下使用：
 *   1) Web 平台 —— react-native-maps 没有 web 实现
 *   2) 原生平台上 react-native-maps 原生模块缺失时（dev client 未 rebuild、Expo Go 版本不匹配等）
 *
 * 接口与原生 StationMap 同构：props/ref 类型完全一致，调用方无需关心具体实现。
 */
const StationMapFallback = forwardRef<StationMapHandle, StationMapProps>(
  function StationMapFallback(
    { stations, selectedId, onSelectStation, bannerText },
    ref,
  ) {
    useImperativeHandle(
      ref,
      () => ({
        // 没有真实地图 region 概念，动画为 no-op
        animateToCoordinate: () => {},
      }),
      [],
    );

    const pinLayouts = useMemo(
      () =>
        stations.map((s, i) => {
          const row = Math.floor(i / 3);
          const col = i % 3;
          const top = 120 + row * 140 + (col % 2) * 40;
          const left = 30 + col * ((width - 80) / 3) + (row % 2) * 20;
          return { station: s, top, left };
        }),
      [stations],
    );

    return (
      <View style={styles.mockMap}>
        {[0.2, 0.35, 0.5, 0.65, 0.8].map((ratio, i) => (
          <View
            key={`h-${i}`}
            style={[
              styles.gridLine,
              { top: height * ratio, left: 0, right: 0, height: 1 },
            ]}
          />
        ))}
        {[0.15, 0.35, 0.55, 0.75, 0.9].map((ratio, i) => (
          <View
            key={`v-${i}`}
            style={[
              styles.gridLine,
              { left: width * ratio, top: 0, bottom: 0, width: 1 },
            ]}
          />
        ))}

        {pinLayouts.map(({ station, top, left }) => {
          const isSelected = selectedId === station.id;
          const isGas = isGasStation(station);
          const tint = isGas ? colors.gas : colors.ev;
          const priceLabel = isGas
            ? (station as GasStation).prices.regular != null
              ? `$${(station as GasStation).prices.regular!.toFixed(2)}`
              : "—"
            : (() => {
                const ev = station as EVStation;
                const prices = ev.chargers
                  .map((c) => c.pricePerKwh)
                  .filter((p) => Number.isFinite(p) && p > 0);
                if (prices.length === 0) return "—";
                return `$${Math.min(...prices).toFixed(2)}`;
              })();

          return (
            <TouchableOpacity
              key={station.id}
              style={[styles.pin, { top, left }]}
              onPress={() => onSelectStation(station)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.marker,
                  {
                    backgroundColor: tint,
                    borderColor: isSelected ? "#fff" : "transparent",
                    borderWidth: isSelected ? 3 : 2,
                    transform: [{ scale: isSelected ? 1.4 : 1 }],
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={isGas ? "gas-station" : "ev-station"}
                  size={18}
                  color="#fff"
                />
              </View>
              <Text style={styles.pinLabel} numberOfLines={1}>
                {priceLabel}
              </Text>
            </TouchableOpacity>
          );
        })}

        <View style={styles.userDot}>
          <View style={styles.userDotInner} />
          <View style={styles.userDotPulse} />
        </View>

        <View style={styles.banner}>
          <Ionicons name="map-outline" size={14} color={colors.textMuted} />
          <Text style={styles.bannerText}>
            {bannerText ??
              "真实地图仅在 iOS / Android 上渲染（需原生构建）"}
          </Text>
        </View>
      </View>
    );
  },
);

export default StationMapFallback;

const styles = StyleSheet.create({
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
  marker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
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
  banner: {
    position: "absolute",
    top: 90,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(15,23,42,0.85)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    maxWidth: width - 40,
  },
  bannerText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },
});
