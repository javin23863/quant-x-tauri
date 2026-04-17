import { useDashboardStore } from "../../store/dashboard";

export default function SignalFeed() {
  const { signals } = useDashboardStore();

  if (signals.length === 0) {
    return (
      <div className="card">
        <h3 className="card-header">Signal Feed</h3>
        <p className="text-slate-500 text-xs">No signals received</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="card-header">Signal Feed ({signals.length})</h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {signals.slice(0, 20).map((signal) => (
          <div
            key={signal.id}
            className="flex items-center justify-between p-2 rounded bg-slate-800/50 text-xs"
          >
            <div className="flex items-center gap-2">
              <span className={`font-semibold ${signal.side === "buy" ? "text-green-400" : "text-red-400"}`}>
                {signal.side.toUpperCase()}
              </span>
              <span className="font-mono text-slate-200">{signal.symbol}</span>
              <span className="text-slate-500">{signal.strategy}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-slate-500 font-mono">{signal.confidence.toFixed(1)}%</span>
              <span className="text-slate-600">{new Date(signal.timestamp).toLocaleTimeString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}