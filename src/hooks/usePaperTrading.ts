import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export function usePaperTrading() {
  const startTrading = useCallback(async (mode: "paper" | "live" = "paper") => {
    try {
      await invoke("start_trading", { mode });
      return { success: true };
    } catch (error) {
      console.error("Failed to start trading:", error);
      return { success: false, error: String(error) };
    }
  }, []);

  const stopTrading = useCallback(async () => {
    try {
      await invoke("stop_trading");
      return { success: true };
    } catch (error) {
      console.error("Failed to stop trading:", error);
      return { success: false, error: String(error) };
    }
  }, []);

  return { startTrading, stopTrading };
}