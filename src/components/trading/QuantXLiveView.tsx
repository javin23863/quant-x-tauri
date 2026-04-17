import React from 'react';
import { useDashboardStore } from '../../store/dashboard';
import MissionTabFrame from '../shared/MissionTabFrame';

interface QxLiveState {
  v?: string;
  ts?: number;
  deployment?: { mode?: string };
  market?: {
    regime?: string;
    hmmState?: number;
    vix?: number;
    spy?: number;
    volatility?: string;
    source?: string;
  };
  missionControl?: {
    status?: string;
    mode?: string;
    activeKillSwitch?: boolean;
  };
  hypotheses?: Record<string, Hypothesis>;
  workflow?: {
    currentPhase?: string;
    paused?: boolean;
    nextAction?: string;
  };
  [key: string]: any;
}

interface Hypothesis {
  title: string;
  version?: string;
  phase: string;
  status: string;
  assetClass?: string;
  pineScriptCompatible?: boolean;
  cumulativePnL?: number;
  winRate?: number;
  maxDrawdown?: number;
  trades?: number;
  profitFactor?: number;
  recommendation?: string;
  scaleUpRecommendation?: {
    status: string;
    currentPositionSize: number;
    recommendedPositionSize: number;
  };
  paperTradingResults?: {
    cumulativePnL?: number;
    winRate?: number;
    maxDrawdown?: number;
    trades?: number;
    sharpeEstimate?: number;
  };
}

interface BusEvent {
  id?: string;
  ts?: number;
  type: string;
  source?: string;
  payload?: any;
}

export default function QuantXLiveView() {
  const state = useDashboardStore((s) => s) as any;
  const s: QxLiveState | undefined = state.qxlive;
  const events: BusEvent[] = state.qxlEvents || [];

  const pnlColor = (v: number | null | undefined): string =>
    v == null ? 'var(--text-muted)'
    : v >= 0 ? 'var(--accent-green)'
    : 'var(--accent-red)';

  const statusDot = (status: string) => {
    const color =
      status === 'running' ? 'var(--accent-green)' :
      status === 'starting' ? 'var(--accent-yellow)' :
      status === 'offline' ? 'var(--text-muted)' : 'var(--accent-blue)';
    return (
      <span style={{
        display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
        background: color, marginRight: 6, flexShrink: 0,
      }} />
    );
  };

  if (!s) {
    return (
      <MissionTabFrame
        number={6}
        title="QX Live"
        subtitle="Real-time terminal + hypothesis feed"
        indicators={[
          { label: 'State Feed', value: 'Polling', detail: 'shared/state/state.json every 2s', status: 'warn' },
          { label: 'Bus Stream', value: `${events.length}`, detail: 'Recent events buffered in app state', status: events.length > 0 ? 'ok' : 'info' },
        ]}
        notes={[
          'Primary data path is the Mission Control state payload plus qxl bus events mirrored into `state.qxlEvents`.',
          'This view stays useful before the live feed arrives by surfacing polling behavior instead of a blank placeholder.',
        ]}
      >
        <div className="panel" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Waiting for quant-x-live data…
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 6, fontFamily: 'var(--font-mono)' }}>
            Polling shared/state/state.json every 2s
          </div>
        </div>
      </MissionTabFrame>
    );
  }

  const terminals = [
    { key: 'terminalA', label: 'Terminal A', icon: '🔬' },
    { key: 'terminalB', label: 'Terminal B', icon: '🧠' },
    { key: 'missionControl', label: 'Mission Control', icon: '🎛️' },
  ];

  const hypotheses = Object.entries(s.hypotheses || {});

  const tvSignals = events
    .filter(e => e.type === 'tradingview.signal')
    .slice(0, 20);

  const pineReady: Record<string, any> = {};
  events
    .filter(e => e.type === 'pine.script_ready' && e.payload?.hypothesisId)
    .forEach(e => { pineReady[e.payload.hypothesisId] = e.payload; });

  return (
    <MissionTabFrame
      number={6}
      title="QX Live"
      subtitle="Real-time terminal + hypothesis feed"
      indicators={[
        { label: 'Supervisor', value: s.missionControl?.status || 'unknown', detail: s.missionControl?.mode || 'mode unavailable', status: s.missionControl?.status === 'running' ? 'ok' : 'warn' },
        { label: 'Hypotheses', value: `${hypotheses.length}`, detail: 'Active research/paper candidates', status: hypotheses.length > 0 ? 'info' : 'neutral' },
        { label: 'TV Signals', value: `${tvSignals.length}`, detail: 'Webhook-derived signal events', status: tvSignals.length > 0 ? 'ok' : 'neutral' },
        { label: 'Bus Events', value: `${events.length}`, detail: 'Recent activity mirrored from bus.jsonl', status: events.length > 0 ? 'info' : 'neutral' },
      ]}
      notes={[
        'Render source is `state.qxlive` plus `state.qxlEvents`; the page does not fetch its own payload so WebSocket/state wiring stays authoritative.',
        'TradingView readiness is inferred from `tradingview.signal` bus events and Pine compatibility flags per hypothesis.',
        'Terminal cards intentionally expose role, mode, and awaiting text so operator decisions can happen without opening logs.',
      ]}
    >
      <div className="view-header" style={{ marginBottom: 0 }}>
        <div></div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{
            padding: '4px 12px',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: s.deployment?.mode === 'PAPER_ONLY' ? 'var(--accent-yellow)' : 'var(--accent-green)',
          }}>
            {s.deployment?.mode || 'UNKNOWN'}
          </div>
          <div style={{
            padding: '4px 12px',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-secondary)',
          }}>
            v{s.v} · {s.ts ? new Date(s.ts).toLocaleTimeString() : '—'}
          </div>
        </div>
      </div>

      {s.market && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          {([
            { label: 'Regime', val: s.market.regime, mono: false },
            { label: 'HMM State', val: s.market.hmmState, mono: true },
            { label: 'VIX', val: s.market.vix, mono: true },
            { label: 'SPY', val: s.market.spy, mono: true },
            { label: 'Volatility', val: s.market.volatility, mono: false },
            { label: 'Source', val: s.market.source, mono: true },
          ]).map(({ label, val, mono }) => (
            <div key={label} style={{
              padding: '8px 14px',
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              minWidth: 80,
            }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: mono ? 'var(--font-mono)' : 'inherit' }}>
                {val ?? '—'}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        {terminals.map(({ key, label, icon }) => {
          const t = (s as any)[key] || {};
          return (
            <div key={key} className="panel" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>{icon}</span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                {statusDot(t.status)}
                <span style={{ fontSize: 12, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{t.status || 'unknown'}</span>
              </div>
              {t.role && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{t.role}</div>
              )}
              {t.mode && (
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)' }}>mode: {t.mode}</div>
              )}
              {t.awaiting && (
                <div style={{ fontSize: 11, color: 'var(--accent-yellow)', marginTop: 4 }}>
                  Awaiting: {t.awaiting}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
          Active Hypotheses
        </div>
        {hypotheses.length === 0 ? (
          <div className="panel" style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No active hypotheses
          </div>
        ) : hypotheses.map(([id, h]) => {
          const results = h.paperTradingResults || h;
          const pnl = results.cumulativePnL ?? h.cumulativePnL;
          const winRate = results.winRate ?? h.winRate;
          const dd = results.maxDrawdown ?? h.maxDrawdown;
          const trades = results.trades ?? h.trades;
          const scaleUp = h.scaleUpRecommendation;
          const pine = pineReady[id];
          const isTVSource = ['forex', 'futures', 'crypto'].includes(h.assetClass || '');

          return (
            <div key={id} className="panel" style={{ padding: 16, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {id.toUpperCase()} — {h.title}
                  </div>
                  {h.version && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>version {h.version}</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 12 }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 4, fontSize: 11,
                    background: 'var(--bg-root)', border: '1px solid var(--border-subtle)',
                    color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)',
                  }}>
                    {h.phase}
                  </span>
                  <span style={{
                    padding: '2px 8px', borderRadius: 4, fontSize: 11,
                    background: 'var(--bg-root)', border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                  }}>
                    {h.status}
                  </span>
                  {isTVSource && (
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 11,
                      background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)',
                      color: 'var(--accent-blue)',
                    }}>
                      TV
                    </span>
                  )}
                  {pine ? (
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 11,
                      background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)',
                      color: 'var(--accent-green)',
                    }} title={pine.pineFile}>
                      Pine ✓
                    </span>
                  ) : h.pineScriptCompatible === false ? (
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 11,
                      background: 'var(--bg-root)', border: '1px solid var(--border-subtle)',
                      color: 'var(--text-muted)',
                    }}>
                      No Pine
                    </span>
                  ) : null}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                {([
                  { label: 'Win Rate', val: winRate != null ? `${(winRate * 100).toFixed(0)}%` : '—' },
                  { label: 'P&L', val: pnl != null ? `$${pnl.toLocaleString()}` : '—', color: pnlColor(pnl) },
                  { label: 'Drawdown', val: dd != null ? `${(dd * 100).toFixed(1)}%` : '—' },
                  { label: 'Trades', val: trades != null ? trades : '—' },
                  ...(h.profitFactor ? [{ label: 'Prof. Factor', val: String(h.profitFactor) }] : []),
                  ...((results as any).sharpeEstimate ? [{ label: 'Sharpe', val: String((results as any).sharpeEstimate) }] : []),
                ]).map(({ label, val, color }) => (
                  <div key={label}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: color || 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{val}</div>
                  </div>
                ))}
              </div>

              {scaleUp && scaleUp.status === 'PENDING_APPROVAL' && (
                <div style={{
                  marginTop: 10, padding: '8px 12px',
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 12, color: 'var(--accent-yellow)',
                }}>
                  Scale-up pending: {scaleUp.currentPositionSize} → {scaleUp.recommendedPositionSize}
                </div>
              )}

              {h.recommendation && (
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                  Recommendation: <span style={{ color: 'var(--text-secondary)' }}>{h.recommendation}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {s.workflow && (
        <div className="panel" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
            Workflow
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 12 }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Phase: </span>
              <span style={{ color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)' }}>{s.workflow.currentPhase || '—'}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Paused: </span>
              <span style={{ color: s.workflow.paused ? 'var(--accent-yellow)' : 'var(--accent-green)' }}>
                {s.workflow.paused ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
          {s.workflow.nextAction && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
              Next: {s.workflow.nextAction}
            </div>
          )}
        </div>
      )}

      <div className="panel" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
          TradingView Signals {tvSignals.length > 0 && <span style={{ color: 'var(--accent-blue)' }}>({tvSignals.length})</span>}
        </div>
        {tvSignals.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: '14px 0' }}>
            No signals yet — POST to <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)' }}>/api/tradingview/webhook</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {tvSignals.map((e, i) => {
              const sig = e.payload || {};
              const actionColor =
                sig.action === 'buy' ? 'var(--accent-green)' :
                sig.action === 'sell' ? 'var(--accent-red)' :
                sig.action === 'close_long' ? 'var(--accent-yellow)' :
                sig.action === 'close_short' ? 'var(--accent-yellow)' :
                'var(--text-secondary)';
              return (
                <div key={sig.id || i} style={{
                  display: 'flex', gap: 10, alignItems: 'center',
                  padding: '6px 8px',
                  background: 'var(--bg-root)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 12, fontFamily: 'var(--font-mono)',
                }}>
                  <span style={{ color: 'var(--text-muted)', flexShrink: 0, width: 64 }}>
                    {sig.receivedAt ? new Date(sig.receivedAt).toLocaleTimeString('en-US', { hour12: false }) : '—'}
                  </span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)', minWidth: 70 }}>{sig.symbol || '—'}</span>
                  <span style={{ fontWeight: 600, color: actionColor, minWidth: 80, textTransform: 'uppercase' }}>{sig.action || '—'}</span>
                  <span style={{ color: 'var(--text-secondary)', minWidth: 60 }}>{sig.price != null ? `$${sig.price}` : ''}</span>
                  <span style={{ color: 'var(--accent-blue)', fontSize: 11 }}>{sig.assetClass || ''}</span>
                  {sig.strategy && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{sig.strategy}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="panel" style={{ padding: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
          Bus Events {events.length > 0 && <span style={{ color: 'var(--accent-blue)' }}>({events.length})</span>}
        </div>
        {events.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
            No events yet — events appear as terminals write to bus.jsonl
          </div>
        ) : (
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {events.slice(0, 60).map((e, i) => (
              <div key={e.id || i} style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                padding: '4px 0',
                borderBottom: '1px solid var(--border-subtle)',
                fontSize: 11, fontFamily: 'var(--font-mono)',
              }}>
                <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                  {e.ts ? new Date(e.ts).toLocaleTimeString('en-US', { hour12: false }) : '—'}
                </span>
                <span style={{ color: 'var(--accent-blue)', flexShrink: 0 }}>[{e.type}]</span>
                <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>{e.source}</span>
                <span style={{ color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                  {e.payload
                    ? (e.payload.hypothesis || e.payload.decision || e.payload.title || JSON.stringify(e.payload).slice(0, 100))
                    : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </MissionTabFrame>
  );
}