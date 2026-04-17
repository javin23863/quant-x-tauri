import React from 'react';
import { useDashboardStore } from '../../store/dashboard';

interface Task {
  id: string;
  title: string;
  owner: string;
  project: string;
  status: string;
  priority: string;
}

const PRIORITY_DOT: Record<string, string> = {
  critical: 'var(--accent-pink)',
  high: 'var(--accent-red)',
  medium: 'var(--accent-yellow)',
  low: 'var(--text-muted)',
};

function TaskItem({ task }: { task: Task }) {
  return (
    <div className="tsp-task-item">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '6px' }}>
        <div className="tsp-task-title">{task.title}</div>
        <div style={{
          width: '7px', height: '7px', borderRadius: '50%',
          background: PRIORITY_DOT[task.priority] || 'var(--text-muted)',
          flexShrink: 0,
          marginTop: '4px',
        }} />
      </div>
      <div className="tsp-task-meta">
        <span>{task.owner}</span>
        <span>·</span>
        <span style={{ fontFamily: 'var(--font-mono)' }}>{task.id}</span>
        <span>·</span>
        <span>{task.project}</span>
      </div>
    </div>
  );
}

function Section({ label, items, accent }: { label: string; items: Task[]; accent?: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="tsp-section-label" style={{ color: accent || 'var(--text-muted)' }}>
        {label} ({items.length})
      </div>
      {items.map(t => <TaskItem key={t.id} task={t} />)}
    </div>
  );
}

export default function TaskSidePanel() {
  const state = useDashboardStore((s) => s) as any;
  const tasks: Task[] = state.tasks || [];
  const isOpen = state.taskPanelOpen;

  const running = tasks.filter(t => t.status === 'in-progress');
  const scheduled = tasks.filter(t => t.status === 'todo');
  const blocked = tasks.filter(t => t.status === 'blocked');
  const review = tasks.filter(t => t.status === 'review');

  function togglePanel() {
    useDashboardStore.setState({ taskPanelOpen: !isOpen } as any);
  }

  return (
    <div className={`task-side-panel ${isOpen ? 'open' : ''}`}>
      <div
        className="tsp-tab"
        onClick={togglePanel}
        title={isOpen ? 'Close task panel' : 'Open task panel'}
      >
        Tasks {!isOpen && running.length > 0 && `(${running.length})`}
      </div>

      <div className="tsp-header">
        <span className="tsp-title">Task Awareness</span>
        <button className="tsp-close" onClick={togglePanel}>✕</button>
      </div>

      <div className="tsp-body">
        <Section label="Running Now" items={running} accent="var(--accent-blue)" />
        <Section label="Review" items={review} accent="var(--accent-purple)" />
        <Section label="Blocked" items={blocked} accent="var(--accent-red)" />
        <Section label="Scheduled" items={scheduled} accent="var(--text-secondary)" />

        {tasks.length === 0 && (
          <div className="empty-state" style={{ paddingTop: '24px' }}>
            <div className="empty-state-icon">✓</div>
            <div className="empty-state-text" style={{ fontSize: '12px' }}>All clear</div>
          </div>
        )}

        <div style={{
          marginTop: '16px',
          paddingTop: '12px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
        }}>
          {([
            { label: 'Active', val: running.length, color: 'var(--accent-blue)' },
            { label: 'Blocked', val: blocked.length, color: 'var(--accent-red)' },
            { label: 'Scheduled', val: scheduled.length, color: 'var(--text-secondary)' },
            { label: 'Review', val: review.length, color: 'var(--accent-purple)' },
          ]).map(s => (
            <div key={s.label} style={{
              background: 'var(--bg-root)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px',
              border: '1px solid var(--border-subtle)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: s.color, fontFamily: 'var(--font-mono)' }}>{s.val}</div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}