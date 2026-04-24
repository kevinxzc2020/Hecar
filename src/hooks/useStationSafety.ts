import { useEffect, useRef, useState } from "react";
import type { Station } from "../types";
import {
  assessStationSafety,
  type SafetyInfo,
} from "../services/safetyApi";

/**
 * 对一组站点批量评估安全等级。
 * - 串行跑避免并发撞 Anthropic / 浪费 token
 * - 用 ref 跟踪已评估的 id，避免 rerender 时重复打分
 * - 同一 id 只在首次加载时算一次；缓存命中时是瞬时的
 */
export function useStationSafety(
  stations: Station[],
): Record<string, SafetyInfo | undefined> {
  const [map, setMap] = useState<Record<string, SafetyInfo | undefined>>({});
  const inFlightRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // 找没评估过也不在跑的 id
    const todo = stations.filter(
      (s) => !(s.id in map) && !inFlightRef.current.has(s.id),
    );
    if (todo.length === 0) return;

    // 串行处理，避免一次性打爆 Claude
    (async () => {
      for (const s of todo) {
        if (!mountedRef.current) return;
        inFlightRef.current.add(s.id);
        try {
          const info = await assessStationSafety(s);
          if (!mountedRef.current) return;
          setMap((prev) => ({ ...prev, [s.id]: info }));
        } catch {
          // 单个失败不影响其它
          if (mountedRef.current) {
            setMap((prev) => ({ ...prev, [s.id]: undefined }));
          }
        } finally {
          inFlightRef.current.delete(s.id);
        }
      }
    })();
  }, [stations, map]);

  return map;
}
