import React, { useState, useCallback, useMemo } from 'react';
import { useDashboardStore } from '../../store/dashboard';
import { invoke } from '@tauri-apps/api/core';

interface MetricItem {
  label: string;
  value: string;
}

interface RobustnessMetricCardsProps {
  items: MetricItem[];
}

function asNumber(value: any, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asPercent(value: any): string {
  return (asNumber(value, 0) * 100).toFixed(2) + '%';
}

function toSeries(rows: any[], xKey: string, yKey: string): Array<{ time: any; value: number }> {
  const list = Array.isArray(rows) ? rows : [];
  return list.map((row: any, index: number) => ({
    time: row && row[xKey] !== undefined ? row[xKey] : (index + 1),
    value: asNumber(row && row[yKey], 0),
  }));
}

function formatRange(range: any): string {
  if (!range) return 'n/a';
  const start = range.start || range.startTime || range.from || 'n/a';
  const end = range.end || range.endTime || range.to || 'n/a';
  return String(start) + ' -> ' + String(end);
}

function RobustnessMetricCards({ items }: RobustnessMetricCardsProps) {
  return (
    <div className="factory-robustness-kpis">
      {items.map((item) => (
        <div key={item.label} className="factory-robustness-kpi">
          <div className="factory-robustness-kpi-label">{item.label}</div>
          <div className="factory-robustness-kpi-value">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

interface WfoResultViewProps {
  result: any;
}

function WfoResultView({ result }: WfoResultViewProps) {
  const data = result || {};
  const rows = Array.isArray(data.results) ? data.results : [];
  const testSeries = toSeries(rows, 'fold', 'testSharpe');
  const trainSeries = toSeries(rows, 'fold', 'trainSharpe');
  const inSampleRanges = Array.isArray(data.inSampleRanges) ? data.inSampleRanges : [];
  const outOfSampleRanges = Array.isArray(data.outOfSampleRanges) ? data.outOfSampleRanges : [];

  return (
    <div className="factory-robustness-result">
      <RobustnessMetricCards
        items={[
          { label: 'Avg Test Sharpe', value: asNumber(data.aggregate && data.aggregate.avgSharpe, 0).toFixed(2) },
          { label: 'Avg Test Return', value: asPercent(data.aggregate && data.aggregate.avgReturn) },
          { label: 'Consistency', value: asPercent(data.aggregate && data.aggregate.consistency) },
        ]}
      />
      <div className="factory-robustness-chart-grid">
        <div className="factory-robustness-chart-card">
          <div className="factory-robustness-chart-head">Fold Sharpe (Train vs Test)</div>
          <div className="factory-backtester-empty">Chart renderer available via plugin</div>
        </div>
        <div className="factory-robustness-chart-card">
          <div className="factory-robustness-chart-head">Fold Breakdown</div>
          <div className="factory-robustness-fold-list">
            {rows.map((row: any, index: number) => (
              <div key={String(row.fold || index)} className="factory-robustness-fold-row">
                <span>Fold {String(row.fold || index + 1)}</span>
                <span>Train {asNumber(row.trainSharpe, 0).toFixed(2)}</span>
                <span>Test {asNumber(row.testSharpe, 0).toFixed(2)}</span>
                <span>{asPercent(row.testReturn)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="factory-robustness-ranges">
        <div className="factory-robustness-range-block">
          <div className="factory-robustness-chart-head">In-Sample Windows</div>
          {inSampleRanges.length === 0 ? (
            <div className="factory-backtester-empty">No in-sample ranges</div>
          ) : (
            <div className="factory-robustness-range-list">
              {inSampleRanges.map((range: any, index: number) => (
                <div key={`is-${index}`} className="factory-robustness-range-pill in-sample">{formatRange(range)}</div>
              ))}
            </div>
          )}
        </div>
        <div className="factory-robustness-range-block">
          <div className="factory-robustness-chart-head">Out-of-Sample Windows</div>
          {outOfSampleRanges.length === 0 ? (
            <div className="factory-backtester-empty">No out-of-sample ranges</div>
          ) : (
            <div className="factory-robustness-range-list">
              {outOfSampleRanges.map((range: any, index: number) => (
                <div key={`oos-${index}`} className="factory-robustness-range-pill out-of-sample">{formatRange(range)}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface MonteCarloResultViewProps {
  result: any;
}

function MonteCarloResultView({ result }: MonteCarloResultViewProps) {
  const data = result || {};
  const runs = Array.isArray(data.runs) ? data.runs : [];
  const original = Array.isArray(data.original) ? data.original : [];
  const percentiles = data.percentiles || {};
  const probability = data.probability || {};

  return (
    <div className="factory-robustness-result">
      <RobustnessMetricCards
        items={[
          { label: 'Runs', value: String(data.runCount || runs.length || 0) },
          { label: 'P50 Sharpe', value: asNumber(percentiles.p50 && percentiles.p50.sharpe, 0).toFixed(2) },
          { label: 'Profitable Probability', value: asPercent(probability.profitable) },
        ]}
      />
      <div className="factory-robustness-chart-card">
        <div className="factory-robustness-chart-head">Monte Carlo Equity Fan</div>
        <div className="factory-backtester-empty">Chart renderer available via plugin</div>
      </div>
      <div className="factory-robustness-kpis">
        {Object.entries(percentiles).map(([label, bucket]: [string, any]) => (
          <div key={label} className="factory-robustness-kpi">
            <div className="factory-robustness-kpi-label">{String(label).toUpperCase()}</div>
            <div className="factory-robustness-kpi-value">Sharpe {asNumber(bucket.sharpe, 0).toFixed(2)}</div>
            <div className="factory-robustness-kpi-sub">Return {asPercent(bucket.return)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface GenericResultViewProps {
  result: any;
}

function GenericResultView({ result }: GenericResultViewProps) {
  const data = result || {};
  if (data.confidenceIntervals) {
    return (
      <div className="factory-robustness-kpis">
        {Object.entries(data.confidenceIntervals).map(([metric, interval]: [string, any]) => (
          <div key={metric} className="factory-robustness-kpi">
            <div className="factory-robustness-kpi-label">{metric.toUpperCase()}</div>
            <div className="factory-robustness-kpi-value">Median {asNumber(interval.median, 0).toFixed(2)}</div>
            <div className="factory-robustness-kpi-sub">{asNumber(interval.lower, 0).toFixed(2)} to {asNumber(interval.upper, 0).toFixed(2)}</div>
          </div>
        ))}
      </div>
    );
  }
  if (Array.isArray(data.results)) {
    return (
      <div className="factory-robustness-fold-list">
        {data.results.map((row: any, index: number) => {
          const sharpeVal = row.testSharpe !== undefined ? row.testSharpe : row.sharpe;
          return (
            <div key={String(row.fold || row.scenario || index)} className="factory-robustness-fold-row">
              <span>{row.scenario || ('Fold ' + String(row.fold || index + 1))}</span>
              <span>Sharpe {asNumber(sharpeVal, 0).toFixed(2)}</span>
              <span>{row.recoveryDays ? (String(row.recoveryDays) + 'd recovery') : asPercent(row.returnImpact || row.testReturn || 0)}</span>
            </div>
          );
        })}
      </div>
    );
  }
  return <pre className="factory-robustness-json">{JSON.stringify(data, null, 2)}</pre>;
}

export default function FactoryRobustnessPanel() {
  const state = useDashboardStore();
  const [activeTest, setActiveTest] = useState<string>('wfo');
  const [running, setRunning] = useState(false);
  const [localResult, setLocalResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const strategy = (state as any).generatedStrategy || ((state as any).factoryResults || [])[0] || null;
  const activeResult = localResult || (state as any).factoryRobustness || null;

  const testParams = useMemo(() => ({
    wfo: { trainWindow: 252, testWindow: 63, anchor: 'roll' },
    'monte-carlo': { iterations: 200, confidence: 0.95, detail: true },
    stress: { severity: 3 },
    bootstrap: { samples: 2000 },
  }), []);

  const runTest = useCallback(async () => {
    if (!strategy) {
      setError('Generate a strategy before running robustness tests.');
      return;
    }
    setRunning(true);
    setError(null);
    useDashboardStore.setState({ factoryStatus: { stage: 'robustness', status: 'running', message: 'Running ' + activeTest } } as any);
    try {
      const params = Object.assign({ strategyId: strategy.id }, testParams[activeTest as keyof typeof testParams] || {});
      const result = await invoke('factory_backtest_robustness', { type: activeTest, ...params }) as any;
      if (result && result.ok === false) throw new Error(result.error || ('Failed to run ' + activeTest));
      const payload = result.wfo || result.monteCarlo || result.stress || result.bootstrap;
      setLocalResult(payload);
      useDashboardStore.setState({
        factoryRobustness: payload,
        factoryStatus: { stage: 'robustness', status: 'completed', message: String(activeTest).toUpperCase() + ' complete' },
      } as any);
    } catch (err: any) {
      setError(err.message || String(err));
      useDashboardStore.setState({ factoryStatus: { stage: 'robustness', status: 'failed', message: err.message || String(err) } } as any);
    } finally {
      setRunning(false);
    }
  }, [activeTest, strategy, testParams]);

  const tests: Array<[string, string]> = [
    ['wfo', 'Walk-Forward'],
    ['monte-carlo', 'Monte Carlo'],
    ['stress', 'Stress'],
    ['bootstrap', 'Bootstrap'],
  ];

  return (
    <div className="factory-robustness-panel factory-robustness-panel-v2">
      <div className="factory-robustness-tabs">
        {tests.map(([id, label]) => (
          <button
            key={id}
            className={`factory-btn ${activeTest === id ? 'factory-btn-primary' : ''}`}
            onClick={() => setActiveTest(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="factory-robustness-toolbar">
        <div className="factory-backtester-toolbar-right">
          {strategy ? ('Active strategy: ' + strategy.primarySymbol + ' • ' + (strategy.templateId || strategy.type || strategy.id)) : 'No active strategy'}
        </div>
        <button className="factory-btn factory-btn-primary" onClick={runTest} disabled={running}>
          {running ? 'Running...' : ('Run ' + activeTest)}
        </button>
      </div>
      {error ? <div className="factory-error-banner">{error}</div> : null}
      <div className="factory-robustness-body">
        {!activeResult ? (
          <div className="factory-backtester-empty">Run WFO, Monte Carlo, stress, or bootstrap after a backtest to evaluate robustness.</div>
        ) : activeTest === 'wfo' ? (
          <WfoResultView result={activeResult} />
        ) : activeTest === 'monte-carlo' ? (
          <MonteCarloResultView result={activeResult} />
        ) : (
          <GenericResultView result={activeResult} />
        )}
      </div>
    </div>
  );
}