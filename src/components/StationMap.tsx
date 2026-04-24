import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { StyleSheet, View, Text, Platform } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, radius, fontSize } from "../theme";
import {
  GasStation,
  EVStation,
  Station,
  isGasStation,
} from "../types";
import StationMapFallback from "./StationMapFallback";
import type {
  StationMapHandle,
  StationMapProps,
} from "./StationMap.types";

export type { StationMapHandle, StationMapProps };

type MapsModule = {
  default: React.ComponentType<any>;
  Marker: React.ComponentType<any>;
  PROVIDER_DEFAULT?: unknown;
  PROVIDER_GOOGLE?: unknown;
};

let Maps: MapsModule | null = null;
let mapsLoadError: string | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Maps = require("react-native-maps") as MapsModule;
} catch (e) {
  mapsLoadError =
    e instanceof Error ? e.message : "react-native-maps 加载失败";
  if (__DEV__) {
    console.warn(
      "[StationMap] react-native-maps 原生模块不可用，回退到占位地图：",
      mapsLoadError,
    );
  }
}

const SF_REGION = {
  latitude: 37.7775,
  longitude: -122.4183,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

const StationMap = forwardRef<StationMapHandle, StationMapProps>(
  function StationMap(props, ref) {
    if (!Maps) {
      return (
        <StationMapFallback
          {...props}
          ref={ref}
          bannerText={
            mapsLoadError
              ? `地图原生模块不可用，需重新构建原生端（${mapsLoadError.slice(0, 40)}）`
              : "地图原生模块不可用"
          }
        />
      );
    }
    return <NativeMap {...props} ref={ref} Maps={Maps} />;
  },
);

export default StationMap;

interface NativeMapProps extends StationMapProps {
  Maps: MapsModule;
}

const NativeMap = forwardRef<StationMapHandle, NativeMapProps>(
  function NativeMap(
    {
      stations,
      selectedId,
      onSelectStation,
      userLocation,
      defaultRegion,
      Maps,
    },
    ref,
  ) {
    const MapView = Maps.default;
    const PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
    const PROVIDER_DEFAULT = Maps.PROVIDER_DEFAULT;

    const mapRef = useRef<any>(null);

    useImperativeHandle(
      ref,
      () => ({
        animateToCoordinate: (coord, zoomDelta = 0.03) => {
          mapRef.current?.animateToRegion?.(
            {
              latitude: coord.latitude,
              longitude: coord.longitude,
              latitudeDelta: zoomDelta,
              longitudeDelta: zoomDelta,
            },
            250, // 短动画，快速连切时不被中断到 "好像没反应"
          );
        },
      }),
      [],
    );

    const hasCenteredRef = useRef(false);
    useEffect(() => {
      if (hasCenteredRef.current) return;
      if (!userLocation) return;
      mapRef.current?.animateToRegion?.(
        {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        },
        500,
      );
      hasCenteredRef.current = true;
    }, [userLocation]);

    const initialRegion = userLocation
      ? {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }
      : defaultRegion ?? SF_REGION;

    return (
      <View style={StyleSheet.absoluteFill}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={
            Platform.OS === "android" ? PROVIDER_GOOGLE : PROVIDER_DEFAULT
          }
          initialRegion={initialRegion}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
          toolbarEnabled={false}
        >
          {stations.map((s) => (
            <StationMarker
              key={s.id}
              station={s}
              isSelected={selectedId === s.id}
              onPress={onSelectStation}
              Marker={Maps.Marker}
            />
          ))}
        </MapView>
      </View>
    );
  },
);

/**
 * 独立 Marker 组件。关键设计：
 *   1) 容器尺寸**固定 60x60**，pin 的大小变化在容器内发生 —— 避免 iOS 重新计算 anchor 位置导致 pin 漂移
 *   2) anchor 中心 (0.5, 0.5) 而不是 bottom (0.5, 1)，选中态下视觉中心才在坐标上
 *   3) tracksViewChanges 只在选中状态切换后短时间开启（800ms），让 iOS 有机会重新快照 marker 图像，
 *      之后关闭避免持续重绘引发的 MapView 渲染 bug（偶发半屏黑屏就是这个原因）
 *   4) 尺寸差异小：34→38 px，4px 增量肉眼能看出但不会让 anchor 抖
 */
interface StationMarkerProps {
  station: Station;
  isSelected: boolean;
  onPress: (s: Station) => void;
  Marker: React.ComponentType<any>;
}

const StationMarker = React.memo(function StationMarker({
  station,
  isSelected,
  onPress,
  Marker,
}: StationMarkerProps) {
  // tracksViewChanges 常开。理由：
  //   - 之前用 800ms 短时开关有 race —— React commit 把新尺寸交给 native view 时，
  //     trackChanges 已经回到 false，iOS 就不重绘，pin 卡在老尺寸
  //   - 20 个 marker 的性能代价在 iOS 上几乎察觉不到
  //   - React.memo + 稳定 onPress 引用让每个 marker 只在自己的 isSelected
  //     切换时才触发 view 变化，不会导致全局抖动
  const isGas = isGasStation(station);
  const tint = isGas ? colors.gas : colors.ev;

  const priceLabel = isGas
    ? (station as GasStation).prices.regular != null
      ? `$${(station as GasStation).prices.regular!.toFixed(2)}`
      : "—"
    : (() => {
        const ev = station as EVStation;
        // 过滤掉 0 和非有限值 —— OCM 不提供价格时我们填 0，这种情况要显示 "—" 而不是 $0.00
        const prices = ev.chargers
          .map((c) => c.pricePerKwh)
          .filter((p) => Number.isFinite(p) && p > 0);
        if (prices.length === 0) return "—";
        return `$${Math.min(...prices).toFixed(2)}`;
      })();

  return (
    <Marker
      coordinate={{
        latitude: station.latitude,
        longitude: station.longitude,
      }}
      onPress={() => onPress(station)}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges
      zIndex={isSelected ? 1000 : 1}
    >
      <View style={styles.markerContainer}>
        {isSelected && (
          <View style={[styles.pinGlow, { backgroundColor: tint }]} />
        )}
        <View
          style={[
            styles.pin,
            {
              backgroundColor: tint,
              borderColor: isSelected ? "#fff" : "rgba(15,23,42,0.6)",
              borderWidth: isSelected ? 3 : 2,
              width: isSelected ? 38 : 32,
              height: isSelected ? 38 : 32,
              borderRadius: isSelected ? 19 : 16,
            },
          ]}
        >
          <MaterialCommunityIcons
            name={isGas ? "gas-station" : "ev-station"}
            size={isSelected ? 20 : 16}
            color="#fff"
          />
        </View>
        <View
          style={[
            styles.priceChip,
            isSelected && {
              backgroundColor: "#fff",
              paddingHorizontal: 8,
            },
          ]}
        >
          <Text
            style={[
              styles.priceChipText,
              isSelected && { color: tint, fontSize: 11 },
            ]}
            numberOfLines={1}
          >
            {priceLabel}
          </Text>
        </View>
      </View>
    </Marker>
  );
});

const styles = StyleSheet.create({
  markerContainer: {
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  pinGlow: {
    position: "absolute",
    width: 54,
    height: 54,
    borderRadius: 27,
    opacity: 0.28,
  },
  pin: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  priceChip: {
    position: "absolute",
    bottom: -2,
    backgroundColor: "rgba(15,23,42,0.9)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.sm,
    maxWidth: 70,
  },
  priceChipText: {
    color: colors.textPrimary,
    fontSize: fontSize.xs,
    fontWeight: "700",
  },
});
