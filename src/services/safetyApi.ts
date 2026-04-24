import AsyncStorage from "@react-native-async-storage/async-storage";
import { env } from "../config/env";
import {
  FBI_STATE_VIOLENT_CRIME_2022,
  classifyViolent,
} from "../data/fbiStateCrimeRates";
import type { Station } from "../types";

export type SafetyLevel = "low" | "moderate" | "high" | "unknown";

export interface SafetyInfo {
  level: SafetyLevel;
  /** 给用户看的一句中文说明 */
  reason: string;
  /** 0-100，越低越安全。unknown 时为 null */
  score: number | null;
  /** 数据来源透明度 */
  source: "fbi+ai" | "fbi" | "ai" | "unknown";
}

const CACHE_KEY_PREFIX = "@hecar/safety/v1/";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 天

// ---- 州代码提取 ----

const US_STATE_CODES = new Set(Object.keys(FBI_STATE_VIOLENT_CRIME_2022));

/**
 * 从 Google Places 返回的地址里提取美国州码。
 * 典型格式："1501 Market St, San Francisco, CA 94102, USA"
 * 没法提取（非美国）时返回 null。
 */
export function parseStateFromAddress(address: string): string | null {
  if (!address) return null;
  // 优先匹配 " XX " 或 " XX," 或 " XX " 紧跟邮编
  const match = address.match(/,\s*([A-Z]{2})\s+\d{5}|\b([A-Z]{2}),\s*USA/);
  const code = match?.[1] ?? match?.[2];
  if (code && US_STATE_CODES.has(code)) return code;
  return null;
}

// ---- 缓存 ----

interface CacheEntry {
  ts: number;
  info: SafetyInfo;
}

async function readCache(key: string): Promise<SafetyInfo | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY_PREFIX + key);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.ts > CACHE_TTL_MS) return null;
    return entry.info;
  } catch {
    return null;
  }
}

async function writeCache(key: string, info: SafetyInfo): Promise<void> {
  try {
    await AsyncStorage.setItem(
      CACHE_KEY_PREFIX + key,
      JSON.stringify({ ts: Date.now(), info }),
    );
  } catch {
    // ignore
  }
}

// ---- A 路：基于 FBI 州级数据的基础评估 ----

function fbiBaseInfo(state: string, rate: number): SafetyInfo {
  const level = classifyViolent(rate);
  const national = 380; // 2022 全美均值
  const delta = Math.round(rate - national);
  const vs =
    delta > 50
      ? `高于全美均值 ${delta}`
      : delta < -50
      ? `低于全美均值 ${-delta}`
      : "接近全美均值";
  return {
    level,
    reason: `${state} 州暴力犯罪率 ${rate.toFixed(0)}/10万，${vs}（2022 FBI 数据）`,
    score: Math.min(100, Math.round((rate / 1000) * 100)),
    source: "fbi",
  };
}

// ---- B 路：Claude 层叠细化 ----

async function claudeRefine(
  station: Station,
  base: SafetyInfo,
  state: string,
  rate: number,
): Promise<SafetyInfo | null> {
  if (!env.hasAnthropic) return null;
  const sys =
    "你是帮司机判断加油站附近安全程度的助手。基于州级犯罪率和站点信息，" +
    "给出简短的中文说明（25-40 字），判断等级在 low/moderate/high 之间选一。" +
    "可以在州基础上根据品牌（Costco/大型连锁通常安全，小品牌 24h 站夜间一般）" +
    "和地址里的路名线索微调，但不能超出 ±1 档。" +
    '严格输出 JSON：{"level":"low|moderate|high","reason":"..."}';
  const user = JSON.stringify({
    state,
    stateViolentCrimePer100k: rate,
    stationName: station.name,
    brand: "brand" in station ? station.brand : undefined,
    address: station.address,
    rating: station.rating,
    baseLevel: base.level,
  });

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.anthropicApiKey as string,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 150,
        system: sys,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text =
      json.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
    const parsed = JSON.parse(cleaned) as {
      level?: SafetyLevel;
      reason?: string;
    };
    if (!parsed.level || !parsed.reason) return null;
    // 限制 Claude 只能在 base 的 ±1 档内调整
    const order: SafetyLevel[] = ["low", "moderate", "high"];
    const baseIdx = order.indexOf(base.level);
    const newIdx = order.indexOf(parsed.level);
    const clampedIdx =
      newIdx >= 0 && Math.abs(newIdx - baseIdx) <= 1 ? newIdx : baseIdx;
    return {
      level: order[clampedIdx] as SafetyLevel,
      reason: parsed.reason,
      score: base.score,
      source: "fbi+ai",
    };
  } catch {
    return null;
  }
}

// ---- 对外入口 ----

export async function assessStationSafety(
  station: Station,
): Promise<SafetyInfo> {
  const cached = await readCache(station.id);
  if (cached) return cached;

  const state = parseStateFromAddress(station.address);
  if (!state) {
    const info: SafetyInfo = {
      level: "unknown",
      reason: "仅支持美国境内站点",
      score: null,
      source: "unknown",
    };
    // 不缓存 unknown，地址更新后可重试
    return info;
  }

  const rate = FBI_STATE_VIOLENT_CRIME_2022[state];
  const base = fbiBaseInfo(state, rate);
  const refined = await claudeRefine(station, base, state, rate);
  const result = refined ?? base;
  await writeCache(station.id, result);
  return result;
}
