import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useDashboardStore } from "../store/dashboard";
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
} from "../types";

const EVENT_MAP: [string, (payload: unknown) => void][] = [
  ["account-update", (p) => useDashboardStore.getState().setAccount(p as AccountInfo)],
  ["positions-update", (p) => useDashboardStore.getState().setPositions(p as Position[])],
  ["orders-update", (p) => useDashboardStore.getState().setOrders(p as Order[])],
  [
    "order-fill",
    (p) => {
      const ev = p as { id: string; status: Order["status"]; filled_qty: number };
      useDashboardStore.getState().updateOrderStatus(ev.id, ev.status, ev.filled_qty);
    },
  ],
  [
    "bar-update",
    (p) => {
      const ev = p as { symbol: string; bars: Bar[] };
      useDashboardStore.getState().addBars(ev.symbol, ev.bars);
    },
  ],
  ["signal", (p) => useDashboardStore.getState().addSignal(p as TradeSignal)],
  ["risk-update", (p) => useDashboardStore.getState().setRisk(p as RiskState)],
  ["regime-update", (p) => useDashboardStore.getState().setRegime(p as RegimeState)],
  ["strategies-update", (p) => useDashboardStore.getState().setStrategies(p as StrategyState[])],
  ["connection-status", (p) => useDashboardStore.getState().setConnection(p as ConnectionStatus)],
  ["kill-switch", (p) => useDashboardStore.getState().setKillSwitch(p as KillSwitchState)],
  ["prop-firm-update", (p) => useDashboardStore.getState().setPropFirm(p as PropFirmState)],
];

export function useTauriEvents() {
  useEffect(() => {
    const unlisteners: (() => void)[] = [];

    async function register() {
      for (const [event, handler] of EVENT_MAP) {
        try {
          const unlisten = await listen(event, (e) => handler(e.payload));
          unlisteners.push(unlisten);
        } catch (err) {
          console.warn(`Failed to register listener for ${event}:`, err);
        }
      }
    }

    register();

    return () => {
      unlisteners.forEach((u) => u());
    };
  }, []);
}