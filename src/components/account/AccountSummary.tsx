import { useDashboardStore } from '../../store/dashboard';

export default function AccountSummary() {
  const account = useDashboardStore((s) => s.account);
  const connection = useDashboardStore((s) => s.connection);

  if (!account) {
    return (
      <div className="card">
        <p className="text-slate-500 text-sm">No account data — connect a broker to begin</p>
      </div>
    );
  }

  const stats = [
    { label: "Portfolio Value", value: `$${account.portfolio_value.toLocaleString("en-US", { minimumFractionDigits: 2 })}` },
    { label: "Equity", value: `$${account.equity.toLocaleString("en-US", { minimumFractionDigits: 2 })}` },
    { label: "Cash", value: `$${account.cash.toLocaleString("en-US", { minimumFractionDigits: 2 })}` },
    { label: "Buying Power", value: `$${account.buying_power.toLocaleString("en-US", { minimumFractionDigits: 2 })}` },
    { label: "Mode", value: connection.mode.toUpperCase() },
    { label: "Status", value: account.status },
    { label: "Broker", value: connection.broker },
    { label: "PDT", value: account.pattern_day_trader ? "Yes" : "No" },
  ];

  return (
    <div className="card">
      <div className="grid grid-cols-4 md:grid-cols-8 gap-4">
        {stats.map(({ label, value }) => (
          <div key={label}>
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <p className="text-sm font-mono text-slate-200">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}