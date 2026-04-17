import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface PhaseBadgeProps {
  phase: string;
}

function PhaseBadge({ phase }: PhaseBadgeProps) {
  const colors: Record<string, { bg: string; border: string; text: string }> = {
    EVALUATION: { bg: 'rgba(59,130,246,0.15)', border: '#3B82F6', text: '#60A5FA' },
    FUNDED: { bg: 'rgba(16,185,129,0.15)', border: '#10B981', text: '#34D399' },
    SCALING: { bg: 'rgba(139,92,246,0.15)', border: '#8B5CF6', text: '#A78BFA' },
  };
  const c = colors[phase] || colors.EVALUATION;

  return (
    <span style={{
      background: c.bg,
      border: `1px solid ${c.border}`,
      borderRadius: 6,
      padding: '4px 12px',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.8px',
      textTransform: 'uppercase' as const,
      color: c.text,
    }}>
      {phase}
    </span>
  );
}

interface DrawdownGaugeProps {
  percent: number;
  status: string;
}

function DrawdownGauge({ percent, status }: DrawdownGaugeProps) {
  const size = 160;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  const colorMap: Record<string, string> = {
    safe: '#10B981',
    caution: '#F59E0B',
    danger: '#EF4444',
    critical: '#991B1B',
  };
  const color = colorMap[status] || colorMap.safe;

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle
          cx={center} cy={center} r={radius} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' as const }}>
        <div style={{ fontSize: 28, fontWeight: 700, color }}>{percent.toFixed(0)}%</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Buffer</div>
      </div>
    </div>
  );
}

interface ChartPoint {
  day?: number;
  cumulative?: number;
  y?: number;
  x?: number;
}

interface ProgressChartProps {
  actual: ChartPoint[];
  ideal: ChartPoint[];
  projected?: ChartPoint[];
  width?: number;
  height?: number;
}

function ProgressChart({ actual, ideal, projected, width, height }: ProgressChartProps) {
  const W = width || 500;
  const H = height || 200;
  const PAD = { top: 20, right: 20, bottom: 30, left: 50 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  if (!actual || actual.length < 2) {
    return <div style={{ width: W, height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Loading chart...</div>;
  }

  const allPoints = [...actual, ...ideal, ...(projected || [])];
  const maxY = Math.max(...allPoints.map(p => p.cumulative || p.y || 0)) * 1.1 || 4000;
  const maxX = Math.max(...allPoints.map(p => p.day || p.x || 0)) || 30;

  const scaleX = (d: number) => PAD.left + (d / maxX) * innerW;
  const scaleY = (v: number) => PAD.top + innerH - (v / maxY) * innerH;

  const buildPath = (points: ChartPoint[]) => {
    if (!points || points.length < 2) return '';
    return points.map((p, i) => {
      const x = scaleX(p.day || p.x || i + 1);
      const y = scaleY(p.cumulative || p.y || 0);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  const actualPath = buildPath(actual);
  const idealPath = buildPath(ideal);
  const projectedPath = projected ? buildPath(projected) : '';

  const yTicks = [0, maxY * 0.25, maxY * 0.5, maxY * 0.75, maxY];
  const xTicks = [0, maxX * 0.25, maxX * 0.5, maxX * 0.75, maxX].map(Math.round);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      {yTicks.map((v, i) => (
        <g key={`gy${i}`}>
          <line x1={PAD.left} y1={scaleY(v)} x2={W - PAD.right} y2={scaleY(v)} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
          <text x={PAD.left - 8} y={scaleY(v) + 4} textAnchor="end" fill="var(--text-muted)" fontSize={10} fontFamily="var(--font-mono)">{`$${(v / 1000).toFixed(0)}k`}</text>
        </g>
      ))}
      {xTicks.map((d, i) => (
        <g key={`gx${i}`}>
          <line x1={scaleX(d)} y1={PAD.top} x2={scaleX(d)} y2={H - PAD.bottom} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
          <text key={`x${i}`} x={scaleX(d)} y={H - 8} textAnchor="middle" fill="var(--text-muted)" fontSize={10} fontFamily="var(--font-mono)">{`Day ${d}`}</text>
        </g>
      ))}
      <path d={idealPath} fill="none" stroke="rgba(139,150,168,0.4)" strokeWidth={1.5} strokeDasharray="4,4" />
      {projectedPath && <path d={projectedPath} fill="none" stroke="rgba(16,185,129,0.3)" strokeWidth={1.5} strokeDasharray="2,2" />}
      <path d={actualPath} fill="none" stroke="#10B981" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle
        cx={scaleX(actual[actual.length - 1]?.day || actual.length)}
        cy={scaleY(actual[actual.length - 1]?.cumulative || actual[actual.length - 1]?.y || 0)}
        r={5} fill="#10B981" stroke="var(--bg-panel)" strokeWidth={2}
      />
    </svg>
  );
}

interface ConsistencyChartProps {
  dailyProfits: Array<{ profit: number; loss: number }>;
  maxDayPercent: string;
}

function ConsistencyChart({ dailyProfits, maxDayPercent }: ConsistencyChartProps) {
  if (!dailyProfits || dailyProfits.length === 0) {
    return <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No data yet</div>;
  }

  const maxVal = Math.max(...dailyProfits.map(d => Math.max(d.profit, d.loss)), 500);
  const barWidth = Math.min(24, 400 / dailyProfits.length - 2);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120, paddingBottom: 20 }}>
      {dailyProfits.map((day, i) => {
        const profitHeight = (day.profit / maxVal) * 100;
        const lossHeight = (day.loss / maxVal) * 100;
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <div style={{ width: barWidth, height: Math.max(2, profitHeight), background: day.profit > 0 ? '#10B981' : 'transparent', borderRadius: '2px 2px 0 0' }} />
            <div style={{ width: barWidth, height: Math.max(2, lossHeight), background: day.loss > 0 ? '#EF4444' : 'transparent', borderRadius: '0 0 2px 2px' }} />
            {i % 7 === 0 && <span style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>{`D${i + 1}`}</span>}
          </div>
        );
      })}
    </div>
  );
}

interface TradeListProps {
  trades: Array<{ timestamp: string; symbol: string; direction: string; pnl: number; r: number }>;
}

function TradeList({ trades }: TradeListProps) {
  if (!trades || trades.length === 0) {
    return <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: 16 }}>No recent trades</div>;
  }

  return (
    <div style={{ maxHeight: 200, overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>{['Time', 'Symbol', 'Dir', 'P&L', 'R'].map(h => (
            <th key={h} style={{ textAlign: h === 'Time' ? 'left' : 'right', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 10, letterSpacing: '0.4px', borderBottom: '1px solid var(--border-subtle)' }}>{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {trades.slice(0, 8).map((trade, i) => {
            const pnlPos = trade.pnl >= 0;
            return (
              <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                <td style={{ padding: '6px 8px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>{trade.timestamp.split('T')[1]?.slice(0, 5) || '--:--'}</td>
                <td style={{ padding: '6px 8px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{trade.symbol}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: trade.direction === 'LONG' ? '#10B981' : '#EF4444', fontWeight: 600, fontSize: 11 }}>{trade.direction}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: pnlPos ? '#10B981' : '#EF4444' }}>{`${pnlPos ? '+' : ''}$${trade.pnl.toFixed(2)}`}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: trade.r >= 0 ? '#10B981' : '#EF4444' }}>{`${trade.r >= 0 ? '+' : ''}${trade.r.toFixed(2)}R`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface PresetSelectorProps {
  current: string;
  presets: Array<{ name: string; provider: string; accountSize: number; profitTarget: number }>;
  onSelect: (name: string) => void;
}

function PresetSelector({ current, presets, onSelect }: PresetSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setIsOpen(!isOpen)} style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{current || 'Select Preset'}</span>
        <span style={{ fontSize: 10 }}>{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && (
        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', borderRadius: 6, minWidth: 200, zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
          {presets.map(p => (
            <div key={p.name} onClick={() => { onSelect(p.name); setIsOpen(false); }} style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)', background: p.name === current ? 'rgba(59,130,246,0.1)' : 'transparent' }}>
              <div style={{ fontWeight: 600, fontSize: 12 }}>{p.name}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{`${p.provider} • $${(p.accountSize / 1000).toFixed(0)}K • Target: $${p.profitTarget}`}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface PropFirmStatus {
  phase: string;
  evaluation: {
    currentEquity: number;
    netPnL: number;
    daysActive: number;
    daysRemaining: number;
    profitTarget: number;
    trades: Array<{ timestamp: string; symbol: string; direction: string; pnl: number; r: number }>;
  };
  projection: {
    overallProbability: number;
  };
}

interface PropFirmRules {
  provider: string;
  accountSize: number;
  preset: string;
  rules: {
    profitTarget: number;
    maxLossLimit: number;
    dailyLossLimit: number | null;
    consistencyRule: { maxDayPercent: number | null; description: string };
    minTradingDays: number | null;
    maxTradingDays: number | null;
  };
}

interface PropFirmDrawdown {
  bufferPercent: number;
  status: string;
  maxAllowed: number;
  current: number;
}

interface PropFirmPace {
  rSquared: number;
  progressPercent: number;
  onTrack: boolean;
  projectedDaysToTarget: number;
  chartData: {
    actual: ChartPoint[];
    ideal: ChartPoint[];
    projected?: ChartPoint[];
  };
}

interface PropFirmConsistency {
  passed: boolean;
  dailyProfits: Array<{ profit: number; loss: number }>;
  maxDayPercent: string;
  bestDay: number;
  worstDay: number;
}

export default function PropFirmView() {
  const [status, setStatus] = useState<PropFirmStatus | null>(null);
  const [rules, setRules] = useState<PropFirmRules | null>(null);
  const [drawdown, setDrawdown] = useState<PropFirmDrawdown | null>(null);
  const [pace, setPace] = useState<PropFirmPace | null>(null);
  const [consistency, setConsistency] = useState<PropFirmConsistency | null>(null);
  const [presets, setPresets] = useState<{ current: string; presets: Array<{ name: string; provider: string; accountSize: number; profitTarget: number }> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchAll() {
    setLoading(true);
    try {
      const [statusData, rulesData, ddData, paceData, consData, presetsData] = await Promise.all([
        invoke('prop_firm_status') as Promise<PropFirmStatus>,
        invoke('prop_firm_rules') as Promise<PropFirmRules>,
        invoke('prop_firm_drawdown') as Promise<PropFirmDrawdown>,
        invoke('prop_firm_pace') as Promise<PropFirmPace>,
        invoke('prop_firm_consistency') as Promise<PropFirmConsistency>,
        invoke('prop_firm_presets') as Promise<{ current: string; presets: Array<{ name: string; provider: string; accountSize: number; profitTarget: number }> }>,
      ]);
      setStatus(statusData);
      setRules(rulesData);
      setDrawdown(ddData);
      setPace(paceData);
      setConsistency(consData);
      setPresets(presetsData);
      setLoading(false);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, []);

  async function handlePresetChange(presetName: string) {
    try {
      await invoke('prop_firm_preset', { name: presetName });
      await fetchAll();
    } catch { /* ignore */ }
  }

  async function handleReset() {
    if (!confirm('Reset evaluation? This clears all progress.')) return;
    try {
      await invoke('prop_firm_reset');
      await fetchAll();
    } catch { /* ignore */ }
  }

  if (loading) {
    return (
      <div className="prop-firm-view">
        <div className="view-header">
          <div className="view-title">Prop Firm</div>
          <div className="view-subtitle">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="prop-firm-view">
        <div className="view-header">
          <div className="view-title">Prop Firm</div>
          <div style={{ color: 'var(--accent-red)' }}>{`Error: ${error}`}</div>
        </div>
      </div>
    );
  }

  const phase = status?.phase || 'EVALUATION';
  const evalData = status?.evaluation || { currentEquity: 50000, netPnL: 0, daysActive: 0, daysRemaining: 0, profitTarget: 3000, trades: [] };
  const proj = status?.projection || { overallProbability: 0 };

  return (
    <div className="prop-firm-view">
      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <div className="view-title">Prop Firm Dashboard</div>
            <PhaseBadge phase={phase} />
          </div>
          <div className="view-subtitle">{`${rules?.provider || 'Unknown'} • $${((rules?.accountSize || 50000) / 1000).toFixed(0)}K Account`}</div>
        </div>
        {presets && <PresetSelector current={presets.current} presets={presets.presets} onSelect={handlePresetChange} />}
      </div>

      <div className="panel" style={{ padding: '16px 20px', marginBottom: 16, display: 'flex', gap: 32, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current Equity</div>
          <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{`$${(evalData.currentEquity || 50000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Net P&L</div>
          <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: (evalData.netPnL || 0) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
            {`${(evalData.netPnL || 0) >= 0 ? '+' : ''}$${(evalData.netPnL || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Days Active</div>
          <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{`${evalData.daysActive || 0} / ${(evalData.daysActive || 0) + (evalData.daysRemaining || 0) || 30}`}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Profit Target</div>
          <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{`$${(evalData.profitTarget || 3000).toLocaleString()}`}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pass Probability</div>
          <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: proj.overallProbability > 0.7 ? 'var(--accent-green)' : proj.overallProbability > 0.4 ? 'var(--accent-yellow)' : 'var(--accent-red)' }}>
            {`${((proj.overallProbability || 0) * 100).toFixed(0)}%`}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="panel" style={{ padding: '14px 16px' }}>
          <div className="panel-header" style={{ marginBottom: 12 }}>
            <span className="panel-title">Trailing Drawdown Buffer</span>
            <span style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 4,
              background: drawdown?.status === 'safe' ? 'rgba(16,185,129,0.15)' :
                          drawdown?.status === 'caution' ? 'rgba(245,158,11,0.15)' :
                          drawdown?.status === 'danger' ? 'rgba(239,68,68,0.15)' : 'rgba(153,27,27,0.15)',
              color: drawdown?.status === 'safe' ? '#34D399' :
                     drawdown?.status === 'caution' ? '#FBBF24' :
                     drawdown?.status === 'danger' ? '#F87171' : '#FCA5A5',
            }}>
              {drawdown?.status?.toUpperCase() || 'UNKNOWN'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <DrawdownGauge percent={drawdown?.bufferPercent || 100} status={drawdown?.status || 'safe'} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 11, color: 'var(--text-secondary)' }}>
            <span>{`Max DD: $${(drawdown?.maxAllowed || 2000).toLocaleString()}`}</span>
            <span>{`Current: $${(drawdown?.current || 0).toLocaleString()}`}</span>
          </div>
        </div>

        <div className="panel" style={{ padding: '14px 16px' }}>
          <div className="panel-header" style={{ marginBottom: 12 }}>
            <span className="panel-title">Daily Profit Distribution</span>
            <span style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 4,
              background: consistency?.passed ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
              color: consistency?.passed ? '#34D399' : '#F87171',
            }}>
              {consistency?.passed ? 'PASSED' : 'CHECK'}
            </span>
          </div>
          <div style={{ position: 'relative', height: 140 }}>
            <ConsistencyChart dailyProfits={consistency?.dailyProfits || []} maxDayPercent={consistency?.maxDayPercent || '50%'} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: 'var(--text-muted)' }}>
            <span>{`Best Day: $${(consistency?.bestDay || 0).toFixed(0)}`}</span>
            <span>{`Worst Day: -$${(consistency?.worstDay || 0).toFixed(0)}`}</span>
            <span>{`Max: ${consistency?.maxDayPercent || '50%'}`}</span>
          </div>
        </div>
      </div>

      <div className="panel" style={{ padding: '14px 16px', marginBottom: 16 }}>
        <div className="panel-header" style={{ marginBottom: 12 }}>
          <span className="panel-title">Profit Pace vs Target</span>
          <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
            <span style={{ color: '#10B981' }}>Actual</span>
            <span style={{ color: 'rgba(139,150,168,0.6)' }}>Ideal</span>
            <span>{`R2: ${(pace?.rSquared || 1).toFixed(3)}`}</span>
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          <ProgressChart actual={pace?.chartData?.actual || []} ideal={pace?.chartData?.ideal || []} projected={pace?.chartData?.projected || []} width={600} height={160} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 11, color: 'var(--text-secondary)' }}>
          <span>
            {`Progress: ${(pace?.progressPercent || 0).toFixed(1)}%`}
            {pace?.onTrack
              ? <span style={{ color: 'var(--accent-green)', marginLeft: 8 }}>On Track</span>
              : <span style={{ color: 'var(--accent-red)', marginLeft: 8 }}>Behind Pace</span>
            }
          </span>
          <span>{`Est. Completion: Day ${pace?.projectedDaysToTarget || 30}`}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="panel" style={{ padding: '14px 16px' }}>
          <div className="panel-header" style={{ marginBottom: 12 }}>
            <span className="panel-title">Active Rules</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{rules?.preset || 'Unknown'}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'Profit Target', value: `$${(rules?.rules?.profitTarget || 3000).toLocaleString()}` },
              { label: 'Max Loss', value: `$${(rules?.rules?.maxLossLimit || 2000).toLocaleString()}` },
              { label: 'Daily Loss Limit', value: rules?.rules?.dailyLossLimit ? `$${rules.rules.dailyLossLimit}` : 'None' },
              { label: 'Consistency', value: rules?.rules?.consistencyRule?.maxDayPercent ? `${(rules.rules.consistencyRule.maxDayPercent * 100).toFixed(0)}%` : 'None' },
              { label: 'Min Days', value: rules?.rules?.minTradingDays ? String(rules.rules.minTradingDays) : 'None' },
              { label: 'Max Days', value: rules?.rules?.maxTradingDays ? String(rules.rules.maxTradingDays) : 'None' },
            ].map(r => (
              <div key={r.label} style={{ padding: '8px 0' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{r.label}</div>
                <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{r.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel" style={{ padding: '14px 16px' }}>
          <div className="panel-header" style={{ marginBottom: 12 }}>
            <span className="panel-title">Recent Trades</span>
            <button onClick={handleReset} style={{ fontSize: 10, padding: '4px 10px', borderRadius: 4, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>Reset</button>
          </div>
          <TradeList trades={status?.evaluation?.trades || []} />
        </div>
      </div>
    </div>
  );
}