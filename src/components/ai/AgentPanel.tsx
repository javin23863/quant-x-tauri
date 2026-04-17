import { useDashboardStore } from '../../store/dashboard';

const AGENT_COLORS: Record<string, string> = {
  AI: 'var(--accent-blue)',
  'Research Director': 'var(--accent-green)',
  'Trade Manager': 'var(--accent-yellow)',
  'Mission Control': 'var(--accent-red)',
  'Meta Harness': 'var(--accent-purple)',
};

interface AgentInfo {
  name: string;
  model: string;
  lastActive?: string;
  currentTask?: string;
  status?: string;
}

interface AgentPanelProps {
  agents: AgentInfo[];
}

export function AgentPanel({ agents }: AgentPanelProps) {
  return (
    <section className="panel agent-panel">
      <h2>AI FLEET STATUS</h2>
      <table className="agent-table">
        <thead>
          <tr>
            <th>Agent</th>
            <th>Model</th>
            <th>Status</th>
            <th>Current Task</th>
            <th>Last Active</th>
          </tr>
        </thead>
        <tbody>
          {agents.map(a => (
            <tr key={a.name}>
              <td style={{ color: AGENT_COLORS[a.name] || 'inherit' }}>
                {a.name}
              </td>
              <td className="mono text-muted">{a.model}</td>
              <td>
                <span className={`status-dot ${a.status || 'offline'}`}></span>
                {a.status || 'offline'}
              </td>
              <td>{a.currentTask || '\u2014'}</td>
              <td className="mono text-muted">{a.lastActive || '\u2014'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}