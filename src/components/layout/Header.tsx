import { useDashboardStore } from "../../store/dashboard";

export default function Header() {
  const { connection, account } = useDashboardStore();

  return (
    <header className="h-14 bg-[#1a2332] border-b border-slate-700 flex items-center px-4 justify-between shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-lg font-bold text-blue-400">Quant X</span>
        <span
          className={`text-xs px-2 py-0.5 rounded ${
            connection.mode === "live"
              ? "bg-red-500/20 text-red-400"
              : connection.mode === "paper"
              ? "bg-yellow-500/20 text-yellow-400"
              : "bg-slate-500/20 text-slate-400"
          }`}
        >
          {connection.mode.toUpperCase()}
        </span>
        {connection.connected && (
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        )}
      </div>
      <div className="flex items-center gap-4 text-sm text-slate-400">
        {account && (
          <>
            <span>
              Equity:{" "}
              <span className="text-slate-200 font-mono">
                ${account.equity.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </span>
            <span>
              Cash:{" "}
              <span className="text-slate-200 font-mono">
                ${account.cash.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </span>
          </>
        )}
      </div>
    </header>
  );
}