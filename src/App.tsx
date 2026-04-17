import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useDashboardStore } from "./store/dashboard";
import { useTauriEvents } from "./hooks/useTauriEvents";
import { RouterProvider } from "./router";
import Dashboard from "./components/Dashboard";

export default function App() {
  const { addNotification, setConnection } = useDashboardStore();
  const [initialized, setInitialized] = useState(false);

  useTauriEvents();

  useEffect(() => {
    async function init() {
      try {
        const status = await invoke<{
          mode: string;
          connected: boolean;
          last_heartbeat: string | null;
          broker: string;
        }>("get_connection_status");
        setConnection({ ...status, mode: status.mode as import("./types").TradingMode });
        setInitialized(true);
      } catch (e) {
        const msg = String(e);
        console.warn("Tauri backend not available, running in offline mode:", msg);
        setConnection({ mode: "stopped", connected: false, last_heartbeat: null, broker: "none" });
        addNotification({
          type: "warning",
          title: "Offline Mode",
          message: "Tauri backend not available. Running in offline mode.",
        });
        setInitialized(true);
      }
    }

    init();
  }, []);

  if (!initialized) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0f1729]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Initializing Quant X...</p>
        </div>
      </div>
    );
  }

  return (
    <RouterProvider>
      <Dashboard />
    </RouterProvider>
  );
}