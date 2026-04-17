import { useState } from 'react';
import { useDashboardStore } from '../../store/dashboard';
import MissionTabFrame from '../shared/MissionTabFrame';

interface ABTest {
  testId: string;
  status: 'pending' | 'running' | 'completed' | 'stopped';
  variantCount?: number;
  controlVariant?: string;
  progress?: number;
  winner?: string;
  startDate?: string;
  confidence?: number;
  results?: Record<string, {
    tradeCount?: number;
    winRate?: number;
    sharpe?: number;
    maxDrawdown?: number;
  }>;
}

interface StrategyRow {
  id: string;
  name?: string;
  sharpe?: number;
  winRate?: number;
  totalReturn?: number;
  maxDrawdown?: number;
  tradeCount?: number;
}

interface DriftPoint {
  value: number;
  drift?: boolean;
  window?: number;
  param?: string;
  change?: number;
}

function ABTestCard({ test }: { test: ABTest }) {
  const [expanded, setExpanded] = useState(false);

  const statusColors: Record<string, string> = {
    pending: 'var(--accent-yellow)',
    running: 'var(--accent-blue)',
    completed: 'var(--accent-green)',
    stopped: 'var(--accent-red)',
  };

  const winner = test.winner ?? 'none';

  return (
    <div
      className="agent-card"
      style={{ '--card-accent': statusColors[test.status] ?? 'var(--accent-blue)' } as React.CSSProperties}
      onClick={() => setExpanded((e) => !e)}
    >
      <div className="agent-card-top">
        <div className="agent-info" style={{ flex: 1 }}>
          <div className="agent-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: statusColors[test.status],
              boxShadow: `0 0 8px ${statusColors[test.status]}`,
            }} />
            {test.testId || 'A/B Test'}
          </div>
          <div className="agent-role" style={{ fontSize: '11px' }}>
            Status: {test.status} • Variants: {test.variantCount ?? 0}
          </div>
        </div>
      </div>

      <div className="agent-task">
        <div className="agent-task-label">Control</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
          {test.controlVariant ?? '—'}
        </div>
      </div>

      {test.status === 'running' && (
        <div className="agent-queue-bar">
          <div className="queue-label">
            <span>Sample Progress</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{test.progress ?? 0}%</span>
          </div>
          <div className="bar-track">
            <div className="bar-fill bar-blue" style={{ width: `${test.progress ?? 0}%` }} />
          </div>
        </div>
      )}

      {test.status === 'completed' && winner && winner !== 'none' && (
        <div style={{
          marginTop: '8px',
          padding: '8px 10px',
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '12px',
        }}>
          <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>Winner: </span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>{winner}</span>
        </div>
      )}

      {expanded && (
        <div style={{
          marginTop: '12px',
          padding: '10px',
          background: 'var(--bg-root)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
          fontSize: '11px',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase' }}>Started</div>
              <div style={{ fontFamily: 'var(--font-mono)' }}>{test.startDate ?? '—'}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase' }}>Confidence</div>
              <div style={{ fontFamily: 'var(--font-mono)' }}>{test.confidence != null ? `${(test.confidence * 100).toFixed(1)}%` : '—'}</div>
            </div>
          </div>
          {test.results && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', marginBottom: '6px' }}>Variant Metrics</div>
              {Object.entries(test.results).map(([variantId, m]) => (
                <div key={variantId} style={{
                  padding: '6px 8px',
                  marginBottom: '4px',
                  background: winner === variantId ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                  borderRadius: 'var(--radius-sm)',
                  border: winner === variantId ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid transparent',
                }}>
                  <div style={{ fontWeight: 600, color: winner === variantId ? 'var(--accent-green)' : 'var(--text-primary)' }}>{variantId}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', marginTop: '4px' }}>
                    <div><span style={{ color: 'var(--text-muted)' }}>Trades:</span> {m.tradeCount ?? 0}</div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Win:</span> {m.winRate != null ? `${(m.winRate * 100).toFixed(1)}%` : '—'}</div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Sharpe:</span> {m.sharpe != null ? m.sharpe.toFixed(2) : '—'}</div>
                    <div><span style={{ color: 'var(--text-muted)' }}>DD:</span> {m.maxDrawdown != null ? `${(m.maxDrawdown * 100).toFixed(1)}%` : '—'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StrategyHeatmap({ strategies }: { strategies: StrategyRow[] }) {
  const metrics = ['Sharpe', 'Win Rate', 'Return', 'DD', 'Trades'];

  const getColor = (value: number | null | undefined, min: number, max: number): string => {
    if (value == null) return 'var(--bg-panel)';
    const normalized = (value - min) / (max - min || 1);
    if (normalized > 0.5) {
      const intensity = (normalized - 0.5) * 2;
      return `rgba(16, 185, 129, ${0.2 + intensity * 0.5})`;
    } else {
      const intensity = (0.5 - normalized) * 2;
      return `rgba(239, 68, 68, ${0.2 + intensity * 0.5})`;
    }
  };

  const metricRanges: Record<string, { min: number; max: number }> = {
    'Sharpe': { min: -1, max: 3 },
    'Win Rate': { min: 0, max: 1 },
    'Return': { min: -0.2, max: 0.5 },
    'DD': { min: 0, max: 0.3 },
    'Trades': { min: 0, max: 1000 },
  };

  return (
    <div style={{
      background: 'var(--bg-panel)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      padding: '16px',
    }}>
      <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-primary)' }}>
        Strategy Performance Heatmap
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>Strategy</th>
              {metrics.map((m) => (
                <th key={m} style={{ textAlign: 'center', padding: '8px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(strategies ?? []).map((s, idx) => (
              <tr key={s.id ?? idx}>
                <td style={{ padding: '10px 8px', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {s.name ?? s.id}
                </td>
                <td style={{ textAlign: 'center', padding: '10px 8px', background: getColor(s.sharpe, metricRanges['Sharpe'].min, metricRanges['Sharpe'].max) }}>
                  {s.sharpe != null ? s.sharpe.toFixed(2) : '—'}
                </td>
                <td style={{ textAlign: 'center', padding: '10px 8px', background: getColor(s.winRate, metricRanges['Win Rate'].min, metricRanges['Win Rate'].max) }}>
                  {s.winRate != null ? `${(s.winRate * 100).toFixed(1)}%` : '—'}
                </td>
                <td style={{ textAlign: 'center', padding: '10px 8px', background: getColor(s.totalReturn, metricRanges['Return'].min, metricRanges['Return'].max) }}>
                  {s.totalReturn != null ? `${(s.totalReturn * 100).toFixed(1)}%` : '—'}
                </td>
                <td style={{ textAlign: 'center', padding: '10px 8px', background: getColor(-(s.maxDrawdown ?? 0), metricRanges['DD'].min, metricRanges['DD'].max) }}>
                  {s.maxDrawdown != null ? `${(s.maxDrawdown * 100).toFixed(1)}%` : '—'}
                </td>
                <td style={{ textAlign: 'center', padding: '10px 8px', fontFamily: 'var(--font-mono)' }}>
                  {s.tradeCount ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ParameterDriftChart({ driftHistory }: { driftHistory: DriftPoint[] }) {
  const maxPoints = 20;
  const points = (driftHistory ?? []).slice(-maxPoints);

  if (points.length < 2) {
    return (
      <div style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '16px',
      }}>
        <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>
          Parameter Drift Detection
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
          No drift history available. Start a WFO run to track parameter stability.
        </div>
      </div>
    );
  }

  const width = 300;
  const height = 60;
  const xStep = width / (points.length - 1);
  const maxVal = Math.max(...points.map((p) => p.value ?? 0));
  const minVal = Math.min(...points.map((p) => p.value ?? 0));
  const range = maxVal - minVal || 1;

  const pathD = points.map((p, i) => {
    const x = i * xStep;
    const y = height - ((p.value - minVal) / range) * (height - 10) - 5;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  const driftDetected = points.some((p) => p.drift);
  const lastDrift = points.filter((p) => p.drift).pop();

  return (
    <div style={{
      background: 'var(--bg-panel)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      padding: '16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
          Parameter Drift Detection
        </div>
        {driftDetected && (
          <div style={{
            padding: '4px 8px',
            background: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '10px',
            color: 'var(--accent-red)',
            fontWeight: 600,
          }}>
            DRIFT DETECTED
          </div>
        )}
      </div>

      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
        <path d={pathD} fill="none" stroke="var(--accent-cyan)" strokeWidth="2" />
        {points.filter((p) => p.drift).map((p, i) => {
          const x = i * xStep;
          const y = height - ((p.value - minVal) / range) * (height - 10) - 5;
          return <circle key={i} cx={x} cy={y} r="4" fill="var(--accent-red)" />;
        })}
      </svg>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '10px', color: 'var(--text-muted)' }}>
        <span>Window 1</span>
        <span>Window {points.length}</span>
      </div>

      {lastDrift && (
        <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--accent-red)' }}>
          Last drift at window {lastDrift.window}: {lastDrift.param} changed {lastDrift.change?.toFixed(2) ?? '—'}%
        </div>
      )}
    </div>
  );
}

export default function StrategyComparisonView() {
  const abTests = (useDashboardStore((s) => (s as any).abTests) ?? []) as ABTest[];
  const strategies = useDashboardStore((s) => s.strategies ?? []) as unknown as StrategyRow[];
  const driftHistory = (useDashboardStore((s) => (s as any).driftHistory) ?? []) as DriftPoint[];

  const runningTests = abTests.filter((t) => t.status === 'running');
  const completedTests = abTests.filter((t) => t.status === 'completed');

  return (
    <MissionTabFrame
      number={7}
      title="Strategy Comparison"
      subtitle="A/B testing, performance heatmaps, and parameter drift monitoring"
      indicators={[
        { label: 'Running Tests', value: `${runningTests.length}`, detail: 'Variants currently accumulating samples', status: runningTests.length > 0 ? 'info' : 'neutral' },
        { label: 'Completed', value: `${completedTests.length}`, detail: 'Finished comparisons with winner selection', status: completedTests.length > 0 ? 'ok' : 'neutral' },
        { label: 'Strategies', value: `${strategies.length}`, detail: 'Rows feeding the heatmap', status: strategies.length > 0 ? 'ok' : 'warn' },
        { label: 'Drift Alerts', value: `${driftHistory.filter((d) => d.drift).length}`, detail: 'Parameter instability windows flagged', status: driftHistory.some((d) => d.drift) ? 'error' : 'ok' },
      ]}
      notes={[
        'This tab is driven from app state: `abTests`, `strategies`, and `driftHistory` should be patched from Mission Control APIs or WebSocket events.',
        'The `+ New A/B Test` action remains intentionally stubbed until the creation flow and backend route contract are finalized.',
        'Heatmap coloring uses per-metric ranges so weak strategies are visually obvious before deeper drill-down tooling exists.',
      ]}
    >
      <div className="view-header" style={{ marginBottom: 0 }}>
        <div></div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn-primary"
            onClick={() => {
              console.log('Create new A/B test');
            }}
          >
            + New A/B Test
          </button>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: '12px',
        marginBottom: '20px',
      }}>
        {[
          { label: 'Active Tests', value: runningTests.length, color: 'var(--accent-blue)' },
          { label: 'Completed Tests', value: completedTests.length, color: 'var(--accent-green)' },
          { label: 'Strategies', value: strategies.length, color: 'var(--accent-cyan)' },
          { label: 'Drift Alerts', value: driftHistory.filter((d) => d.drift).length, color: 'var(--accent-red)' },
        ].map((stat) => (
          <div key={stat.label} style={{
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: stat.color, fontFamily: 'var(--font-mono)' }}>
              {stat.value}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {runningTests.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-primary)' }}>
            Running A/B Tests
          </div>
          <div className="agents-grid">
            {runningTests.map((test) => (
              <ABTestCard key={test.testId} test={test} />
            ))}
          </div>
        </div>
      )}

      {completedTests.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-primary)' }}>
            Completed Tests
          </div>
          <div className="agents-grid">
            {completedTests.slice(0, 4).map((test) => (
              <ABTestCard key={test.testId} test={test} />
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom: '24px' }}>
        <StrategyHeatmap strategies={strategies} />
      </div>

      <div>
        <ParameterDriftChart driftHistory={driftHistory} />
      </div>
    </MissionTabFrame>
  );
}