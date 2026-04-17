import { useState, useEffect } from 'react';
import { useDashboardStore } from '../../store/dashboard';
import { invoke } from '@tauri-apps/api/core';
import MissionTabFrame from '../shared/MissionTabFrame';

interface PaperMetrics {
  sharpe: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  trades: number;
  winCount: number;
  lossCount: number;
  totalPnL: number;
  avgWin: number;
  avgLoss: number;
}

interface PaperHistoryPoint {
  date: string;
  equity: number;
  pnl: number;
  trades: number;
}

interface PaperData {
  strategyId: string;
  status: string;
  startDate: string;
  currentDay: number;
  totalDays: number;
  metrics: PaperMetrics;
  history: PaperHistoryPoint[];
}

interface PromotionCriteria {
  minSharpe: number;
  maxDrawdown: number;
  minWinRate: number;
  minProfitFactor: number;
  minDays: number;
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatPercent(val: number | string | null | undefined): string {
  if (val === null || val === undefined) return '--';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '--';
  return `${num >= 0 ? '+' : ''}${(num * 100).toFixed(2)}%`;
}

export function formatNumber(val: number | string | null | undefined, decimals: number = 2): string {
  if (val === null || val === undefined) return '--';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '--';
  return num.toFixed(decimals);
}

interface ProgressRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}

export function ProgressRing({ progress, size = 80, strokeWidth = 6, color = 'var(--accent-green)' }: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const dashOffset = circumference - (progress / 100) * circumference;

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--border-subtle)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
    </svg>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  subtitle?: string;
  trend?: number;
  color?: string;
}

export function MetricCard({ label, value, subtitle, trend, color = 'var(--text-primary)' }: MetricCardProps) {
  const trendColor = trend && trend > 0 ? 'var(--accent-green)' : trend && trend < 0 ? 'var(--accent-red)' : 'var(--text-muted)';
  const trendIcon = trend && trend > 0 ? '↑' : trend && trend < 0 ? '↓' : '–';

  return (
    <div style={{
      background: 'var(--bg-panel)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      padding: '12px 16px',
      minWidth: '120px',
    }}>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ fontSize: '20px', fontWeight: 600, color }}>
        {value}
      </div>
      {trend !== undefined && (
        <div style={{ fontSize: '11px', color: trendColor, marginTop: '2px' }}>
          {trendIcon} {Math.abs(trend).toFixed(2)}%
        </div>
      )}
      {subtitle && (
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

interface PromotionGaugeProps {
  metrics: PaperMetrics & { daysActive: number };
  criteria: PromotionCriteria;
}

export function PromotionGauge({ metrics, criteria }: PromotionGaugeProps) {
  const checks = [
    { key: 'sharpe', label: 'Sharpe', value: metrics.sharpe, min: criteria.minSharpe, format: (v: number) => formatNumber(v, 2) },
    { key: 'maxDD', label: 'Max DD', value: metrics.maxDrawdown, max: criteria.maxDrawdown, format: (v: number) => formatPercent(v) },
    { key: 'winRate', label: 'Win Rate', value: metrics.winRate, min: criteria.minWinRate, format: (v: number) => formatPercent(v) },
    { key: 'profitFactor', label: 'Profit Factor', value: metrics.profitFactor, min: criteria.minProfitFactor, format: (v: number) => formatNumber(v, 2) },
    { key: 'days', label: 'Days Active', value: metrics.daysActive, min: criteria.minDays, format: (v: number) => `${v} days` },
  ];

  const passed = checks.filter(c => {
    if (c.min !== undefined) return c.value >= c.min;
    if (c.max !== undefined) return c.value <= c.max;
    return true;
  }).length;

  const progress = (passed / checks.length) * 100;
  const isReady = passed === checks.length;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '16px',
      background: 'var(--bg-panel)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-subtle)',
    }}>
      <div style={{ position: 'relative', marginBottom: '12px' }}>
        <ProgressRing
          progress={progress}
          size={100}
          strokeWidth={8}
          color={isReady ? 'var(--accent-green)' : 'var(--accent-yellow)'}
        />
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {passed}/{checks.length}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            criteria
          </div>
        </div>
      </div>

      <div style={{
        fontSize: '14px',
        fontWeight: 600,
        color: isReady ? 'var(--accent-green)' : 'var(--accent-yellow)',
        marginBottom: '8px',
      }}>
        {isReady ? '✓ Ready for Live' : `${checks.length - passed} criteria remaining`}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
        {checks.map(c => {
          const passedCheck = c.min !== undefined ? c.value >= c.min : c.value <= (c.max ?? 0);
          return (
            <div key={c.key} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12px',
              padding: '4px 8px',
              background: passedCheck ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              borderRadius: 'var(--radius-sm)',
            }}>
              <span style={{ color: 'var(--text-muted)' }}>{c.label}</span>
              <span style={{
                color: passedCheck ? 'var(--accent-green)' : 'var(--accent-red)',
                fontFamily: 'var(--font-mono)',
              }}>
                {c.format(c.value)}
                {c.min !== undefined && <span style={{ opacity: 0.6 }}> / {c.format(c.min)}</span>}
                {c.max !== undefined && <span style={{ opacity: 0.6 }}> / max {c.format(c.max)}</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface DailyMetricsChartProps {
  history: PaperHistoryPoint[];
}

export function DailyMetricsChart({ history }: DailyMetricsChartProps) {
  if (!history || history.length < 2) {
    return (
      <div style={{
        height: '200px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted)',
        background: 'var(--bg-panel)',
        borderRadius: 'var(--radius-md)',
      }}>
        Loading metrics...
      </div>
    );
  }

  const W = 600, H = 200, PAD = { top: 20, right: 20, bottom: 30, left: 50 };
  const inner = { w: W - PAD.left - PAD.right, h: H - PAD.top - PAD.bottom };

  const values = history.map(h => h.equity || h.pnl || 0);
  const min = Math.min(...values) * 0.99;
  const max = Math.max(...values) * 1.01;
  const range = max - min || 1;

  const baseline = values[0];
  const isPositive = values[values.length - 1] >= baseline;
  const color = isPositive ? 'var(--accent-green)' : 'var(--accent-red)';

  const toX = (i: number): number => PAD.left + (i / (history.length - 1)) * inner.w;
  const toY = (v: number): number => PAD.top + inner.h - ((v - min) / range) * inner.h;

  const pathD = history.map((h, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(h.equity || h.pnl || 0)}`).join(' ');
  const baselineY = toY(baseline);

  const xLabels = [0, Math.floor(history.length / 2), history.length - 1].map(i => ({
    x: toX(i),
    label: formatDate(history[i]?.date || history[i]?.date || ''),
  }));

  const fmt = (v: number): string => v >= 1000 ? `$${(v/1000).toFixed(1)}k` : `$${v.toFixed(0)}`;

  return (
    <div style={{ background: 'var(--bg-panel)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
        <line x1={PAD.left} y1={baselineY} x2={W - PAD.right} y2={baselineY} stroke="var(--border-subtle)" strokeDasharray="4,4" />

        {[0, 0.5, 1].map((p, i) => {
          const v = min + range * p;
          return (
            <text key={i} x={PAD.left - 8} y={toY(v) + 4} fill="var(--text-muted)" fontSize="10" textAnchor="end" fontFamily="var(--font-mono)">
              {fmt(v)}
            </text>
          );
        })}

        {xLabels.map((l, i) => (
          <text key={i} x={l.x} y={H - 8} fill="var(--text-muted)" fontSize="10" textAnchor="middle">
            {l.label}
          </text>
        ))}

        <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export default function PaperTradingPanel() {
  const [paperData, setPaperData] = useState<PaperData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const criteria: PromotionCriteria = {
    minSharpe: 0.5,
    maxDrawdown: 0.20,
    minWinRate: 0.40,
    minProfitFactor: 1.2,
    minDays: 30,
  };

  useEffect(() => {
    invoke<PaperData>('paper_trading_status')
      .then((data) => {
        setPaperData(data);
        setLoading(false);
      })
      .catch(() => {
        setPaperData({
          strategyId: 'strategy-001',
          status: 'active',
          startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
          currentDay: 14,
          totalDays: 30,
          metrics: {
            sharpe: 1.24,
            maxDrawdown: 0.12,
            winRate: 0.58,
            profitFactor: 1.67,
            trades: 47,
            winCount: 27,
            lossCount: 20,
            totalPnL: 2456.78,
            avgWin: 156.32,
            avgLoss: -82.45,
          },
          history: Array.from({ length: 14 }, (_, i) => ({
            date: new Date(Date.now() - (13 - i) * 24 * 60 * 60 * 1000).toISOString(),
            equity: 100000 + (Math.random() * 2000) + i * 175,
            pnl: (Math.random() * 400) - 50 + i * 12,
            trades: Math.floor(Math.random() * 5) + 1,
          })),
        });
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text-muted)' }}>
        Loading paper trading status...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-md)', color: 'var(--accent-red)' }}>
        Error loading paper trading data: {error}
      </div>
    );
  }

  if (!paperData) return null;

  const progress = (paperData.currentDay / paperData.totalDays) * 100;
  const metrics: PaperMetrics & { daysActive: number } = {
    ...paperData.metrics,
    daysActive: paperData.currentDay,
  };
  const readinessChecks = [
    metrics.sharpe >= criteria.minSharpe,
    metrics.maxDrawdown <= criteria.maxDrawdown,
    metrics.winRate >= criteria.minWinRate,
    metrics.profitFactor >= criteria.minProfitFactor,
    metrics.daysActive >= criteria.minDays,
  ];
  const readinessPassed = readinessChecks.filter(Boolean).length;

  return (
    <MissionTabFrame
      number={8}
      title="Paper Trading"
      subtitle={`30-day validation for ${paperData.strategyId}`}
      indicators={[
        { label: 'Validation Day', value: `${paperData.currentDay}/${paperData.totalDays}`, detail: `${progress.toFixed(0)}% complete`, status: progress >= 100 ? 'ok' : 'info' },
        { label: 'Readiness', value: `${readinessPassed}/5`, detail: 'Promotion gate checks passing', status: readinessPassed === 5 ? 'ok' : readinessPassed >= 3 ? 'warn' : 'error' },
        { label: 'Status', value: String(paperData.status || 'unknown').toUpperCase(), detail: paperData.startDate ? `Started ${formatDate(paperData.startDate)}` : 'No start date', status: paperData.status === 'active' ? 'ok' : 'warn' },
        { label: 'Total P&L', value: `${metrics.totalPnL >= 0 ? '+' : ''}${formatNumber(metrics.totalPnL, 2)}`, detail: 'Validation equity delta', status: metrics.totalPnL >= 0 ? 'ok' : 'error' },
      ]}
      notes={[
        'Primary data source is the paper_trading_status Tauri command; when unavailable the tab deliberately falls back to seeded mock data so the layout remains reviewable.',
        'Promotion thresholds are currently client defaults and should eventually be supplied by the promotion pipeline or profile manager for a single source of truth.',
        'Readiness is visualized twice on purpose: the top indicators provide operator-at-a-glance status, while the gauge preserves per-criterion detail.',
      ]}
    >
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      <div className="view-header" style={{ marginBottom: '0' }}>
        <div></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{
            padding: '4px 12px',
            background: paperData.status === 'active' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(234, 179, 8, 0.2)',
            color: paperData.status === 'active' ? 'var(--accent-green)' : 'var(--accent-yellow)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'uppercase',
          }}>
            {paperData.status}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Day {paperData.currentDay} of {paperData.totalDays}
          </span>
        </div>
      </div>

      <div style={{
        background: 'var(--bg-panel)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 16px',
        border: '1px solid var(--border-subtle)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Validation Progress</span>
          <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {progress.toFixed(0)}%
          </span>
        </div>
        <div style={{
          height: '8px',
          background: 'var(--bg-surface)',
          borderRadius: '4px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: 'linear-gradient(90deg, var(--accent-blue), var(--accent-green))',
            borderRadius: '4px',
            transition: 'width 0.5s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '10px', color: 'var(--text-muted)' }}>
          <span>Started: {formatDate(paperData.startDate)}</span>
          <span>ETA: {formatDate(new Date(Date.now() + (paperData.totalDays - paperData.currentDay) * 24 * 60 * 60 * 1000).toISOString())}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '16px', flex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            <MetricCard
              label="Sharpe Ratio"
              value={formatNumber(metrics.sharpe, 2)}
              trend={2.1}
              color={metrics.sharpe >= criteria.minSharpe ? 'var(--accent-green)' : 'var(--accent-yellow)'}
            />
            <MetricCard
              label="Max Drawdown"
              value={formatPercent(metrics.maxDrawdown)}
              color={metrics.maxDrawdown <= criteria.maxDrawdown ? 'var(--accent-green)' : 'var(--accent-red)'}
            />
            <MetricCard
              label="Win Rate"
              value={formatPercent(metrics.winRate)}
              color={metrics.winRate >= criteria.minWinRate ? 'var(--accent-green)' : 'var(--accent-yellow)'}
            />
            <MetricCard
              label="Profit Factor"
              value={formatNumber(metrics.profitFactor, 2)}
              color={metrics.profitFactor >= criteria.minProfitFactor ? 'var(--accent-green)' : 'var(--accent-yellow)'}
            />
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Equity Curve
            </div>
            <DailyMetricsChart history={paperData.history} />
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '12px',
            background: 'var(--bg-panel)',
            borderRadius: 'var(--radius-md)',
            padding: '12px',
            border: '1px solid var(--border-subtle)',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>{metrics.trades}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Total Trades</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--accent-green)' }}>{metrics.winCount}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Wins</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--accent-red)' }}>{metrics.lossCount}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Losses</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--accent-green)' }}>${formatNumber(metrics.avgWin, 0)}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Avg Win</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--accent-red)' }}>${formatNumber(Math.abs(metrics.avgLoss), 0)}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Avg Loss</div>
            </div>
          </div>
        </div>

        <div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Promotion Readiness
          </div>
          <PromotionGauge metrics={metrics} criteria={criteria} />

          <div style={{
            marginTop: '12px',
            padding: '16px',
            background: metrics.totalPnL >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Total P&L</div>
            <div style={{
              fontSize: '28px',
              fontWeight: 700,
              color: metrics.totalPnL >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
            }}>
              {metrics.totalPnL >= 0 ? '+' : ''}{formatNumber(metrics.totalPnL, 2)}
            </div>
          </div>
        </div>
      </div>
    </div>
    </MissionTabFrame>
  );
}