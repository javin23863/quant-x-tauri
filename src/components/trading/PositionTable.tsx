import { useDashboardStore } from "../../store/dashboard";

export default function PositionTable() {
  const { positions } = useDashboardStore();

  if (positions.length === 0) {
    return (
      <div className="card">
        <h3 className="card-header">Positions</h3>
        <p className="text-slate-500 text-xs">No open positions</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="card-header">Positions ({positions.length})</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500 border-b border-slate-700">
              <th className="text-left pb-2">Symbol</th>
              <th className="text-right pb-2">Qty</th>
              <th className="text-right pb-2">Side</th>
              <th className="text-right pb-2">Avg Entry</th>
              <th className="text-right pb-2">Current</th>
              <th className="text-right pb-2">Mkt Value</th>
              <th className="text-right pb-2">P&L</th>
              <th className="text-right pb-2">P&L %</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((pos) => (
              <tr key={pos.symbol} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                <td className="py-2 font-mono text-slate-200">{pos.symbol}</td>
                <td className="py-2 text-right font-mono">{pos.qty}</td>
                <td className={`py-2 text-right ${pos.side === "long" ? "text-green-400" : "text-red-400"}`}>
                  {pos.side}
                </td>
                <td className="py-2 text-right font-mono">${pos.avg_entry_price.toFixed(2)}</td>
                <td className="py-2 text-right font-mono">${pos.current_price.toFixed(2)}</td>
                <td className="py-2 text-right font-mono">${pos.market_value.toFixed(2)}</td>
                <td className={`py-2 text-right font-mono ${pos.unrealized_pl >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {pos.unrealized_pl >= 0 ? "+" : ""}${pos.unrealized_pl.toFixed(2)}
                </td>
                <td className={`py-2 text-right font-mono ${pos.unrealized_plpc >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {(pos.unrealized_plpc * 100).toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}