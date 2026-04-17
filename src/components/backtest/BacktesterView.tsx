import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import MissionTabFrame from '../shared/MissionTabFrame';

function fmtTime(value: string | number | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function fmtPct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function fmtNum(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toFixed(2);
}

function resultTone(status: string): string {
  return status === 'VALIDATED' ? 'var(--accent-green)' : 'var(--accent-red)';
}

function normalizeSymbols(value: string | string[] | null | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value.split(',').map((token) => token.trim()).filter(Boolean);
  }
  return [];
}

function metricAverage(results: BacktestResult[], selector: (r: BacktestResult) => number | null | undefined): number | null {
  if (!results.length) return null;
  const vals = results.map(selector).filter((v): v is number => v != null && !Number.isNaN(v));
  if (vals.length === 0) return null;
  return vals.reduce((sum, v) => sum + v, 0) / vals.length;
}

interface BacktestMetrics {
  sharpe?: number;
  winRate?: number;
  profitFactor?: number;
  maxDrawdown?: number;
  totalTrades?: number;
}

interface BacktestHypothesis {
  id?: string;
  title?: string;
  description?: string;
}

interface BacktestResult {
  id?: string;
  status?: string;
  symbols?: string | string[];
  period?: string;
  metrics?: BacktestMetrics;
  hypothesis?: BacktestHypothesis;
  critique?: { reason?: string };
  review?: { verdict?: string; reason?: string };
}

interface BacktestData {
  backtestResults?: BacktestResult[];
  summary?: {
    counts?: {
      generated?: number;
      backtested?: number;
      implemented?: number;
      deferred?: number;
      rejected?: number;
    };
  };
  lastCompletedAt?: string;
}

export default function BacktesterView() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<BacktestData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const payload = await invoke('pipeline_research_results') as BacktestData;
        if (!mounted) return;
        setData(payload);
        setError('');
      } catch (err: unknown) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load backtest results');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    const timer = setInterval(load, 4000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const results = Array.isArray(data?.backtestResults) ? data.backtestResults : [];
  const validated = results.filter((result) => result.status === 'VALIDATED');
  const failed = results.filter((result) => result.status !== 'VALIDATED');
  const bestResult = results.reduce((best: BacktestResult | null, result) => {
    if (!best) return result;
    return (result.metrics?.sharpe || 0) > (best.metrics?.sharpe || 0) ? result : best;
  }, null);

  return (
    <MissionTabFrame
      number={3}
      title="Backtester"
      subtitle="Preview backtest outcomes and implementation decisions"
      indicators={[
        { label: 'Results', value: `${results.length}`, detail: 'Preview backtests captured', status: results.length > 0 ? 'ok' : 'neutral' },
        { label: 'Validated', value: `${validated.length}`, detail: 'Ready for implementation review', status: validated.length > 0 ? 'ok' : 'neutral' },
        { label: 'Avg Sharpe', value: fmtNum(metricAverage(results, (result) => result.metrics?.sharpe) ?? undefined), detail: 'Across current run', status: (metricAverage(results, (result) => result.metrics?.sharpe) ?? 0) > 1 ? 'ok' : 'neutral' },
        { label: 'Last Run', value: data?.lastCompletedAt ? 'Complete' : 'Pending', detail: fmtTime(data?.lastCompletedAt), status: data?.lastCompletedAt ? 'ok' : 'neutral' },
      ]}
      notes={[
        'Backtester reflects the stored preview evaluations from the current research run.',
        'Use this page to see which hypotheses validated, failed, or were implemented after review.',
      ]}
    >
      <style>{`
        .backtester-layout { display: grid; grid-template-columns: 320px 1fr; gap: 16px; }
        .backtester-metrics-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
        @media (max-width: 1100px) {
          .backtester-layout { grid-template-columns: 1fr; }
        }
        @media (max-width: 768px) {
          .backtester-metrics-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
      `}</style>
      <div className="backtester-layout">
        <div style={{ display: 'grid', gap: '16px' }}>
          <div className="panel" style={{ padding: '18px' }}>
            <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>Outcome Summary</div>
            <div style={{ display: 'grid', gap: '10px' }}>
              {[
                ['Generated', data?.summary?.counts?.generated || 0],
                ['Backtested', data?.summary?.counts?.backtested || 0],
                ['Implemented', data?.summary?.counts?.implemented || 0],
                ['Deferred', data?.summary?.counts?.deferred || 0],
                ['Rejected', data?.summary?.counts?.rejected || 0],
              ].map(([label, value]) => (
                <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel" style={{ padding: '18px' }}>
            <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>Best Candidate</div>
            {bestResult ? (
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{bestResult.hypothesis?.title || bestResult.hypothesis?.id}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{bestResult.hypothesis?.description || 'No description available.'}</div>
                <div style={{ marginTop: '12px', display: 'grid', gap: '8px', fontSize: '12px' }}>
                  <div><span style={{ color: 'var(--text-muted)' }}>Sharpe:</span> {fmtNum(bestResult.metrics?.sharpe)}</div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Win rate:</span> {fmtPct(bestResult.metrics?.winRate)}</div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Profit factor:</span> {fmtNum(bestResult.metrics?.profitFactor)}</div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Max DD:</span> {fmtPct(bestResult.metrics?.maxDrawdown)}</div>
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Run the Generator first to populate backtest results.</div>
            )}
          </div>
        </div>

        <div className="panel" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 600 }}>Preview Results</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Validated and failed hypotheses from the current run.</div>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {error || (loading ? 'Loading…' : `${results.length} results`)}
            </div>
          </div>

          {results.length === 0 ? (
            <div style={{
              minHeight: '260px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px dashed var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-muted)',
              padding: '24px',
              textAlign: 'center',
            }}>
              No backtest results yet. Start a generator run to populate this page.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {[...validated, ...failed].map((result, index) => {
                const tone = resultTone(result.status || '');
                const symbols = normalizeSymbols(result.symbols);
                const resultKey = result.hypothesis?.id || result.id || `${result.status || 'result'}-${index}`;
                return (
                  <div key={resultKey} style={{
                    padding: '14px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${tone}`,
                    background: result.status === 'VALIDATED' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600 }}>{result.hypothesis?.title || result.hypothesis?.id}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{result.hypothesis?.description || 'No description available.'}</div>
                      </div>
                      <div style={{ color: tone, fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                        {result.status}
                      </div>
                    </div>

                    <div className="backtester-metrics-grid" style={{ fontSize: '12px', marginBottom: '10px' }}>
                      <MetricCard label="Sharpe" value={fmtNum(result.metrics?.sharpe)} />
                      <MetricCard label="Win Rate" value={fmtPct(result.metrics?.winRate)} />
                      <MetricCard label="Profit Factor" value={fmtNum(result.metrics?.profitFactor)} />
                      <MetricCard label="Max DD" value={fmtPct(result.metrics?.maxDrawdown)} />
                      <MetricCard label="Trades" value={result.metrics?.totalTrades != null ? String(result.metrics.totalTrades) : '—'} />
                    </div>

                    <div style={{ display: 'grid', gap: '6px', fontSize: '12px' }}>
                      <div><span style={{ color: 'var(--text-muted)' }}>Critique:</span> {result.critique?.reason || 'No critique captured.'}</div>
                      <div><span style={{ color: 'var(--text-muted)' }}>Review:</span> {result.review?.verdict || 'Pending'}{result.review?.reason ? ` — ${result.review.reason}` : ''}</div>
                      <div><span style={{ color: 'var(--text-muted)' }}>Scope:</span> {symbols.length > 0 ? symbols.join(', ') : '—'} • {result.period || '1y'}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </MissionTabFrame>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      padding: '10px',
      borderRadius: 'var(--radius-sm)',
      background: 'rgba(0,0,0,0.18)',
      border: '1px solid var(--border-subtle)',
    }}>
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '4px' }}>{value}</div>
    </div>
  );
}