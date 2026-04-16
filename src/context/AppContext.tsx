import React, { createContext, useContext, useReducer, ReactNode } from "react";
import {
  AppState,
  Vehicle,
  Expense,
  FuelMode,
  UserProfile,
} from "../types";
import { mockVehicle, mockExpenses } from "../data/mockExpenses";

// ---- Actions ----

type Action =
  | { type: "SET_ONBOARDED"; payload: boolean }
  | { type: "SET_USER"; payload: UserProfile | null }
  | { type: "SET_FUEL_MODE"; payload: FuelMode }
  | { type: "ADD_VEHICLE"; payload: Vehicle }
  | { type: "REMOVE_VEHICLE"; payload: string }
  | { type: "SET_ACTIVE_VEHICLE"; payload: string }
  | { type: "ADD_EXPENSE"; payload: Expense }
  | { type: "TOGGLE_FAVORITE"; payload: string };

// ---- Initial State ----

const initialState: AppState = {
  isOnboarded: false,
  user: null,
  vehicles: [],
  activeVehicleId: null,
  fuelMode: "gas",
  expenses: [],
  favoriteStationIds: ["gas-2", "gas-4", "ev-1"],
};

// Demo state for skipping onboarding during development
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

// ---- Context ----

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  // Use demoState for now so the app skips onboarding and has data
  const [state, dispatch] = useReducer(appReducer, demoState);
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
