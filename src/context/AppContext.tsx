import React, {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AppState,
  Vehicle,
  Expense,
  FuelMode,
  UserProfile,
} from "../types";
import { mockVehicle, mockExpenses } from "../data/mockExpenses";

// ---- Storage ----

const STORAGE_KEY = "@hecar/appState/v1";

// ---- Actions ----

type Action =
  | { type: "SET_ONBOARDED"; payload: boolean }
  | { type: "SET_USER"; payload: UserProfile | null }
  | { type: "SET_FUEL_MODE"; payload: FuelMode }
  | { type: "ADD_VEHICLE"; payload: Vehicle }
  | { type: "REMOVE_VEHICLE"; payload: string }
  | { type: "SET_ACTIVE_VEHICLE"; payload: string }
  | { type: "ADD_EXPENSE"; payload: Expense }
  | { type: "TOGGLE_FAVORITE"; payload: string }
  | { type: "HYDRATE"; payload: AppState }
  | { type: "LOGOUT" }
  | { type: "RESET" };

// ---- Initial / Demo State ----

const initialState: AppState = {
  isOnboarded: false,
  user: null,
  vehicles: [],
  activeVehicleId: null,
  fuelMode: "gas",
  expenses: [],
  favoriteStationIds: [],
};

export const demoState: AppState = {
  isOnboarded: true,
  user: {
    id: "demo",
    email: "demo@hecar.app",
    displayName: "Demo User",
    plan: "free",
  },
  vehicles: [mockVehicle],
  activeVehicleId: "v-1",
  fuelMode: "gas",
  expenses: mockExpenses,
  favoriteStationIds: ["gas-2", "gas-4", "ev-1"],
};

// ---- Reducer ----

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "HYDRATE":
      return action.payload;
    case "LOGOUT":
      return { ...state, user: null, isOnboarded: false };
    case "RESET":
      return initialState;
    case "SET_ONBOARDED":
      return { ...state, isOnboarded: action.payload };
    case "SET_USER":
      return { ...state, user: action.payload };
    case "SET_FUEL_MODE":
      return { ...state, fuelMode: action.payload };
    case "ADD_VEHICLE":
      return {
        ...state,
        vehicles: [...state.vehicles, action.payload],
        activeVehicleId: state.activeVehicleId ?? action.payload.id,
      };
    case "REMOVE_VEHICLE":
      return {
        ...state,
        vehicles: state.vehicles.filter((v) => v.id !== action.payload),
        activeVehicleId:
          state.activeVehicleId === action.payload
            ? state.vehicles[0]?.id ?? null
            : state.activeVehicleId,
      };
    case "SET_ACTIVE_VEHICLE":
      return { ...state, activeVehicleId: action.payload };
    case "ADD_EXPENSE":
      return { ...state, expenses: [action.payload, ...state.expenses] };
    case "TOGGLE_FAVORITE": {
      const id = action.payload;
      const favs = state.favoriteStationIds.includes(id)
        ? state.favoriteStationIds.filter((f) => f !== id)
        : [...state.favoriteStationIds, id];
      return { ...state, favoriteStationIds: favs };
    }
    default:
      return state;
  }
}

// ---- Hydration Helpers ----

function isValidAppState(v: unknown): v is AppState {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.isOnboarded === "boolean" &&
    Array.isArray(s.vehicles) &&
    Array.isArray(s.expenses) &&
    Array.isArray(s.favoriteStationIds) &&
    (s.fuelMode === "gas" || s.fuelMode === "ev") &&
    (s.user === null || typeof s.user === "object") &&
    (s.activeVehicleId === null || typeof s.activeVehicleId === "string")
  );
}

async function loadPersistedState(): Promise<AppState | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isValidAppState(parsed)) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function persistState(state: AppState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore; next state change will try again
  }
}

async function clearPersistedState(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ---- Context ----

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  resetLocalData: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const hydratedRef = useRef(false);
  const [hydrated, setHydrated] = React.useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const persisted = await loadPersistedState();
      if (cancelled) return;

      if (persisted) {
        dispatch({ type: "HYDRATE", payload: persisted });
      } else if (__DEV__) {
        dispatch({ type: "HYDRATE", payload: demoState });
      }
      hydratedRef.current = true;
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    void persistState(state);
  }, [state]);

  const resetLocalData = React.useCallback(async () => {
    await clearPersistedState();
    dispatch({ type: "RESET" });
  }, []);

  if (!hydrated) return null;

  return (
    <AppContext.Provider value={{ state, dispatch, resetLocalData }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
