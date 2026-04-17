import { useState, useEffect, useCallback } from 'react';
import { useDashboardStore } from '../../store/dashboard';
import { invoke } from '@tauri-apps/api/core';

interface StrategyState {
  id: string;
  symbol: string;
  type: string;
  lifecycleState: string;
  route?: { route: string; reason: string };
}

interface LiveSummary {
  orders: any[];
  positions: any[];
  portfolio: { totalValue?: number; buyingPower?: number };
  strategyStates: StrategyState[];
  deployment: { deploymentMode: string } | null;
  liveExecutionAvailable: boolean;
  liveExecutionStatus: {
    ready: boolean;
    reason?: string;
    credentialsConfigured?: boolean;
  };
}

interface Ticket {
  strategyId: string | null;
  symbol: string;
  side: string;
  quantity: number | string;
  price: string;
}

export default function FactoryExecutionPanel() {
  const state = useDashboardStore() as any;
  const dispatch = useDashboardStore.setState;
  const generatedStrategy = state.generatedStrategy || (state.factoryResults || [])[0] || null;

  const [summary, setSummary] = useState<LiveSummary>({
    orders: [],
    positions: [],
    portfolio: {},
    strategyStates: [],
    deployment: null,
    liveExecutionAvailable: false,
    liveExecutionStatus: { ready: false, reason: 'Live execution status unavailable' },
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<Ticket>({
    strategyId: null,
    symbol: generatedStrategy?.primarySymbol || 'SPY',
    side: 'buy',
    quantity: 1,
    price: '',
  });

  const refresh = useCallback(async () => {
    try {
      const result = await invoke('factory_live_summary') as any;
      setSummary({
        orders: result.orders || [],
        positions: result.positions || [],
        portfolio: result.portfolio || {},
        strategyStates: result.strategyStates || [],
        deployment: result.deployment || null,
        liveExecutionAvailable: result.liveExecutionAvailable ?? false,
        liveExecutionStatus: result.liveExecutionStatus || { ready: false, reason: 'Live execution status unavailable' },
      });
      setError(null);
      if (!ticket.strategyId) {
        const preferredId = generatedStrategy?.id || null;
        const firstStrategyId = result.strategyStates?.[0]?.id || null;
        const preferred = preferredId || firstStrategyId;
        const strategySymbol = generatedStrategy?.primarySymbol || 'SPY';
        setTicket(prev => ({
          ...prev,
          strategyId: prev.strategyId || preferred,
          symbol: prev.symbol || strategySymbol,
        }));
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load live summary');
    } finally {
      setLoading(false);
    }
  }, [generatedStrategy, ticket.strategyId]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (generatedStrategy?.id) {
      setTicket(prev => ({
        ...prev,
        strategyId: prev.strategyId || generatedStrategy.id,
        symbol: generatedStrategy.primarySymbol || prev.symbol,
      }));
    }
  }, [generatedStrategy]);

  const setStatus = (message: string, status = 'updated', stage = 'execution') => {
    dispatch({ factoryStatus: { stage, status, message } } as any);
  };

  const postJson = async (url: string, body: any) => {
    const result = await invoke(url.replace(/\//g, '_').replace(/^_/, '')) as any;
    if (!result?.ok) throw new Error(result?.error || 'Request failed');
    return result;
  };

  const enableLive = async () => {
    if (!window.confirm('Enable LIVE routing? Live-approved strategies may route to real-money execution.')) return;
    if (!window.confirm('Final confirmation: enable live routing now?')) return;
    try {
      const result = await invoke('factory_deployment_enable_live', {
        user: 'factory-ui',
        reason: 'Factory enable live',
        confirmLive: true,
      }) as any;
      setStatus(`Deployment mode switched to ${result?.policy?.deploymentMode || 'LIVE'}`, 'updated', 'deployment');
      refresh();
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  };

  const forcePaper = async () => {
    try {
      const result = await invoke('factory_deployment_force_paper', {
        reason: 'Factory forced paper-only',
      }) as any;
      setStatus(`Deployment mode switched to ${result?.policy?.deploymentMode || 'PAPER_ONLY'}`, 'updated', 'deployment');
      refresh();
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  };

  const promote = async (target: string) => {
    if (!ticket.strategyId) {
      setError('Select or generate a strategy first.');
      return;
    }
    if (target === 'live') {
      if (!window.confirm('Promote strategy to LIVE state?')) return;
      if (!window.confirm('Final confirmation: this marks the strategy eligible for real-money routing when live mode is enabled.')) return;
    }
    try {
      const result = await invoke('factory_strategy_promote', {
        strategyId: ticket.strategyId,
        target,
        user: 'factory-ui',
        reason: `Factory promote to ${target}`,
      }) as any;
      setStatus(`Strategy promoted to ${result?.lifecycle?.state || target}`, 'updated', 'approval');
      refresh();
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  };

  const demote = async () => {
    if (!ticket.strategyId) {
      setError('Select or generate a strategy first.');
      return;
    }
    try {
      const result = await invoke('factory_strategy_demote', {
        strategyId: ticket.strategyId,
        reason: 'Factory demotion',
      }) as any;
      setStatus(`Strategy demoted to ${result?.lifecycle?.state || 'paper'}`, 'updated', 'approval');
      refresh();
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  };

  const submitOrder = async () => {
    if (!ticket.strategyId) {
      setError('Select or generate a strategy first.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await invoke('factory_execution_order', {
        strategyId: ticket.strategyId,
        symbol: ticket.symbol,
        side: ticket.side,
        quantity: Number(ticket.quantity),
        price: ticket.price ? Number(ticket.price) : undefined,
      }) as any;
      const orderStatus = result?.result?.status || 'submitted';
      setStatus(`Submitted ${(result?.executionMode || 'paper').toUpperCase()} ${ticket.side.toUpperCase()} order for ${ticket.symbol}`, orderStatus, 'execution');
      refresh();
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const cancelOrder = async (order: any) => {
    try {
      const result = await invoke('factory_orders_cancel', {
        orderId: order.id,
        reason: 'factory_manual_cancel',
        executionMode: order.executionMode || 'paper',
      }) as any;
      setStatus(result?.message || 'Order cancelled', 'updated', 'execution');
      refresh();
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  };

  const closePosition = async (position: any) => {
    try {
      const result = await invoke('factory_positions_close', {
        symbol: position.symbol,
        strategyId: position.strategyId || ticket.strategyId,
        executionMode: position.executionMode || 'paper',
        reason: 'factory_manual_close',
      }) as any;
      setStatus(result?.message || 'Position closed', 'updated', 'execution');
      refresh();
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  };

  const guardedGoLiveSubmit = async () => {
    if (!ticket.strategyId) {
      setError('Select or generate a strategy first.');
      return;
    }
    if (!summary.liveExecutionStatus.ready) {
      setError(summary.liveExecutionStatus.reason || 'Live execution is not available.');
      return;
    }
    if (!window.confirm('Run guarded LIVE flow (enable routing, promote strategy, submit live order)?')) return;
    if (!window.confirm('Final confirmation: this can place a real-money order. Proceed?')) return;

    setSubmitting(true);
    try {
      await invoke('factory_deployment_enable_live', {
        user: 'factory-ui',
        reason: 'Factory guarded live flow',
        confirmLive: true,
      });
      await invoke('factory_strategy_promote', {
        strategyId: ticket.strategyId,
        target: 'live',
        user: 'factory-ui',
        reason: 'Factory guarded live flow',
      });
      const result = await invoke('factory_execution_order', {
        strategyId: ticket.strategyId,
        symbol: ticket.symbol,
        side: ticket.side,
        quantity: Number(ticket.quantity),
        price: ticket.price ? Number(ticket.price) : undefined,
      }) as any;
      const orderStatus = result?.result?.status || 'submitted';
      setStatus(`Guarded flow submitted ${(result?.executionMode || 'paper').toUpperCase()} ${ticket.side.toUpperCase()} order for ${ticket.symbol}`, orderStatus, 'execution');
      refresh();
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const orders = summary.orders || [];
  const positions = summary.positions || [];
  const portfolio = summary.portfolio || {};
  const deployment = summary.deployment;
  const strategyStates = summary.strategyStates || [];
  const liveStatus = summary.liveExecutionStatus;
  const activeStrategyState = strategyStates.find(item => item.id === ticket.strategyId) || strategyStates[0] || null;

  const operatingMessage = liveStatus.ready
    ? 'Paper trading ready. Live trading authenticated and available.'
    : liveStatus.credentialsConfigured
      ? `Paper trading ready. Live trading blocked: ${liveStatus.reason}`
      : 'Paper trading ready. Live trading unavailable until ALPACA_LIVE_API_KEY and ALPACA_LIVE_API_SECRET are configured.';

  const cards = [
    { label: 'Deployment', value: deployment?.deploymentMode || 'PAPER_ONLY' },
    { label: 'Live Broker', value: summary.liveExecutionAvailable ? 'AVAILABLE' : 'UNAVAILABLE' },
    { label: 'Total Value', value: `$${Number(portfolio.totalValue || 0).toFixed(2)}` },
    { label: 'Buying Power', value: `$${Number(portfolio.buyingPower || 0).toFixed(2)}` },
  ];

  return (
    <div className="factory-execution-panel" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px' }}>
        {cards.map(card => (
          <div key={card.label} style={{ padding: '8px', border: '1px solid #374151', borderRadius: '4px', background: '#111827' }}>
            <div style={{ fontSize: '9px', color: '#9CA3AF', textTransform: 'uppercase' }}>{card.label}</div>
            <div style={{ fontSize: '12px', color: '#E5E7EB', fontFamily: 'var(--font-mono)' }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div style={{
        border: `1px solid ${liveStatus.ready ? '#065F46' : '#92400E'}`,
        background: liveStatus.ready ? '#052E2B' : '#1F1708',
        color: liveStatus.ready ? '#6EE7B7' : '#FCD34D',
        borderRadius: '6px',
        padding: '10px',
        fontSize: '11px',
      }}>
        {operatingMessage}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '10px' }}>
        <div style={{ border: '1px solid #374151', borderRadius: '6px', background: '#111827', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '10px', color: '#9CA3AF', textTransform: 'uppercase' }}>Strategy Approval</div>
          <div style={{ fontSize: '11px', color: liveStatus.ready ? '#34D399' : '#FBBF24' }}>
            Live readiness: {liveStatus.ready ? 'READY' : 'BLOCKED'}{liveStatus.reason ? ` • ${liveStatus.reason}` : ''}
          </div>
          <select
            className="factory-select"
            value={ticket.strategyId || ''}
            onChange={e => {
              const selected = strategyStates.find(item => item.id === e.target.value);
              const preferredSym = generatedStrategy?.primarySymbol || 'SPY';
              setTicket(prev => ({
                ...prev,
                strategyId: e.target.value || null,
                symbol: selected ? selected.symbol : (preferredSym || prev.symbol),
              }));
            }}
          >
            <option value="">Select strategy</option>
            {strategyStates.map(item => (
              <option key={item.id} value={item.id}>{item.symbol} • {item.type} • {item.lifecycleState}</option>
            ))}
          </select>
          <div style={{ fontSize: '11px', color: '#E5E7EB' }}>
            {activeStrategyState
              ? `Lifecycle: ${activeStrategyState.lifecycleState} • Route: ${activeStrategyState.route?.route || 'paper'} (${activeStrategyState.route?.reason || 'default'})`
              : 'No strategy lifecycle state yet'}
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button className="factory-btn factory-btn-sm" onClick={() => promote('paper')}>Promote Paper</button>
            <button className="factory-btn factory-btn-sm" onClick={() => promote('live')}>Promote Live</button>
            <button className="factory-btn factory-btn-sm" onClick={demote}>Demote</button>
            <button className="factory-btn factory-btn-sm" onClick={enableLive} disabled={!liveStatus.ready}>Enable Live Routing</button>
            <button className="factory-btn factory-btn-sm factory-btn-danger" onClick={forcePaper}>Force Paper Only</button>
          </div>
        </div>

        <div style={{ border: '1px solid #374151', borderRadius: '6px', background: '#111827', padding: '10px', display: 'grid', gap: '8px' }}>
          <div style={{ fontSize: '10px', color: '#9CA3AF', textTransform: 'uppercase' }}>Execution Ticket</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <input className="factory-input" type="text" value={ticket.symbol} onChange={e => setTicket(prev => ({ ...prev, symbol: e.target.value.toUpperCase() }))} placeholder="Symbol" />
            <select className="factory-select" value={ticket.side} onChange={e => setTicket(prev => ({ ...prev, side: e.target.value }))}>
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
            <input className="factory-input" type="number" min="1" value={ticket.quantity} onChange={e => setTicket(prev => ({ ...prev, quantity: e.target.value }))} placeholder="Quantity" />
            <input className="factory-input" type="number" step="0.01" value={ticket.price} onChange={e => setTicket(prev => ({ ...prev, price: e.target.value }))} placeholder="Optional price" />
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button className="factory-btn factory-btn-primary" onClick={submitOrder} disabled={submitting || !ticket.strategyId}>
              {submitting ? 'Submitting...' : 'Submit Routed Order'}
            </button>
            <button className="factory-btn" onClick={guardedGoLiveSubmit} disabled={submitting || !ticket.strategyId || !liveStatus.ready}>
              Promote + Route + Submit Live
            </button>
          </div>
        </div>
      </div>

      {error && <div className="factory-error-banner">{error}</div>}

      <div style={{ border: '1px solid #374151', borderRadius: '6px', background: '#111827', overflow: 'hidden' }}>
        <div style={{ padding: '8px', borderBottom: '1px solid #374151', fontSize: '10px', color: '#9CA3AF', textTransform: 'uppercase' }}>Orders</div>
        {loading ? (
          <div style={{ padding: '12px', color: '#9CA3AF' }}>Loading orders...</div>
        ) : orders.length === 0 ? (
          <div style={{ padding: '12px', color: '#9CA3AF' }}>No orders yet.</div>
        ) : (
          orders.slice(0, 20).map(order => (
            <div key={`${order.executionMode || 'paper'}-${order.id}`} style={{ display: 'grid', gridTemplateColumns: '130px 70px 60px 70px 90px 80px 100px 90px', gap: '8px', padding: '8px', borderBottom: '1px solid #1F2937', fontSize: '11px', alignItems: 'center' }}>
              <div style={{ fontFamily: 'var(--font-mono)' }}>{order.id}</div>
              <div style={{ color: order.executionMode === 'live' ? '#F97316' : '#60A5FA' }}>{String(order.executionMode || 'paper').toUpperCase()}</div>
              <div>{order.symbol}</div>
              <div style={{ color: order.side === 'SELL' ? '#F87171' : '#34D399' }}>{order.side}</div>
              <div style={{ fontFamily: 'var(--font-mono)' }}>{String(order.quantity || order.qty || 0)}</div>
              <div style={{ fontFamily: 'var(--font-mono)' }}>{String(order.status || 'unknown').toUpperCase()}</div>
              <div style={{ color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>{new Date(order.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}</div>
              <div>{['filled', 'cancelled', 'rejected'].includes(String(order.status || '').toLowerCase()) ? '—' : (
                <button className="factory-btn factory-btn-sm factory-btn-danger" onClick={() => cancelOrder(order)}>Cancel</button>
              )}</div>
            </div>
          ))
        )}
      </div>

      <div style={{ border: '1px solid #374151', borderRadius: '6px', background: '#111827', overflow: 'hidden' }}>
        <div style={{ padding: '8px', borderBottom: '1px solid #374151', fontSize: '10px', color: '#9CA3AF', textTransform: 'uppercase' }}>Positions</div>
        {loading ? (
          <div style={{ padding: '12px', color: '#9CA3AF' }}>Loading positions...</div>
        ) : positions.length === 0 ? (
          <div style={{ padding: '12px', color: '#9CA3AF' }}>No open positions.</div>
        ) : (
          positions.slice(0, 20).map(position => (
            <div key={`${position.executionMode || 'paper'}-${position.symbol}`} style={{ display: 'grid', gridTemplateColumns: '70px 70px 70px 80px 80px 70px 90px', gap: '8px', padding: '8px', borderBottom: '1px solid #1F2937', fontSize: '11px', alignItems: 'center' }}>
              <div style={{ color: position.executionMode === 'live' ? '#F97316' : '#60A5FA' }}>{String(position.executionMode || 'paper').toUpperCase()}</div>
              <div style={{ fontFamily: 'var(--font-mono)' }}>{position.symbol}</div>
              <div style={{ fontFamily: 'var(--font-mono)' }}>{String(position.qty || position.quantity || 0)}</div>
              <div style={{ fontFamily: 'var(--font-mono)' }}>${Number(position.entryPrice || position.avgEntryPrice || position.avgPrice || 0).toFixed(2)}</div>
              <div style={{ fontFamily: 'var(--font-mono)', color: Number(position.pnl || position.unrealizedPl || 0) >= 0 ? '#34D399' : '#F87171' }}>
                {(Number(position.pnl || position.unrealizedPl || 0) >= 0 ? '+' : '')}{`$${Number(position.pnl || position.unrealizedPl || 0).toFixed(2)}`}
              </div>
              <div>{position.direction || position.side || 'LONG'}</div>
              <div><button className="factory-btn factory-btn-sm factory-btn-danger" onClick={() => closePosition(position)}>Close</button></div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}