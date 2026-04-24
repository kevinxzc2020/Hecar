import { EVStation, GasStation, Station, isGasStation } from "../types";
import { haversineKm } from "../utils/distance";

export interface RankContext {
  /** 用户当前位置，用于距离成本 */
  userCoord: { latitude: number; longitude: number } | null;
  /** 每 km 开过去多花的钱估算（默认 $0.15/km 综合油耗） */
  fuelCostPerKm?: number;
  /** 假设一次加满 ~14 gallon (~53L)；用于把 $/gal 价差乘出真实省下来的钱 */
  fillGallons?: number;
  /** 偏好：省钱 > 距离 用 "price"；距离 > 价格 用 "distance"；平衡 "balanced" */
  preference?: "price" | "distance" | "balanced";
}

export interface RankedStation {
  station: Station;
  /** 距离 km（来自用户定位或站点自带 distance 字段） */
  km: number;
  /** 单价（gas 用 regular，EV 用最便宜 kWh） */
  unitPrice: number | null;
  /** 打分，越低越好 */
  score: number;
  /** 排名 1-based；undefined 表示无价格不参与排名 */
  rank?: number;
  /** 静态推荐原因（不靠 AI） */
  reason: string;
}

const DEFAULTS = {
  fuelCostPerKm: 0.15,
  fillGallons: 14,
};

/** 拿单价：gas 优先 regular，EV 优先所有 DC 桩中最便宜 */
function getUnitPrice(s: Station): number | null {
  if (isGasStation(s)) {
    const r = s.prices.regular;
    if (typeof r === "number" && Number.isFinite(r) && r > 0) return r;
    const p = s.prices.premium;
    if (typeof p === "number" && Number.isFinite(p) && p > 0) return p;
    return null;
  }
  const ev = s as EVStation;
  const prices = ev.chargers
    .map((c) => c.pricePerKwh)
    .filter((p) => Number.isFinite(p) && p > 0);
  if (prices.length === 0) return null;
  return Math.min(...prices);
}

function getKm(
  s: Station,
  userCoord: RankContext["userCoord"],
): number {
  if (userCoord) {
    return haversineKm(userCoord, {
      latitude: s.latitude,
      longitude: s.longitude,
    });
  }
  return s.distance; // fallback to mock-populated distance
}

/**
 * 给候选站点打分并排序。
 * 策略：score = unitPrice * fillGallons   // 加满费用
 *             + km * fuelCostPerKm * 2   // 来回开过去的油钱 × 2（往返）
 * 分数越低越好。没价格的站点不排名。
 */
export function rankStations(
  stations: Station[],
  context: RankContext,
): RankedStation[] {
  const {
    userCoord,
    fuelCostPerKm = DEFAULTS.fuelCostPerKm,
    fillGallons = DEFAULTS.fillGallons,
    preference = "balanced",
  } = context;

  // 偏好影响权重
  const priceWeight =
    preference === "price" ? 1.5 : preference === "distance" ? 0.5 : 1.0;
  const distWeight =
    preference === "distance" ? 2.0 : preference === "price" ? 0.5 : 1.0;

  const priced: RankedStation[] = [];
  const unpriced: RankedStation[] = [];

  for (const s of stations) {
    const km = getKm(s, userCoord);
    const unitPrice = getUnitPrice(s);
    let score: number;
    let reason: string;

    if (unitPrice == null) {
      // 没价格，按距离排
      score = km * fuelCostPerKm * 2 * distWeight + 999; // 罚分确保沉底
      reason = `${km.toFixed(1)} km · 无价格数据`;
      unpriced.push({ station: s, km, unitPrice, score, reason });
      continue;
    }

    const fillCost = unitPrice * fillGallons * priceWeight;
    const driveCost = km * fuelCostPerKm * 2 * distWeight;
    score = fillCost + driveCost;
    reason = `${km.toFixed(1)} km · $${unitPrice.toFixed(2)}${
      isGasStation(s) ? "/gal" : "/kWh"
    }`;
    priced.push({ station: s, km, unitPrice, score, reason });
  }

  priced.sort((a, b) => a.score - b.score);
  unpriced.sort((a, b) => a.km - b.km);

  // 带价格的上榜，无价格的跟在后面
  priced.forEach((r, i) => (r.rank = i + 1));
  // 给前三名换更明确的原因词
  if (priced[0]) {
    const best = priced[0];
    const nextScore = priced[1]?.score;
    const diff = nextScore ? nextScore - best.score : 0;
    const savings = diff > 0 ? diff : 0;
    best.reason =
      savings > 0.3
        ? `综合最省，比第二名省约 $${savings.toFixed(2)}/次`
        : `综合最优：${best.km.toFixed(1)} km · $${best.unitPrice!.toFixed(2)}`;
  }
  if (priced[1]) {
    priced[1].reason = `性价比次优 · ${priced[1].km.toFixed(
      1,
    )} km · $${priced[1].unitPrice!.toFixed(2)}`;
  }
  if (priced[2]) {
    priced[2].reason = `备选 · ${priced[2].km.toFixed(
      1,
    )} km · $${priced[2].unitPrice!.toFixed(2)}`;
  }

  return [...priced, ...unpriced];
}
