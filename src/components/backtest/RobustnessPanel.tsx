import { useState, useEffect, useRef, useCallback } from 'react';
import { useDashboardStore } from '../../store/dashboard';
import { invoke } from '@tauri-apps/api/core';

interface ShuffleTestData {
  actualSharpe: number | null;
  pValue: number | null;
  passes: boolean | null;
  distribution: number[];
}

interface BootstrapData {
  ci95Low: number | null;
  ci95High: number | null;
  stable: boolean | null;
}

interface DsrData {
  dsr: number | null;
  sr0: number | null;
  passes: boolean | null;
}

interface RobustnessData {
  shuffleTest: ShuffleTestData;
  bootstrap: BootstrapData;
  dsr: DsrData;
}

export default function RobustnessPanel() {
  const [robustness, setRobustness] = useState<RobustnessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ metric: string; content: string } | null>(null);

  const mountedRef = useRef(true);

  const defaultData: RobustnessData = {
    shuffleTest: { actualSharpe: null, pValue: null, passes: null, distribution: [] },
    bootstrap: { ci95Low: null, ci95High: null, stable: null },
    dsr: { dsr: null, sr0: null, passes: null },
  };

  const data = robustness || defaultData;

  const getStatusColor = (value: number | null | undefined): string => {
    if (value == null) return 'var(--text-muted)';
    if (value >= 0.95) return 'var(--accent-green)';
    if (value >= 0.5) return 'var(--accent-yellow)';
    return 'var(--accent-red)';
  };

  const getStatusClass = (value: number | null | undefined): string => {
    if (value == null) return 'status-unknown';
    if (value >= 0.95) return 'status-pass';
    if (value >= 0.5) return 'status-warn';
    return 'status-fail';
  };

  const fetchData = useCallback(async () => {
    try {
      const json = await invoke('risk_metrics') as { robustness?: RobustnessData } | RobustnessData;
      if (mountedRef.current) {
        const r = (json as { robustness?: RobustnessData }).robustness || json as RobustnessData;
        setRobustness(r);
        setLoading(false);
        setError(null);
      }
    } catch (err: unknown) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchData]);

  const showTooltip = (metric: string, content: string) => {
    setTooltip({ metric, content });
  };

  const hideTooltip = () => {
    setTooltip(null);
  };

  const fmt = (val: number | null | undefined, decimals: number = 4): string => {
    if (val == null) return '—';
    return typeof val === 'number' ? val.toFixed(decimals) : String(val);
  };

  const fmtPct = (val: number | null | undefined, decimals: number = 1): string => {
    if (val == null) return '—';
    return typeof val === 'number' ? `${(val * 100).toFixed(decimals)}%` : String(val);
  };

  const renderHistogram = () => {
    const distribution = data.shuffleTest.distribution || [];
    const actualSharpe = data.shuffleTest.actualSharpe;

    if (distribution.length === 0) {
      return (
        <div className="histogram-empty">
          <span className="text-muted" style={{ fontSize: 11 }}>No distribution data</span>
        </div>
      );
    }

    const min = Math.min(...distribution, actualSharpe || 0);
    const max = Math.max(...distribution, actualSharpe || 1);
    const range = max - min || 1;
    const binCount = 30;
    const binWidth = range / binCount;

    const bins = new Array(binCount).fill(0);
    distribution.forEach(v => {
      const idx = Math.min(Math.floor((v - min) / binWidth), binCount - 1);
      bins[idx]++;
    });

    const maxCount = Math.max(...bins) || 1;
    const actualBinIdx = actualSharpe != null ? Math.floor((actualSharpe - min) / binWidth) : -1;

    return (
      <div className="histogram-container">
        <div className="histogram-bars">
          {bins.map((count, idx) => {
            const heightPct = (count / maxCount) * 100;
            const isActual = idx === actualBinIdx;
            const barColor = isActual ? 'var(--accent-green)' : 'var(--bg-surface)';
            return (
              <div
                key={idx}
                className={`histogram-bar ${isActual ? 'actual-bar' : ''}`}
                style={{
                  height: `${heightPct}%`,
                  background: barColor,
                  flex: 1,
                  minWidth: 0,
                }}
              />
            );
          })}
        </div>
        <div className="histogram-axis">
          <span className="axis-label">{fmt(min, 2)}</span>
          <span className="axis-label axis-center">Shuffle Distribution</span>
          <span className="axis-label">{fmt(max, 2)}</span>
        </div>
        {actualSharpe != null && (
          <div className="histogram-actual">
            <span className="actual-marker" style={{ color: getStatusColor(data.shuffleTest.pValue) }}>
              ▼ {fmt(actualSharpe, 2)}
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderBoxplot = () => {
    const ci95Low = data.bootstrap.ci95Low;
    const ci95High = data.bootstrap.ci95High;
    const stable = data.bootstrap.stable;

    if (ci95Low == null || ci95High == null) {
      return (
        <div className="boxplot-empty">
          <span className="text-muted" style={{ fontSize: 11 }}>No bootstrap data</span>
        </div>
      );
    }

    const mid = (ci95Low + ci95High) / 2;

    return (
      <div className="boxplot-container">
        <div className="boxplot-whisker-zone">
          <div className="whisker-left" style={{ left: 0, width: '25%', background: 'var(--bg-surface)' }} />
          <div className="boxplot-box" style={{ left: '25%', width: '50%', background: stable ? 'var(--accent-green)' : 'var(--accent-yellow)' }}>
            <div className="box-median" />
          </div>
          <div className="whisker-right" style={{ left: '75%', width: '25%', background: 'var(--bg-surface)' }} />
        </div>
        <div className="boxplot-labels">
          <span className="box-label" style={{ textAlign: 'left' }}>{fmt(ci95Low, 3)}</span>
          <span className="box-label" style={{ textAlign: 'center' }}>{fmt(mid, 3)}</span>
          <span className="box-label" style={{ textAlign: 'right' }}>{fmt(ci95High, 3)}</span>
        </div>
        <div className="boxplot-stability">
          <span style={{ color: getStatusColor(stable ? 0.97 : 0.4) }}>
            {stable ? '✓ Stable' : '⚠ Unstable'}
          </span>
        </div>
      </div>
    );
  };

  const renderDSRGauge = () => {
    const dsr = data.dsr.dsr;
    const sr0 = data.dsr.sr0;
    const passes = data.dsr.passes;

    if (dsr == null) {
      return (
        <div className="gauge-empty">
          <span className="text-muted" style={{ fontSize: 11 }}>No DSR data</span>
        </div>
      );
    }

    const threshold = 0.95;
    const angle = Math.min((dsr / threshold) * 180, 180);
    const passesThreshold = dsr >= threshold;

    return (
      <div className="gauge-container">
        <div className="gauge-arc">
          <svg viewBox="0 0 200 100" className="gauge-svg">
            <path
              d="M 20 90 A 80 80 0 0 1 180 90"
              fill="none"
              stroke="var(--bg-surface)"
              strokeWidth="12"
            />
            <path
              d="M 20 90 A 80 80 0 0 1 180 90"
              fill="none"
              stroke={passesThreshold ? 'var(--accent-green)' : dsr >= 0.5 ? 'var(--accent-yellow)' : 'var(--accent-red)'}
              strokeWidth="12"
              strokeDasharray={`${(angle / 180) * 251.2} 251.2`}
            />
            <line x1="144" y1="25" x2="148" y2="30" stroke="var(--text-muted)" strokeWidth="2" />
          </svg>
        </div>
        <div className="gauge-value">
          <span className="value-main" style={{ color: getStatusColor(dsr) }}>{fmt(dsr, 3)}</span>
          <span className="value-label">DSR</span>
        </div>
        {sr0 != null && (
          <div className="gauge-sr0">
            <span className="text-muted" style={{ fontSize: 10 }}>SR₀ = {fmt(sr0, 4)}</span>
          </div>
        )}
        <div className="gauge-status">
          <span className={`status-badge ${getStatusClass(passes ? 0.97 : 0.3)}`}>
            {passes ? 'PASS' : 'FAIL'}
          </span>
          <span className="text-muted" style={{ fontSize: 10 }}>threshold: {threshold}</span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <section className="panel robustness-panel">
        <div className="panel-header">
          <h2>ROBUSTNESS METRICS</h2>
        </div>
        <div className="loading-state">
          <span className="loading-spinner">⟳</span>
          <span className="text-muted">Loading metrics...</span>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel robustness-panel">
        <div className="panel-header">
          <h2>ROBUSTNESS METRICS</h2>
        </div>
        <div className="error-state">
          <span className="error-icon">⚠</span>
          <span className="text-muted">Error: {error}</span>
          <button className="retry-btn" onClick={fetchData}>Retry</button>
        </div>
      </section>
    );
  }

  return (
    <section className="panel robustness-panel">
      <div className="panel-header">
        <h2>ROBUSTNESS METRICS</h2>
        <div className="panel-actions">
          <span className="live-indicator">● LIVE</span>
        </div>
      </div>

      {tooltip && (
        <div className="tooltip-overlay" style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 16px',
          maxWidth: '300px',
          zIndex: 1000,
          boxShadow: 'var(--shadow-lg)',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 11 }}>{tooltip.metric}</div>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{tooltip.content}</div>
        </div>
      )}

      <div
        className="robustness-section shuffle-section"
        onMouseEnter={() => showTooltip('Shuffle Test', 'Tests whether actual Sharpe ratio is statistically significant by comparing against 1000 randomized return sequences. P-value < 0.05 indicates the result is unlikely due to chance.')}
        onMouseLeave={hideTooltip}
      >
        <div className="section-header">
          <h3>Shuffle Test</h3>
          <span className={`status-badge ${getStatusClass(data.shuffleTest.passes ? 0.97 : (data.shuffleTest.pValue ?? 0) >= 0.5 ? 0.7 : 0.3)}`}>
            {data.shuffleTest.passes ? 'PASS' : data.shuffleTest.pValue != null ? 'FAIL' : '—'}
          </span>
        </div>
        <div className="section-metrics">
          <div className="metric-row">
            <span className="metric-label">Actual Sharpe</span>
            <span className="metric-value" style={{ color: getStatusColor(data.shuffleTest.pValue) }}>
              {fmt(data.shuffleTest.actualSharpe, 4)}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">P-Value</span>
            <span className="metric-value">{fmtPct(data.shuffleTest.pValue)}</span>
          </div>
        </div>
        {renderHistogram()}
      </div>

      <div
        className="robustness-section bootstrap-section"
        onMouseEnter={() => showTooltip('Bootstrap CI', '95% confidence interval derived from bootstrap resampling. Narrow intervals indicate stable estimates.')}
        onMouseLeave={hideTooltip}
      >
        <div className="section-header">
          <h3>Bootstrap CI</h3>
          <span className={`status-badge ${getStatusClass(data.bootstrap.stable ? 0.97 : 0.4)}`}>
            {data.bootstrap.stable ? 'STABLE' : 'UNSTABLE'}
          </span>
        </div>
        <div className="section-metrics">
          <div className="metric-row">
            <span className="metric-label">95% CI Low</span>
            <span className="metric-value">{fmt(data.bootstrap.ci95Low, 4)}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">95% CI High</span>
            <span className="metric-value">{fmt(data.bootstrap.ci95High, 4)}</span>
          </div>
        </div>
        {renderBoxplot()}
      </div>

      <div
        className="robustness-section dsr-section"
        onMouseEnter={() => showTooltip('DSR (Deflated Sharpe Ratio)', "Adjusts Sharpe ratio for multiple testing and data snooping bias. DSR >= 0.95 indicates the strategy's performance survives the deflation adjustment.")}
        onMouseLeave={hideTooltip}
      >
        <div className="section-header">
          <h3>DSR Status</h3>
          <span className={`status-badge ${getStatusClass(data.dsr.passes ? 0.97 : 0.3)}`}>
            {data.dsr.passes ? 'PASS' : 'FAIL'}
          </span>
        </div>
        {renderDSRGauge()}
      </div>

      <div className="robustness-summary">
        <div className="summary-row">
          <span className="summary-label">Overall Robustness</span>
          <div className="summary-indicators">
            <span className={`indicator ${getStatusClass(data.shuffleTest.passes ? 0.97 : 0.3)}`}>
              .shuffle {data.shuffleTest.passes ? '✓' : '✗'}
            </span>
            <span className={`indicator ${getStatusClass(data.bootstrap.stable ? 0.97 : 0.3)}`}>
              .boot {data.bootstrap.stable ? '✓' : '✗'}
            </span>
            <span className={`indicator ${getStatusClass(data.dsr.passes ? 0.97 : 0.3)}`}>
              .dsr {data.dsr.passes ? '✓' : '✗'}
            </span>
          </div>
        </div>
      </div>

      <style>{`
        .robustness-panel {
          background: var(--bg-root);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 16px;
          font-size: 11px;
        }
        .robustness-panel .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--border-subtle);
        }
        .robustness-panel h2 {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-primary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 0;
        }
        .live-indicator { font-size: 10px; color: var(--accent-green); font-weight: 600; }
        .robustness-section {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-sm);
          padding: 12px;
          margin-bottom: 12px;
          cursor: help;
        }
        .robustness-section:last-of-type { margin-bottom: 0; }
        .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .section-header h3 { font-size: 11px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; margin: 0; }
        .section-metrics { display: flex; gap: 16px; margin-bottom: 10px; }
        .metric-row { display: flex; flex-direction: column; gap: 2px; }
        .metric-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; }
        .metric-value { font-family: var(--font-mono); font-size: 12px; font-weight: 600; color: var(--text-primary); }
        .status-badge { font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: var(--radius-sm); text-transform: uppercase; }
        .status-pass { background: rgba(34, 197, 94, 0.15); color: var(--accent-green); border: 1px solid var(--accent-green); }
        .status-warn { background: rgba(234, 179, 8, 0.15); color: var(--accent-yellow); border: 1px solid var(--accent-yellow); }
        .status-fail { background: rgba(239, 68, 68, 0.15); color: var(--accent-red); border: 1px solid var(--accent-red); }
        .status-unknown { background: var(--bg-surface); color: var(--text-muted); border: 1px solid var(--border-subtle); }
        .histogram-container { position: relative; height: 80px; }
        .histogram-bars { display: flex; align-items: flex-end; height: 60px; gap: 1px; }
        .histogram-bar { border-radius: 1px 1px 0 0; transition: height 0.2s ease; }
        .histogram-bar.actual-bar { box-shadow: 0 0 4px var(--accent-green); }
        .histogram-axis { display: flex; justify-content: space-between; margin-top: 4px; }
        .axis-label { font-size: 10px; color: var(--text-muted); font-family: var(--font-mono); }
        .axis-center { color: var(--text-secondary); }
        .histogram-actual { text-align: center; margin-top: 8px; }
        .actual-marker { font-family: var(--font-mono); font-size: 11px; font-weight: 600; }
        .histogram-empty, .boxplot-empty, .gauge-empty {
          display: flex; align-items: center; justify-content: center;
          height: 80px; background: var(--bg-root); border-radius: var(--radius-sm);
        }
        .boxplot-container { padding: 8px 0; }
        .boxplot-whisker-zone { display: flex; height: 24px; position: relative; }
        .whisker-left, .whisker-right { position: absolute; height: 100%; border-radius: var(--radius-sm); }
        .boxplot-box { position: absolute; height: 100%; border-radius: var(--radius-sm); display: flex; align-items: center; }
        .box-median { width: 2px; height: 60%; background: var(--text-primary); margin: auto; }
        .boxplot-labels { display: flex; justify-content: space-between; margin-top: 4px; padding: 0 4px; }
        .box-label { font-family: var(--font-mono); font-size: 10px; color: var(--text-muted); flex: 1; }
        .boxplot-stability { text-align: center; margin-top: 8px; font-size: 10px; font-weight: 600; }
        .gauge-container { position: relative; height: 120px; }
        .gauge-arc { height: 70px; }
        .gauge-svg { width: 100%; height: 100%; }
        .gauge-value { text-align: center; position: absolute; bottom: 30px; width: 100%; }
        .value-main { font-family: var(--font-mono); font-size: 22px; font-weight: 700; }
        .value-label { display: block; font-size: 10px; color: var(--text-muted); text-transform: uppercase; margin-top: 2px; }
        .gauge-sr0 { text-align: center; margin-top: 2px; }
        .gauge-status { display: flex; flex-direction: column; align-items: center; gap: 2px; margin-top: 6px; }
        .robustness-summary { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-subtle); }
        .summary-row { display: flex; justify-content: space-between; align-items: center; }
        .summary-label { font-size: 11px; font-weight: 600; color: var(--text-secondary); }
        .summary-indicators { display: flex; gap: 8px; }
        .indicator { font-family: var(--font-mono); font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: var(--radius-sm); }
        .loading-state, .error-state {
          display: flex; align-items: center; justify-content: center;
          gap: 12px; padding: 40px; color: var(--text-muted);
        }
        .loading-spinner { animation: spin 1s linear infinite; font-size: 16px; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .error-icon { color: var(--accent-red); font-size: 16px; }
        .retry-btn {
          background: var(--bg-surface); border: 1px solid var(--border-subtle);
          color: var(--text-primary); padding: 4px 12px; border-radius: var(--radius-sm);
          font-size: 11px; cursor: pointer;
        }
        .retry-btn:hover { background: var(--bg-root); }
      `}</style>
    </section>
  );
}