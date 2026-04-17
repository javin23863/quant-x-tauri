import { useDashboardStore } from "../../store/dashboard";

export default function RiskPanel() {
  const { risk, kill_switch } = useDashboardStore();

  if (!risk) {
    return (
      <div className="card">
        <h3 className="card-header">Risk Monitor</h3>
        <p className="text-slate-500 text-xs">No risk data</p>
      </div>
    );
  }

  const items = [
    { label: "VaR Limit", value: `$${risk.var_limit.toLocaleString()}`, color: "text-blue-400" },
    { label: "Max Position", value: `$${risk.max_position_size.toLocaleString()}`, color: "text-slate-200" },
    { label: "Daily Loss Limit", value: `$${risk.daily_loss_limit.toLocaleString()}`, color: "text-slate-200" },
    { label: "Equity Drop", value: `${(risk.equity_drop_pct * 100).toFixed(1)}%`, color: risk.equity_drop_pct > 0.05 ? "text-red-400" : "text-green-400" },
    { label: "Daily P&L", value: `$${risk.daily_pnl.toFixed(2)}`, color: risk.daily_pnl >= 0 ? "text-green-400" : "text-red-400" },
    { label: "Consecutive Losses", value: `${risk.consecutive_losses}/${risk.max_consecutive_losses}`, color: risk.consecutive_losses > 3 ? "text-red-400" : "text-slate-200" },
    { label: "Circuit Breakers", value: risk.circuit_breakers_active ? "ACTIVE" : "Clear", color: risk.circuit_breakers_active ? "text-red-400" : "text-green-400" },
    { label: "Kill Switch", value: kill_switch.active ? `ENGAGED: ${kill_switch.reason || ""}` : "Disengaged", color: kill_switch.active ? "text-red-400" : "text-green-400" },
  ];

  return (
    <div className="card">
      <h3 className="card-header">Risk Monitor</h3>
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