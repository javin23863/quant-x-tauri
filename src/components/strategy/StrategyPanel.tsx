import { useDashboardStore } from "../../store/dashboard";

export default function StrategyPanel() {
  const { strategies } = useDashboardStore();

  if (strategies.length === 0) {
    return (
      <div className="card">
        <h3 className="card-header">Strategies</h3>
        <p className="text-slate-500 text-xs">No strategies loaded</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="card-header">Strategies ({strategies.length})</h3>
      <div className="space-y-2">
        {strategies.map((s) => (
          <div key={s.name} className="flex justify-between items-center text-xs p-2 rounded bg-slate-800/50">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${s.active ? "bg-green-500" : "bg-slate-600"}`} />
              <span className="text-slate-200">{s.display_name || s.name}</span>
              <span className="text-slate-600 text-[10px]">{s.lifecycle_state}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className={`font-mono ${s.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                {s.pnl >= 0 ? "+" : ""}{s.pnl.toFixed(2)}
              </span>
              <span className="text-slate-500 font-mono">{s.positions} pos</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}