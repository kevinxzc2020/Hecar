import { useCallback, useEffect, useRef, useState } from "react";
import type { Coord } from "../services/stationsApi";
import {
  fetchEVStations,
  fetchGasStations,
  getLastGasMeta,
} from "../services/stationsApi";
import type { EVStation, FuelMode, GasStation, Station } from "../types";

export interface GasFetchInfo {
  source: "google" | "osm";
  googleError?: string;
}

export interface UseNearbyStationsState<T extends Station = Station> {
  stations: T[];
  loading: boolean;
  error: string | null;
  /** gas 模式下，上次 fetch 实际用了哪个源 */
  gasInfo: GasFetchInfo | null;
  /** 刷新，绕过缓存强拉一次 */
  refresh: () => Promise<void>;
}

interface Options {
  /** 半径 km，不传走服务层默认值 */
  radiusKm?: number;
  /** 暂停拉取（比如 tab 不在视口） */
  enabled?: boolean;
}

/**
 * 根据用户位置和 fuelMode 拉附近站点。
 * coord 为 null 时不拉取（返回空 + loading=false），UI 应降级到其它来源。
 */
export function useNearbyStations(
  coord: Coord | null,
  mode: FuelMode,
  options: Options = {},
): UseNearbyStationsState {
  const { radiusKm, enabled = true } = options;

  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gasInfo, setGasInfo] = useState<GasFetchInfo | null>(null);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  // 把 coord 分桶到小数点后 2 位（~1km）—— watch 模式下 coord 每 5s/10m 抖一次，
  // 但 1km 内不应该触发重新拉取（cache key 本来就按这个粒度分桶）。
  // 这里把真正会触发 run 重建的 "桶坐标" 固定下来。
  const bucketLat = coord ? Math.round(coord.latitude * 100) / 100 : null;
  const bucketLng = coord ? Math.round(coord.longitude * 100) / 100 : null;

  const run = useCallback(
    async (force: boolean) => {
      if (!coord) {
        // 没位置不拉
        setStations([]);
        setLoading(false);
        return;
      }
      const myReqId = ++requestIdRef.current;
      setLoading(true);
      setError(null);
      try {
        const result: Station[] =
          mode === "gas"
            ? ((await fetchGasStations(coord, { radiusKm, force })) as GasStation[])
            : ((await fetchEVStations(coord, { radiusKm, force })) as EVStation[]);

        // 并发时只接受最新那次请求的结果
        if (!mountedRef.current || myReqId !== requestIdRef.current) return;
        // 内容相同就不换 ref —— 缓存命中时常见，避免下游 useMemo/useEffect 连带重跑
        setStations((prev) => {
          if (
            prev.length === result.length &&
            prev.every((s, i) => s.id === result[i].id)
          ) {
            return prev;
          }
          return result;
        });
        if (mode === "gas") {
          const meta = getLastGasMeta();
          if (meta) {
            setGasInfo({
              source: meta.source,
              googleError: meta.googleError,
            });
          }
        } else {
          setGasInfo(null);
        }
      } catch (e) {
        if (!mountedRef.current || myReqId !== requestIdRef.current) return;
        setError(e instanceof Error ? e.message : "拉取站点失败");
      } finally {
        if (mountedRef.current && myReqId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    // 用桶坐标做依赖 —— coord 每几秒抖一次但桶坐标稳定，除非用户真的挪了 ~1km
    // 还要保留 coord 引用一起做依赖，否则首次定位拿到时（null → 非 null）不会触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bucketLat, bucketLng, mode, radiusKm],
  );

  useEffect(() => {
    mountedRef.current = true;
    if (enabled) void run(false);
    return () => {
      mountedRef.current = false;
    };
  }, [run, enabled]);

  const refresh = useCallback(() => run(true), [run]);

  return { stations, loading, error, gasInfo, refresh };
}
