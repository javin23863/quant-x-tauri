import { useDashboardStore } from '../../store/dashboard';

interface ActiveWorkflow {
  type: string;
  currentStep: number;
  totalSteps: number;
  stepLabel: string;
}

interface WorkflowHistoryEntry {
  type: string;
  timestamp: string;
  outcome?: string;
}

interface RuleSet {
  id: string;
  rules: Record<string, unknown>;
}

interface AIContext {
  activeSymbols?: string[];
}

interface AIState {
  context?: AIContext;
  activeWorkflow?: ActiveWorkflow | null;
  workflowHistory?: WorkflowHistoryEntry[];
  ruleSets?: RuleSet[];
}

export default function AIHarnessView() {
  const state = useDashboardStore() as any;
  const aiState: AIState = state.ai || {};
  const context = aiState.context;
  const activeWorkflow = aiState.activeWorkflow;
  const history: WorkflowHistoryEntry[] = aiState.workflowHistory || [];
  const rules: RuleSet[] = aiState.ruleSets || [];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '16px', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', paddingBottom: '20px' }}>

        <div className="panel" style={{ padding: '16px' }}>
          <div className="panel-header" style={{ marginBottom: '12px' }}>
            <span className="panel-title">Active Decision Workflow</span>
            <span style={{
              fontSize: '10px',
              padding: '2px 8px',
              borderRadius: '4px',
              background: activeWorkflow ? 'rgba(16,185,129,0.1)' : 'rgba(156,163,175,0.1)',
              color: activeWorkflow ? 'var(--accent-green)' : 'var(--text-muted)'
            }}>
              {activeWorkflow ? 'EXECUTING' : 'IDLE'}
            </span>
          </div>

          {activeWorkflow ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>{activeWorkflow.type}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Step {activeWorkflow.currentStep} of {activeWorkflow.totalSteps}: {activeWorkflow.stepLabel}
              </div>
              <div className="bar-track" style={{ height: '6px' }}>
                <div
                  className="bar-fill bar-blue"
                  style={{ width: `${(activeWorkflow.currentStep / activeWorkflow.totalSteps) * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>
              No active workflow. Start a rotation or posture shift to begin.
            </div>
          )}
        </div>

        <div className="panel" style={{ padding: '16px', flex: 1 }}>
          <div className="panel-header" style={{ marginBottom: '12px' }}>
            <span className="panel-title">Workflow History</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {history.length > 0 ? history.map((h, i) => (
              <div key={i} style={{
                padding: '10px',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                background: 'rgba(255,255,255,0.02)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600 }}>{h.type}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{new Date(h.timestamp).toLocaleString()}</div>
                </div>
                <div style={{ fontSize: '11px', color: h.outcome === 'success' ? 'var(--accent-green)' : 'var(--accent-yellow)' }}>
                  {(h.outcome ? h.outcome : 'COMPLETED').toUpperCase()}
                </div>
              </div>
            )) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No history found.</div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
        <div className="panel" style={{ padding: '16px' }}>
          <div className="panel-header" style={{ marginBottom: '12px' }}>
            <span className="panel-title">Knowledge Base</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Rule Sets</span>
              <span style={{ fontWeight: 600 }}>{rules.length}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Session Context</span>
              <span style={{ fontWeight: 600 }}>{(context && context.activeSymbols ? context.activeSymbols.length : 0)} symbols</span>
            </div>
          </div>
        </div>

        <div className="panel" style={{ padding: '16px' }}>
          <div className="panel-header" style={{ marginBottom: '12px' }}>
            <span className="panel-title">Active Rule Sets</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {rules.map(r => (
              <div key={r.id} style={{
                padding: '8px 10px',
                background: 'rgba(59,130,246,0.05)',
                border: '1px solid rgba(59,130,246,0.2)',
                borderRadius: '4px'
              }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent-blue)' }}>{r.id.toUpperCase()}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{Object.keys(r.rules || {}).length} rules defined</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}