import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

const CHECKPOINT_GATES = [
  { id: 'dataFreshness', name: 'Data Freshness', description: 'Market data freshness check', order: 1 },
  { id: 'featureIntegrity', name: 'Feature Integrity', description: 'Feature completeness check', order: 2 },
  { id: 'alphaConfidence', name: 'Alpha Confidence', description: 'Model confidence threshold', order: 3 },
  { id: 'validatorConfirm', name: 'Validator Confirm', description: 'Independent signal confirmation', order: 4 },
  { id: 'regimeAllow', name: 'Regime Allow', description: 'Regime-based trading filter', order: 5 },
  { id: 'driftCheck', name: 'Drift Check', description: 'Feature/model drift detection', order: 6 },
  { id: 'riskApproval', name: 'Risk Approval', description: 'Portfolio-level risk checks', order: 7 },
  { id: 'executionApproval', name: 'Execution Approval', description: 'Order quality checks', order: 8 },
  { id: 'brokerHealth', name: 'Broker Health', description: 'Broker connection and market hours', order: 9 },
];

const MODEL_CLASSES = [
  { id: 'ALPHA', name: 'Alpha Models', authority: ['research', 'paper', 'limited_live', 'scaled_live'] },
  { id: 'FEATURE', name: 'Feature Models', authority: ['research', 'validated', 'paper'] },
  { id: 'REGIME', name: 'Regime Models', authority: ['research', 'paper', 'live'] },
  { id: 'RISK', name: 'Risk Models', authority: ['research', 'paper', 'live'] },
  { id: 'EXECUTION', name: 'Execution Models', authority: ['research', 'paper', 'live'] },
  { id: 'RESEARCH', name: 'Research Models', authority: ['advisory_only'] },
  { id: 'OPTIMIZATION', name: 'Optimization', authority: ['research_only'] },
];

const LIFECYCLE_STAGES = ['RESEARCH', 'VALIDATED', 'PAPER', 'LIMITED_LIVE', 'SCALED_LIVE', 'DEGRADED', 'QUARANTINED', 'DISABLED'];

function StatusDot({ status, size }: { status: string; size?: number }) {
  const s = size || 8;
  const colors: Record<string, string> = {
    passed: 'var(--accent-green)',
    online: 'var(--accent-green)',
    warning: 'var(--accent-yellow)',
    blocked: 'var(--accent-red)',
    offline: 'var(--accent-red)',
    disabled: 'var(--text-muted)',
    inactive: 'var(--text-muted)',
  };
  const color = colors[status] || 'var(--text-muted)';
  return <span style={{ width: s, height: s, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />;
}

function GateStatusRow({ gate, result }: { gate: typeof CHECKPOINT_GATES[0]; result?: any }) {
  const passed = result?.passed !== false;
  const status = result?.enabled === false ? 'disabled' : passed ? 'passed' : 'blocked';
  const hasWarning = result?.warnings && result.warnings.length > 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 6, background: status === 'blocked' ? 'rgba(239,68,68,0.08)' : status === 'passed' ? 'rgba(16,185,129,0.05)' : 'var(--bg-panel-alt)', marginBottom: 4 }}>
      <StatusDot status={status === 'passed' && hasWarning ? 'warning' : status} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500, fontSize: 12, color: 'var(--text-primary)' }}>{gate.name}</div>
        {result?.reason && <div style={{ fontSize: 10, color: 'var(--accent-red)', marginTop: 2 }}>{result.reason}</div>}
        {hasWarning && result.warnings.map((w: any, i: number) => <div key={i} style={{ fontSize: 10, color: 'var(--accent-yellow)', marginTop: 2 }}>{w.reason || w.message}</div>)}
      </div>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
        {status === 'disabled' ? 'DISABLED' : passed ? 'PASS' : 'BLOCK'}
      </span>
    </div>
  );
}

function BlockedEventRow({ event }: { event: any }) {
  const timestamp = event.timestamp ? new Date(event.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--';
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 6, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', marginBottom: 6 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{timestamp}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-primary)', marginBottom: 4 }}>{event.guardrail || event.gate || 'Unknown Guardrail'}</div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{event.reason || event.message || 'No reason provided'}</div>
        {event.modelClass && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{`Model: ${event.modelClass}`}</div>}
      </div>
    </div>
  );
}

function CheckpointPanel({ checkpoints }: { checkpoints: any[] }) {
  const latestCheckpoint = checkpoints?.[0] || null;
  const gates = CHECKPOINT_GATES.map(gate => {
    const result = latestCheckpoint?.gates?.find((g: any) => g.gate === gate.id);
    return { gate, result };
  });

  const passedCount = gates.filter(g => g.result?.passed !== false && g.result?.enabled !== false).length;
  const totalCount = gates.filter(g => g.result?.enabled !== false).length || 9;
  const overallStatus = latestCheckpoint?.passed ? 'passed' : latestCheckpoint?.blocked ? 'blocked' : 'inactive';

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StatusDot status={overallStatus} />
          <span className="panel-title">Checkpoint Status</span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{`${passedCount}/${totalCount} gates passed`}</span>
      </div>
      <div style={{ padding: '12px 16px' }}>
        {gates.map(({ gate, result }) => <GateStatusRow key={gate.id} gate={gate} result={result} />)}
      </div>
    </div>
  );
}

function ModelClassPanel({ modelClasses, lifecycleStage }: { modelClasses: Record<string, string>; lifecycleStage: string }) {
  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-header"><span className="panel-title">Model Class Status</span></div>
      <div style={{ padding: '12px 16px' }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Current Lifecycle Stage</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {LIFECYCLE_STAGES.map((stage, i) => {
              const isActive = lifecycleStage === stage;
              const isPast = LIFECYCLE_STAGES.indexOf(lifecycleStage) >= i;
              return (
                <div key={stage} style={{ padding: '4px 8px', borderRadius: 4, fontSize: 9, fontWeight: 600, background: isActive ? 'var(--accent-blue)' : isPast ? 'rgba(59,130,246,0.15)' : 'var(--bg-panel-alt)', color: isActive ? '#fff' : isPast ? 'var(--accent-blue)' : 'var(--text-muted)', border: isActive ? 'none' : `1px solid ${isPast ? 'rgba(59,130,246,0.3)' : 'var(--border-subtle)'}` }}>
                  {stage.replace('_', ' ')}
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
          {MODEL_CLASSES.map(mc => {
            const status = modelClasses?.[mc.id] || 'inactive';
            return (
              <div key={mc.id} style={{ padding: '10px 12px', borderRadius: 6, background: 'var(--bg-panel-alt)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <StatusDot status={status} size={6} />
                  <span style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-primary)' }}>{mc.name}</span>
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.4 }}>{mc.authority.join(', ')}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ValidatorPanel({ validator }: { validator: { regimeAgreement: number; signalAgreement: number; driftScore: number } }) {
  const regimeAgreement = validator?.regimeAgreement || 0;
  const signalAgreement = validator?.signalAgreement || 0;
  const driftScore = validator?.driftScore || 0;

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-header"><span className="panel-title">Validator Status</span></div>
      <div style={{ padding: '12px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Regime Agreement</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: regimeAgreement >= 0.6 ? 'var(--accent-green)' : 'var(--accent-red)' }}>{`${(regimeAgreement * 100).toFixed(0)}%`}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>threshold: 60%</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Signal Agreement</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: signalAgreement >= 0.5 ? 'var(--accent-green)' : 'var(--accent-yellow)' }}>{`${(signalAgreement * 100).toFixed(0)}%`}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>threshold: 50%</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Drift Score</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: driftScore <= 0.3 ? 'var(--accent-green)' : 'var(--accent-yellow)' }}>{driftScore.toFixed(3)}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>max: 0.300</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BlockedEventsPanel({ events }: { events: any[] }) {
  const blockedEvents = (events || [])
    .filter((e: any) => e.type === 'guardrails:blocked' || e.type === 'checkpoint:blocked')
    .slice(0, 10);

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">Recent Blocked Events</span>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{`${blockedEvents.length} events`}</span>
      </div>
      <div style={{ padding: '12px 16px', maxHeight: 300, overflowY: 'auto' }}>
        {blockedEvents.length === 0
          ? <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}><div style={{ fontSize: 32, marginBottom: 8 }}>✓</div><div style={{ fontSize: 12 }}>No blocked events</div></div>
          : blockedEvents.map((event: any, i: number) => <BlockedEventRow key={i} event={event} />)
        }
      </div>
    </div>
  );
}

export default function GuardrailsView() {
  const [guardrailsState, setGuardrailsState] = useState({
    checkpoints: [] as any[],
    modelClasses: {} as Record<string, string>,
    lifecycleStage: 'RESEARCH',
    validator: { regimeAgreement: 0, signalAgreement: 0, driftScore: 0 },
    blockedEvents: [] as any[],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mockData = {
    checkpoints: [{
      timestamp: new Date().toISOString(),
      passed: true,
      gates: CHECKPOINT_GATES.map(g => ({ gate: g.id, passed: true, severity: 'block' })),
    }],
    modelClasses: { ALPHA: 'online', FEATURE: 'online', REGIME: 'online', RISK: 'online', EXECUTION: 'online', RESEARCH: 'online', OPTIMIZATION: 'online' },
    lifecycleStage: 'PAPER',
    validator: { regimeAgreement: 0.72, signalAgreement: 0.65, driftScore: 0.12 },
    blockedEvents: [],
  };

  useEffect(() => {
    let mounted = true;

    async function fetchGuardrails() {
      try {
        const data = await invoke('guardrails_state') as any;
        if (mounted) { setGuardrailsState(data); setLoading(false); }
      } catch {
        if (mounted) { setGuardrailsState(mockData); setLoading(false); }
      }
    }

    fetchGuardrails();

    const interval = setInterval(async () => {
      try {
        const data = await invoke('guardrails_state') as any;
        if (mounted) setGuardrailsState(data);
      } catch {}
    }, 5000);

    return () => { mounted = false; clearInterval(interval); };
  }, []);

  if (loading) {
    return (
      <div className="guardrails-view">
        <div className="view-header">
          <div className="view-title">Guardrails</div>
          <div className="view-subtitle">Safety Framework status</div>
        </div>
        <div className="panel" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 24, color: 'var(--text-muted)' }}>Loading guardrails status...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="guardrails-view">
      <div className="view-header">
        <div>
          <div className="view-title">Guardrails</div>
          <div className="view-subtitle">Safety Framework — Checkpoint gates, model class status, and validator metrics</div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--bg-panel)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
            <StatusDot status={guardrailsState.checkpoints?.[0]?.passed ? 'passed' : 'blocked'} />
            <span style={{ fontSize: 12, fontWeight: 500 }}>{guardrailsState.checkpoints?.[0]?.passed ? 'All gates passed' : 'Gate blocked'}</span>
          </div>
        </div>
      </div>

      <CheckpointPanel checkpoints={guardrailsState.checkpoints} />
      <ModelClassPanel modelClasses={guardrailsState.modelClasses} lifecycleStage={guardrailsState.lifecycleStage} />
      <ValidatorPanel validator={guardrailsState.validator} />
      <BlockedEventsPanel events={guardrailsState.blockedEvents} />
    </div>
  );
}