import { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface BacktestResult {
  id?: string;
  status: string;
  symbols?: string | string[];
  period?: string;
  hypothesis?: {
    id?: string;
    title?: string;
    description?: string;
  };
  metrics?: {
    sharpe?: number;
    winRate?: number;
    profitFactor?: number;
    maxDrawdown?: number;
    totalTrades?: number;
  };
  critique?: { reason?: string };
  review?: { verdict?: string; reason?: string };
}

interface BacktestData {
  backtestResults?: BacktestResult[];
  lastCompletedAt?: string;
  summary?: {
    counts?: {
      generated?: number;
      backtested?: number;
      implemented?: number;
      deferred?: number;
      rejected?: number;
    };
  };
}

function fmtTime(value: string | null | undefined): string {
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

function normalizeSymbols(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',').map(t => t.trim()).filter(Boolean);
  return [];
}

function metricAverage(results: BacktestResult[], selector: (r: BacktestResult) => number | undefined): number | null {
  if (!results.length) return null;
  return results.reduce((sum, r) => sum + (selector(r) || 0), 0) / results.length;
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

export default function ResultsGrid({ pipelineId }: { pipelineId?: string }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<BacktestData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const payload = await invoke('pipeline_research_results', { pipelineId }) as any;
        if (!mounted) return;
        setData(payload);
        setError('');
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message || 'Failed to load backtest results');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    const timer = setInterval(load, 4000);
    return () => { mounted = false; clearInterval(timer); };
  }, [pipelineId]);

  const results: BacktestResult[] = Array.isArray(data?.backtestResults) ? data.backtestResults : [];
  const validated = results.filter(r => r.status === 'VALIDATED');
  const failed = results.filter(r => r.status !== 'VALIDATED');
  const bestResult = results.reduce<BacktestResult | null>((best, r) => {
    if (!best) return r;
    return (r.metrics?.sharpe || 0) > (best.metrics?.sharpe || 0) ? r : best;
  }, null);

  const summaryCards = [
    { label: 'Generated', value: data?.summary?.counts?.generated || 0 },
    { label: 'Backtested', value: data?.summary?.counts?.backtested || 0 },
    { label: 'Implemented', value: data?.summary?.counts?.implemented || 0 },
    { label: 'Deferred', value: data?.summary?.counts?.deferred || 0 },
    { label: 'Rejected', value: data?.summary?.counts?.rejected || 0 },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '16px' }}>
      <div style={{ display: 'grid', gap: '16px' }}>
        <div className="panel" style={{ padding: '18px' }}>
          <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>Outcome Summary</div>
          <div style={{ display: 'grid', gap: '10px' }}>
            {summaryCards.map(card => (
              <div key={card.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>{card.label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{card.value}</span>
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
              const tone = resultTone(result.status);
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

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '10px', fontSize: '12px', marginBottom: '10px' }}>
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
  );
}