import { Platform } from "react-native";
import type { GasStation } from "../types";
import { haversineKm } from "../utils/distance";
import { env } from "../config/env";

export type Coord = { latitude: number; longitude: number };

/**
 * Google Places API (New) 站点拉取。
 *
 * 文档：https://developers.google.com/maps/documentation/places/web-service/op-overview
 *   - POST https://places.googleapis.com/v1/places:searchNearby  → 附近搜索
 *   - GET  https://places.googleapis.com/v1/places/{id}           → 详情（带 fuelOptions）
 *
 * 价格字段在 Place Details 的 fuelOptions.fuelPrices[] 里：
 *   { type: "REGULAR" | "MIDGRADE" | "PREMIUM" | "DIESEL",
 *     price: { currencyCode, units, nanos },
 *     updateTime: ISO string }
 *
 * 计费须带 X-Goog-FieldMask，只请求用到的字段以省配额。
 */

/**
 * 构造 Google 所需的 app-identification header。
 * REST API 下 iOS bundle id / Android package 不会自动填，必须手动带 header，
 * 否则 key 的 "iOS apps / Android apps" 限制会把请求拒掉（API_KEY_*_APP_BLOCKED）。
 *
 * Expo Go 在 iOS 上的 bundle id 是 `host.exp.exponent`，
 * 你自己打 dev client 后要改成自己的 bundle id。
 */
function appIdHeaders(): Record<string, string> {
  if (Platform.OS === "ios") {
    return { "X-Ios-Bundle-Identifier": "host.exp.exponent" };
  }
  if (Platform.OS === "android") {
    return { "X-Android-Package": "host.exp.exponent" };
  }
  return {};
}

interface NearbyPlace {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  types?: string[];
  rating?: number;
}

interface FuelPrice {
  type?: "REGULAR_UNLEADED" | "MIDGRADE" | "PREMIUM" | "DIESEL" | string;
  price?: {
    currencyCode?: string;
    units?: string; // 整数部分，string 型（Google proto3 格式）
    nanos?: number; // 小数部分 × 10^9
  };
  updateTime?: string;
}

interface PlaceDetails {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  fuelOptions?: { fuelPrices?: FuelPrice[] };
}

/** 把 Google 的 { units: "4", nanos: 590000000 } 拼回 4.59 */
function parseFuelPrice(p: FuelPrice): number | null {
  const units = p.price?.units ? parseInt(p.price.units, 10) : 0;
  const nanos = p.price?.nanos ?? 0;
  if (!Number.isFinite(units) || !Number.isFinite(nanos)) return null;
  const value = units + nanos / 1_000_000_000;
  return value > 0 && Number.isFinite(value) ? value : null;
}

function mapPricesToGasPrices(
  fuelPrices: FuelPrice[] | undefined,
): GasStation["prices"] {
  const out: GasStation["prices"] = {};
  if (!fuelPrices) return out;
  for (const fp of fuelPrices) {
    const val = parseFuelPrice(fp);
    if (val == null) continue;
    switch (fp.type) {
      case "REGULAR_UNLEADED":
        out.regular = val;
        break;
      case "MIDGRADE":
        out.midgrade = val;
        break;
      case "PREMIUM":
        out.premium = val;
        break;
      case "DIESEL":
        out.diesel = val;
        break;
      // 其它类型（E85、LPG 等）暂不映射
    }
  }
  return out;
}

/** Known brand 推断（兼容 Google 返回的 name/displayName 字段） */
const KNOWN_BRANDS = [
  "7-Eleven", "Wawa", "Sheetz", "Circle K", "Speedway",
  "Chevron", "Shell", "BP", "Exxon", "Mobil", "ExxonMobil", "Texaco",
  "Valero", "Marathon", "Sunoco", "Citgo", "Phillips 66", "76",
  "Arco", "Costco", "Sam's Club", "Sinclair", "Conoco",
  "QuikTrip", "RaceTrac", "Pilot", "Flying J", "Love's",
  "Hess", "Murphy", "Meijer", "Safeway", "Kroger", "Walmart",
];

function inferBrand(name: string): string {
  const lower = name.toLowerCase();
  for (const b of KNOWN_BRANDS) {
    if (lower.includes(b.toLowerCase())) return b;
  }
  return name;
}

// ---- 对外接口 ----

export async function fetchGasStationsFromGoogle(
  coord: Coord,
  radiusM: number = 8000,
): Promise<GasStation[]> {
  const key = env.googlePlacesApiKey;
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY missing");

  // 1) Nearby Search：只要 id 省得第一步就烧详情费
  //    - includedTypes 里加 truck_stop：有些加油点（如 Wawa Fuel、Pilot）会被分成这类
  //    - rankPreference DISTANCE：默认 POPULARITY 会按热度排，把小站挤出 top 20；
  //      按距离排能覆盖真正"附近"的所有站点
  const searchBody = {
    includedTypes: ["gas_station", "truck_stop"],
    maxResultCount: 20,
    rankPreference: "DISTANCE",
    locationRestriction: {
      circle: {
        center: {
          latitude: coord.latitude,
          longitude: coord.longitude,
        },
        radius: Math.min(radiusM, 50000),
      },
    },
  };

  const searchRes = await fetch(
    "https://places.googleapis.com/v1/places:searchNearby",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.rating",
        ...appIdHeaders(),
      },
      body: JSON.stringify(searchBody),
    },
  );

  if (!searchRes.ok) {
    const txt = await searchRes.text();
    throw new Error(`Google Places searchNearby ${searchRes.status}: ${txt}`);
  }

  const searchJson = (await searchRes.json()) as { places?: NearbyPlace[] };
  const places = searchJson.places ?? [];
  if (places.length === 0) return [];

  // 2) 并行拉每家 details，带 fuelOptions 字段
  const detailResults = await Promise.allSettled(
    places.map((p) =>
      fetch(`https://places.googleapis.com/v1/places/${p.id}`, {
        headers: {
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask":
            "id,displayName,formattedAddress,location,rating,fuelOptions",
          ...appIdHeaders(),
        },
      }).then(async (res) => {
        if (!res.ok) throw new Error(`details ${res.status}`);
        return (await res.json()) as PlaceDetails;
      }),
    ),
  );

  const stations: GasStation[] = [];
  for (let i = 0; i < detailResults.length; i++) {
    const placeBase = places[i];
    const settled = detailResults[i];
    // detail 成功就用 detail（带价格）；失败就退回 search 那份
    const d: PlaceDetails =
      settled.status === "fulfilled" ? settled.value : (placeBase as PlaceDetails);

    const lat = d.location?.latitude ?? placeBase.location?.latitude;
    const lng = d.location?.longitude ?? placeBase.location?.longitude;
    if (lat == null || lng == null) continue;

    const name = d.displayName?.text ?? placeBase.displayName?.text ?? "Gas Station";
    const brand = inferBrand(name);
    const address =
      d.formattedAddress ?? placeBase.formattedAddress ?? "";
    const km = haversineKm(coord, { latitude: lat, longitude: lng });

    stations.push({
      id: `gp-${d.id}`,
      name,
      brand,
      address,
      latitude: lat,
      longitude: lng,
      distance: Math.round(km * 10) / 10,
      prices: mapPricesToGasPrices(d.fuelOptions?.fuelPrices),
      updatedAt: new Date().toISOString(),
      rating: d.rating ?? placeBase.rating ?? 0,
      isFavorite: false,
    });
  }

  stations.sort((a, b) => a.distance - b.distance);
  return stations;
}
