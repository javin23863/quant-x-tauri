import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useDashboardStore } from '../../store/dashboard';

interface DeskConfig {
  id: string;
  label: string;
  pos: { left: string; top: string };
}

interface Agent {
  id: string;
  name: string;
  emoji?: string;
  role?: string;
  status: string;
  currentTask?: string;
  queue?: number;
  model?: string;
}

interface FeedItem {
  msg: string;
  time: string;
}

const DESK_CONFIG: DeskConfig[] = [
  { id: 'ai', label: 'AI', pos: { left: '6%', top: '10%' } },
  { id: 'research-director', label: 'Research Director', pos: { left: '22%', top: '10%' } },
  { id: 'trade-manager', label: 'Trade Manager', pos: { left: '38%', top: '10%' } },
  { id: 'mission-control', label: 'Mission Control', pos: { left: '54%', top: '10%' } },
  { id: 'meta-harness', label: 'Meta Harness', pos: { left: '70%', top: '10%' } },
];

const AGENT_AT_DESK: Record<string, { left: string; top: string }> = {
  ai: { left: '10.5%', top: '22%' },
  'research-director': { left: '26.5%', top: '22%' },
  'trade-manager': { left: '42.5%', top: '22%' },
  'mission-control': { left: '58.5%', top: '22%' },
  'meta-harness': { left: '74.5%', top: '22%' },
};

const AGENT_AT_MEETING: Record<string, { left: string; top: string }> = {
  ai: { left: '36%', top: '50%' },
  'research-director': { left: '44%', top: '42%' },
  'trade-manager': { left: '52%', top: '50%' },
  'mission-control': { left: '44%', top: '58%' },
  'meta-harness': { left: '52%', top: '42%' },
};

const AGENT_AT_WATER: Record<string, { left: string; top: string }> = {
  ai: { left: '78%', top: '76%' },
  'research-director': { left: '82%', top: '80%' },
  'trade-manager': { left: '86%', top: '76%' },
  'mission-control': { left: '80%', top: '84%' },
  'meta-harness': { left: '88%', top: '82%' },
};

const STATUS_GLOW: Record<string, React.CSSProperties> = {
  working: { border: '2px solid var(--accent-green)', boxShadow: '0 0 14px rgba(16,185,129,0.6), 0 0 6px rgba(16,185,129,0.3) inset' },
  chatting: { border: '2px solid var(--accent-blue)', boxShadow: '0 0 14px rgba(59,130,246,0.6), 0 0 6px rgba(59,130,246,0.3) inset' },
  idle: { border: '2px solid var(--accent-yellow)' },
  offline: { border: '2px solid rgba(107,114,128,0.3)', opacity: '0.5' },
  blocked: { border: '2px solid var(--accent-red)', boxShadow: '0 0 14px rgba(239,68,68,0.6)' },
};

const STATUS_BG: Record<string, string> = {
  working: 'rgba(16,185,129,0.2)',
  chatting: 'rgba(59,130,246,0.2)',
  idle: 'rgba(245,158,11,0.15)',
  offline: 'rgba(30,42,64,0.8)',
  blocked: 'rgba(239,68,68,0.2)',
};

interface PortfolioStats {
  totalValue?: number;
  dailyPnl?: number;
  dailyPnlPct?: number;
  strategies?: any[];
  mode?: string;
  buyingPower?: number;
}

function generateFeedEvent(agents: Agent[]): FeedItem {
  const names = agents.filter(a => a.status !== 'offline').map(a => a.name);
  const templates = [
    (n: string) => `${n} submitted a task`,
    (n: string) => `${n} completed analysis`,
    (n: string) => `${n} is requesting approval`,
    (n: string) => `${n} started new job`,
    (n: string) => `${n} heartbeat — nominal`,
    (n: string) => `${n} queued hypothesis`,
  ];
  const name = names[Math.floor(Math.random() * names.length)] || 'System';
  const fn = templates[Math.floor(Math.random() * templates.length)];
  return { msg: fn(name), time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) };
}

export default function OfficeView() {
  const state = useDashboardStore((s) => s) as any;
  const setView = useDashboardStore((s) => s.setView);
  const agents: Agent[] = state.agents || [];
  const officeMode = (state.office?.mode) || 'normal';
  const [positions, setPositions] = useState<Record<string, string>>(
    () => agents.reduce((acc: Record<string, string>, a: Agent) => ({ ...acc, [a.id]: 'desk' }), {})
  );
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null);
  const [portfolioStats, setPortfolioStats] = useState<PortfolioStats | null>(null);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([
    { msg: 'Office opened — all agents at desks', time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) },
  ]);

  useEffect(() => {
    function fetchStats() {
      invoke('get_portfolio')
        .then((data: any) => { if (!data.error) setPortfolioStats(data); })
        .catch(() => {});
    }
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const ev = generateFeedEvent(agents);
      setFeedItems(prev => [ev, ...prev].slice(0, 20));
    }, 5000);
    return () => clearInterval(timer);
  }, [agents]);

  function getAgentPosition(agentId: string): { left: string; top: string } {
    const pos = positions[agentId] || 'desk';
    if (pos === 'meeting') return AGENT_AT_MEETING[agentId] || AGENT_AT_DESK[agentId] || { left: '50%', top: '50%' };
    if (pos === 'water') return AGENT_AT_WATER[agentId] || AGENT_AT_DESK[agentId] || { left: '50%', top: '50%' };
    return AGENT_AT_DESK[agentId] || { left: '50%', top: '50%' };
  }

  function setAllPositions(pos: string) {
    const newPos: Record<string, string> = {};
    agents.forEach(a => { if (a.status !== 'offline') newPos[a.id] = pos; });
    setPositions(prev => ({ ...prev, ...newPos }));
    setFeedItems(prev => [{
      msg: pos === 'meeting' ? 'All agents gathered at meeting table' : pos === 'water' ? 'Agents heading to watercooler' : 'Agents returned to desks',
      time: new Date().toLocaleTimeString('en-US', { hour12: false }),
    }, ...prev].slice(0, 20));
  }

  function startMeeting() {
    setAllPositions('meeting');
    setFeedItems(prev => [{
      msg: '📋 Meeting started — agenda loading...',
      time: new Date().toLocaleTimeString('en-US', { hour12: false }),
    }, ...prev].slice(0, 20));
  }

  const agentById = agents.reduce((acc: Record<string, Agent>, a: Agent) => ({ ...acc, [a.id]: a }), {});

  return (
    <div>
      <div className="view-header">
        <div>
          <div className="view-title">Office</div>
          <div className="view-subtitle">Live 2D agent simulation — click an agent for profile</div>
        </div>
      </div>

      <div className="office-container">
        <div className="office-main">
          <div className="office-controls">
            <button className="office-btn" onClick={() => setAllPositions('desk')}>
              🖥️ All Desks
            </button>
            <button className="office-btn" onClick={() => setAllPositions('meeting')}>
              📋 Gather
            </button>
            <button className={`office-btn ${officeMode === 'meeting' ? 'active' : ''}`} onClick={startMeeting}>
              🎙️ Run Meeting
            </button>
            <button className="office-btn" onClick={() => setAllPositions('water')}>
              💧 Watercooler
            </button>
            {Object.values(positions).some(p => p !== 'desk') && (
              <button className="office-btn" onClick={() => setAllPositions('desk')}>
                ↩ Reset
              </button>
            )}
          </div>

          {portfolioStats && (
            <div className="portfolio-ticker">
              <div className="portfolio-ticker-inner">
                {[1, 2, 3].map(k => (
                  <span key={k} style={{ display: 'inline-flex', gap: 28, whiteSpace: 'nowrap' }}>
                    <span>Total Value: <strong style={{ color: 'var(--text-primary)' }}>${(portfolioStats.totalValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                    <span>Daily P&L: <strong style={{ color: (portfolioStats.dailyPnl ?? 0) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>{(portfolioStats.dailyPnl ?? 0) >= 0 ? '+' : ''}${Math.abs(portfolioStats.dailyPnl || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({(portfolioStats.dailyPnlPct ?? 0) >= 0 ? '+' : ''}{(portfolioStats.dailyPnlPct || 0).toFixed(2)}%)</strong></span>
                    <span>Strategies: <strong style={{ color: 'var(--accent-blue)' }}>{(portfolioStats.strategies || []).length} active</strong></span>
                    <span>Mode: <strong style={{ color: portfolioStats.mode === 'live' ? 'var(--accent-green)' : 'var(--accent-blue)' }}>{(portfolioStats.mode || 'paper').toUpperCase()}</strong></span>
                    <span style={{ marginRight: 60 }}>Buying Power: <strong style={{ color: 'var(--text-primary)' }}>${(portfolioStats.buyingPower || 0).toLocaleString()}</strong></span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="office-floor">
            <div className="office-scene">
              <div className="office-plant" style={{ left: '2%', top: '2%' }}>🌿</div>
              <div className="office-plant" style={{ right: '2%', top: '2%' }}>🌿</div>
              <div className="office-plant" style={{ left: '2%', bottom: '4%' }}>🌱</div>
              <div className="office-water" style={{ right: '4%', bottom: '8%' }}>💧</div>
              <div style={{ position: 'absolute', right: '4%', bottom: '15%', fontSize: '9px', color: 'rgba(59,130,246,0.4)', fontFamily: 'var(--font-mono)' }}>
                WATER COOLER
              </div>

              <div className="office-meeting-table">
                <span className="meeting-table-label">Meeting</span>
              </div>

              {DESK_CONFIG.map(desk => {
                const agent = agentById[desk.id];
                const hasAgent = !!agent;
                return (
                  <div key={desk.id} className="office-desk" style={desk.pos}>
                    <div className="desk-monitor">
                      <span style={{ color: hasAgent && agent.status !== 'offline' ? 'var(--accent-green)' : '#333', fontSize: '8px' }}>
                        {hasAgent && agent.status !== 'offline' ? '█▄' : '░░'}
                      </span>
                    </div>
                    <div className="desk-label">{desk.label}</div>
                  </div>
                );
              })}

              {agents.map(agent => {
                const pos = getAgentPosition(agent.id);
                const status = agent.status || 'offline';
                const glowStyle = STATUS_GLOW[status] || STATUS_GLOW.offline;
                const bgStyle = STATUS_BG[status] || STATUS_BG.offline;
                const isWorking = status === 'working';
                const isChatting = status === 'chatting';
                const pulseColor = isWorking ? 'rgba(16,185,129,0.7)' : isChatting ? 'rgba(59,130,246,0.7)' : null;

                return (
                  <div
                    key={agent.id}
                    style={{ position: 'absolute', left: pos.left, top: pos.top }}
                    onMouseEnter={() => setHoveredAgent(agent.id)}
                    onMouseLeave={() => setHoveredAgent(null)}
                  >
                    {pulseColor && (
                      <div style={{
                        position: 'absolute', top: '50%', left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: 44, height: 44, borderRadius: '50%',
                        border: `2px solid ${pulseColor}`,
                        animation: 'office-pulse 2s ease-out infinite',
                        pointerEvents: 'none',
                        zIndex: 1,
                      }} />
                    )}
                    <div
                      className={`office-agent ${status}`}
                      style={{
                        background: bgStyle,
                        position: 'relative',
                        zIndex: 2,
                        ...glowStyle,
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        setView('chat');
                      }}
                      title={`${agent.name} — click to chat`}
                    >
                      <span>{agent.emoji || agent.name[0]}</span>
                      <div className="agent-tooltip">{agent.name}</div>
                    </div>
                    {hoveredAgent === agent.id && (
                      <div className="office-tooltip">
                        <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{agent.name} {agent.emoji}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>{agent.role || ''}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
                          {agent.currentTask ? agent.currentTask : 'No active task'}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 10, color: 'var(--text-muted)' }}>
                          <span>Queue: {agent.queue || 0}%</span>
                          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>{agent.model}</span>
                        </div>
                        <div className="office-tooltip-arrow" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="office-feed">
          <div className="panel" style={{ padding: '0', overflow: 'hidden', flexShrink: 0 }}>
            <div className="panel-header">
              <span className="panel-title">Live Activity</span>
            </div>
          </div>
          <div className="office-feed-list">
            {feedItems.map((item, i) => (
              <div key={i} className="office-feed-item">
                <div>{item.msg}</div>
                <div className="feed-time">{item.time}</div>
              </div>
            ))}
          </div>

          <div className="panel" style={{ padding: '12px 14px', flexShrink: 0 }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>
              Status Legend
            </div>
            {([
              { label: 'Working', color: 'var(--accent-green)' },
              { label: 'Chatting', color: 'var(--accent-blue)' },
              { label: 'Idle', color: 'var(--accent-yellow)' },
              { label: 'Offline', color: 'var(--text-muted)' },
] as const).map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                <div style={{
                  width: '10px', height: '10px', borderRadius: '50%',
                  background: s.color,
                  boxShadow: s.label === 'Working' ? '0 0 8px rgba(16,185,129,0.6)' : s.label === 'Chatting' ? '0 0 8px rgba(59,130,246,0.6)' : 'none',
                }} />
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedAgent && (
        <div className="agent-overlay" onClick={() => setSelectedAgent(null)}>
          <div className="agent-overlay-card" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '16px',
                background: STATUS_BG[selectedAgent.status] || STATUS_BG.offline,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '28px',
                ...(STATUS_GLOW[selectedAgent.status] || {}),
              }}>
                {selectedAgent.emoji}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedAgent.name}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{selectedAgent.role}</div>
              </div>
              <button
                onClick={() => setSelectedAgent(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '20px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              {([
                { label: 'Status', val: selectedAgent.status || 'offline' },
                { label: 'Queue', val: `${selectedAgent.queue || 0}%` },
                { label: 'Location', val: (positions[selectedAgent.id] || 'desk').replace('-', ' ') },
                { label: 'Position', val: positions[selectedAgent.id] === 'meeting' ? 'Conference' : positions[selectedAgent.id] === 'water' ? 'Watercooler' : 'Desk' },
              ]).map(field => (
                <div key={field.label} style={{
                  background: 'var(--bg-root)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 12px',
                  border: '1px solid var(--border-subtle)',
                }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>
                    {field.label}
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                    {field.val}
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              background: 'var(--bg-root)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 12px',
              border: '1px solid var(--border-subtle)',
              marginBottom: '14px',
            }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Current Task</div>
              <div style={{ fontSize: '13px', color: selectedAgent.currentTask ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {selectedAgent.currentTask || 'No active task'}
              </div>
            </div>

            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--accent-cyan)',
              background: 'var(--bg-root)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 12px',
              border: '1px solid var(--border-subtle)',
            }}>
              {selectedAgent.model}
            </div>

            <div style={{ marginTop: '14px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                className="panel-btn"
                style={{ flex: 1, justifyContent: 'center', height: '34px', background: 'var(--accent-blue)', color: '#fff', border: 'none' }}
                onClick={() => {
                  setView('chat');
                  setSelectedAgent(null);
                }}
              >
                💬 Chat
              </button>
              <button
                className="panel-btn"
                style={{ flex: 1, justifyContent: 'center', height: '34px' }}
                onClick={() => {
                  setPositions(prev => ({ ...prev, [selectedAgent.id]: 'meeting' }));
                  setSelectedAgent(null);
                }}
              >
                📋 Meeting
              </button>
              <button
                className="panel-btn"
                style={{ flex: 1, justifyContent: 'center', height: '34px' }}
                onClick={() => {
                  setPositions(prev => ({ ...prev, [selectedAgent.id]: 'desk' }));
                  setSelectedAgent(null);
                }}
              >
                🖥️ Desk
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}