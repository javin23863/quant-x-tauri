import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import MissionTabFrame from '../shared/MissionTabFrame';

interface Indicator {
  name: string;
  config: Record<string, unknown>;
}

interface Hypothesis {
  id: string;
  key?: string;
  title: string;
  description?: string;
  indicators?: Indicator[];
}

interface GeneratorConfig {
  focus: string;
  hypothesisCount: number;
  symbols: string | string[];
  period: string;
}

interface GeneratorData {
  status?: string;
  running?: boolean;
  phase?: string;
  hypothesis?: string;
  config?: GeneratorConfig;
  lastCompletedAt?: string;
  lastError?: string;
  generatedHypotheses?: Hypothesis[];
  backtestResults?: unknown[];
  backtestCount?: number;
}

interface ActionState {
  busy: boolean;
  message: string;
  isError: boolean;
}

function statusTone(status: string | undefined): string {
  if (status === 'completed' || status === 'VALIDATED') return 'var(--accent-green)';
  if (status === 'running' || status === 'starting') return 'var(--accent-blue)';
  if (status === 'error' || status === 'FAILED') return 'var(--accent-red)';
  return 'var(--accent-yellow)';
}

function phaseLabel(phase: string | undefined): string {
  if (!phase) return 'Idle';
  return String(phase).replace(/(^|[-_])(\w)/g, (_, lead, char) => `${lead ? ' ' : ''}${char.toUpperCase()}`);
}

function IndicatorChip({ indicator }: { indicator: Indicator }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 8px',
      borderRadius: '999px',
      background: 'rgba(59,130,246,0.12)',
      border: '1px solid rgba(59,130,246,0.22)',
      fontSize: '11px',
      color: 'var(--text-primary)',
    }}>
      <span>{indicator.name}</span>
      <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
        {Object.entries(indicator.config || {}).map(([key, value]) => `${key}:${value}`).join(' ')}
      </span>
    </span>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-panel)',
  color: 'var(--text-primary)',
  fontSize: '13px',
};

const emptyStateStyle: React.CSSProperties = {
  minHeight: '220px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px dashed var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-muted)',
  fontSize: '13px',
  textAlign: 'center',
  padding: '24px',
};

function primaryButton(disabled: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '12px 14px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: disabled ? 'rgba(16,185,129,0.12)' : 'var(--accent-green)',
    color: disabled ? 'var(--text-muted)' : '#fff',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.65 : 1,
  };
}

function secondaryButton(disabled: boolean): React.CSSProperties {
  return {
    padding: '12px 16px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-subtle)',
    background: disabled ? 'rgba(255,255,255,0.03)' : 'rgba(239,68,68,0.12)',
    color: disabled ? 'var(--text-muted)' : 'var(--accent-red)',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.65 : 1,
  };
}

export default function GeneratorView() {
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [data, setData] = useState<GeneratorData | null>(null);
  const [error, setError] = useState('');
  const [actionState, setActionState] = useState<ActionState>({ busy: false, message: '', isError: false });
  const [formDirty, setFormDirty] = useState(false);
  const [form, setForm] = useState<GeneratorConfig>({
    focus: 'auto-detect',
    hypothesisCount: 6,
    symbols: 'ES, NQ',
    period: '1y',
  });

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const payload = await invoke<GeneratorData>('pipeline_research_results');
        if (!mounted) return;
        setData(payload);
        setError('');
      } catch (err: unknown) {
        if (!mounted) return;
        setError((err as Error).message || 'Failed to load generator state');
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
  }, [refreshTick]);

  useEffect(() => {
    if (!data?.config || formDirty) return;
    setForm({
      focus: data.config.focus || 'auto-detect',
      hypothesisCount: data.config.hypothesisCount || 6,
      symbols: Array.isArray(data.config.symbols)
        ? data.config.symbols.join(', ')
        : (data.config.symbols || 'ES, NQ'),
      period: data.config.period || '1y',
    });
  }, [data?.config, formDirty]);

  async function postAction(path: string, body?: Record<string, unknown>) {
    setActionState({ busy: true, message: '', isError: false });
    try {
      const payload = await invoke<{ message?: string; error?: string }>(path, body || {});
      setActionState({ busy: false, message: payload.message || 'Action completed', isError: false });
      setRefreshTick((value) => value + 1);
    } catch (err: unknown) {
      setActionState({ busy: false, message: (err as Error).message || 'Action failed', isError: true });
    }
  }

  function startResearch() {
    const symbols = (typeof form.symbols === 'string' ? form.symbols : '').split(',').map((item: string) => item.trim()).filter(Boolean);
    postAction('pipeline_research_start', {
      focus: form.focus,
      hypothesisCount: Number(form.hypothesisCount) || 6,
      symbols,
      period: form.period,
    });
  }

  function stopResearch() {
    postAction('pipeline_research_stop');
  }

  const generated: Hypothesis[] = Array.isArray(data?.generatedHypotheses) ? data.generatedHypotheses : [];
  const backtestCount = Array.isArray(data?.backtestResults)
    ? data.backtestResults.length
    : Number(data?.backtestCount || 0);
  const tone = statusTone(data?.status);

  return (
    <MissionTabFrame
      number={2}
      title="Generator"
      subtitle="Research hypothesis generation and preview workflow"
      indicators={[
        { label: 'Status', value: data?.status || 'loading', detail: phaseLabel(data?.phase), status: data?.running ? 'ok' : 'neutral' },
        { label: 'Generated', value: `${generated.length}`, detail: 'Current hypothesis set', status: generated.length > 0 ? 'info' : 'neutral' },
        { label: 'Backtests', value: `${backtestCount}`, detail: 'Preview evaluations completed', status: backtestCount > 0 ? 'ok' : 'neutral' },
        { label: 'Last Run', value: data?.lastCompletedAt ? 'Complete' : 'Pending', detail: data?.lastCompletedAt ? new Date(data.lastCompletedAt).toLocaleString() : 'N/A', status: data?.lastCompletedAt ? 'ok' : 'neutral' },
      ]}
      notes={[
        'Generator owns research start/stop plus live hypothesis inventory.',
        'Preview evaluations use signal-layer mini-backtests to rank candidates before implementation.',
      ]}
    >
      <style>{`
        .generator-layout { display: grid; grid-template-columns: minmax(300px, 360px) 1fr; gap: 16px; }
        @media (max-width: 1100px) {
          .generator-layout { grid-template-columns: 1fr; }
        }
        @media (max-width: 768px) {
          .generator-actions { flex-direction: column; }
        }
      `}</style>
      <div className="generator-layout">
        <div className="panel" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 600 }}>Research Controls</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Launch and manage the current generator run.</div>
            </div>
            <div style={{
              padding: '6px 10px',
              borderRadius: '999px',
              border: `1px solid ${tone}`,
              color: tone,
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}>
              {data?.status || 'idle'}
            </div>
          </div>

          <div style={{ display: 'grid', gap: '12px' }}>
            <label style={{ display: 'grid', gap: '6px', fontSize: '12px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Focus</span>
              <input value={form.focus} onChange={(e) => { setFormDirty(true); setForm({ ...form, focus: e.target.value }); }} style={inputStyle} />
            </label>

            <label style={{ display: 'grid', gap: '6px', fontSize: '12px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Hypothesis Count</span>
              <input type="number" min={1} max={20} value={form.hypothesisCount} onChange={(e) => { setFormDirty(true); setForm({ ...form, hypothesisCount: Number(e.target.value) }); }} style={inputStyle} />
            </label>

            <label style={{ display: 'grid', gap: '6px', fontSize: '12px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Symbols</span>
              <input value={form.symbols} onChange={(e) => { setFormDirty(true); setForm({ ...form, symbols: e.target.value }); }} style={inputStyle} />
            </label>

            <label style={{ display: 'grid', gap: '6px', fontSize: '12px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Period</span>
              <select value={form.period} onChange={(e) => { setFormDirty(true); setForm({ ...form, period: e.target.value }); }} style={inputStyle}>
                <option value="3m">3m</option>
                <option value="6m">6m</option>
                <option value="1y">1y</option>
                <option value="2y">2y</option>
              </select>
            </label>
          </div>

          <div className="generator-actions" style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button onClick={startResearch} disabled={loading || actionState.busy || !data || !!data?.running} style={primaryButton(loading || !data || !!data?.running)}>
              {data?.running ? 'Running' : 'Start Generator'}
            </button>
            <button onClick={stopResearch} disabled={loading || actionState.busy || !data || !data?.running} style={secondaryButton(loading || !data || !data?.running)}>
              Stop
            </button>
          </div>

          <div style={{ marginTop: '12px', fontSize: '12px', color: actionState.isError ? 'var(--accent-red)' : (actionState.message ? 'var(--text-primary)' : 'var(--text-muted)') }}>
            {actionState.message || (loading ? 'Loading generator state...' : error || data?.lastError || 'Ready.')}
          </div>

          <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)', display: 'grid', gap: '8px', fontSize: '12px' }}>
            <div><span style={{ color: 'var(--text-muted)' }}>Current phase:</span> {phaseLabel(data?.phase)}</div>
            <div><span style={{ color: 'var(--text-muted)' }}>Active hypothesis:</span> <span style={{ fontFamily: 'var(--font-mono)' }}>{data?.hypothesis || '—'}</span></div>
            <div><span style={{ color: 'var(--text-muted)' }}>Config:</span> {data?.config ? `${data.config.focus} | ${data.config.period}` : '—'}</div>
          </div>
        </div>

        <div className="panel" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 600 }}>Generated Hypotheses</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Current candidate set from the research director.</div>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {generated.length} loaded
            </div>
          </div>

          {generated.length === 0 ? (
            <div style={emptyStateStyle}>No generated hypotheses yet. Start the generator to seed the queue.</div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {generated.map((hypothesis) => {
                const isActive = data?.hypothesis === hypothesis.id;
                return (
                  <div key={hypothesis.key || hypothesis.id} style={{
                    padding: '14px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${isActive ? 'rgba(59,130,246,0.4)' : 'var(--border-subtle)'}`,
                    background: isActive ? 'rgba(59,130,246,0.08)' : 'var(--bg-panel)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600 }}>{hypothesis.title}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{hypothesis.description}</div>
                      </div>
                      {isActive && <div style={{ color: 'var(--accent-blue)', fontSize: '11px', fontWeight: 700 }}>ACTIVE</div>}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {(hypothesis.indicators || []).map((indicator, index) => <IndicatorChip key={`${hypothesis.id}-${indicator.name}-${index}`} indicator={indicator} />)}
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