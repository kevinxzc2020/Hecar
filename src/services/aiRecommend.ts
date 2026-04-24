import { env } from "../config/env";
import type { RankedStation } from "./ranking";
import { isGasStation } from "../types";

export interface AIContext {
  /** 油量 / 电量百分比 0-100 */
  fuelPercent?: number;
  /** 剩余行驶里程 mile */
  rangeLeftMile?: number;
  /** 用户自然语言输入 */
  userQuery?: string;
  /** gas 还是 ev */
  mode: "gas" | "ev";
}

export interface AIRecommendation {
  /** 推荐赢家 id；undefined 表示 AI 没能决定，用 rank 兜底 */
  winnerId?: string;
  /** 给用户看的一句话解释（中文） */
  reason: string;
  /** 后续建议：加满 / 加半箱 / 就近应急 等 */
  tip?: string;
}

/**
 * 调 Claude Haiku 拿推荐。
 * 无 key 时返回 null，上层用 ranking 的静态原因兜底。
 *
 * ⚠️ 目前 key 在客户端里；生产应该走后端代理。
 */
export async function aiRecommend(
  ranked: RankedStation[],
  context: AIContext,
): Promise<AIRecommendation | null> {
  if (!env.hasAnthropic) return null;
  if (ranked.length === 0) return null;

  // 取前 8 名喂给 Claude 决策，多了浪费 token
  const candidates = ranked.slice(0, 8).map((r) => {
    const s = r.station;
    return {
      id: s.id,
      name: s.name,
      brand: isGasStation(s) ? s.brand : (s as any).network,
      km: Number(r.km.toFixed(2)),
      unitPrice: r.unitPrice,
      rating: s.rating,
      rank: r.rank,
    };
  });

  const sys =
    "你是一个帮司机选加油站/充电桩的助手。用户会给你当前油量/电量和备选站点（已按综合性价比初排）。" +
    "从候选里选一个最合适的，用一句简洁中文（20-35 字）说明为什么。" +
    "重点：如果油量很低（<15% 或剩余里程 < 20 mile）务必优先最近，不要为省几毛绕路。" +
    "如果油量充足则偏向价格更低的。必要时给一句提示（tip 字段，10-20 字）。" +
    '严格输出 JSON：{"winnerId":"...","reason":"...","tip":"..."}';

  const user = JSON.stringify({
    mode: context.mode,
    fuelPercent: context.fuelPercent,
    rangeLeftMile: context.rangeLeftMile,
    query: context.userQuery,
    candidates,
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
        max_tokens: 200,
        system: sys,
        messages: [{ role: "user", content: user }],
      }),
    });

    if (!res.ok) {
      if (__DEV__) {
        const txt = await res.text();
        console.warn("[aiRecommend] Anthropic", res.status, txt);
      }
      return null;
    }

    const json = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text =
      json.content?.find((c) => c.type === "text")?.text?.trim() ?? "";

    // Claude 返回的 JSON 可能被 ```json 包住，先清洗
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    let parsed: AIRecommendation;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Claude 不守格式时当它没推荐
      return null;
    }
    if (!parsed.reason) return null;
    return parsed;
  } catch (e) {
    if (__DEV__) console.warn("[aiRecommend] network error", e);
    return null;
  }
}
