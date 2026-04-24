import { useEffect, useRef, useState } from "react";
import type { Station } from "../types";
import { rankStations, type RankedStation } from "../services/ranking";
import { aiRecommend, type AIContext, type AIRecommendation } from "../services/aiRecommend";

interface Options extends Omit<AIContext, "mode"> {
  userCoord: { latitude: number; longitude: number } | null;
  mode: "gas" | "ev";
  /** 是否调 AI 层（默认 true；无 key 时内部自动跳过） */
  useAI?: boolean;
}

export interface UseRankedStationsResult {
  ranked: RankedStation[];
  ai: AIRecommendation | null;
  aiLoading: boolean;
}

/**
 * 站点 → 打分排序 → AI 层加一层叠加解释。
 * ranking 纯函数每次都跑；AI 只在 stations 集合真正变化时跑一次，避免浪费 token。
 */
export function useRankedStations(
  stations: Station[],
  options: Options,
): UseRankedStationsResult {
  const { userCoord, mode, useAI = true, fuelPercent, rangeLeftMile, userQuery } =
    options;

  const ranked = rankStations(stations, {
    userCoord,
    preference: "balanced",
  });

  const [ai, setAi] = useState<AIRecommendation | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const lastSigRef = useRef<string>("");

  useEffect(() => {
    if (!useAI) {
      setAi(null);
      return;
    }
    // 基于候选集合 + 用户上下文做 signature，相同不重复请求
    const sig = JSON.stringify({
      ids: ranked.slice(0, 8).map((r) => r.station.id),
      fuelPercent,
      rangeLeftMile,
      userQuery,
      mode,
    });
    if (sig === lastSigRef.current) return;
    lastSigRef.current = sig;

    let cancelled = false;
    (async () => {
      setAiLoading(true);
      const result = await aiRecommend(ranked, {
        mode,
        fuelPercent,
        rangeLeftMile,
        userQuery,
      });
      if (!cancelled) {
        setAi(result);
        setAiLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    useAI,
    mode,
    fuelPercent,
    rangeLeftMile,
    userQuery,
    // 故意不把 ranked 放依赖里，用 signature 做实际判等
    ranked,
  ]);

  return { ranked, ai, aiLoading };
}
