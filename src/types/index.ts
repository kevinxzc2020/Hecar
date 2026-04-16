// ============================================================
// Hecar — Core Types
// ============================================================

/** 燃料类型 */
export type FuelMode = "gas" | "ev";

/** 油品类型 */
export type GasType = "regular" | "midgrade" | "premium" | "diesel";

/** 充电桩类型 */
export type ChargerType = "AC" | "DC";

/** 充电桩状态 */
export type ChargerStatus = "available" | "occupied" | "offline";

/** 车辆燃料类型 */
export type VehicleFuelType = "gas" | "electric" | "hybrid";

// ------ Station ------

export interface GasStation {
  id: string;
  name: string;
  brand: string;
  address: string;
  latitude: number;
  longitude: number;
  distance: number; // km
  prices: {
    regular?: number;
    midgrade?: number;
    premium?: number;
    diesel?: number;
  };
  updatedAt: string; // ISO
  rating: number;
  isFavorite: boolean;
}

export interface Charger {
  id: string;
  type: ChargerType;
  power: number; // kW
  status: ChargerStatus;
  pricePerKwh: number;
}

export interface EVStation {
  id: string;
  name: string;
  network: string; // e.g. "Tesla Supercharger", "ChargePoint"
  address: string;
  latitude: number;
  longitude: number;
  distance: number;
  chargers: Charger[];
  rating: number;
  isFavorite: boolean;
}

export type Station = GasStation | EVStation;

export function isGasStation(s: Station): s is GasStation {
  return "prices" in s;
}

export function isEVStation(s: Station): s is EVStation {
  return "chargers" in s;
}

// ------ Vehicle ------

export interface Vehicle {
  id: string;
  nickname: string;
  brand: string;
  model: string;
  year: number;
  fuelType: VehicleFuelType;
  licensePlate?: string;
}

// ------ Expense ------

export interface Expense {
  id: string;
  vehicleId: string;
  type: "gas" | "charge";
  amount: number; // $
  liters?: number;
  kwh?: number;
  stationName: string;
  date: string; // ISO
  odometer?: number;
}

// ------ User / Auth ------

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  plan: "free" | "plus" | "pro";
}

// ------ App State ------

export interface AppState {
  isOnboarded: boolean;
  user: UserProfile | null;
  vehicles: Vehicle[];
  activeVehicleId: string | null;
  fuelMode: FuelMode;
  expenses: Expense[];
  favoriteStationIds: string[];
}
