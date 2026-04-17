import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface StatusBadgeProps {
  status: string;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const colors: Record<string, { bg: string; border: string; text: string; label: string }> = {
    running: { bg: 'rgba(16,185,129,0.15)', border: '#10B981', text: '#34D399', label: 'RUNNING' },
    stopped: { bg: 'rgba(107,114,128,0.15)', border: '#6B7280', text: '#9CA3AF', label: 'STOPPED' },
    error: { bg: 'rgba(239,68,68,0.15)', border: '#EF4444', text: '#F87171', label: 'ERROR' },
  };
  const c = colors[status] || colors.stopped;

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
      {c.label}
    </span>
  );
}

interface PipelineCardProps {
  title: string;
  type: string;
  status: string;
  children: React.ReactNode;
  onStart: () => void;
  onStop: () => void;
  extra?: React.ReactNode;
}

function PipelineCard({ title, type, status, children, onStart, onStop, extra }: PipelineCardProps) {
  const isRunning = status === 'running';

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{type}</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{title}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <StatusBadge status={status} />
          {extra}
        </div>
      </div>
      <div style={{ padding: 20 }}>
        {children}
        <div style={{ display: 'flex', gap: 12, marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
          <button
            onClick={onStart}
            disabled={isRunning}
            style={{
              flex: 1, padding: '12px 20px',
              background: isRunning ? 'rgba(16,185,129,0.1)' : '#10B981',
              color: isRunning ? 'var(--text-muted)' : '#fff',
              border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: isRunning ? 'not-allowed' : 'pointer',
              opacity: isRunning ? 0.5 : 1, transition: 'all 0.2s',
            }}
          >
            {isRunning ? '\u25CF Running' : '\u25B6 Start'}
          </button>
          <button
            onClick={onStop}
            disabled={!isRunning}
            style={{
              flex: 1, padding: '12px 20px',
              background: !isRunning ? 'rgba(239,68,68,0.1)' : '#EF4444',
              color: !isRunning ? 'var(--text-muted)' : '#fff',
              border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: !isRunning ? 'not-allowed' : 'pointer',
              opacity: !isRunning ? 0.5 : 1, transition: 'all 0.2s',
            }}
          >
            \u25A0 Stop
          </button>
        </div>
      </div>
    </div>
  );
}

interface PresetItem {
  name: string;
  profitTarget: number;
  maxDrawdown: number;
}

function PresetSelector({ presets, active, onSelect }: { presets: PresetItem[]; active: string; onSelect: (name: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setIsOpen(!isOpen)} style={{ padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{active || 'Select Preset'}</span>
        <span style={{ fontSize: 10 }}>&#9660;</span>
      </button>
      {isOpen && (
        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 8, minWidth: 200, zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
          {presets.map(preset => (
            <div key={preset.name} onClick={() => { onSelect(preset.name); setIsOpen(false); }} style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: 6, background: preset.name === active ? 'rgba(59,130,246,0.15)' : 'transparent', marginBottom: 4 }}>
              <div style={{ fontWeight: 600 }}>{preset.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{`Target: $${preset.profitTarget?.toLocaleString()} | DD: $${preset.maxDrawdown?.toLocaleString()}`}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface LaneState {
  running: boolean;
  status: string;
  strategies: unknown[];
  preset?: string;
}

interface ResearchState {
  running: boolean;
  status: string;
  phase: string | null;
  progress: number;
}

export default function PipelineControlView() {
  const [lane1, setLane1] = useState<LaneState>({ running: false, status: 'stopped', strategies: [] });
  const [lane2, setLane2] = useState<LaneState>({ running: false, status: 'stopped', preset: 'LucidFlex 50K', strategies: [] });
  const [research, setResearch] = useState<ResearchState>({ running: false, status: 'stopped', phase: null, progress: 0 });
  const [presets, setPresets] = useState<PresetItem[]>([]);

  useEffect(() => {
    fetchStatus();
    fetchPresets();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchStatus() {
    try {
      const data = await invoke<{ lane1: { running: boolean; status: string }; lane2: { running: boolean; status: string; preset: string }; research: { running: boolean; status: string; phase: string } }>('pipeline_status');
      setLane1(prev => ({ ...prev, running: data.lane1.running, status: data.lane1.status }));
      setLane2(prev => ({ ...prev, running: data.lane2.running, status: data.lane2.status, preset: data.lane2.preset }));
      setResearch(prev => ({ ...prev, running: data.research.running, status: data.research.status, phase: data.research.phase }));
    } catch (err) {
      console.error('Failed to fetch pipeline status:', err);
    }
  }

  async function fetchPresets() {
    try {
      const data = await invoke<{ presets: PresetItem[] }>('pipeline_presets');
      setPresets(data.presets || []);
    } catch (err) {
      console.error('Failed to fetch presets:', err);
    }
  }

  async function startLane1() {
    try {
      const data = await invoke<{ ok: boolean }>('pipeline_lane1_start');
      if (data.ok) setLane1(prev => ({ ...prev, running: true, status: 'running' }));
    } catch (err) { console.error('Failed to start lane1:', err); }
  }

  async function stopLane1() {
    try {
      const data = await invoke<{ ok: boolean }>('pipeline_lane1_stop');
      if (data.ok) setLane1(prev => ({ ...prev, running: false, status: 'stopped' }));
    } catch (err) { console.error('Failed to stop lane1:', err); }
  }

  async function startLane2() {
    try {
      const data = await invoke<{ ok: boolean }>('pipeline_lane2_start', { preset: lane2.preset });
      if (data.ok) setLane2(prev => ({ ...prev, running: true, status: 'running' }));
    } catch (err) { console.error('Failed to start lane2:', err); }
  }

  async function stopLane2() {
    try {
      const data = await invoke<{ ok: boolean }>('pipeline_lane2_stop');
      if (data.ok) setLane2(prev => ({ ...prev, running: false, status: 'stopped' }));
    } catch (err) { console.error('Failed to stop lane2:', err); }
  }

  async function startResearch() {
    try {
      const data = await invoke<{ ok: boolean }>('pipeline_research_start');
      if (data.ok) setResearch(prev => ({ ...prev, running: true, status: 'running', phase: 'hypothesis' }));
    } catch (err) { console.error('Failed to start research:', err); }
  }

  async function stopResearch() {
    try {
      const data = await invoke<{ ok: boolean }>('pipeline_research_stop');
      if (data.ok) setResearch(prev => ({ ...prev, running: false, status: 'stopped', phase: null }));
    } catch (err) { console.error('Failed to stop research:', err); }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Pipeline Control</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 32 }}>Start and stop trading pipelines independently. Same strategy engine, different constraint layers.</p>

      <div style={{ marginBottom: 24 }}>
        <PipelineCard title="Lane 1: Quant X Live" type="STANDARD TRADING" status={lane1.status} onStart={startLane1} onStop={stopLane1}>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            <div>Standard trading pipeline without prop-firm constraints.</div>
            <div style={{ marginTop: 8 }}><strong>Goal:</strong> Maximize profit</div>
            <div><strong>Constraints:</strong> None (risk management only)</div>
            <div><strong>Account:</strong> Regular brokerage account</div>
          </div>
        </PipelineCard>
      </div>

      <div style={{ marginBottom: 24 }}>
        <PipelineCard title="Lane 2: Prop-Firm Department" type="EVALUATION PIPELINE" status={lane2.status} onStart={startLane2} onStop={stopLane2} extra={<PresetSelector presets={presets} active={lane2.preset || ''} onSelect={(name: string) => setLane2(prev => ({ ...prev, preset: name }))} />}>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            <div>Prop-firm evaluation pipeline with constraint layer.</div>
            <div style={{ marginTop: 8 }}><strong>Goal:</strong> PASS EVALUATION</div>
            <div><strong>Constraints:</strong> Trailing drawdown, consistency rule, profit pacing</div>
            <div><strong>Preset:</strong>{` ${lane2.preset}`}</div>
            <div style={{ marginTop: 12, padding: 12, background: 'rgba(59,130,246,0.1)', borderRadius: 8 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Active Rules:</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                <div>&bull; Trailing drawdown</div>
                <div>&bull; 50% consistency rule</div>
                <div>&bull; Profit pacing</div>
                <div>&bull; Micros-first scaling</div>
              </div>
            </div>
          </div>
        </PipelineCard>
      </div>

      <div style={{ marginBottom: 24 }}>
        <PipelineCard title="Research Director" type="AUTOMATED WORKFLOW" status={research.status} onStart={startResearch} onStop={stopResearch}>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            <div>One button to run full research workflow.</div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
              {['Hypothesis', 'Backtest', 'Review', 'Implement'].map((phase, i) => (
                <div key={phase} style={{
                  padding: '8px 16px',
                  background: research.phase === phase.toLowerCase() ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)',
                  borderRadius: 6, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: research.phase === phase.toLowerCase() ? '#10B981' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff' }}>{i + 1}</div>
                  <span>{phase}</span>
                </div>
              ))}
            </div>
          </div>
        </PipelineCard>
      </div>

      <div style={{ padding: 20, background: 'rgba(139,92,246,0.1)', borderRadius: 12, border: '1px solid rgba(139,92,246,0.3)' }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>&#9881;&#65039; Architecture</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          <div><strong>Lane 1 &amp; Lane 2:</strong> Share the same strategy engine code, but run independently with different constraint layers.</div>
          <div style={{ marginTop: 4 }}><strong>Research Director:</strong> Automated hypothesis &rarr; backtest &rarr; review &rarr; implement workflow.</div>
        </div>
      </div>
    </div>
  );
}