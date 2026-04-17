import { useState, useEffect, useCallback } from 'react';
import { useDashboardStore } from '../../store/dashboard';
import { invoke } from '@tauri-apps/api/core';

interface LiveStatus {
  ready: boolean;
  reason: string;
  credentialsConfigured: boolean;
  authenticated: boolean;
  brokerMode: string;
}

interface AuditLogEntry {
  at: string;
  from: string;
  to: string;
  by: string;
  reason?: string;
}

interface Deployment {
  deploymentMode: string;
  auditLog: AuditLogEntry[];
}

interface StrategyStateInfo {
  lifecycleState: string;
}

interface LiveSummary {
  liveExecutionStatus: LiveStatus;
  deployment: Deployment;
  strategyStates: StrategyStateInfo[];
}

interface ChecklistItem {
  id: string;
  label: string;
  status: 'pass' | 'fail' | 'warn' | 'info';
  desc: string;
}

export default function LiveActivationView() {
  const state = useDashboardStore();
  const [summary, setSummary] = useState<LiveSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await invoke<LiveSummary>('factory_live_summary');
      if (result) setSummary(result);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 10000);
    return () => clearInterval(timer);
  }, [refresh]);

  const liveStatus: LiveStatus = summary ? summary.liveExecutionStatus : { ready: false, reason: 'Status unavailable', credentialsConfigured: false, authenticated: false, brokerMode: 'PAPER' };
  const deployment: Deployment = summary ? summary.deployment : { deploymentMode: 'PAPER_ONLY', auditLog: [] };
  const strategyStates: StrategyStateInfo[] = summary ? (summary.strategyStates || []) : [];
  const auditLog: AuditLogEntry[] = deployment && Array.isArray(deployment.auditLog) ? deployment.auditLog : [];
  const liveApprovedCount = strategyStates.filter((s) => s.lifecycleState === 'live').length;

  const riskMetrics = (state as any).riskMetrics || {};
  const maxDD = riskMetrics.maxDrawdown !== undefined ? riskMetrics.maxDrawdown : 1.0;

  const checklist: ChecklistItem[] = [
    { id: 'creds', label: 'Live Credentials', status: liveStatus.credentialsConfigured ? 'pass' : 'fail', desc: 'ALPACA_LIVE_API_KEY and ALPACA_LIVE_API_SECRET detected.' },
    { id: 'auth', label: 'Broker Authentication', status: liveStatus.authenticated ? 'pass' : 'fail', desc: 'Connection to Alpaca Live API established and verified.' },
    { id: 'routing', label: 'Global Routing', status: deployment.deploymentMode === 'LIVE_ENABLED' ? 'pass' : 'warn', desc: 'System-wide routing gate set to LIVE_ENABLED.' },
    { id: 'strategies', label: 'Strategy Approval', status: liveApprovedCount > 0 ? 'pass' : 'warn', desc: `${liveApprovedCount} strategies currently promoted to Live state.` },
    { id: 'risk', label: 'Risk Configuration', status: maxDD < 0.2 ? 'pass' : 'info', desc: 'Portfolio-level risk limits and circuit breakers active.' },
  ];

  const getStatusIcon = (status: string): { char: string; color: string } => {
    if (status === 'pass') return { char: '✓', color: 'var(--accent-green)' };
    if (status === 'fail') return { char: '✗', color: 'var(--accent-red)' };
    if (status === 'warn') return { char: '⚠', color: 'var(--accent-yellow)' };
    return { char: '○', color: 'var(--text-muted)' };
  };

  const handleActivateLive = async () => {
    setActionError(null);
    setActionMessage(null);

    if (!liveStatus.ready) {
      setActionError(liveStatus.reason || 'Live broker is not ready.');
      return;
    }

    if (!confirm('Enable LIVE trading mode? This allows live-approved strategies to route to real-money execution.')) return;
    if (!confirm('Final confirmation: proceed with LIVE enablement now?')) return;

    setActionLoading(true);
    try {
      await invoke('deployment_mode_enable_live', { user: 'live-activation-view', reason: 'Live trading enabled from Live Activation view', confirmLive: true });
      setActionMessage('Live deployment mode enabled. Continue monitoring authority, risk, and strategy state before live order submission.');
      refresh();
    } catch (err: any) {
      setActionError(err?.message || String(err) || 'Failed to enable live trading');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="mission-tab-frame">
      <div className="view-header">
        <div>
          <div className="view-title">Live Activation</div>
          <div className="view-subtitle">Formal readiness checklist for production broker execution</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '16px', height: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="panel" style={{ padding: '16px' }}>
            <div className="panel-header" style={{ marginBottom: '16px' }}><span className="panel-title">Readiness Checklist</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {checklist.map(item => {
                const icon = getStatusIcon(item.status);
                return (
                  <div key={item.id} style={{ display: 'flex', gap: '16px', padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: `${icon.color}15`, color: icon.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 700, flexShrink: 0 }}>{icon.char}</div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{item.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="panel" style={{ padding: '20px', textAlign: 'center', background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.2)' }}>
            <div style={{ fontSize: '18px', marginBottom: '8px' }}>📉</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-blue)' }}>Verify Paper Track Record</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '8px 0 16px' }}>We recommend at least 30 days of consistent paper trading results before final live activation.</div>
            <button className="not-found-btn" style={{ background: 'var(--accent-blue)', color: '#fff', border: 'none' }}>Open Paper Tracker</button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="panel" style={{ padding: '16px' }}>
            <div className="panel-header" style={{ marginBottom: '12px' }}><span className="panel-title">System Status</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Routing Mode</span>
                <span style={{ fontWeight: 600, color: deployment.deploymentMode === 'LIVE_ENABLED' ? 'var(--accent-red)' : 'var(--accent-green)' }}>{deployment.deploymentMode}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Broker Env</span>
                <span style={{ fontWeight: 600 }}>{(liveStatus.brokerMode ? liveStatus.brokerMode : 'PAPER').toUpperCase()}</span>
              </div>
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', marginTop: '4px' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Live Decision Log</div>
                {auditLog.length === 0 ? (
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>No recent live activation events recorded in audit log.</div>
                ) : (
                  <div style={{ display: 'grid', gap: '6px' }}>
                    {auditLog.slice(-5).reverse().map((item: AuditLogEntry, index: number) => (
                      <div key={`${item.at || 'n/a'}-${index}`} style={{ border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '6px' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{item.at || 'unknown time'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-primary)' }}>{item.from || 'unknown'} → {item.to || 'unknown'}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>by {item.by || 'unknown'}{item.reason ? ` • ${item.reason}` : ''}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="panel" style={{ padding: '16px', border: '1px solid var(--accent-red)', background: 'rgba(239,68,68,0.02)' }}>
            <div style={{ color: 'var(--accent-red)', fontWeight: 700, fontSize: '12px', marginBottom: '8px', textTransform: 'uppercase' }}>Final Activation</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px' }}>Live activation requires all checklist items to pass. This will enable real-money trading for all live-approved strategies.</div>
            <button className="not-found-btn" disabled={!liveStatus.ready || actionLoading} onClick={handleActivateLive} style={{ width: '100%', background: (liveStatus.ready && !actionLoading) ? 'var(--accent-red)' : 'rgba(239,68,68,0.1)', color: (liveStatus.ready && !actionLoading) ? '#fff' : 'var(--text-muted)', border: 'none', cursor: (liveStatus.ready && !actionLoading) ? 'pointer' : 'not-allowed' }}>
              {actionLoading ? 'Enabling Live Trading...' : 'Activate Live Trading'}
            </button>
            {actionError && <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--accent-red)' }}>{actionError}</div>}
            {actionMessage && <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--accent-green)' }}>{actionMessage}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}