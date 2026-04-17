interface StrategyAttribution {
  alpha: number | null;
  beta: number | null;
  sharpe: number | null;
  regime_breakdown?: Record<string, number>;
}

interface AttributionData {
  strategies: Record<string, StrategyAttribution>;
  asOf?: string;
}

interface AttributionPanelProps {
  attribution: AttributionData;
}

function fmt(val: number | null | undefined): string {
  if (val == null) return '—';
  if (typeof val === 'number') return val.toFixed(4);
  return String(val);
}

function fmtDate(ts: string | undefined): string {
  if (!ts) return 'N/A';
  try { return new Date(ts).toLocaleString(); } catch { return ts || 'N/A'; }
}

function regimeLabel(breakdown: Record<string, number> | undefined | null): string {
  if (!breakdown || typeof breakdown !== 'object') return '—';
  return Object.entries(breakdown)
    .map(([k, v]) => `${k}: ${typeof v === 'number' ? (v * 100).toFixed(1) + '%' : v}`)
    .join('  ');
}

export default function AttributionPanel({ attribution }: AttributionPanelProps) {
  const strategies = (attribution && attribution.strategies) || {};
  const asOf = (attribution && attribution.asOf) || undefined;
  const ids = Object.keys(strategies);

  return (
    <section className="panel attribution-panel">
      <h2>
        ATTRIBUTION
        {asOf && <span className="text-muted" style={{ fontSize: '0.75rem', marginLeft: '0.5rem' }}>as of {fmtDate(asOf)}</span>}
      </h2>

      {ids.length === 0 ? (
        <div className="empty-state">No attribution data loaded</div>
      ) : (
        <table className="attribution-table">
          <thead>
            <tr>
              <th>Strategy</th>
              <th>Alpha</th>
              <th>Beta</th>
              <th>Sharpe</th>
              <th>Regime Breakdown</th>
            </tr>
          </thead>
          <tbody>
            {ids.map((id) => {
              const s = strategies[id];
              return (
                <tr key={id}>
                  <td className="mono">{id}</td>
                  <td className="mono">{fmt(s.alpha)}</td>
                  <td className="mono">{fmt(s.beta)}</td>
                  <td className="mono">{fmt(s.sharpe)}</td>
                  <td className="text-muted" style={{ fontSize: '0.75rem' }}>
                    {regimeLabel(s.regime_breakdown)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}