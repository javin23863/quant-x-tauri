import { useState, useEffect, useRef } from 'react';
import { useDashboardStore } from '../../store/dashboard';

interface Agent {
  id: string;
  name: string;
  emoji?: string;
  role: string;
  status: string;
  model?: string;
  currentTask?: string;
}

interface ChatMsg {
  from: 'user' | 'agent';
  text: string;
  time: string;
}

const MOCK_CHAT_HISTORY: Record<string, ChatMsg[]> = {
  ai: [
    { from: 'agent', text: 'Session started. Reading SOUL.md and AGENTS.md.', time: '08:01' },
    { from: 'user', text: "AI, what's the status on phase 8?", time: '08:02' },
    { from: 'agent', text: 'Phase 6 is complete — 755 tests, 751 passing. Phase 7 is in review. Phase 8 decomposition starts today.', time: '08:03' },
    { from: 'agent', text: 'Sprint planning ready. 8 tasks decomposed across 3 projects.', time: '08:05' },
  ],
  'research-director': [
    { from: 'agent', text: 'Research brief drafted for autoresearch engine integration.', time: '08:10' },
    { from: 'agent', text: 'HMM regime detection analysis complete.', time: '08:15' },
  ],
  'trade-manager': [
    { from: 'agent', text: 'Two paper positions flagged for volatility shift review.', time: '08:17' },
  ],
};

const STATUS_BG: Record<string, string> = {
  working: 'rgba(16,185,129,0.15)',
  chatting: 'rgba(59,130,246,0.15)',
  idle: 'rgba(245,158,11,0.15)',
  offline: 'rgba(107,114,128,0.1)',
  blocked: 'rgba(239,68,68,0.15)',
};

const STATUS_COLOR: Record<string, string> = {
  working: 'var(--accent-green)',
  chatting: 'var(--accent-blue)',
  idle: 'var(--accent-yellow)',
  offline: 'var(--text-muted)',
  blocked: 'var(--accent-red)',
};

export default function TeamView() {
  const state = useDashboardStore() as any;
  const agents: Agent[] = state.agents || [];
  const [chatAgent, setChatAgent] = useState<Agent | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<Record<string, ChatMsg[]>>(MOCK_CHAT_HISTORY);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatAgent, chatHistory]);

  function openChat(agent: Agent) {
    setChatAgent(agent);
  }

  function closeChat() {
    setChatAgent(null);
    setChatInput('');
  }

  function sendMessage() {
    if (!chatInput.trim() || !chatAgent) return;
    const agentId = chatAgent.id;
    const userMsg: ChatMsg = {
      from: 'user',
      text: chatInput.trim(),
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    };
    const agentResponse: ChatMsg = {
      from: 'agent',
      text: `[${chatAgent.name}] Processing your request via ${chatAgent.model}...`,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    };
    setChatHistory(prev => ({
      ...prev,
      [agentId]: [...(prev[agentId] || []), userMsg, agentResponse],
    }));
    setChatInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const currentHistory = chatAgent ? (chatHistory[chatAgent.id] || []) : [];

  return (
    <div style={{ position: 'relative' }}>
      <div className="view-header">
        <div>
          <div className="view-title">Team</div>
          <div className="view-subtitle">AI fleet directory — click an agent to open chat</div>
        </div>
      </div>

      <div className="team-grid">
        {agents.map(agent => {
          const status = agent.status || 'offline';
          const initials = agent.name.slice(0, 2).toUpperCase();
          return (
            <div key={agent.id || agent.name} className="team-card" onClick={() => openChat(agent)}>
              <div className="team-avatar" style={{ background: STATUS_BG[status] || STATUS_BG.offline }}>
                <span style={{ fontSize: '20px' }}>{agent.emoji || initials}</span>
                <div className="team-avatar-status" style={{
                  background: STATUS_COLOR[status] || 'var(--text-muted)',
                }} />
              </div>
              <div className="team-info">
                <div className="team-name">{agent.name}</div>
                <div className="team-role">{agent.role}</div>
                <div className="team-current">
                  {agent.currentTask ? `▶ ${agent.currentTask}` : '—'}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                <span className={`agent-status-badge badge-${status}`} style={{ fontSize: '10px' }}>
                  {status}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--accent-blue)' }}>💬</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className={`chat-panel ${chatAgent ? 'open' : ''}`}>
        {chatAgent && (
          <>
            <div className="chat-header">
              <div className="chat-agent-info">
                <div style={{
                  width: '36px', height: '36px',
                  borderRadius: '50%',
                  background: STATUS_BG[chatAgent.status] || STATUS_BG.offline,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '18px',
                }}>
                  {chatAgent.emoji}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>{chatAgent.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{chatAgent.model}</div>
                </div>
              </div>
              <button className="chat-close" onClick={closeChat}>✕</button>
            </div>

            <div className="chat-messages">
              {currentHistory.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', padding: '24px' }}>
                  No messages yet. Say hello!
                </div>
              )}
              {currentHistory.map((msg, i) => (
                <div key={i}>
                  <div className={`chat-msg ${msg.from === 'agent' ? 'from-agent' : 'from-user'}`}>
                    {msg.text}
                  </div>
                  <div className="chat-msg-time" style={{
                    textAlign: msg.from === 'agent' ? 'left' : 'right',
                    paddingLeft: msg.from === 'agent' ? '4px' : '0',
                    paddingRight: msg.from === 'user' ? '4px' : '0',
                  }}>
                    {msg.time}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-area">
              <textarea
                className="chat-input"
                placeholder={`Message ${chatAgent.name}...`}
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
              />
              <button className="chat-send" onClick={sendMessage} title="Send">
                ➤
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}