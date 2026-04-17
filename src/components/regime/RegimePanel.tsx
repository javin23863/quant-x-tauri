import { useDashboardStore } from "../../store/dashboard";

const regimeColor: Record<string, string> = {
  trending: "text-green-400",
  mean_reverting: "text-blue-400",
  volatile: "text-red-400",
  quiet: "text-slate-400",
};

export default function RegimePanel() {
  const { regime } = useDashboardStore();

  if (!regime) {
    return (
      <div className="card">
        <h3 className="card-header">Market Regime</h3>
        <p className="text-slate-500 text-xs">No regime data</p>
      </div>
    );
  }

  const items = [
    { label: "Regime", value: regime.current, color: regimeColor[regime.current] || "text-slate-200" },
    { label: "HMM State", value: String(regime.hmm_state), color: "text-blue-400" },
    { label: "Vol Cluster", value: regime.volatility_cluster, color: "text-slate-200" },
    { label: "Trend Strength", value: `${(regime.trend_strength * 100).toFixed(1)}%`, color: "text-slate-200" },
  ];

  return (
    <div className="card">
      <h3 className="card-header">Market Regime</h3>
      <div className="space-y-2">
        {items.map(({ label, value, color }) => (
          <div key={label} className="flex justify-between items-center text-xs">
            <span className="text-slate-500">{label}</span>
            <span className={`font-mono font-semibold ${color}`}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}