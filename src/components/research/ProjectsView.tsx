import { useState } from 'react';
import { useDashboardStore } from '../../store/dashboard';

interface Task {
  id: string;
  project: string;
  title: string;
  status: string;
}

interface Project {
  id: string;
  name: string;
  desc: string;
  status: string;
  phase: string;
  taskCount: number;
  completedTasks: number;
  progress: number;
  agents?: string[];
}

const PROJECT_STATUS_COLOR: Record<string, { bg: string; color: string; label: string }> = {
  active:   { bg: 'rgba(16,185,129,0.12)',  color: 'var(--accent-green)',  label: 'Active'   },
  paused:   { bg: 'rgba(245,158,11,0.12)',  color: 'var(--accent-yellow)', label: 'Paused'   },
  complete: { bg: 'rgba(59,130,246,0.12)',  color: 'var(--accent-blue)',   label: 'Complete' },
  archived: { bg: 'rgba(107,114,128,0.12)', color: 'var(--text-muted)',    label: 'Archived' },
};

interface Agent {
  id: string;
  name: string;
  emoji?: string;
}

function ProjectCard({ project, agents, tasks, onExpand, expanded }: { project: Project; agents: Agent[]; tasks: Task[]; onExpand: () => void; expanded: boolean }) {
  const status = PROJECT_STATUS_COLOR[project.status] || PROJECT_STATUS_COLOR.active;
  const projectAgents = (project.agents || []).map(id =>
    agents.find(a => a.id === id || a.name.toLowerCase() === id)
  ).filter(Boolean) as Agent[];
  const projectTasks = tasks.filter(t => t.project === project.name);

  return (
    <div className="project-card" onClick={onExpand} style={{ cursor: 'pointer' }}>
      <div className="project-header">
        <div>
          <div className="project-name">{project.name}</div>
          <div style={{
            display: 'inline-block',
            marginTop: '6px',
            padding: '3px 10px',
            borderRadius: '20px',
            fontSize: '10px',
            fontWeight: 600,
            background: status.bg,
            color: status.color,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            {status.label}
          </div>
        </div>
        <span style={{ fontSize: '22px', marginLeft: '8px' }}>
          {project.status === 'active' ? '🚀' : project.status === 'complete' ? '✅' : '📦'}
        </span>
      </div>

      <div className="project-desc">{project.desc}</div>

      <div style={{
        fontSize: '11px',
        fontFamily: 'var(--font-mono)',
        color: 'var(--accent-cyan)',
        background: 'rgba(6,182,212,0.06)',
        border: '1px solid rgba(6,182,212,0.15)',
        borderRadius: 'var(--radius-sm)',
        padding: '5px 10px',
      }}>
        {project.phase}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
        {[
          { label: 'Tasks', val: project.taskCount },
          { label: 'Done', val: project.completedTasks },
          { label: 'Progress', val: `${project.progress}%` },
        ].map(stat => (
          <div key={stat.label} style={{ textAlign: 'center' }}>
            <span className="project-stat-val">{stat.val}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{stat.label}</span>
          </div>
        ))}
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px' }}>
          <span>Completion</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>{project.progress}%</span>
        </div>
        <div className="project-progress-bar">
          <div className="project-progress-fill" style={{ width: `${project.progress}%` }} />
        </div>
      </div>

      <div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>Team</div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {projectAgents.map(a => (
            <div key={a.id} style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '3px 8px',
              background: 'var(--bg-root)',
              borderRadius: '20px',
              border: '1px solid var(--border-subtle)',
              fontSize: '11px',
              color: 'var(--text-secondary)',
            }}>
              <span style={{ fontSize: '12px' }}>{a.emoji}</span>
              <span>{a.name}</span>
            </div>
          ))}
        </div>
      </div>

      {expanded && (
        <div style={{
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '14px',
          marginTop: '4px',
        }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>
            Tasks ({projectTasks.length})
          </div>
          {projectTasks.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No tasks found.</div>
          ) : (
            projectTasks.map(t => (
              <div key={t.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 0',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                fontSize: '12px',
              }}>
                <span className={`status-badge ${
                  t.status === 'done' ? 'status-done' :
                  t.status === 'in-progress' ? 'status-in-progress' :
                  t.status === 'blocked' ? 'status-blocked' :
                  t.status === 'review' ? 'status-review' : 'status-todo'
                }`} style={{ padding: '2px 6px', fontSize: '9px' }}>
                  {t.status}
                </span>
                <span style={{ flex: 1, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.title}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>
                  {t.id}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function ProjectsView() {
  const state = useDashboardStore() as any;
  const projects: Project[] = state.projects || [];
  const agents: Agent[] = state.agents || [];
  const tasks: Task[] = state.tasks || [];
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function toggleExpand(id: string) {
    setExpandedId(prev => prev === id ? null : id);
  }

  const totalTasks = projects.reduce((s, p) => s + (p.taskCount || 0), 0);
  const totalDone = projects.reduce((s, p) => s + (p.completedTasks || 0), 0);
  const avgProgress = projects.length > 0
    ? Math.round(projects.reduce((s, p) => s + (p.progress || 0), 0) / projects.length)
    : 0;

  return (
    <div>
      <div className="view-header">
        <div>
          <div className="view-title">Projects</div>
          <div className="view-subtitle">Active projects — {projects.length} total</div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          {[
            { label: 'Total Tasks', val: totalTasks, color: 'var(--accent-blue)' },
            { label: 'Completed', val: totalDone, color: 'var(--accent-green)' },
            { label: 'Avg Progress', val: `${avgProgress}%`, color: 'var(--accent-purple)' },
          ].map(s => (
            <div key={s.label} style={{
              padding: '8px 16px',
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              textAlign: 'center',
              minWidth: '80px',
            }}>
              <div style={{ fontSize: '18px', fontWeight: 700, color: s.color, fontFamily: 'var(--font-mono)' }}>{s.val}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="projects-grid">
        {projects.map(project => (
          <ProjectCard
            key={project.id}
            project={project}
            agents={agents}
            tasks={tasks}
            expanded={expandedId === project.id}
            onExpand={() => toggleExpand(project.id)}
          />
        ))}

        <div style={{
          background: 'transparent',
          border: '1px dashed rgba(255,255,255,0.1)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          cursor: 'pointer',
          minHeight: '200px',
          color: 'var(--text-muted)',
          transition: 'all var(--transition)',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)'; e.currentTarget.style.color = 'var(--accent-blue)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          <div style={{ fontSize: '28px' }}>＋</div>
          <div style={{ fontSize: '13px' }}>New Project</div>
        </div>
      </div>
    </div>
  );
}