import { useState, useEffect, useMemo } from 'react';
import { useDashboardStore } from '../../store/dashboard';

interface AgentInfo {
  id: string;
  name: string;
  status: string;
  color: string;
  icon: string;
}

interface Metrics {
  pnl24h: number;
  riskLevel: string;
  regime: string;
  activeSignals: number;
}

const riskColors: Record<string, { bg: string; border: string; text: string }> = {
  nominal: { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)', text: 'var(--accent-green)' },
  elevated: { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)', text: 'var(--accent-yellow)' },
  critical: { bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.3)', text: 'var(--accent-red)' },
};

const regimeLabels: Record<string, { label: string; color: string }> = {
  BULL_STABLE: { label: 'BULL', color: 'var(--accent-green)' },
  BULL_VOLATILE: { label: 'BULL+', color: 'var(--accent-green)' },
  BEAR_STABLE: { label: 'BEAR', color: 'var(--accent-red)' },
  BEAR_VOLATILE: { label: 'BEAR+', color: 'var(--accent-red)' },
  TRANSITION: { label: 'TRANS', color: 'var(--accent-yellow)' },
  SIDEWAYS: { label: 'FLAT', color: 'var(--text-muted)' },
  UNKNOWN: { label: '—', color: 'var(--text-muted)' },
};

export default function GlobalHUD() {
  const wsConnected = useDashboardStore((s) => s.connection?.connected ?? false);
  const signals = useDashboardStore((s) => s.signals ?? []);
  const regimeData = useDashboardStore((s) => s.regime);
  const [pulse, setPulse] = useState(false);
  const [metrics, setMetrics] = useState<Metrics>({
    pnl24h: 0,
    riskLevel: 'nominal',
    regime: 'UNKNOWN',
    activeSignals: 0,
  });

  const agents = useMemo<AgentInfo[]>(() => [
    { id: 'research', name: 'Research Director', status: 'idle', color: 'indigo', icon: '🔬' },
    { id: 'trade', name: 'Trade Manager', status: 'idle', color: 'emerald', icon: '📊' },
    { id: 'quant', name: 'Quant Analyst', status: 'idle', color: 'amber', icon: '🧮' },
  ], []);

  useEffect(() => {
    const handler = () => setPulse(true);
    window.addEventListener('ws:tick', handler);
    window.addEventListener('ws:signal', handler);
    window.addEventListener('ws:trade', handler);
    return () => {
      window.removeEventListener('ws:tick', handler);
      window.removeEventListener('ws:signal', handler);
      window.removeEventListener('ws:trade', handler);
    };
  }, []);

  useEffect(() => {
    if (pulse) {
      const timer = setTimeout(() => setPulse(false), 300);
      return () => clearTimeout(timer);
    }
  }, [pulse]);

  useEffect(() => {
    setMetrics({
      pnl24h: 0,
      riskLevel: 'nominal',
      regime: regimeData?.hmm_state != null ? String(regimeData.current).toUpperCase() : 'UNKNOWN',
      activeSignals: signals.length,
    });
  }, [regimeData, signals]);

  const formatPnL = (val: number) => {
    const prefix = val >= 0 ? '+' : '';
    const color = val >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(val));
    return { text: `${prefix}${val < 0 ? '-' : ''}${formatted}`, color };
  };

  const pnl = formatPnL(metrics.pnl24h);
  const risk = riskColors[metrics.riskLevel] ?? riskColors.nominal;
  const regime = regimeLabels[metrics.regime] ?? regimeLabels.UNKNOWN;

  return (
    <div className="global-hud">
      <div className={`hud-pulse-indicator ${pulse ? 'pulse-active' : ''}`}>
        <div className="pulse-ring" />
        <span className="pulse-dot" />
      </div>

      <div className="hud-agents">
        {agents.map((agent) => (
          <div key={agent.id} className={`hud-agent ${agent.status}`}>
            <div className="hud-agent-avatar" style={{ '--agent-color': `var(--accent-${agent.color})` } as React.CSSProperties}>
              {agent.icon}
            </div>
            <div className="hud-agent-status-bar">
              <div className="hud-agent-status-fill" />
            </div>
          </div>
        ))}
      </div>

      <div className="hud-metrics">
        <div className="hud-metric">
          <div className="hud-metric-label">P&amp;L 24h</div>
          <div className="hud-metric-value" style={{ color: pnl.color }}>
            {pnl.text}
          </div>
        </div>

        <div className="hud-divider" />

        <div
          className="hud-metric hud-metric-clickable"
          style={{ background: risk.bg, border: `1px solid ${risk.border}` }}
        >
          <div className="hud-metric-label">RISK</div>
          <div className="hud-metric-value" style={{ color: risk.text }}>
            {metrics.riskLevel.toUpperCase()}
          </div>
        </div>

        <div className="hud-divider" />

        <div className="hud-metric">
          <div className="hud-metric-label">REGIME</div>
          <div className="hud-metric-value" style={{ color: regime.color }}>
            {regime.label}
          </div>
        </div>

        <div className="hud-divider" />

        <div className="hud-metric">
          <div className="hud-metric-label">SIGNALS</div>
          <div className="hud-metric-value">
            {metrics.activeSignals}
          </div>
        </div>
      </div>

      <div className="hud-system">
        <div className={`hud-system-status ${wsConnected ? 'connected' : 'disconnected'}`}>
          <span className="hud-system-dot" />
          <span className="hud-system-text">
            {wsConnected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
        <div className="hud-system-time">
          {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </div>
      </div>
    </div>
  );
}