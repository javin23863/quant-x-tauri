import React, { useState, useEffect } from 'react';
import { useDashboardStore } from '../../store/dashboard';
import { invoke } from '@tauri-apps/api/core';

function ModeIndicator({ mode }: { mode: string }) {
  const isLive = mode === 'LIVE_ENABLED';
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 6, background: isLive ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)', border: `1px solid ${isLive ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}` }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: isLive ? 'var(--accent-red)' : 'var(--accent-green)', boxShadow: isLive ? '0 0 8px rgba(239,68,68,0.6)' : '0 0 8px rgba(16,185,129,0.6)' }} />
      <span style={{ fontWeight: 600, fontSize: 13, color: isLive ? 'var(--accent-red)' : 'var(--accent-green)' }}>{isLive ? 'LIVE_ENABLED' : 'PAPER_ONLY'}</span>
      {isLive && <span style={{ fontSize: 10, color: 'var(--accent-red)', marginLeft: 4 }}>⚠ LIVE</span>}
    </div>
  );
}

function ActionButtons({ mode, onForcePaper, onEnableLive, loading, disabled }: { mode: string; onForcePaper: () => void; onEnableLive: () => void; loading: boolean; disabled: boolean }) {
  const isPaper = mode === 'PAPER_ONLY';
  const isLive = mode === 'LIVE_ENABLED';

  return (
    <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
      <button onClick={onForcePaper} disabled={disabled || loading || isPaper} style={{ padding: '10px 20px', borderRadius: 6, border: isPaper ? '1px solid var(--accent-green)' : '1px solid var(--border-subtle)', background: isPaper ? 'rgba(16,185,129,0.1)' : 'var(--bg-panel-alt)', color: isPaper ? 'var(--accent-green)' : 'var(--text-secondary)', cursor: isPaper ? 'default' : 'pointer', fontWeight: 500, fontSize: 12, opacity: isPaper ? 0.7 : 1 }}>
        {isPaper ? '✓ System in Paper Mode' : 'Run Entire System in Paper'}
      </button>
      <button onClick={onEnableLive} disabled={disabled || loading || isLive} style={{ padding: '10px 20px', borderRadius: 6, border: isLive ? '1px solid var(--accent-red)' : '1px solid var(--border-subtle)', background: isLive ? 'rgba(239,68,68,0.15)' : 'var(--bg-panel-alt)', color: isLive ? 'var(--accent-red)' : 'var(--text-secondary)', cursor: isLive ? 'default' : 'pointer', fontWeight: 500, fontSize: 12, opacity: isLive ? 0.7 : 1 }}>
        {isLive ? '✓ Live Trading Enabled' : 'Enable Live Trading'}
      </button>
    </div>
  );
}

function AuditLogEntry({ entry, index }: { entry: any; index: number }) {
  const isLive = entry.to === 'LIVE_ENABLED';
  const isPaper = entry.to === 'PAPER_ONLY';
  const timestamp = new Date(entry.at).toLocaleString('en-US', { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div style={{ padding: '10px 12px', borderRadius: 6, background: 'var(--bg-panel-alt)', border: '1px solid var(--border-subtle)', marginBottom: 6, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', minWidth: 140 }}>{timestamp}</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 600, background: isPaper ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: isPaper ? 'var(--accent-green)' : 'var(--accent-red)' }}>{`${entry.from} → ${entry.to}`}</span>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{`by ${entry.by}`}</span>
        </div>
        {entry.reason && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{entry.reason}</div>}
      </div>
    </div>
  );
}

function LiveStrategiesSummary({ liveApproved }: { liveApproved: any[] }) {
  if (!liveApproved || liveApproved.length === 0) {
    return <div style={{ padding: '12px 16px', background: 'var(--bg-panel-alt)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No strategies are currently live-approved</div></div>;
  }

  return (
    <div style={{ padding: '12px 16px', background: 'var(--bg-panel-alt)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{`${liveApproved.length} Live-Approved Strateg${liveApproved.length === 1 ? 'y' : 'ies'}`}</span>
        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(16,185,129,0.15)', color: 'var(--accent-green)' }}>READY</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {liveApproved.slice(0, 5).map((s: any) => <div key={s.id} style={{ fontSize: 10, padding: '4px 8px', background: 'var(--bg-panel)', borderRadius: 4, color: 'var(--text-secondary)' }}>{s.name || s.id}</div>)}
      </div>
    </div>
  );
}

export default function DeploymentModeControlView() {
  const [deploymentMode, setDeploymentMode] = useState('PAPER_ONLY');
  const [policy, setPolicy] = useState<any>(null);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [liveApproved, setLiveApproved] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDeploymentMode = async () => {
    try {
      const [modeData, policyData, auditData, strategiesData] = await Promise.all([
        invoke('deployment_mode'),
        invoke('deployment_mode_policy'),
        invoke('deployment_mode_audit_log'),
        invoke('deployment_mode_strategies_live_approved'),
      ]);
      setDeploymentMode((modeData as any).mode || 'PAPER_ONLY');
      setPolicy(policyData as any);
      setAuditLog(Array.isArray(auditData) ? auditData : []);
      setLiveApproved((strategiesData as any)?.strategies || []);
      setLoading(false);
    } catch {
      setDeploymentMode('PAPER_ONLY');
      setPolicy({ deploymentMode: 'PAPER_ONLY', liveBrokerAllowed: false, paperBrokerAllowed: true, changedBy: 'system', changedAt: new Date().toISOString(), reason: 'Default mode' });
      setAuditLog([]);
      setLiveApproved([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeploymentMode();
    const interval = setInterval(fetchDeploymentMode, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleForcePaper = async () => {
    if (!confirm('Switch entire system to PAPER_ONLY mode? All live executions will be blocked.')) return;
    setActionLoading(true);
    try {
      await invoke('deployment_mode_force_paper', { reason: 'Manual paper-only mode via dashboard' });
      await fetchDeploymentMode();
    } catch { setError('Connection error'); }
    setActionLoading(false);
  };

  const handleEnableLive = async () => {
    if (!confirm('Enable LIVE trading mode? This allows live-approved strategies to route to live broker.')) return;
    if (!confirm('Are you SURE? This enables real money trading for live-approved strategies.')) return;
    setActionLoading(true);
    try {
      await invoke('deployment_mode_enable_live', { user: 'dashboard', reason: 'Live trading enabled via dashboard', confirmLive: true });
      await fetchDeploymentMode();
    } catch { setError('Connection error'); }
    setActionLoading(false);
  };

  if (loading) {
    return (
      <div className="deployment-mode-view">
        <div className="view-header"><div className="view-title">Deployment Mode Control</div><div className="view-subtitle">Global routing gate for broker execution</div></div>
        <div className="panel" style={{ padding: 40, textAlign: 'center' }}><div style={{ fontSize: 24, color: 'var(--text-muted)' }}>Loading deployment mode...</div></div>
      </div>
    );
  }

  const isLive = deploymentMode === 'LIVE_ENABLED';

  return (
    <div className="deployment-mode-view">
      <div className="view-header">
        <div>
          <div className="view-title">Deployment Mode Control</div>
          <div className="view-subtitle">Global routing gate — controls whether orders route to live broker or paper broker</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModeIndicator mode={deploymentMode} />
        </div>
      </div>

      {error && <div style={{ padding: '12px 16px', marginBottom: 16, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: 'var(--accent-red)' }}>{error}</div>}

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-header"><span className="panel-title">Current Policy</span></div>
        <div style={{ padding: '12px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Deployment Mode</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: isLive ? 'var(--accent-red)' : 'var(--accent-green)' }}>{deploymentMode}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Live Broker Allowed</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: policy?.liveBrokerAllowed ? 'var(--accent-green)' : 'var(--text-muted)' }}>{policy?.liveBrokerAllowed ? 'Yes' : 'No'}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Changed By</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{policy?.changedBy || 'system'}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Changed At</div>
              <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{policy?.changedAt ? new Date(policy.changedAt).toLocaleString() : '--'}</div>
            </div>
          </div>
          {policy?.reason && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Reason</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{policy.reason}</div>
            </div>
          )}
          <ActionButtons mode={deploymentMode} onForcePaper={handleForcePaper} onEnableLive={handleEnableLive} loading={actionLoading} disabled={false} />
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-header">
          <span className="panel-title">Live-Approved Strategies</span>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{`${liveApproved.length} ready`}</span>
        </div>
        <div style={{ padding: '12px 16px' }}>
          <LiveStrategiesSummary liveApproved={liveApproved} />
          <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(59,130,246,0.08)', borderRadius: 4, fontSize: 11, color: 'var(--text-secondary)' }}>
            <strong>Rule: </strong>Live execution allowed only if <code style={{ background: 'var(--bg-panel)', padding: '2px 4px', borderRadius: 2 }}>deploymentMode = LIVE_ENABLED</code> AND <code style={{ background: 'var(--bg-panel)', padding: '2px 4px', borderRadius: 2 }}>strategy status = live-approved</code>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Audit Log</span>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{`${auditLog.length} changes`}</span>
        </div>
        <div style={{ padding: '12px 16px', maxHeight: 300, overflowY: 'auto' }}>
          {auditLog.length === 0
            ? <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}><div style={{ fontSize: 32, marginBottom: 8 }}>📝</div><div style={{ fontSize: 12 }}>No mode changes recorded</div></div>
            : auditLog.slice(0, 10).map((entry: any, i: number) => <AuditLogEntry key={i} entry={entry} index={i} />)
          }
        </div>
      </div>
    </div>
  );
}