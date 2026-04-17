import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useDashboardStore } from "../../store/dashboard";

export default function KillSwitch() {
  const { kill_switch, addNotification } = useDashboardStore();
  const [confirming, setConfirming] = useState(false);

  const handleActivate = async () => {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
      return;
    }
    try {
      await invoke("activate_kill_switch", { reason: "Manual activation" });
      addNotification({ type: "error", title: "Kill Switch Activated", message: "All trading has been halted." });
    } catch (e) {
      addNotification({ type: "warning", title: "Kill Switch", message: String(e) });
    }
    setConfirming(false);
  };

  const handleDeactivate = async () => {
    try {
      await invoke("deactivate_kill_switch");
      addNotification({ type: "success", title: "Kill Switch Off", message: "Trading resumed." });
    } catch (e) {
      addNotification({ type: "warning", title: "Kill Switch", message: String(e) });
    }
  };

  if (kill_switch.active) {
    return (
      <div className="fixed bottom-4 left-4 z-50">
        <div className="bg-red-500/20 border-2 border-red-500 rounded-lg p-4 flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <div>
            <p className="text-red-400 font-bold text-sm">KILL SWITCH ACTIVE</p>
            {kill_switch.reason && <p className="text-red-300 text-xs">{kill_switch.reason}</p>}
          </div>
          <button onClick={handleDeactivate} className="btn btn-secondary text-xs ml-4">
            Resume Trading
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <button
        onClick={handleActivate}
        className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
          confirming
            ? "bg-red-500 hover:bg-red-600 text-white"
            : "bg-surface-tertiary hover:bg-red-900/50 text-slate-400 hover:text-red-400"
        }`}
      >
        {confirming ? "Click again to ACTIVATE" : "Emergency Stop"}
      </button>
    </div>
  );
}