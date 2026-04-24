import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";

export type Coord = { latitude: number; longitude: number };

export interface UseUserLocationOptions {
  /**
   * 订阅模式：挂载后持续接收位置更新，卸载时自动清理。
   * false 或不传：只在挂载时取一次；通过 refresh() 手动再取。
   */
  watch?: boolean;
  /** 订阅模式下，位移多少米触发一次更新。默认 10 */
  distanceInterval?: number;
  /** 订阅模式下，最短间隔多少毫秒触发一次更新。默认 5000 */
  timeInterval?: number;
  /** 精度档位，默认 Balanced（城市级，省电） */
  accuracy?: Location.LocationAccuracy;
}

export interface UseUserLocationResult {
  /** 当前经纬度；未授权或获取失败时为 null */
  coord: Coord | null;
  /** 用户可读的错误信息；未出错时为 null */
  error: string | null;
  /** 主动重新请求一次定位，返回最新 coord（失败返回 null） */
  refresh: () => Promise<Coord | null>;
}

/**
 * 前台定位 hook。
 * - 默认行为：挂载时取一次位置；通过 refresh() 手动再取。
 * - watch=true 时：额外订阅位置流，人在走地图上的位置会同步更新。
 *   订阅有电量代价，只在真正需要实时的屏幕上开启。
 */
export function useUserLocation(
  options: UseUserLocationOptions = {},
): UseUserLocationResult {
  const {
    watch = false,
    distanceInterval = 10,
    timeInterval = 5000,
    accuracy = Location.Accuracy.Balanced,
  } = options;

  const [coord, setCoord] = useState<Coord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const ensurePermission = useCallback(async (): Promise<boolean> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      if (mountedRef.current) setError("未授权定位");
      return false;
    }
    return true;
  }, []);

  const fetchOnce = useCallback(async (): Promise<Coord | null> => {
    try {
      if (!(await ensurePermission())) return null;
      const pos = await Location.getCurrentPositionAsync({ accuracy });
      const next: Coord = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      if (mountedRef.current) {
        setCoord(next);
        setError(null);
      }
      return next;
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : "获取位置失败");
      }
      return null;
    }
  }, [accuracy, ensurePermission]);

  useEffect(() => {
    mountedRef.current = true;
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      if (!watch) {
        // one-shot 模式
        await fetchOnce();
        return;
      }
      // watch 模式：先尝试拿权限，同时做一次即时取样，然后开订阅流
      if (!(await ensurePermission())) return;
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy });
        if (mountedRef.current) {
          setCoord({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          setError(null);
        }
      } catch {
        // 首取样失败不致命，订阅流会补上
      }

      try {
        subscription = await Location.watchPositionAsync(
          { accuracy, distanceInterval, timeInterval },
          (pos) => {
            if (!mountedRef.current) return;
            setCoord({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            });
          },
        );
      } catch (e) {
        if (mountedRef.current) {
          setError(
            e instanceof Error ? e.message : "订阅位置流失败",
          );
        }
      }
    })();

    return () => {
      mountedRef.current = false;
      subscription?.remove();
    };
  }, [watch, distanceInterval, timeInterval, accuracy, fetchOnce, ensurePermission]);

  return { coord, error, refresh: fetchOnce };
}
