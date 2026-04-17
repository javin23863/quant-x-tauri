import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

const sectionLabel: React.CSSProperties = { fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.5px' };
const thStyle: React.CSSProperties = { padding: '9px 12px', textAlign: 'left' as const, fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.5px' };
const tdStyle: React.CSSProperties = { padding: '10px 12px', color: 'var(--text-secondary)' };
const inputStyle: React.CSSProperties = { width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: '6px', padding: '7px 10px', fontSize: '13px', boxSizing: 'border-box' as const };
const labelStyle: React.CSSProperties = { fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.4px' };

function btnStyle(bg: string, full = false): React.CSSProperties {
  return { background: bg, color: '#fff', border: 'none', borderRadius: '6px', padding: '7px 14px', fontSize: '12px', cursor: 'pointer', fontWeight: 700, width: full ? '100%' : 'auto' };
}
const cancelBtnStyle: React.CSSProperties = { background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '7px 14px', fontSize: '13px', cursor: 'pointer' };

function categoryColor(cat: string): string {
  return { selection: '#3B82F6', direction: '#F59E0B', posture: '#6366F1', evolution: '#10B981', observation: '#94A3B8' }[cat] || '#6B7280';
}

function priorityColor(p: string): string {
  return { prop_rules: '#EF4444', risk_control: '#F59E0B', system_validation: '#3B82F6', profitability: '#10B981' }[p] || '#6B7280';
}

function EmptyState({ icon, text, sub }: { icon: string; text: string; sub?: string }) {
  return (
    <div className="panel" style={{ padding: '40px', textAlign: 'center' }}>
      <div style={{ fontSize: '32px', marginBottom: '12px' }}>{icon}</div>
      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>{text}</div>
      {sub && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>{sub}</div>}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CandidateTable({ candidates, onDecide }: { candidates: any[]; onDecide: (id: string, decision: string, notes: string) => void }) {
  if (candidates.length === 0) {
    return <EmptyState icon="📥" text="No candidates in queue." sub="Candidates appear here when a strategy passes the full pipeline." />;
  }
  const order: Record<string, number> = { pending: 0, deferred: 1, approved: 2, rejected: 3 };
  const sorted = [...candidates].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));

  return (
    <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
            {['Strategy', 'Symbol', 'Readiness', 'Prop Status', 'Queued', 'Status', 'Decision'].map(h => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(c => (
            <tr key={c.strategyId} style={{ borderBottom: '1px solid var(--border-subtle)', opacity: c.status === 'pending' ? 1 : 0.6 }}>
              <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600 }}>{c.strategyId}</td>
              <td style={tdStyle}>{c.symbol || '—'}</td>
              <td style={tdStyle}>
                {c.readinessScore != null ? (
                  <span style={{ color: c.readinessScore >= 80 ? '#10B981' : c.readinessScore >= 60 ? '#F59E0B' : '#EF4444', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    {c.readinessScore}
                  </span>
                ) : '—'}
              </td>
              <td style={tdStyle}>{c.propStatus || '—'}</td>
              <td style={{ ...tdStyle, fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{c.queuedAt ? new Date(c.queuedAt).toLocaleDateString() : '—'}</td>
              <td style={tdStyle}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: c.status === 'pending' ? '#F59E0B' : c.status === 'approved' ? '#10B981' : c.status === 'rejected' ? '#EF4444' : 'var(--text-muted)' }}>
                  {c.status}
                </span>
              </td>
              <td style={tdStyle}>
                {c.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => onDecide(c.strategyId, 'approve', 'Approved by principal')} style={{ background: '#10B98120', color: '#10B981', border: '1px solid #10B98140', borderRadius: '4px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer', fontWeight: 700 }}>Approve</button>
                    <button onClick={() => onDecide(c.strategyId, 'defer', 'Deferred for review')} style={{ background: '#6366F120', color: '#6366F1', border: '1px solid #6366F140', borderRadius: '4px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer' }}>Defer</button>
                    <button onClick={() => onDecide(c.strategyId, 'reject', 'Rejected by principal')} style={{ background: '#EF444420', color: '#EF4444', border: '1px solid #EF444440', borderRadius: '4px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer' }}>Reject</button>
                  </div>
                )}
                {c.status !== 'pending' && c.notes && (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>{c.notes}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PropMissionView() {
  const [state, setState] = useState<any>(null);
  const [progressPct, setProgressPct] = useState(0);
  const [tab, setTab] = useState('mission');
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [modal, setModal] = useState<string | null>(null);
  const [library, setLibrary] = useState<any[]>([]);
  const [activeSet, setActiveSet] = useState<any[]>([]);
  const [learningReport, setLearningReport] = useState<any>(null);
  const [learningRunning, setLearningRunning] = useState(false);
  const [modalData, setModalData] = useState<any>({});
  const [sessionCtx, setSessionCtx] = useState<any>(null);
  const [activeWorkflow, setActiveWorkflow] = useState<any>(null);
  const [protocols, setProtocols] = useState<any[]>([]);
  const [protocolStats, setProtocolStats] = useState<any>(null);
  const [protocolQuery, setProtocolQuery] = useState('');
  const [protocolCat, setProtocolCat] = useState('');
  const [protocolDetail, setProtocolDetail] = useState<any>(null);
  const [protocolLocalQ, setProtocolLocalQ] = useState('');
  const [protocolLocalCat, setProtocolLocalCat] = useState('');
  const [showAuthor, setShowAuthor] = useState(false);
  const [authorForm, setAuthorForm] = useState({ name: '', trigger: '', category: '', priority: 'medium', steps: '', notes: '', tags: '' });
  const [authorSaving, setAuthorSaving] = useState(false);
  const [filter, setFilter] = useState('all');

  function showToast(msg: string, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); }

  function apiPatch(url: string, body: any = {}) {
    return invoke(url.replace(/\//g, '_').replace(/^_/, ''), body);
  }
  function apiPost(url: string, body: any = {}) {
    return invoke(url.replace(/\//g, '_').replace(/^_/, ''), body);
  }

  useEffect(() => {
    invoke('prop_desk_state').then((d: any) => { if (d?.ok) { setState(d.state); setProgressPct(d.progressPct); } }).catch(() => {});
    invoke('strategy_library').then((d: any) => { if (d?.ok) setLibrary(d.strategies); }).catch(() => {});
    invoke('strategy_library_active').then((d: any) => { if (d?.ok) setActiveSet(d.strategies); }).catch(() => {});
    invoke('ai_context').then((d: any) => { if (d?.ok) { setSessionCtx(d.context); setActiveWorkflow(d.activeWorkflow); } }).catch(() => {});
    invoke('protocols_stats').then((d: any) => { if (d?.totalProtocols) setProtocolStats(d); }).catch(() => {});
  }, []);

  function loadProtocols(query: string, category: string) {
    invoke('protocols', { q: query, category, limit: 60 }).then((d: any) => { if (Array.isArray(d)) setProtocols(d); }).catch(() => {});
  }

  function handlePosture(field: string, value: string) {
    const body = field === 'styleBias' ? { styleBias: value } : { riskPosture: value };
    apiPatch('prop_desk_posture', body).then((d: any) => { if (d?.ok) { showToast('Posture updated'); } });
  }

  function handleOpsState(action: string, reason = '') {
    apiPost(`prop_desk_operations_${action}`, { reason }).then((d: any) => { if (d?.ok) { showToast(`Operations ${action}d`); } else showToast(d?.error || 'Failed', 'error'); });
  }

  function handleCandidateDecision(id: string, decision: string, notes: string) {
    apiPost(`prop_desk_candidates_${id}_${decision}`, { notes, reason: notes }).then((d: any) => { if (d?.ok) { showToast(`Candidate ${decision}d`); } else showToast(d?.error || 'Failed', 'error'); });
  }

  function handlePhaseChange(phase: string) {
    apiPatch('prop_desk_mission', { phase }).then((d: any) => { if (d?.ok) showToast(`Phase → ${phase}`); });
  }

  if (!state) return <div style={{ padding: '32px', color: 'var(--text-muted)' }}>Loading...</div>;

  const { mission, posture, candidates, directives, arbitrations, progress } = state;
  const pendingCandidates = Object.values(candidates).filter((c: any) => c.status === 'pending');
  const activeDirectives = directives.filter((d: any) => d.status === 'active');
  const opsColor = posture.operationsState === 'running' ? '#10B981' : posture.operationsState === 'caution' ? '#F59E0B' : '#EF4444';
  const aiStatusLabel = posture.operationsState === 'running' ? 'AI Active' : 'AI Offline';

  const categories = protocolStats ? Object.entries(protocolStats.categories).sort((a: any, b: any) => (b[1] as number) - (a[1] as number)) : [];
  const activeIds = new Set(activeSet.map((s: any) => s.strategyId));
  let displayed = library;
  if (filter === 'active') displayed = library.filter((s: any) => activeIds.has(s.strategyId));

  function runCycle() {
    setLearningRunning(true);
    invoke('strategy_library_learning_run', {}).then((d: any) => {
      if (d?.ok) { setLearningReport(d.report); showToast('Learning cycle complete'); }
      else showToast(d?.error || 'Failed', 'error');
    }).catch(() => showToast('Learning cycle failed', 'error')).finally(() => setLearningRunning(false));
  }

  function getStrategyAIMeta(strategy: any) {
    return strategy.ai || strategy.mike || { preference: 'neutral', recentBehavior: 'unknown', learningNotes: [], isActive: false };
  }

  return (
    <div style={{ padding: '0 0 40px 0' }}>
      <div className="view-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: '12px' }}>
        <div>
          <div className="view-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            AI Orchestrator
            <span style={{ fontSize: '12px', fontWeight: 600, background: opsColor + '20', color: opsColor, border: `1px solid ${opsColor}40`, borderRadius: '6px', padding: '3px 10px', letterSpacing: '0.5px' }}>
              {aiStatusLabel}
            </span>
          </div>
          <div className="view-subtitle">Prop Desk Principal · {mission.objective}</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {pendingCandidates.length > 0 && (
            <span style={{ background: '#F59E0B20', color: '#F59E0B', border: '1px solid #F59E0B40', borderRadius: '6px', padding: '5px 12px', fontSize: '12px', fontWeight: 700 }}>
              {pendingCandidates.length} awaiting decision
            </span>
          )}
          <button onClick={() => setModal('payout')} style={btnStyle('#6366F1')}>Record Payout</button>
          <button onClick={() => setModal('directive')} style={btnStyle('#10B981')}>+ Issue Directive</button>
        </div>
      </div>

      {activeWorkflow && (
        <div style={{ background: '#F59E0B15', border: '1px solid #F59E0B40', borderRadius: '8px', padding: '10px 18px', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '16px' }}>⚙️</span>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#F59E0B' }}>ACTIVE WORKFLOW: {activeWorkflow.type.replace(/_/g, ' ').toUpperCase()}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Step {activeWorkflow.stepIndex + 1}/{activeWorkflow.steps.length}: <span style={{ fontFamily: 'var(--font-mono)' }}>{activeWorkflow.currentStep}</span> · {activeWorkflow.description}</div>
            </div>
          </div>
          <button onClick={() => { setActiveWorkflow(null); showToast('Workflow cancelled'); }} style={{ background: '#EF444420', color: '#EF4444', border: '1px solid #EF444440', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
        </div>
      )}

      <div className="panel" style={{ padding: '20px 24px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Mission Progress</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              ${(mission.currentPayout || 0).toLocaleString()} of ${mission.targetPayout.toLocaleString()} target
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: progressPct >= 100 ? '#10B981' : 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {progressPct}%
          </div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: '6px', height: '10px', overflow: 'hidden' }}>
          <div style={{ background: progressPct >= 100 ? '#10B981' : progressPct >= 50 ? '#6366F1' : '#3B82F6', width: `${Math.min(progressPct, 100)}%`, height: '100%', borderRadius: '6px', transition: 'width 0.4s ease' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '10px', marginTop: '16px' }}>
          {[
            { label: 'Phase', value: mission.phase, mono: false },
            { label: 'Deployed', value: progress.strategiesDeployed, mono: true },
            { label: 'Rejected', value: progress.strategiesRejected, mono: true },
            { label: 'Evaluations', value: progress.evaluationsCompleted, mono: true },
            { label: 'Total Paid', value: `$${(progress.totalPayouts || 0).toLocaleString()}`, mono: true },
          ].map(stat => (
            <div key={stat.label} style={{ background: 'var(--bg-secondary)', borderRadius: '6px', padding: '10px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: stat.mono ? 'var(--font-mono)' : 'inherit' }}>{stat.value}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
        {[
          { id: 'mission', label: 'Posture & Phase' },
          { id: 'candidates', label: `Candidates${pendingCandidates.length > 0 ? ` (${pendingCandidates.length})` : ''}` },
          { id: 'directives', label: `Directives${activeDirectives.length > 0 ? ` (${activeDirectives.length})` : ''}` },
          { id: 'arbitration', label: 'Arbitration Log' },
          { id: 'library', label: `Library${activeSet.length > 0 ? ` · ${activeSet.length} active` : ''}` },
          { id: 'learning', label: 'Learning' },
          { id: 'protocols', label: `Protocols${protocolStats ? ` · ${protocolStats.totalProtocols}` : ''}` },
          { id: 'authority', label: 'Authority' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '8px 16px', fontSize: '13px', fontWeight: 600,
            color: tab === t.id ? 'var(--accent-blue)' : 'var(--text-secondary)',
            borderBottom: tab === t.id ? '2px solid var(--accent-blue)' : '2px solid transparent',
            marginBottom: '-1px',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'mission' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="panel" style={{ padding: '20px' }}>
            <div style={sectionLabel}>Style Bias</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px' }}>
              {[
                { value: 'defensive', desc: 'Capital preservation above all' },
                { value: 'consistent', desc: 'Steady progression, rule-safe' },
                { value: 'balanced', desc: 'Moderate edge-seeking' },
                { value: 'aggressive', desc: 'Max validated edge deployment' },
              ].map(b => (
                <button key={b.value} onClick={() => handlePosture('styleBias', b.value)} style={{
                  background: posture.styleBias === b.value ? '#3B82F620' : 'var(--bg-secondary)',
                  border: `1px solid ${posture.styleBias === b.value ? '#3B82F6' : 'var(--border-subtle)'}`,
                  borderRadius: '8px', padding: '12px', cursor: 'pointer', textAlign: 'left' as const,
                }}>
                  <div style={{ fontWeight: 700, fontSize: '12px', color: posture.styleBias === b.value ? '#3B82F6' : 'var(--text-primary)', textTransform: 'capitalize' }}>{b.value}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>{b.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="panel" style={{ padding: '20px' }}>
            <div style={sectionLabel}>Risk Posture</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
              {[
                { value: 'survival', desc: 'Minimize all risk, protect the account' },
                { value: 'progression', desc: 'Steady advancement toward target' },
                { value: 'acceleration', desc: 'Push validated edges harder' },
              ].map(p => (
                <button key={p.value} onClick={() => handlePosture('riskPosture', p.value)} style={{
                  background: posture.riskPosture === p.value ? '#10B98120' : 'var(--bg-secondary)',
                  border: `1px solid ${posture.riskPosture === p.value ? '#10B981' : 'var(--border-subtle)'}`,
                  borderRadius: '8px', padding: '12px', cursor: 'pointer', textAlign: 'left' as const, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '12px', color: posture.riskPosture === p.value ? '#10B981' : 'var(--text-primary)', textTransform: 'capitalize' }}>{p.value}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{p.desc}</div>
                  </div>
                  {posture.riskPosture === p.value && <span style={{ color: '#10B981', fontSize: '16px' }}>✓</span>}
                </button>
              ))}
            </div>
          </div>
          <div className="panel" style={{ padding: '20px' }}>
            <div style={sectionLabel}>Operations</div>
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {posture.operationsState === 'running' ? (
                <>
                  <button onClick={() => handleOpsState('pause', 'Manual pause by principal')} style={btnStyle('#EF4444', true)}>Pause Operations</button>
                  <button onClick={() => handleOpsState('caution', 'Elevated caution by principal')} style={btnStyle('#F59E0B', true)}>Set Caution</button>
                </>
              ) : (
                <button onClick={() => handleOpsState('resume')} style={btnStyle('#10B981', true)}>Resume Operations</button>
              )}
              {posture.pauseReason && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                  Reason: {posture.pauseReason}
                </div>
              )}
            </div>
          </div>
          <div className="panel" style={{ padding: '20px' }}>
            <div style={sectionLabel}>Mission Phase</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px' }}>
              {['evaluation', 'funded', 'scaling', 'target_reached'].map(ph => (
                <button key={ph} onClick={() => handlePhaseChange(ph)} style={{
                  background: mission.phase === ph ? '#6366F120' : 'var(--bg-secondary)',
                  border: `1px solid ${mission.phase === ph ? '#6366F1' : 'var(--border-subtle)'}`,
                  borderRadius: '6px', padding: '10px', cursor: 'pointer', textAlign: 'center' as const,
                  fontWeight: 700, fontSize: '11px',
                  color: mission.phase === ph ? '#6366F1' : 'var(--text-secondary)',
                  textTransform: 'capitalize' as const,
                }}>
                  {ph.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'candidates' && <CandidateTable candidates={Object.values(candidates)} onDecide={handleCandidateDecision} />}

      {tab === 'directives' && (
        <div>
          {directives.length === 0 ? (
            <EmptyState icon="📋" text="No directives issued yet." sub="Directives are the AI Orchestrator's formal instructions to the operational stack." />
          ) : (
            <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
                    {['Category', 'Directive', 'Issued', 'Status', ''].map(h => <th key={h} style={thStyle}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {directives.map((d: any) => (
                    <tr key={d.id} style={{ borderBottom: '1px solid var(--border-subtle)', opacity: d.status === 'active' ? 1 : 0.5 }}>
                      <td style={tdStyle}><span style={{ background: categoryColor(d.category) + '20', color: categoryColor(d.category), borderRadius: '4px', padding: '2px 7px', fontSize: '11px', fontWeight: 600 }}>{d.category}</span></td>
                      <td style={{ ...tdStyle, color: 'var(--text-primary)', fontWeight: 500, maxWidth: '320px' }}>{d.text}</td>
                      <td style={{ ...tdStyle, color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: '11px' }}>{d.issuedAt ? new Date(d.issuedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      <td style={tdStyle}><span style={{ color: d.status === 'active' ? '#10B981' : 'var(--text-muted)', fontSize: '11px', fontWeight: d.status === 'active' ? 700 : 400 }}>{d.status}</span></td>
                      <td style={tdStyle}>
                        {d.status === 'active' && (
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button onClick={() => apiPost(`prop_desk_directives_${d.id}_fulfill`)} style={{ background: '#10B98120', color: '#10B981', border: '1px solid #10B98140', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', cursor: 'pointer' }}>Done</button>
                            <button onClick={() => apiPost(`prop_desk_directives_${d.id}_cancel`)} style={{ background: '#EF444420', color: '#EF4444', border: '1px solid #EF444440', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'arbitration' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
            <button onClick={() => setModal('arbitration')} style={btnStyle('#F59E0B')}>+ Log Arbitration</button>
          </div>
          {arbitrations.length === 0 ? (
            <EmptyState icon="⚖️" text="No arbitrations recorded." sub="Log a conflict resolution when competing priorities need to be adjudicated." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {arbitrations.map((a: any) => (
                <div key={a.id} className="panel" style={{ padding: '14px 18px', borderLeft: `3px solid ${priorityColor(a.winningPriority)}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ background: priorityColor(a.winningPriority) + '20', color: priorityColor(a.winningPriority), borderRadius: '4px', padding: '2px 8px', fontSize: '11px', fontWeight: 700 }}>{a.winningPriority.replace(/_/g, ' ')}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{a.loggedAt ? new Date(a.loggedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}><strong style={{ color: 'var(--text-primary)' }}>Conflict:</strong> {a.conflict}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}><strong style={{ color: 'var(--text-primary)' }}>Decision:</strong> {a.decision}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'authority' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="panel" style={{ padding: '20px' }}>
            <div style={{ ...sectionLabel, color: '#10B981', marginBottom: '12px' }}>AI Orchestrator CAN</div>
            {[
              'Approve or reject strategies for prop deployment',
              'Select which strategies are prioritized',
              'Decide whether to continue, pause, or redirect search',
              'Request variation (mutation/evolution) within allowed structure',
              'Choose portfolio combinations from validated candidates',
              'Set style bias and risk posture',
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span style={{ color: '#10B981', flexShrink: 0 }}>✓</span> {item}
              </div>
            ))}
          </div>
          <div className="panel" style={{ padding: '20px' }}>
            <div style={{ ...sectionLabel, color: '#EF4444', marginBottom: '12px' }}>AI Orchestrator CANNOT</div>
            {[
              'Alter strategy logic outside defined system interfaces',
              'Bypass validation, realism, or prop rule layers',
              'Inject untested strategies into execution',
              'Modify the underlying pipeline',
              'Override prop rules (they are the hard floor)',
              'Act on partial or unvalidated pipeline outputs',
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span style={{ color: '#EF4444', flexShrink: 0 }}>✗</span> {item}
              </div>
            ))}
          </div>
        </div>
      )}

      {modal === 'directive' && (
        <Modal title="Issue Directive" onClose={() => setModal(null)}>
          <form onSubmit={e => { e.preventDefault(); const f = e.target as HTMLFormElement; apiPost('prop_desk_directives', { text: (f.text as HTMLInputElement).value.trim(), category: (f.category as HTMLInputElement).value }).then((d: any) => { if (d?.ok) { showToast('Directive issued'); setModal(null); } else showToast(d?.error || 'Failed', 'error'); }); }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div><label style={labelStyle}>Category</label><select name="category" style={inputStyle}><option value="selection">Selection — approve/reject/prioritize candidates</option><option value="direction">Direction — redirect or pause search</option><option value="posture">Posture — risk or style guidance</option><option value="evolution">Evolution — mutation/evolution guidance</option><option value="observation">Observation — monitor and report</option></select></div>
            <div><label style={labelStyle}>Directive</label><textarea name="text" rows={3} required placeholder="e.g. Prioritize futures strategies in trending regime." style={{ ...inputStyle, resize: 'vertical' as const }} /></div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}><button type="button" onClick={() => setModal(null)} style={cancelBtnStyle}>Cancel</button><button type="submit" style={btnStyle('#10B981')}>Issue</button></div>
          </form>
        </Modal>
      )}

      {modal === 'arbitration' && (
        <Modal title="Log Arbitration" onClose={() => setModal(null)}>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>Priority order: Prop Rules → Risk Control → System Validation → Profitability</p>
          <form onSubmit={e => { e.preventDefault(); const f = e.target as HTMLFormElement; apiPost('prop_desk_arbitrations', { conflict: (f.conflict as HTMLInputElement).value.trim(), decision: (f.decision as HTMLInputElement).value.trim(), winningPriority: (f.winningPriority as HTMLInputElement).value }).then((d: any) => { if (d?.ok) { showToast('Arbitration recorded'); setModal(null); } else showToast(d?.error || 'Failed', 'error'); }); }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div><label style={labelStyle}>Conflict</label><input name="conflict" required placeholder="e.g. High-return strategy conflicts with consistency rule" style={inputStyle} /></div>
            <div><label style={labelStyle}>Decision</label><textarea name="decision" rows={2} required placeholder="" style={{ ...inputStyle, resize: 'vertical' as const }} /></div>
            <div><label style={labelStyle}>Winning Priority</label><select name="winningPriority" style={inputStyle}><option value="prop_rules">Prop Rules (highest)</option><option value="risk_control">Risk Control</option><option value="system_validation">System Validation</option><option value="profitability">Profitability (lowest)</option></select></div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}><button type="button" onClick={() => setModal(null)} style={cancelBtnStyle}>Cancel</button><button type="submit" style={btnStyle('#F59E0B')}>Record</button></div>
          </form>
        </Modal>
      )}

      {modal === 'payout' && (
        <Modal title="Record Payout" onClose={() => setModal(null)}>
          <form onSubmit={e => { e.preventDefault(); const f = e.target as HTMLFormElement; apiPost('prop_desk_payout', { amount: parseFloat((f.amount as HTMLInputElement).value) }).then((d: any) => { if (d?.ok) { showToast('Payout recorded'); setModal(null); } else showToast(d?.error || 'Failed', 'error'); }); }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div><label style={labelStyle}>Payout Amount ($)</label><input name="amount" type="number" min="0" step="0.01" required placeholder="e.g. 2500" style={inputStyle} /></div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}><button type="button" onClick={() => setModal(null)} style={cancelBtnStyle}>Cancel</button><button type="submit" style={btnStyle('#6366F1')}>Record</button></div>
          </form>
        </Modal>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: toast.type === 'error' ? '#EF4444' : '#10B981', color: '#fff', borderRadius: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: 600, zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}