import React, { useState } from 'react';
import { useDashboardStore } from '../../store/dashboard';

interface Task {
  id: string;
  title: string;
  desc?: string;
  owner: string;
  project: string;
  status: string;
  priority: string;
}

interface Agent {
  id: string;
  name: string;
  emoji?: string;
}

const STATUS_CLASS: Record<string, string> = {
  'todo': 'status-todo',
  'in-progress': 'status-in-progress',
  'done': 'status-done',
  'blocked': 'status-blocked',
  'review': 'status-review',
};

const STATUS_LABEL: Record<string, string> = {
  'todo': 'To Do',
  'in-progress': 'In Progress',
  'done': 'Done',
  'blocked': 'Blocked',
  'review': 'In Review',
};

const PRIORITY_CLASS: Record<string, string> = {
  'critical': 'priority-critical',
  'high': 'priority-high',
  'medium': 'priority-medium',
  'low': 'priority-low',
};

const PRIORITY_ICON: Record<string, string> = {
  'critical': '🔴',
  'high': '🟠',
  'medium': '🟡',
  'low': '⚪',
};

export default function TasksView() {
  const state = useDashboardStore((s) => s) as any;
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterOwner, setFilterOwner] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const tasks: Task[] = state.tasks || [];
  const agents: Agent[] = state.agents || [];

  const ownerOptions = ['all', ...new Set(tasks.map(t => t.owner))];
  const statusOptions = ['all', 'todo', 'in-progress', 'review', 'blocked', 'done'];

  const filtered = tasks.filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterOwner !== 'all' && t.owner !== filterOwner) return false;
    return true;
  });

  function getOwnerAgent(ownerId: string): Agent | undefined {
    return agents.find(a => a.id === ownerId || a.name.toLowerCase() === ownerId);
  }

  function toggleExpand(id: string) {
    setExpandedId(prev => prev === id ? null : id);
  }

  const totalByStatus: Record<string, number> = {
    todo: tasks.filter(t => t.status === 'todo').length,
    'in-progress': tasks.filter(t => t.status === 'in-progress').length,
    review: tasks.filter(t => t.status === 'review').length,
    done: tasks.filter(t => t.status === 'done').length,
    blocked: tasks.filter(t => t.status === 'blocked').length,
  };

  return (
    <div>
      <div className="view-header">
        <div>
          <div className="view-title">Tasks</div>
          <div className="view-subtitle">All active tasks across projects</div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {Object.entries(totalByStatus).map(([s, count]) => count > 0 && (
            <button
              key={s}
              onClick={() => setFilterStatus(filterStatus === s ? 'all' : s)}
              className="panel-btn"
              style={{
                background: filterStatus === s ? 'rgba(59,130,246,0.15)' : undefined,
                borderColor: filterStatus === s ? 'rgba(59,130,246,0.3)' : undefined,
              }}
            >
              <span className={`status-badge ${STATUS_CLASS[s]}`} style={{ background: 'none', padding: '0', fontSize: '10px' }}>
                {STATUS_LABEL[s]}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>{count}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Filter:</span>
        <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          {statusOptions.map(s => (
            <option key={s} value={s}>{s === 'all' ? 'All Status' : STATUS_LABEL[s] || s}</option>
          ))}
        </select>
        <select className="filter-select" value={filterOwner} onChange={e => setFilterOwner(e.target.value)}>
          {ownerOptions.map(o => (
            <option key={o} value={o}>{o === 'all' ? 'All Owners' : o.charAt(0).toUpperCase() + o.slice(1)}</option>
          ))}
        </select>
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>
          {filtered.length} of {tasks.length} tasks
        </span>
      </div>

      <div className="panel" style={{ overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-text">No tasks match the current filters</div>
          </div>
        ) : (
          <table className="tasks-table">
            <thead>
              <tr>
                <th style={{ width: '90px' }}>ID</th>
                <th>Title</th>
                <th style={{ width: '110px' }}>Owner</th>
                <th style={{ width: '120px' }}>Status</th>
                <th style={{ width: '100px' }}>Priority</th>
                <th style={{ width: '140px' }}>Project</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(task => {
                const owner = getOwnerAgent(task.owner);
                const isExpanded = expandedId === task.id;
                return (
                  <React.Fragment key={task.id}>
                    <tr onClick={() => toggleExpand(task.id)}>
                      <td className="task-id-cell">{task.id}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500 }}>
                            {task.title}
                          </span>
                          {isExpanded && (
                            <span style={{ fontSize: '10px', color: 'var(--accent-blue)' }}>▾</span>
                          )}
                        </div>
                      </td>
                      <td>
                        {owner ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '14px' }}>{owner.emoji}</span>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{owner.name}</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                            {task.owner}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`status-badge ${STATUS_CLASS[task.status] || ''}`}>
                          {STATUS_LABEL[task.status] || task.status}
                        </span>
                      </td>
                      <td>
                        <span className={`priority-pill ${PRIORITY_CLASS[task.priority] || 'priority-low'}`}>
                          {PRIORITY_ICON[task.priority]} {task.priority}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{task.project}</td>
                    </tr>
                    {isExpanded && (
                      <tr className="task-expand-row">
                        <td colSpan={6}>
                          <div className="task-detail">
                            <div style={{ marginBottom: '8px', fontWeight: 500, color: 'var(--text-primary)' }}>
                              {task.title}
                            </div>
                            <div style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                              {task.desc || 'No description available.'}
                            </div>
                            <div style={{ marginTop: '10px', display: 'flex', gap: '16px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                              <span>ID: {task.id}</span>
                              <span>Project: {task.project}</span>
                              <span>Priority: {task.priority}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}