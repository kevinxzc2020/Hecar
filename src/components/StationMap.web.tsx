/**
 * Web 入口：react-native-maps 在 web 平台没有实现，Metro 会优先解析到这里。
 * 直接复用原生失败时也用的 StationMapFallback，保证两种回落路径表现一致。
 */
export { default } from "./StationMapFallback";
export type {
  StationMapHandle,
  StationMapProps,
} from "./StationMap.types";
