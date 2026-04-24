import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Charger,
  ChargerType,
  EVStation,
  GasStation,
  Station,
} from "../types";
import { haversineKm } from "../utils/distance";
import { env } from "../config/env";
import { fetchGasStationsFromGoogle } from "./googlePlacesApi";

export type Coord = { latitude: number; longitude: number };

/** 缓存 TTL 30 分钟；久了价格/状态都不可信 */
const CACHE_TTL_MS = 30 * 60 * 1000;

/** 内存缓存：按 id 查站（给 station-detail 用） */
const stationById = new Map<string, Station>();

export function getStationById(id: string): Station | null {
  return stationById.get(id) ?? null;
}

function indexStations(stations: Station[]) {
  for (const s of stations) stationById.set(s.id, s);
}

// ---- 缓存 ----

interface CacheEntry<T> {
  ts: number;
  data: T;
}

/** 粗粒度位置桶，~1km；用户走几百米不会重新请求 */
function cacheKey(prefix: string, coord: Coord): string {
  const lat = coord.latitude.toFixed(2);
  const lng = coord.longitude.toFixed(2);
  return `@hecar/stations/${prefix}/${lat},${lng}`;
}

async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.ts > CACHE_TTL_MS) return null;
    return entry.data;
  } catch {
    return null;
  }
}

async function writeCache<T>(key: string, data: T): Promise<void> {
  try {
    const entry: CacheEntry<T> = { ts: Date.now(), data };
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // ignore
  }
}

// ---- 上次 fetch 的元信息（UI 用于显示真实数据源和错误） ----

export type GasSource = "google" | "osm";

interface GasFetchMeta {
  source: GasSource;
  googleError?: string;
  stationCount: number;
  at: number;
}

let lastGasMeta: GasFetchMeta | null = null;
export function getLastGasMeta(): GasFetchMeta | null {
  return lastGasMeta;
}

// ---- Gas stations: OpenStreetMap Overpass API ----

/**
 * 从 OSM Overpass API 拉附近 `amenity=fuel` 节点。
 * 免费，无 key，但节点数据质量参差：品牌信息可能缺、价格基本没有。
 */
/** 从 OSM name 字段兜底识别常见品牌 */
const KNOWN_BRANDS = [
  "7-Eleven", "7 Eleven", "Wawa", "Sheetz", "Circle K", "Speedway",
  "Chevron", "Shell", "BP", "Exxon", "Mobil", "ExxonMobil", "Texaco",
  "Valero", "Marathon", "Sunoco", "Citgo", "Phillips 66", "76",
  "Arco", "Costco", "Sam's Club", "Sinclair", "Conoco", "Kwik Trip",
  "QuikTrip", "RaceTrac", "Pilot", "Flying J", "Love's", "Cumberland Farms",
  "Hess", "Murphy", "Meijer", "Safeway", "Kroger", "Walmart",
  "Shell Select", "Petro-Canada", "Esso",
];

function inferBrand(tags: Record<string, string>): string {
  // 优先显式 brand 字段
  for (const key of ["brand", "brand:en", "operator", "operator:en"]) {
    const v = tags[key];
    if (v && v.trim()) return v.trim();
  }
  // 从 name 里找已知品牌
  const name = tags.name ?? tags["name:en"];
  if (name) {
    const lower = name.toLowerCase();
    for (const b of KNOWN_BRANDS) {
      if (lower.includes(b.toLowerCase())) return b;
    }
    return name.trim();
  }
  return "Unknown";
}

interface OSMElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  /** Overpass `out center` 返回的几何中心（way / relation 用） */
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

async function fetchGasStationsFromOSM(
  coord: Coord,
  radiusM: number,
): Promise<GasStation[]> {
  // 同时抓 node + way + relation；way/relation 用 out center 返回中心点
  const q = `[out:json][timeout:20];(node(around:${radiusM},${coord.latitude},${coord.longitude})[amenity=fuel];way(around:${radiusM},${coord.latitude},${coord.longitude})[amenity=fuel];relation(around:${radiusM},${coord.latitude},${coord.longitude})[amenity=fuel];);out center;`;
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Overpass API ${res.status}`);
  const json = (await res.json()) as { elements?: OSMElement[] };

  const stations: GasStation[] = (json.elements ?? [])
    .map((el): GasStation | null => {
      const tags = el.tags ?? {};
      // node 直接用 lat/lon；way / relation 用 center
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (lat == null || lon == null) return null;

      const brand = inferBrand(tags);
      const name = tags.name ?? tags["name:en"] ?? brand;
      const addrParts = [
        tags["addr:housenumber"],
        tags["addr:street"],
        tags["addr:city"],
      ].filter(Boolean);
      const address = addrParts.length > 0 ? addrParts.join(" ") : "";
      const km = haversineKm(coord, { latitude: lat, longitude: lon });

      return {
        id: `osm-gas-${el.type}-${el.id}`,
        name,
        brand,
        address,
        latitude: lat,
        longitude: lon,
        distance: Math.round(km * 10) / 10,
        prices: {}, // OSM 基本没有价格
        updatedAt: new Date().toISOString(),
        rating: 0,
        isFavorite: false,
      };
    })
    .filter((s): s is GasStation => s !== null);

  stations.sort((a, b) => a.distance - b.distance);
  return stations.slice(0, 50);
}

// ---- EV stations: Open Charge Map ----

interface OCMConnection {
  ConnectionTypeID?: number;
  LevelID?: number;
  CurrentTypeID?: number;
  PowerKW?: number;
  Quantity?: number;
}

interface OCMPoi {
  ID?: number;
  UUID?: string;
  OperatorInfo?: { Title?: string };
  AddressInfo?: {
    Title?: string;
    AddressLine1?: string;
    Town?: string;
    Latitude?: number;
    Longitude?: number;
  };
  Connections?: OCMConnection[];
  UsageCost?: string;
}

/**
 * Open Charge Map API 免费公开，建议带 User-Agent。
 * 没有 API key 低配额下能用，上线建议申请 key。
 */
async function fetchEVStationsFromOCM(
  coord: Coord,
  radiusKm: number,
): Promise<EVStation[]> {
  const params = new URLSearchParams({
    output: "json",
    latitude: String(coord.latitude),
    longitude: String(coord.longitude),
    distance: String(radiusKm),
    distanceunit: "KM",
    maxresults: "50",
    compact: "true",
    verbose: "false",
  });
  const url = `https://api.openchargemap.io/v3/poi/?${params.toString()}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Hecar/1.0" },
  });
  if (!res.ok) throw new Error(`Open Charge Map ${res.status}`);
  const pois = (await res.json()) as OCMPoi[];

  const stations: EVStation[] = pois
    .filter(
      (p): p is OCMPoi & {
        AddressInfo: { Latitude: number; Longitude: number };
      } =>
        !!p.AddressInfo &&
        typeof p.AddressInfo.Latitude === "number" &&
        typeof p.AddressInfo.Longitude === "number",
    )
    .map((p) => {
      const network = p.OperatorInfo?.Title ?? "Unknown";
      const name = p.AddressInfo.Title ?? network;
      const addrBits = [
        p.AddressInfo.AddressLine1,
        p.AddressInfo.Town,
      ].filter(Boolean);
      const address = addrBits.join(", ");
      const chargers: Charger[] = (p.Connections ?? []).map((c, i) => {
        // LevelID 3 = DC Fast; CurrentTypeID 30 = DC；其它都按 AC 算
        const isDC = c.LevelID === 3 || c.CurrentTypeID === 30;
        const type: ChargerType = isDC ? "DC" : "AC";
        return {
          id: `${p.UUID ?? p.ID}-${i}`,
          type,
          power: c.PowerKW ?? 0,
          status: "available", // OCM 不提供实时状态，统一标为空闲
          pricePerKwh: 0, // 价格也没有
        };
      });
      const lat = p.AddressInfo.Latitude;
      const lng = p.AddressInfo.Longitude;
      const km = haversineKm(coord, { latitude: lat, longitude: lng });

      return {
        id: `ocm-ev-${p.ID ?? p.UUID ?? Math.random()}`,
        name,
        network,
        address,
        latitude: lat,
        longitude: lng,
        distance: Math.round(km * 10) / 10,
        chargers,
        rating: 0,
        isFavorite: false,
      };
    });

  stations.sort((a, b) => a.distance - b.distance);
  return stations;
}

// ---- 统一入口 ----

export interface FetchOptions {
  /** 半径：gas 默认 5km，EV 默认 10km */
  radiusKm?: number;
  /** 强制绕过缓存 */
  force?: boolean;
}

export async function fetchGasStations(
  coord: Coord,
  options: FetchOptions = {},
): Promise<GasStation[]> {
  const radiusKm = options.radiusKm ?? 8;
  // cache key 带候选数据源前缀，防止不同源的结果互相污染
  const candidateSource = env.hasGooglePlaces ? "google" : "osm";
  const key = cacheKey(`gas-${candidateSource}-r${radiusKm}`, coord);

  if (!options.force) {
    const cached = await readCache<GasStation[]>(key);
    if (cached) {
      indexStations(cached);
      // 缓存命中时也要回写 meta，否则 UI 不知道这批数据来自哪个源（默认 fallback 到 OSM）
      // candidateSource 就是当初写入这份缓存时用的 key 前缀
      lastGasMeta = {
        source: candidateSource as GasSource,
        stationCount: cached.length,
        at: Date.now(),
      };
      return cached;
    }
  }

  let stations: GasStation[] = [];
  let source: GasSource = "osm";
  let googleError: string | undefined;

  // 1) 优先 Google Places (New)：有实时价格
  if (env.hasGooglePlaces) {
    try {
      stations = await fetchGasStationsFromGoogle(coord, radiusKm * 1000);
      if (stations.length > 0) {
        source = "google";
      } else {
        googleError = "Google 返回 0 站点（可能区域无覆盖）";
      }
    } catch (e) {
      googleError = e instanceof Error ? e.message : String(e);
      if (__DEV__) {
        console.warn("[stationsApi] Google Places 失败，回退 OSM:", e);
      }
    }
  }

  // 2) 没 key 或 Google 失败 / 空 → OSM
  if (stations.length === 0) {
    stations = await fetchGasStationsFromOSM(coord, radiusKm * 1000);
    if (stations.length < 5 && radiusKm < 15) {
      const expanded = await fetchGasStationsFromOSM(coord, 15000);
      if (expanded.length > stations.length) stations = expanded;
    }
    source = "osm";
  }

  lastGasMeta = {
    source,
    googleError,
    stationCount: stations.length,
    at: Date.now(),
  };

  indexStations(stations);
  await writeCache(key, stations);
  return stations;
}

export async function fetchEVStations(
  coord: Coord,
  options: FetchOptions = {},
): Promise<EVStation[]> {
  const radiusKm = options.radiusKm ?? 10;
  const key = cacheKey(`ev-r${radiusKm}`, coord);

  if (!options.force) {
    const cached = await readCache<EVStation[]>(key);
    if (cached) {
      indexStations(cached);
      return cached;
    }
  }

  const stations = await fetchEVStationsFromOCM(coord, radiusKm);
  indexStations(stations);
  await writeCache(key, stations);
  return stations;
}
