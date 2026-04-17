import { create } from "zustand";
import type {
  AccountInfo,
  Position,
  Order,
  Bar,
  TradeSignal,
  RiskState,
  RegimeState,
  StrategyState,
  ConnectionStatus,
  KillSwitchState,
  PropFirmState,
  Notification,
  DashboardState,
  BrokerType,
} from "../types";

interface DashboardActions {
  setAccount: (account: AccountInfo | null) => void;
  setPositions: (positions: Position[]) => void;
  updatePosition: (symbol: string, update: Partial<Position>) => void;
  setOrders: (orders: Order[]) => void;
  addOrder: (order: Order) => void;
  updateOrderStatus: (id: string, status: Order["status"], filled_qty?: number) => void;
  addBars: (symbol: string, bars: Bar[]) => void;
  addSignal: (signal: TradeSignal) => void;
  setRisk: (risk: RiskState | null) => void;
  setRegime: (regime: RegimeState | null) => void;
  setStrategies: (strategies: StrategyState[]) => void;
  setConnection: (status: Partial<ConnectionStatus>) => void;
  setKillSwitch: (state: KillSwitchState) => void;
  setPropFirm: (state: PropFirmState | null) => void;
  addNotification: (notification: Omit<Notification, "id" | "timestamp">) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setView: (view: string) => void;
  switchBroker: (broker: BrokerType) => void;
}

const initialState: DashboardState = {
  account: null,
  positions: [],
  orders: [],
  bars: {},
  signals: [],
  risk: null,
  regime: null,
  strategies: [],
  connection: { mode: "stopped", connected: false, last_heartbeat: null, broker: "none" },
  kill_switch: { active: false, reason: null, activated_at: null },
  prop_firm: null,
  notifications: [],
  loading: false,
  error: null,
  last_update: null,
  active_view: 'dashboard',
};

export const useDashboardStore = create<DashboardState & DashboardActions>(
  (set, get) => ({
    ...initialState,

    setAccount: (account) => set({ account }),

    setPositions: (positions) => set({ positions }),

    updatePosition: (symbol, update) =>
      set((state) => ({
        positions: state.positions.map((p) =>
          p.symbol === symbol ? { ...p, ...update } : p
        ),
      })),

    setOrders: (orders) => set({ orders }),

    addOrder: (order) =>
      set((state) => ({ orders: [order, ...state.orders].slice(0, 200) })),

    updateOrderStatus: (id, status, filled_qty) =>
      set((state) => ({
        orders: state.orders.map((o) =>
          o.id === id ? { ...o, status, ...(filled_qty !== undefined ? { filled_qty } : {}) } : o
        ),
      })),

    addBars: (symbol, bars) =>
      set((state) => ({
        bars: { ...state.bars, [symbol]: bars },
        last_update: new Date().toISOString(),
      })),

    addSignal: (signal) =>
      set((state) => ({
        signals: [signal, ...state.signals].slice(0, 100),
        last_update: new Date().toISOString(),
      })),

    setRisk: (risk) => set({ risk }),

    setRegime: (regime) => set({ regime }),

    setStrategies: (strategies) => set({ strategies }),

    setConnection: (status) =>
      set((state) => ({
        connection: { ...state.connection, ...status },
      })),

    setKillSwitch: (ks) => set({ kill_switch: ks }),

    setPropFirm: (prop_firm) => set({ prop_firm }),

    addNotification: (notification) =>
      set((state) => ({
        notifications: [
          {
            ...notification,
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
          },
          ...state.notifications,
        ].slice(0, 50),
      })),

    removeNotification: (id) =>
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      })),

    clearNotifications: () => set({ notifications: [] }),

    setLoading: (loading) => set({ loading }),

    setError: (error) => set({ error }),

    setView: (view) => set({ active_view: view }),

    switchBroker: (broker) =>
      set((state) => ({
        connection: { ...state.connection, broker },
      })),
  }),
);