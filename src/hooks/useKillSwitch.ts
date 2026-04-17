import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useKillSwitch() {
  const activate = useCallback(async (reason?: string) => {
    try {
      await invoke("activate_kill_switch", { reason: reason ?? "manual" });
      return { success: true };
    } catch (error) {
      console.error("Failed to activate kill switch:", error);
      return { success: false, error: String(error) };
    }
  }, []);

  const deactivate = useCallback(async () => {
    try {
      await invoke("deactivate_kill_switch");
      return { success: true };
    } catch (error) {
      console.error("Failed to deactivate kill switch:", error);
      return { success: false, error: String(error) };
    }
  }, []);

  return { activate, deactivate };
}