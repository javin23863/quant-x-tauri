import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface TVStrategy {
  strategyId: string;
  symbol: string;
  timeframe: string;
  mode: string;
  propStatus: string;
  chartTarget?: string | null;
  sessionBias?: string | null;
  openDiscrepancies: number;
  pineSetupStatus?: string;
  discrepancies: Discrepancy[];
}

interface Discrepancy {
  id: string;
  type: string;
  expected: string;
  observed: string;
  severity: string;
  resolved: boolean;
  loggedAt?: string;
  strategyId: string;
  notes?: string;
}

interface SessionSummary {
  sessionLabel: string;
  closedAt?: string;
  totalMonitored: number;
  byMode?: { paper?: number; live?: number };
  byPropStatus?: { approved?: number; funded?: number };
  openCritical: number;
  openWarnings: number;
  auditNotes?: string;
}

export default function PropTVMonitorView() {
  const [strategies, setStrategies] = useState<TVStrategy[]>([]);
  const [summaries, setSummaries] = useState<SessionSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [registerForm, setRegisterForm] = useState<Record<string, string> | null>(null);
  const [discForm, setDiscForm] = useState<{ strategyId: string } | null>(null);
  const [sessionCloseModal, setSessionCloseModal] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  function loadStrategies() {
    invoke('tv_monitor_strategies')
      .then((d: unknown) => {
        const data = d as { ok?: boolean; strategies?: TVStrategy[] };
        if (data.ok) setStrategies(data.strategies || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  function loadSummaries() {
    invoke('tv_monitor_session_summaries', { limit: 10 })
      .then((d: unknown) => {
        const data = d as { ok?: boolean; summaries?: SessionSummary[] };
        if (data.ok) setSummaries(data.summaries || []);
      })
      .catch(() => {});
  }

  function loadDiscrepancies(strategyId: string) {
    invoke('tv_monitor_discrepancies', { strategyId })
      .then((d: unknown) => {
        const data = d as { ok?: boolean; discrepancies?: Discrepancy[] };
        if (data.ok) setDiscrepancies(data.discrepancies || []);
      })
      .catch(() => {});
  }

  useEffect(() => {
    loadStrategies();
    loadSummaries();
  }, []);

  useEffect(() => {
    if (selectedId) loadDiscrepancies(selectedId);
  }, [selectedId]);

  function showToast(msg: string, type: string = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = {
      strategyId: (form.elements.namedItem('strategyId') as HTMLInputElement).value.trim(),
      symbol: (form.elements.namedItem('symbol') as HTMLInputElement).value.trim(),
      timeframe: (form.elements.namedItem('timeframe') as HTMLInputElement).value.trim(),
      mode: (form.elements.namedItem('mode') as HTMLSelectElement).value,
      propStatus: (form.elements.namedItem('propStatus') as HTMLSelectElement).value,
      chartTarget: (form.elements.namedItem('chartTarget') as HTMLInputElement).value.trim() || null,
      notes: (form.elements.namedItem('notes') as HTMLInputElement).value.trim(),
    };
    try {
      const d = await invoke('tv_monitor_register', body) as { ok?: boolean; error?: string };
      if (d.ok) {
        showToast(`Strategy ${body.strategyId} registered`);
        setRegisterForm(null);
        loadStrategies();
      } else {
        showToast(d.error || 'Registration failed', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    }
  }

  async function handleUnregister(strategyId: string) {
    if (!window.confirm(`Remove ${strategyId} from monitoring?`)) return;
    try {
      const d = await invoke('tv_monitor_unregister', { strategyId }) as { ok?: boolean };
      if (d.ok) {
        showToast(`${strategyId} removed`);
        if (selectedId === strategyId) { setSelectedId(null); setDiscrepancies([]); }
        loadStrategies();
      }
    } catch {
      showToast('Network error', 'error');
    }
  }

  async function handleUpdateBias(strategyId: string, bias: string | null) {
    try {
      await invoke('tv_monitor_update_bias', { strategyId, sessionBias: bias });
      loadStrategies();
    } catch { /* ignore */ }
  }

  async function handleLogDiscrepancy(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!discForm) return;
    const form = e.currentTarget;
    const body = {
      strategyId: discForm.strategyId,
      type: (form.elements.namedItem('discType') as HTMLSelectElement).value,
      expected: (form.elements.namedItem('expected') as HTMLInputElement).value.trim(),
      observed: (form.elements.namedItem('observed') as HTMLInputElement).value.trim(),
      severity: (form.elements.namedItem('severity') as HTMLSelectElement).value,
      notes: (form.elements.namedItem('discNotes') as HTMLInputElement).value.trim(),
    };
    try {
      const d = await invoke('tv_monitor_log_discrepancy', body) as { ok?: boolean; error?: string };
      if (d.ok) {
        showToast('Discrepancy logged');
        setDiscForm(null);
        if (selectedId === discForm.strategyId) loadDiscrepancies(discForm.strategyId);
        loadStrategies();
      } else {
        showToast(d.error || 'Failed to log', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    }
  }

  async function handleResolveDiscrepancy(strategyId: string, discId: string) {
    try {
      const d = await invoke('tv_monitor_resolve_discrepancy', { strategyId, discId, resolvedBy: 'prop-desk' }) as { ok?: boolean };
      if (d.ok) {
        showToast('Discrepancy resolved');
        loadDiscrepancies(strategyId);
        loadStrategies();
      }
    } catch {
      showToast('Network error', 'error');
    }
  }

  async function handleSessionClose(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const auditNotes = (form.elements.namedItem('auditNotes') as HTMLTextAreaElement).value.trim();
    try {
      const d = await invoke('tv_monitor_session_close', { auditNotes, generatedBy: 'prop-desk' }) as { ok?: boolean; error?: string };
      if (d.ok) {
        showToast('Session summary saved');
        setSessionCloseModal(false);
        loadSummaries();
      } else {
        showToast(d.error || 'Failed', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    }
  }

  function modeBadge(mode: string) {
    const color = mode === 'live' ? '#10B981' : '#3B82F6';
    return (
      <span style={{ background: color, color: '#fff', borderRadius: '4px', padding: '2px 7px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>
        {mode.toUpperCase()}
      </span>
    );
  }

  function propStatusBadge(status: string) {
    const colors: Record<string, string> = { approved: '#10B981', funded: '#6366F1', pending: '#F59E0B', suspended: '#EF4444' };
    const color = colors[status] || '#6B7280';
    return (
      <span style={{ background: color + '20', color: color, border: `1px solid ${color}40`, borderRadius: '4px', padding: '2px 7px', fontSize: '11px', fontWeight: 600 }}>
        {status}
      </span>
    );
  }

  function severityBadge(sev: string) {
    const colors: Record<string, string> = { critical: '#EF4444', warning: '#F59E0B', info: '#3B82F6' };
    const color = colors[sev] || '#6B7280';
    return (
      <span style={{ background: color + '20', color: color, borderRadius: '4px', padding: '2px 6px', fontSize: '10px', fontWeight: 700 }}>
        {sev}
      </span>
    );
  }

  function handleConfirmSetup(strategyId: string) {
    invoke('tv_monitor_confirm_setup', { strategyId })
      .then((d: unknown) => { const data = d as { ok?: boolean }; if (data.ok) { showToast(`Alerts confirmed — comparator active for ${strategyId}`); loadStrategies(); } })
      .catch(() => showToast('Network error', 'error'));
  }

  function handleResendSetup(strategyId: string) {
    invoke('tv_monitor_resend_setup', { strategyId })
      .then(() => showToast('Setup instructions re-sent via Telegram'))
      .catch(() => showToast('Network error', 'error'));
  }

  function setupStatusBadge(status: string | undefined, strategyId: string) {
    if (status === 'confirmed') {
      return <span style={{ color: '#10B981', fontSize: '11px', fontWeight: 700 }}>✓ Active</span>;
    }
    if (status === 'sent') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ color: '#F59E0B', fontSize: '10px', fontWeight: 600 }}>Sent via Telegram</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => handleConfirmSetup(strategyId)}
              style={{ background: '#10B98120', color: '#10B981', border: '1px solid #10B98140', borderRadius: '3px', padding: '2px 6px', fontSize: '10px', cursor: 'pointer', fontWeight: 700 }}
            >Confirm</button>
            <button
              onClick={() => handleResendSetup(strategyId)}
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)', borderRadius: '3px', padding: '2px 6px', fontSize: '10px', cursor: 'pointer' }}
            >Resend</button>
          </div>
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ color: '#EF4444', fontSize: '10px', fontWeight: 600 }}>Pending setup</span>
        <button
          onClick={() => handleResendSetup(strategyId)}
          style={{ background: '#EF444420', color: '#EF4444', border: '1px solid #EF444440', borderRadius: '3px', padding: '2px 6px', fontSize: '10px', cursor: 'pointer', fontWeight: 600 }}
        >Send Setup</button>
      </div>
    );
  }

  function openTradingView(strategy: TVStrategy) {
    const target = strategy.chartTarget;
    if (!target) {
      showToast('No chart target set for this strategy', 'error');
      return;
    }
    const url = target.startsWith('http') ? target : `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(target)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  const totalOpen = strategies.reduce((n, s) => n + (s.openDiscrepancies || 0), 0);
  const totalCritical = strategies.reduce((n, s) => n + (s.discrepancies || []).filter(d => d.severity === 'critical' && !d.resolved).length, 0);

  return (
    <div style={{ padding: '0 0 40px 0' }}>
      {/* Header */}
      <div className="view-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div className="view-title">TradingView Monitor</div>
          <div className="view-subtitle">Prop Department — Visual oversight layer for approved strategies</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {totalCritical > 0 && (
            <span style={{ background: '#EF444420', color: '#EF4444', border: '1px solid #EF444440', borderRadius: '6px', padding: '4px 12px', fontSize: '12px', fontWeight: 700 }}>
              {totalCritical} CRITICAL
            </span>
          )}
          {totalOpen > 0 && (
            <span style={{ background: '#F59E0B20', color: '#F59E0B', border: '1px solid #F59E0B40', borderRadius: '6px', padding: '4px 12px', fontSize: '12px', fontWeight: 600 }}>
              {totalOpen} open flags
            </span>
          )}
          <button onClick={() => setSessionCloseModal(true)} style={{ background: '#6366F1', color: '#fff', border: 'none', borderRadius: '6px', padding: '7px 14px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
            Close Session
          </button>
          <button onClick={() => setRegisterForm({})} style={{ background: '#10B981', color: '#fff', border: 'none', borderRadius: '6px', padding: '7px 14px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
            + Register Strategy
          </button>
        </div>
      </div>

      {/* Architecture notice */}
      <div style={{ margin: '0 0 16px 0', padding: '10px 16px', background: '#1E293B', border: '1px solid #334155', borderRadius: '8px', fontSize: '11px', color: '#94A3B8', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <span style={{ color: '#64748B' }}>INFO</span>
        <span>TradingView is a <strong style={{ color: '#CBD5E1' }}>chart-state bridge and visual oversight layer only</strong>. It is not the canonical backtest engine, prop-rule source, or execution truth. Discrepancies logged here are for audit purposes.</span>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0' }}>
        {[
          { id: 'overview', label: 'Monitored Strategies' },
          { id: 'discrepancies', label: `Discrepancy Log${totalOpen > 0 ? ` (${totalOpen})` : ''}` },
          { id: 'sessions', label: 'Session Summaries' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 16px', fontSize: '13px', fontWeight: 600,
              color: tab === t.id ? 'var(--accent-blue)' : 'var(--text-secondary)',
              borderBottom: tab === t.id ? '2px solid var(--accent-blue)' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div>
          {loading && <div style={{ color: 'var(--text-muted)', padding: '24px' }}>Loading...</div>}
          {!loading && strategies.length === 0 && (
            <div className="panel" style={{ padding: '40px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>📺</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No strategies registered for monitoring.</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '8px' }}>Register a strategy once it is approved for paper or live oversight.</div>
            </div>
          )}
          {!loading && strategies.length > 0 && (
            <div className="panel" style={{ padding: '0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
                    {['Strategy', 'Symbol', 'TF', 'Mode', 'Prop Status', 'Session Bias', 'TV Setup', 'Flags', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {strategies.map((s, i) => (
                    <tr
                      key={s.strategyId}
                      style={{ borderBottom: '1px solid var(--border-subtle)', background: selectedId === s.strategyId ? 'var(--bg-hover)' : (i % 2 === 0 ? 'transparent' : 'var(--bg-secondary)'), cursor: 'pointer' }}
                      onClick={() => { setSelectedId(s.strategyId); setTab('discrepancies'); }}
                    >
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{s.strategyId}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>{s.symbol || '—'}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{s.timeframe || '—'}</td>
                      <td style={{ padding: '10px 14px' }}>{modeBadge(s.mode)}</td>
                      <td style={{ padding: '10px 14px' }}>{propStatusBadge(s.propStatus)}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <select
                          value={s.sessionBias || ''}
                          onClick={e => e.stopPropagation()}
                          onChange={e => { e.stopPropagation(); handleUpdateBias(s.strategyId, e.target.value || null); }}
                          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: '4px', padding: '3px 6px', fontSize: '12px', cursor: 'pointer' }}
                        >
                          <option value=''>— none —</option>
                          <option value='bullish'>Bullish</option>
                          <option value='bearish'>Bearish</option>
                          <option value='neutral'>Neutral</option>
                          <option value='range'>Range</option>
                        </select>
                      </td>
                      <td style={{ padding: '10px 14px' }} onClick={e => e.stopPropagation()}>
                        {setupStatusBadge(s.pineSetupStatus, s.strategyId)}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {s.openDiscrepancies > 0 ? (
                          <span style={{ background: '#EF444420', color: '#EF4444', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', fontWeight: 700 }}>
                            {s.openDiscrepancies} open
                          </span>
                        ) : (
                          <span style={{ color: '#10B981', fontSize: '11px' }}>Clean</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
                          <button title="Open in TradingView" onClick={() => openTradingView(s)} style={{ background: '#1D4ED820', color: '#3B82F6', border: '1px solid #3B82F640', borderRadius: '4px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}>TV</button>
                          <button title="Log discrepancy" onClick={() => { setDiscForm({ strategyId: s.strategyId }); setTab('discrepancies'); }} style={{ background: '#F59E0B20', color: '#F59E0B', border: '1px solid #F59E0B40', borderRadius: '4px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}>Flag</button>
                          <button title="Remove from monitoring" onClick={() => handleUnregister(s.strategyId)} style={{ background: '#EF444420', color: '#EF4444', border: '1px solid #EF444440', borderRadius: '4px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer' }}>✕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Discrepancy Log Tab */}
      {tab === 'discrepancies' && (
        <div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Filter by strategy:</span>
            <select
              value={selectedId || ''}
              onChange={e => setSelectedId(e.target.value || null)}
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: '4px', padding: '5px 10px', fontSize: '12px' }}
            >
              <option value=''>All strategies</option>
              {strategies.map(s => (
                <option key={s.strategyId} value={s.strategyId}>{s.strategyId} — {s.symbol} {s.timeframe}</option>
              ))}
            </select>
            <button onClick={() => setDiscForm({ strategyId: selectedId || (strategies[0] && strategies[0].strategyId) })} disabled={strategies.length === 0} style={{ background: '#F59E0B', color: '#000', border: 'none', borderRadius: '6px', padding: '5px 12px', fontSize: '12px', cursor: strategies.length === 0 ? 'not-allowed' : 'pointer', fontWeight: 700 }}>
              + Log Discrepancy
            </button>
          </div>

          {discForm && (
            <div className="panel" style={{ padding: '20px', marginBottom: '16px', borderLeft: '3px solid #F59E0B' }}>
              <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '12px', color: '#F59E0B' }}>Log Discrepancy — {discForm.strategyId}</div>
              <form onSubmit={handleLogDiscrepancy} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>Type</label>
                  <select name="discType" style={inputStyle}>
                    <option value="signal_missing">Signal Missing</option>
                    <option value="entry_mismatch">Entry Mismatch</option>
                    <option value="exit_mismatch">Exit Mismatch</option>
                    <option value="bias_conflict">Bias Conflict</option>
                    <option value="rule_breach">Rule Breach</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Severity</label>
                  <select name="severity" style={inputStyle}>
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
                    <option value="info">Info</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Expected (QX Live recorded)</label>
                  <input name="expected" required placeholder="e.g. Long entry at 4512.50 at 09:32" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Observed (TradingView chart)</label>
                  <input name="observed" required placeholder="e.g. No signal on chart at that time" style={inputStyle} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Notes</label>
                  <input name="discNotes" placeholder="Additional context..." style={inputStyle} />
                </div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '8px' }}>
                  <button type="submit" style={{ background: '#F59E0B', color: '#000', border: 'none', borderRadius: '6px', padding: '7px 16px', fontSize: '12px', cursor: 'pointer', fontWeight: 700 }}>Log</button>
                  <button type="button" onClick={() => setDiscForm(null)} style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '7px 16px', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                </div>
              </form>
            </div>
          )}

          <DiscrepancyListComponent
            strategies={strategies}
            selectedId={selectedId}
            discrepancies={discrepancies}
            onResolve={handleResolveDiscrepancy}
            onSelect={(id: string) => { setSelectedId(id); loadDiscrepancies(id); }}
            severityBadge={severityBadge}
          />
        </div>
      )}

      {/* Session Summaries Tab */}
      {tab === 'sessions' && (
        <div>
          {summaries.length === 0 && (
            <div className="panel" style={{ padding: '40px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>📋</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No session summaries yet.</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '8px' }}>Click "Close Session" to generate the first summary.</div>
            </div>
          )}
          {summaries.map(s => (
            <div key={s.sessionLabel} className="panel" style={{ padding: '16px 20px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{s.sessionLabel}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{s.closedAt ? new Date(s.closedAt).toLocaleString() : '—'}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {s.openCritical > 0 && <span style={{ background: '#EF444420', color: '#EF4444', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', fontWeight: 700 }}>{s.openCritical} critical</span>}
                  {s.openWarnings > 0 && <span style={{ background: '#F59E0B20', color: '#F59E0B', borderRadius: '4px', padding: '2px 8px', fontSize: '11px' }}>{s.openWarnings} warnings</span>}
                  {s.openCritical === 0 && s.openWarnings === 0 && <span style={{ color: '#10B981', fontSize: '11px', fontWeight: 600 }}>Clean</span>}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px', marginBottom: '12px' }}>
                {[
                  { label: 'Monitored', value: s.totalMonitored },
                  { label: 'Paper', value: s.byMode?.paper || 0 },
                  { label: 'Live', value: s.byMode?.live || 0 },
                  { label: 'Approved', value: s.byPropStatus?.approved || 0 },
                  { label: 'Funded', value: s.byPropStatus?.funded || 0 },
                ].map(stat => (
                  <div key={stat.label} style={{ background: 'var(--bg-secondary)', borderRadius: '6px', padding: '8px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>{stat.value}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{stat.label}</div>
                  </div>
                ))}
              </div>
              {s.auditNotes && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px' }}>{s.auditNotes}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Register Strategy Modal */}
      {registerForm !== null && (
        <Modal title="Register Strategy for Monitoring" onClose={() => setRegisterForm(null)}>
          <form onSubmit={handleRegister} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Strategy ID *</label>
              <input name="strategyId" required placeholder="e.g. strat_es_momentum_v3" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Symbol *</label>
              <input name="symbol" required placeholder="e.g. ES, NQ, EURUSD" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Timeframe *</label>
              <input name="timeframe" required placeholder="e.g. 5m, 1h" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Mode</label>
              <select name="mode" style={inputStyle}>
                <option value="paper">Paper</option>
                <option value="live">Live</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Prop Status</label>
              <select name="propStatus" style={inputStyle}>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="funded">Funded</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>TradingView Chart Target (URL or symbol key)</label>
              <input name="chartTarget" placeholder="e.g. CME_MINI:ES1! or https://www.tradingview.com/chart/..." style={inputStyle} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Notes</label>
              <input name="notes" placeholder="Prop desk notes..." style={inputStyle} />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setRegisterForm(null)} style={cancelBtnStyle}>Cancel</button>
              <button type="submit" style={submitBtnStyle}>Register</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Session Close Modal */}
      {sessionCloseModal && (
        <Modal title="Close Session & Generate Summary" onClose={() => setSessionCloseModal(false)}>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            This will snapshot all monitored strategies, open discrepancies, and prop status into a dated audit artifact.
          </p>
          <form onSubmit={handleSessionClose} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Audit Notes (optional)</label>
              <textarea name="auditNotes" rows={3} placeholder="Any session notes for the audit record..." style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setSessionCloseModal(false)} style={cancelBtnStyle}>Cancel</button>
              <button type="submit" style={{ ...submitBtnStyle, background: '#6366F1' }}>Generate Summary</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px',
          background: toast.type === 'error' ? '#EF4444' : '#10B981',
          color: '#fff', borderRadius: '8px', padding: '10px 18px',
          fontSize: '13px', fontWeight: 600, zIndex: 9999,
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function DiscrepancyListComponent({ strategies, selectedId, discrepancies, onResolve, onSelect, severityBadge }: {
  strategies: TVStrategy[];
  selectedId: string | null;
  discrepancies: Discrepancy[];
  onResolve: (strategyId: string, discId: string) => void;
  onSelect: (id: string) => void;
  severityBadge: (sev: string) => React.ReactNode;
}) {
  const show = selectedId
    ? discrepancies
    : strategies.flatMap(s => (s.discrepancies || []).map(d => ({ ...d, strategyId: s.strategyId })));

  if (show.length === 0) {
    return (
      <div className="panel" style={{ padding: '32px', textAlign: 'center' }}>
        <div style={{ color: '#10B981', fontSize: '14px', fontWeight: 600 }}>No discrepancies logged{selectedId ? ` for ${selectedId}` : ''}.</div>
        <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '6px' }}>All clear.</div>
      </div>
    );
  }

  return (
    <div className="panel" style={{ padding: '0', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead>
          <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
            {['Strategy', 'Type', 'Severity', 'Expected (QX Live)', 'Observed (TV Chart)', 'Logged', 'Status', ''].map(h => (
              <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {show.map(d => (
            <tr key={d.id} style={{ borderBottom: '1px solid var(--border-subtle)', background: d.resolved ? 'transparent' : (d.severity === 'critical' ? '#EF444408' : 'transparent'), opacity: d.resolved ? 0.55 : 1 }}>
              <td style={{ padding: '9px 12px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => onSelect(d.strategyId)}>{d.strategyId}</td>
              <td style={{ padding: '9px 12px', color: 'var(--text-primary)' }}>{d.type && d.type.replace(/_/g, ' ')}</td>
              <td style={{ padding: '9px 12px' }}>{severityBadge(d.severity)}</td>
              <td style={{ padding: '9px 12px', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.expected}>{d.expected}</td>
              <td style={{ padding: '9px 12px', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.observed}>{d.observed}</td>
              <td style={{ padding: '9px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{d.loggedAt ? new Date(d.loggedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
              <td style={{ padding: '9px 12px' }}>
                {d.resolved
                  ? <span style={{ color: '#10B981', fontSize: '11px' }}>Resolved</span>
                  : <span style={{ color: '#F59E0B', fontSize: '11px', fontWeight: 600 }}>Open</span>
                }
              </td>
              <td style={{ padding: '9px 12px' }}>
                {!d.resolved && (
                  <button onClick={() => onResolve(d.strategyId, d.id)} style={{ background: '#10B98120', color: '#10B981', border: '1px solid #10B98140', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', cursor: 'pointer' }}>
                    Resolve
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-subtle)',
  color: 'var(--text-primary)',
  borderRadius: '6px',
  padding: '7px 10px',
  fontSize: '13px',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-muted)',
  display: 'block',
  marginBottom: '4px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
};

const submitBtnStyle: React.CSSProperties = {
  background: '#10B981',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  padding: '8px 20px',
  fontSize: '13px',
  cursor: 'pointer',
  fontWeight: 700,
};

const cancelBtnStyle: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '6px',
  padding: '8px 16px',
  fontSize: '13px',
  cursor: 'pointer',
};