import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useDashboardStore } from '../../store/dashboard';

interface Agent {
  id: string;
  name: string;
  emoji?: string;
  role: string;
  status: 'working' | 'chatting' | 'idle' | 'offline' | 'blocked';
  currentTask?: string;
  model?: string;
  queue?: number;
  color?: string;
  lastActive?: string;
}

interface MetaHarnessQueue {
  pendingCount: number;
  processedCount: number;
  invalidCount: number;
  decisionCount: number;
  errorCount: number;
}

interface MetaHarnessStatus {
  enabled: boolean;
  running: boolean;
  queue: MetaHarnessQueue;
}

const STATUS_LABEL: Record<string, string> = {
  working: 'Working',
  chatting: 'Chatting',
  idle: 'Idle',
  offline: 'Offline',
  blocked: 'Blocked',
};

const BADGE_CLASS: Record<string, string> = {
  working: 'badge-working',
  chatting: 'badge-chatting',
  idle: 'badge-idle',
  offline: 'badge-offline',
  blocked: 'badge-blocked',
};

const QUEUE_BAR_CLASS: Record<string, string> = {
  working: 'bar-green',
  chatting: 'bar-blue',
  idle: 'bar-yellow',
  offline: 'bar-gray',
  blocked: 'bar-red',
};

function AgentCard({ agent }: { agent: Agent }) {
  const [expanded, setExpanded] = useState(false);
  const status = agent.status || 'offline';

  const cardStyle: React.CSSProperties = {
    '--card-accent': agent.color || 'var(--accent-blue)',
  } as React.CSSProperties;

  return (
    <div
      className={`agent-card ${expanded ? 'active-card' : ''}`}
      style={cardStyle}
      onClick={() => setExpanded(e => !e)}
    >
      <div className="agent-card-top">
        <div className={`agent-avatar ${status}`}>
          <div className="agent-avatar-inner">{agent.emoji || agent.name[0]}</div>
          <div className="agent-status-ring" />
        </div>
        <div className="agent-info">
          <div className="agent-name">
            {agent.name}
            <span className={`agent-status-badge ${BADGE_CLASS[status]}`}>
              {STATUS_LABEL[status] || status}
            </span>
          </div>
          <div className="agent-role">{agent.role}</div>
        </div>
      </div>

      <div className="agent-task">
        <div className="agent-task-label">Current Task</div>
        <div style={{ color: agent.currentTask ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '12px' }}>
          {agent.currentTask || 'No active task'}
        </div>
      </div>

      <div className="agent-queue-bar">
        <div className="queue-label">
          <span>Queue Load</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>{agent.queue || 0}%</span>
        </div>
        <div className="bar-track">
          <div
            className={`bar-fill ${QUEUE_BAR_CLASS[status]}`}
            style={{ width: `${agent.queue || 0}%` }}
          />
        </div>
      </div>

      {expanded && (
        <div style={{
          marginTop: '12px',
          padding: '10px',
          background: 'var(--bg-root)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
          fontSize: '12px',
          color: 'var(--text-secondary)',
        }}>
          <div style={{ marginBottom: '4px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Model</span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontSize: '11px' }}>
            {agent.model}
          </div>
          {agent.lastActive && (
            <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
              Last active: {agent.lastActive}
            </div>
          )}
        </div>
      )}

      <div className="agent-heartbeat">
        {status !== 'offline' && (
          <div className={`hb-dot ${status === 'working' || status === 'chatting' ? 'animate' : ''}`}
               style={{ background: status === 'working' ? 'var(--accent-green)' : status === 'chatting' ? 'var(--accent-blue)' : 'var(--accent-yellow)' }} />
        )}
        <span style={{ fontFamily: 'var(--font-mono)' }}>
          {status === 'offline' ? '—' : `${agent.model}`}
        </span>
      </div>
    </div>
  );
}

export default function AgentsView() {
  const state = useDashboardStore() as any;
  const agents: Agent[] = state.agents || [];
  const [metaHarnessStatus, setMetaHarnessStatus] = useState<MetaHarnessStatus | null>(state.metaHarnessStatus || null);

  useEffect(() => {
    let mounted = true;

    async function loadStatus() {
      try {
        const data = await invoke<MetaHarnessStatus>('meta_harness_status');
        if (mounted) setMetaHarnessStatus(data);
      } catch {}
    }

    loadStatus();
    const timer = setInterval(loadStatus, 10000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (state.metaHarnessStatus) {
      setMetaHarnessStatus(state.metaHarnessStatus);
    }
  }, [state.metaHarnessStatus]);

  const stats = {
    total: agents.length,
    active: agents.filter(a => a.status === 'working').length,
    chatting: agents.filter(a => a.status === 'chatting').length,
    idle: agents.filter(a => a.status === 'idle').length,
    offline: agents.filter(a => a.status === 'offline').length,
  };

  const mh = metaHarnessStatus || state.metaHarnessStatus || {
    enabled: false,
    running: false,
    queue: {
      pendingCount: 0,
      processedCount: 0,
      invalidCount: 0,
      decisionCount: 0,
      errorCount: 0,
    },
  };

  const mhDetail = [
    `pending:${mh.queue?.pendingCount || 0}`,
    `decisions:${mh.queue?.decisionCount || 0}`,
    `errors:${mh.queue?.errorCount || 0}`,
  ].join(' ');

  const mhStatus = !mh.enabled
    ? 'unknown'
    : (mh.running && (mh.queue?.errorCount || 0) === 0 ? 'ok' : ((mh.queue?.errorCount || 0) > 0 ? 'error' : 'unknown'));

  const connection = useDashboardStore(s => s.connection);

  return (
    <div>
      <div className="view-header">
        <div>
          <div className="view-title">Agent Fleet</div>
          <div className="view-subtitle">AI + role subagents — real-time status and task monitoring</div>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {[
            { label: 'Working', val: stats.active, color: 'var(--accent-green)' },
            { label: 'Chatting', val: stats.chatting, color: 'var(--accent-blue)' },
            { label: 'Idle', val: stats.idle, color: 'var(--accent-yellow)' },
            { label: 'Offline', val: stats.offline, color: 'var(--text-muted)' },
          ].map(s => (
            <div key={s.label} style={{
              padding: '6px 14px',
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              textAlign: 'center',
              minWidth: '70px',
            }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: s.color, fontFamily: 'var(--font-mono)' }}>{s.val}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="agents-grid">
        {agents.map(agent => (
          <AgentCard key={agent.id || agent.name} agent={agent} />
        ))}
      </div>

      <div style={{
        marginTop: '24px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '12px',
      }}>
        {[
          { label: 'Vera-X Proxy', status: connection?.connected ? 'ok' : 'unknown', detail: 'Port 8080', icon: '🔌' },
          { label: 'WebSocket', status: connection?.connected ? 'ok' : 'error', detail: 'Port 3002', icon: '⚡' },
          { label: 'Mission Control', status: 'ok', detail: 'Port 3001', icon: '🖥️' },
          { label: 'Meta-Harness', status: mhStatus, detail: mhDetail, icon: '🧠' },
          { label: 'QMD Knowledge', status: 'ok', detail: '16 docs', icon: '🧬' },
        ].map(sys => (
          <div key={sys.label} style={{
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <span style={{ fontSize: '18px' }}>{sys.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{sys.label}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{sys.detail}</div>
            </div>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: sys.status === 'ok' ? 'var(--accent-green)' : sys.status === 'error' ? 'var(--accent-red)' : 'var(--accent-yellow)',
              boxShadow: sys.status === 'ok' ? '0 0 8px var(--glow-green)' : 'none',
            }} />
          </div>
        ))}
      </div>
    </div>
  );
}