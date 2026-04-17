import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useDashboardStore } from '../../store/dashboard';

export default function CommandBar() {
  const state = useDashboardStore((s) => s) as any;
  const [searchVal, setSearchVal] = useState('');
  const [paused, setPaused] = useState(false);

  function handleRefresh() {
    invoke('get_state')
      .then((data: any) => {
        if (data) {
          useDashboardStore.getState().setAccount(data.account || null);
        }
      })
      .catch(() => {});
  }

  function handlePing() {
    invoke('health_check')
      .then((data: any) => {
        useDashboardStore.getState().addNotification({
          type: 'info',
          title: 'Ping OK',
          message: JSON.stringify(data).slice(0, 60),
        });
      })
      .catch(() => {
        useDashboardStore.getState().addNotification({
          type: 'warning',
          title: 'Ping Failed',
          message: 'Backend may be offline',
        });
      });
  }

  const isOnline = state.connection?.connected ?? false;
  const agents: any[] = state.agents || [];
  const activeAgents = agents.filter((a: any) => a.status === 'working' || a.status === 'chatting').length;

  const qxl = state.qxlive;
  const killSwitchActive = qxl?.missionControl?.activeKillSwitch || state.kill_switch?.active || false;
  const hyps = qxl ? Object.values(qxl.hypotheses || {}) : [] as any[];
  const worstDrawdown = hyps.length > 0
    ? Math.max(...hyps.map((h: any) => h.maxDrawdown ?? h.paperTradingResults?.maxDrawdown ?? 0))
    : null;
  const drawdownPct = worstDrawdown != null ? (worstDrawdown * 100).toFixed(1) : null;
  const drawdownColor = worstDrawdown == null ? 'var(--text-muted)'
    : worstDrawdown >= 0.03 ? 'var(--accent-red)'
    : worstDrawdown >= 0.015 ? 'var(--accent-yellow)'
    : 'var(--accent-green)';

  return (
    <header className="command-bar">
      <div className="cb-brand">
        <div className="cb-logo">MC</div>
        <span className="cb-title">Mission Control</span>
      </div>

      <div className="cb-search">
        <span className="cb-search-icon">⌕</span>
        <input
          type="text"
          placeholder="Search agents, tasks, events..."
          value={searchVal}
          onChange={e => setSearchVal(e.target.value)}
        />
      </div>

      <div className="cb-actions">
        <button
          className={`cb-btn ${paused ? 'active' : ''}`}
          onClick={() => setPaused(p => !p)}
          title={paused ? 'Resume live updates' : 'Pause live updates'}
        >
          {paused ? '▶ Resume' : '⏸ Pause'}
        </button>

        <button className="cb-btn" onClick={handlePing} title="Ping backend">
          📡 Ping
        </button>

        <button className="cb-btn cb-btn-icon" onClick={handleRefresh} title="Refresh state">
          ↻
        </button>

        {killSwitchActive && (
          <div style={{
            padding: '0 12px', height: '32px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid var(--accent-red)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '12px', fontWeight: 700, color: 'var(--accent-red)',
            letterSpacing: '0.5px',
          }}>
            ⛔ KILL SWITCH
          </div>
        )}

        <div style={{
          padding: '0 10px', height: '32px',
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${drawdownColor}`,
          borderRadius: 'var(--radius-sm)',
          display: 'flex', alignItems: 'center', gap: '6px',
          fontSize: '12px',
        }} title="Max drawdown across active hypotheses">
          <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>DD</span>
          <span style={{ color: drawdownColor, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
            {drawdownPct != null ? `${drawdownPct}%` : '—'}
          </span>
        </div>

        <div style={{
          padding: '0 10px',
          height: '32px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '12px',
          color: 'var(--text-secondary)',
        }}>
          <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{activeAgents}</span>
          <span>active</span>
        </div>

        <div className={`cb-status ${isOnline ? '' : 'offline'}`}>
          <span className={`status-dot ${isOnline ? 'pulse' : ''}`} />
          {isOnline ? 'Online' : 'Offline'}
        </div>
      </div>
    </header>
  );
}