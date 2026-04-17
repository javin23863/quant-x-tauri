import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

function PortfolioChart({ history, baselineValue }: { history: Array<{ value: number; timestamp: string }>; baselineValue: number }) {
  const W = 600, H = 180, PAD = { top: 16, right: 20, bottom: 28, left: 72 };
  const inner = { w: W - PAD.left - PAD.right, h: H - PAD.top - PAD.bottom };

  if (!history || history.length < 2) {
    return <div className="portfolio-chart" style={{ width: W, maxWidth: '100%' }}><p style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: 80 }}>Loading chart…</p></div>;
  }

  const values = history.map(p => p.value);
  const baseline = baselineValue || values[0];
  const min = Math.min(...values, baseline) * 0.999;
  const max = Math.max(...values, baseline) * 1.001;
  const range = max - min || 1;

  const toX = (i: number) => PAD.left + (i / (history.length - 1)) * inner.w;
  const toY = (v: number) => PAD.top + inner.h - ((v - min) / range) * inner.h;

  const pts = history.map((p, i) => `${toX(i)},${toY(p.value)}`).join(' ');
  const isPositive = values[values.length - 1] >= baseline;
  const lineColor = isPositive ? '#10B981' : '#EF4444';
  const fillColor = isPositive ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)';

  const baselineY = toY(baseline);
  const firstX = toX(0);
  const lastX = toX(history.length - 1);
  const fillPath = `M${firstX},${baselineY} ` + history.map((p, i) => `L${toX(i)},${toY(p.value)}`).join(' ') + ` L${lastX},${baselineY} Z`;
  const baselineYclamped = Math.max(PAD.top, Math.min(PAD.top + inner.h, baselineY));

  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const val = min + (range * i) / 4;
    return { val, y: toY(val) };
  });

  const xLabels = [0, Math.floor(history.length / 2), history.length - 1].map(i => ({
    x: toX(i),
    label: history[i] ? new Date(history[i].timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
  }));

  const fmt = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`;

  return (
    <div className="portfolio-chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: 'auto', maxHeight: H }}>
        <path d={fillPath} fill={fillColor} />
        <line x1={PAD.left} y1={baselineYclamped} x2={PAD.left + inner.w} y2={baselineYclamped} stroke="rgba(255,255,255,0.15)" strokeWidth={1} strokeDasharray="4,3" />
        {yTicks.map((t, i) => (
          <g key={`gy${i}`}>
            <line x1={PAD.left - 4} y1={t.y} x2={PAD.left + inner.w} y2={t.y} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
            <text x={PAD.left - 6} y={t.y + 4} textAnchor="end" fill="rgba(139,150,168,0.7)" fontSize={10} fontFamily="monospace">{fmt(t.val)}</text>
          </g>
        ))}
        {xLabels.map((l, i) => (
          <text key={`xl${i}`} x={l.x} y={H - 6} textAnchor="middle" fill="rgba(139,150,168,0.7)" fontSize={10} fontFamily="monospace">{l.label}</text>
        ))}
        <polyline points={pts} fill="none" stroke={lineColor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={toX(history.length - 1)} cy={toY(values[values.length - 1])} r={4} fill={lineColor} stroke="var(--bg-panel)" strokeWidth={2} />
      </svg>
    </div>
  );
}

interface StrategyData {
  name: string;
  status: string;
  dailyPnl: number;
  dailyPnlPct: number;
  winRate: number;
  sharpe: number;
  allocated: number;
  sparkline: number[];
}

function StrategyCard({ strat }: { strat: StrategyData }) {
  const isPositive = strat.dailyPnl >= 0;
  const badgeColor = strat.status === 'LIVE' ? 'var(--accent-green)' : strat.status === 'PAUSED' ? 'var(--accent-yellow)' : 'var(--accent-blue)';
  const miniSparkline = strat.sparkline || [];
  const sparkPts = miniSparkline.length > 1 ? miniSparkline.map((v: number, i: number) => `${i * 6},${28 - v * 24}`).join(' ') : '';

  return (
    <div className="strategy-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{strat.name}</div>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: badgeColor, border: `1px solid ${badgeColor}`, borderRadius: 4, padding: '2px 6px' }}>{strat.status}</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Allocated: ${strat.allocated.toLocaleString()}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: isPositive ? 'var(--accent-green)' : 'var(--accent-red)' }}>{`${isPositive ? '+' : ''}$${strat.dailyPnl.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}</span>
        <span style={{ fontSize: 11, color: isPositive ? 'var(--accent-green)' : 'var(--accent-red)' }}>{`${isPositive ? '▲' : '▼'} ${Math.abs(strat.dailyPnlPct).toFixed(2)}%`}</span>
      </div>
      <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10 }}>
        <span>{`Win: ${(strat.winRate * 100).toFixed(0)}%`}</span>
        <span>{`Sharpe: ${strat.sharpe.toFixed(2)}`}</span>
      </div>
      {sparkPts && <svg width={120} height={28} style={{ display: 'block' }}><polyline points={sparkPts} fill="none" stroke={isPositive ? '#10B981' : '#EF4444'} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" /></svg>}
    </div>
  );
}

interface PositionData {
  symbol: string;
  direction: string;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPct: number;
}

function PositionsTable({ positions }: { positions: PositionData[] }) {
  if (!positions || positions.length === 0) {
    return <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: 16 }}>No open positions</div>;
  }

  const totalPnl = positions.reduce((s: number, p: PositionData) => s + p.pnl, 0);
  const isPositive = totalPnl >= 0;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>{['Symbol', 'Dir', 'Entry', 'Current', 'P&L $', 'P&L %'].map(h => (
            <th key={h} style={{ textAlign: h === 'Symbol' || h === 'Dir' ? 'left' : 'right', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border-subtle)', fontSize: 11, letterSpacing: '0.4px' }}>{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {positions.map((pos: PositionData, i: number) => {
            const pnlPos = pos.pnl >= 0;
            return (
              <tr key={i} className={`position-row ${pnlPos ? 'profit' : 'loss'}`}>
                <td style={{ padding: '7px 8px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{pos.symbol}</td>
                <td style={{ padding: '7px 8px', color: pos.direction === 'LONG' ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 600, fontSize: 11 }}>{pos.direction}</td>
                <td style={{ padding: '7px 8px', textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{`$${pos.entryPrice.toFixed(2)}`}</td>
                <td style={{ padding: '7px 8px', textAlign: 'right', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{`$${pos.currentPrice.toFixed(2)}`}</td>
                <td style={{ padding: '7px 8px', textAlign: 'right', color: pnlPos ? 'var(--accent-green)' : 'var(--accent-red)', fontFamily: 'var(--font-mono)' }}>{`${pnlPos ? '+' : ''}$${pos.pnl.toFixed(2)}`}</td>
                <td style={{ padding: '7px 8px', textAlign: 'right', color: pnlPos ? 'var(--accent-green)' : 'var(--accent-red)', fontFamily: 'var(--font-mono)' }}>{`${pnlPos ? '+' : ''}${pos.pnlPct.toFixed(2)}%`}</td>
              </tr>
            );
          })}
          <tr style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <td colSpan={4} style={{ padding: '7px 8px', fontWeight: 700, fontSize: 12, color: 'var(--text-secondary)' }}>Total P&L</td>
            <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700, color: isPositive ? 'var(--accent-green)' : 'var(--accent-red)', fontFamily: 'var(--font-mono)' }}>{`${isPositive ? '+' : ''}$${totalPnl.toFixed(2)}`}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function PortfolioTrackerView() {
  const [mode, setMode] = useState('paper');
  const [portfolio, setPortfolio] = useState<any>(null);
  const [history, setHistory] = useState<Array<{ value: number; timestamp: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchPortfolio() {
    try {
      const data: any = await invoke('portfolio');
      if (data.error) {
        setError(data.error);
      } else {
        setPortfolio(data);
        setMode(data.mode || 'paper');
        setError(null);
      }
      setLoading(false);
    } catch {
      setError('API unreachable');
      setLoading(false);
    }
  }

  async function fetchHistory() {
    try {
      const data: any = await invoke('portfolio_history');
      if (Array.isArray(data)) setHistory(data);
    } catch {}
  }

  useEffect(() => {
    fetchPortfolio();
    fetchHistory();
    const interval = setInterval(() => { fetchPortfolio(); fetchHistory(); }, 30000);
    return () => clearInterval(interval);
  }, []);

  async function toggleMode(newMode: string) {
    try {
      await invoke('portfolio_mode', { mode: newMode });
      setMode(newMode);
      await fetchPortfolio();
    } catch {}
  }

  const isLive = mode === 'live';
  const dailyPnlPositive = portfolio && portfolio.dailyPnl >= 0;

  if (loading) {
    return <div className="portfolio-view"><div className="view-header"><div className="view-title">Portfolio</div><div className="view-subtitle">Loading...</div></div></div>;
  }

  if (error) {
    return <div className="portfolio-view"><div className="view-header"><div className="view-title">Portfolio</div><div style={{ color: 'var(--accent-red)' }}>{error}</div></div></div>;
  }

  return (
    <div className="portfolio-view">
      <div className="view-header">
        <div className="view-title">Portfolio</div>
        <div className="view-subtitle">Real-time P&L tracking — paper or live mode</div>
      </div>

      <div className="panel" style={{ padding: '14px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', background: 'var(--bg-root)', borderRadius: 8, padding: 3, gap: 2 }}>
          {['paper', 'live'].map(m => (
            <button key={m} onClick={() => toggleMode(m)} style={{
              padding: '5px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11,
              fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', transition: 'all 200ms',
              background: mode === m ? (m === 'live' ? 'var(--accent-green)' : 'var(--accent-blue)') : 'transparent',
              color: mode === m ? '#fff' : 'var(--text-muted)',
            }}>{m}</button>
          ))}
        </div>

        <div style={{ flex: 1 }}>
          {loading ? <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
           : error ? <div style={{ color: 'var(--accent-red)', fontSize: 13 }}>{error}</div>
           : <div className="portfolio-value-large" style={{ color: 'var(--text-primary)' }}>{`$${(portfolio.totalValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</div>}
        </div>

        {!loading && !error && portfolio && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: dailyPnlPositive ? 'var(--accent-green)' : 'var(--accent-red)' }}>
              {`${dailyPnlPositive ? '+' : ''}$${Math.abs(portfolio.dailyPnl || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </div>
            <div style={{ fontSize: 12, color: dailyPnlPositive ? 'var(--accent-green)' : 'var(--accent-red)' }}>
              {`${dailyPnlPositive ? '▲' : '▼'} ${Math.abs(portfolio.dailyPnlPct || 0).toFixed(2)}% today`}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: isLive ? 'var(--accent-green)' : 'var(--accent-blue)', boxShadow: `0 0 8px ${isLive ? 'rgba(16,185,129,0.6)' : 'rgba(59,130,246,0.6)'}` }} />
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>{isLive ? 'LIVE' : 'PAPER'}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 300px', gap: 16, marginBottom: 16 }}>
        <div className="panel" style={{ padding: '14px 16px' }}>
          <div className="panel-header"><span className="panel-title">Strategies</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
            {(portfolio?.strategies || []).map((s: StrategyData, i: number) => <StrategyCard key={i} strat={s} />)}
          </div>
        </div>

        <div className="panel" style={{ padding: '14px 16px' }}>
          <div className="panel-header">
            <span className="panel-title">Portfolio Value — 30-day</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{`${history.length} snapshots`}</span>
          </div>
          <div style={{ marginTop: 12 }}>
            <PortfolioChart history={history.slice(-100)} baselineValue={portfolio?.baselineValue} />
          </div>
        </div>

        <div className="panel" style={{ padding: '14px 16px' }}>
          <div className="panel-header"><span className="panel-title">Open Positions</span></div>
          <div style={{ marginTop: 12 }}>
            <PositionsTable positions={portfolio?.positions} />
          </div>
        </div>
      </div>

      {!loading && !error && portfolio && (
        <div className="panel" style={{ padding: '12px 20px', display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { label: 'Realized P&L Today', value: portfolio.realizedPnl, mono: true },
            { label: 'Unrealized P&L', value: portfolio.unrealizedPnl, mono: true },
            { label: 'Commission Paid', value: portfolio.commissionPaid, mono: true, negative: true },
            { label: 'Buying Power', value: portfolio.buyingPower, mono: true },
          ].map(({ label, value, mono, negative }) => {
            const pos = (value || 0) >= 0 && !negative;
            const color = negative ? 'var(--accent-red)' : pos ? 'var(--accent-green)' : 'var(--accent-red)';
            return (
              <div key={label as string}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>{label as string}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color, fontFamily: mono ? 'var(--font-mono)' : 'inherit' }}>{`${(value || 0) >= 0 && !negative ? '+' : ''}$${Math.abs(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}