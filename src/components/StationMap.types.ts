import type { Station } from "../types";

export interface StationMapHandle {
  /** 以动画方式把地图中心挪到指定经纬度 */
  animateToCoordinate: (
    coord: { latitude: number; longitude: number },
    zoomDelta?: number,
  ) => void;
}

export interface StationMapProps {
  stations: Station[];
  selectedId: string | null;
  onSelectStation: (s: Station) => void;
  /** 用户当前经纬度；无则使用 defaultRegion（原生）或视作未定位（fallback） */
  userLocation?: { latitude: number; longitude: number } | null;
  /** 原生地图的初始区域（fallback 忽略此参数） */
  defaultRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  /** fallback 占位使用的提示文案；原生地图忽略 */
  bannerText?: string;
}
