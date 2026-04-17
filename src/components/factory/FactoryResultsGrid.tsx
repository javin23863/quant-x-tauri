import { useState, useEffect, useCallback } from 'react';
import { useDashboardStore } from '../../store/dashboard';
import { invoke } from '@tauri-apps/api/core';

export default function FactoryResultsGrid() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const store = useDashboardStore();

  const refreshResults = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke('factory_backtest_results', { limit: 10 }) as any;
      useDashboardStore.setState({ orders: result.results || [] });
      const latestRes = result.latest;
      if (latestRes && latestRes.metrics) {
        useDashboardStore.setState({ risk: latestRes.metrics });
      }
      setError(null);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshResults();
  }, [refreshResults]);

  const runs: any[] = (store as any).backtestResults || [];
  const latest = runs[0] || null;
  const metrics = (latest && latest.metrics) ? latest.metrics : ((store as any).factoryMetrics || null);

  const cards = metrics ? [
    { label: 'Sharpe', value: Number(metrics.sharpe || 0).toFixed(2) },
    { label: 'Sortino', value: Number(metrics.sortino || 0).toFixed(2) },
    { label: 'Max DD', value: (Number(metrics.maxDrawdown || 0) * 100).toFixed(2) + '%' },
    { label: 'Win Rate', value: (Number(metrics.winRate || 0) * 100).toFixed(1) + '%' },
    { label: 'CAGR', value: Number(metrics.cagr || 0).toFixed(2) + '%' },
    { label: 'Volatility', value: Number(metrics.volatility || 0).toFixed(2) + '%' },
    { label: 'Calmar', value: Number(metrics.calmar || 0).toFixed(2) },
    { label: 'Profit Factor', value: Number(metrics.profitFactor || 0).toFixed(2) },
    { label: 'Trades', value: String(metrics.totalTrades || (latest ? latest.tradeCount : 0) || 0) },
    { label: 'Avg Win', value: '$' + Number(metrics.avgWin || 0).toFixed(2) },
    { label: 'Avg Loss', value: '$' + Number(metrics.avgLoss || 0).toFixed(2) },
    { label: 'Total P&L', value: '$' + Number(metrics.totalPnl || 0).toFixed(2) },
  ] : [];

  return (
    <div className="factory-results-grid" style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%', color: '#E5E7EB' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em' }}>LATEST BACKTEST</div>
        <button className="factory-btn factory-btn-sm" onClick={refreshResults} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</button>
      </div>
      {error && <div className="factory-error-banner">{error}</div>}
      {!latest && !loading && (
        <div style={{ padding: '16px', border: '1px solid #2A2A2A', background: '#111827', borderRadius: '6px', color: '#9CA3AF', fontSize: '11px' }}>
          No backtest results yet. Generate a strategy and run the backtest from the Factory header.
        </div>
      )}
      {latest && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '6px' }}>
          {cards.map((card) => (
            <div key={card.label} style={{ padding: '8px', background: '#1F2937', border: '1px solid #374151', borderRadius: '4px' }}>
              <div style={{ fontSize: '9px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>{card.label}</div>
              <div style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{card.value}</div>
            </div>
          ))}
        </div>
      )}
      {latest && (
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', border: '1px solid #374151', borderRadius: '6px', background: '#111827' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 80px 80px 80px 90px', gap: '8px', padding: '8px', fontSize: '9px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #374151' }}>
            <div>Symbol</div>
            <div>Status</div>
            <div>Sharpe</div>
            <div>Trades</div>
            <div>Timestamp</div>
          </div>
          {runs.map(function(run: any) {
            const runMetrics = run.metrics || {};
            const sharpe = Number(runMetrics.sharpe || 0).toFixed(2);
            const trades = String(run.tradeCount || runMetrics.totalTrades || 0);
            return (
              <div key={run.id} style={{ display: 'grid', gridTemplateColumns: '140px 80px 80px 80px 90px', gap: '8px', padding: '8px', fontSize: '11px', borderBottom: '1px solid #1F2937' }}>
                <div style={{ fontFamily: 'var(--font-mono)' }}>{(run.symbol || 'N/A') + ' • ' + (run.strategyType || 'strategy')}</div>
                <div>{String(run.status || 'unknown').toUpperCase()}</div>
                <div style={{ fontFamily: 'var(--font-mono)' }}>{sharpe}</div>
                <div style={{ fontFamily: 'var(--font-mono)' }}>{trades}</div>
                <div style={{ color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>{new Date(run.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}