import { useDashboardStore } from "../../store/dashboard";

export default function ChartPanel() {
  const { bars } = useDashboardStore();
  const symbols = Object.keys(bars);

  if (symbols.length === 0) {
    return (
      <div className="card">
        <h3 className="card-header">Chart</h3>
        <p className="text-slate-500 text-xs">Waiting for market data...</p>
      </div>
    );
  }

  const symbol = symbols[0];
  const symbolBars = bars[symbol] || [];
  const latest = symbolBars[symbolBars.length - 1];

  return (
    <div className="card">
      <h3 className="card-header">
        {symbol}
        {latest && (
          <span className="font-mono text-xs text-slate-400 ml-2">
            ${latest.close.toFixed(2)}
          </span>
        )}
      </h3>
      <div className="h-48 flex items-center justify-center text-slate-600 text-xs">
        Chart rendering — requires canvas/SVG charting library
      </div>
      <div className="text-xs text-slate-500 mt-2">{symbolBars.length} bars loaded</div>
    </div>
  );
}