import React, { useState } from 'react';
import { useDashboardStore } from '../../store/dashboard';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const HOUR_SLOTS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
const SLOT_HEIGHT = 64;

interface CalTask {
  id: string;
  title: string;
  label?: string;
  days: number[];
  time: number;
  duration: number;
  color: string;
}

interface CalendarState {
  tasks: CalTask[];
  alwaysRunning: string[];
}

function formatHour(h: number): string {
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  if (h < 12) return `${h} AM`;
  return `${h - 12} PM`;
}

export default function CalendarView() {
  const state = useDashboardStore((s) => s) as any;
  const calTasks: CalTask[] = (state.calendar?.tasks) || [];
  const alwaysRun: string[] = (state.calendar?.alwaysRunning) || [];
  const [selectedTask, setSelectedTask] = useState<CalTask | null>(null);
  const today = new Date().getDay();

  function getTasksForDayHour(dayIndex: number, hour: number): CalTask[] {
    return calTasks.filter(t => t.days.includes(dayIndex) && t.time === hour);
  }

  return (
    <div>
      <div className="view-header">
        <div>
          <div className="view-title">Calendar</div>
          <div className="view-subtitle">Weekly schedule — recurring tasks and automation</div>
        </div>
      </div>

      <div className="always-running-bar">
        <span className="always-label">Always Running</span>
        {alwaysRun.map((item, i) => (
          <span key={i} className="always-pill">{item}</span>
        ))}
      </div>

      <div className="panel" style={{ overflow: 'hidden' }}>
        <div className="calendar-grid">
          <div className="cal-day-header" style={{ borderRight: '1px solid var(--border-subtle)', fontSize: '10px', color: 'var(--text-muted)' }}>
            CDT
          </div>

          {DAYS.map((day, i) => (
            <div key={day} className={`cal-day-header ${i === today ? 'today' : ''}`}
                 style={{ borderRight: i < 6 ? '1px solid var(--border-subtle)' : 'none' }}>
              {day}
              {i === today && (
                <span style={{
                  display: 'inline-block',
                  marginLeft: '4px',
                  width: '16px', height: '16px',
                  background: 'var(--accent-blue)',
                  borderRadius: '50%',
                  lineHeight: '16px',
                  textAlign: 'center',
                  fontSize: '10px',
                  color: 'white',
                  fontWeight: 700,
                }}>
                  {new Date().getDate()}
                </span>
              )}
            </div>
          ))}

          {HOUR_SLOTS.map(hour => (
            <React.Fragment key={hour}>
              <div className="cal-time-col">
                <div className="cal-time-slot">
                  {formatHour(hour)}
                </div>
              </div>

              {DAYS.map((day, dayIdx) => {
                const dayTasks = getTasksForDayHour(dayIdx, hour);
                return (
                  <div key={day} className="cal-day-col">
                    <div className="cal-cell" style={{ position: 'relative' }}>
                      {dayTasks.map(task => (
                        <div
                          key={task.id}
                          className={`cal-task-block cal-task-${task.color}`}
                          style={{
                            top: '4px',
                            height: `${task.duration * SLOT_HEIGHT - 8}px`,
                          }}
                          onClick={() => setSelectedTask(task)}
                          title={`${task.title} — ${task.label || ''}`}
                        >
                          <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {task.title}
                          </div>
                          {task.label && (
                            <div style={{ fontSize: '9px', opacity: 0.8, marginTop: '2px' }}>{task.label}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {selectedTask && (
        <div className="agent-overlay" onClick={() => setSelectedTask(null)}>
          <div className="agent-overlay-card" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedTask.title}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {selectedTask.label || 'No owner'}
                </div>
              </div>
              <button
                onClick={() => setSelectedTask(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '20px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Time</div>
                  <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{formatHour(selectedTask.time)}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Duration</div>
                  <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{selectedTask.duration}h</div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Days</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {DAYS.map((day, i) => (
                    <span key={day} style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 500,
                      background: selectedTask.days.includes(i)
                        ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
                      color: selectedTask.days.includes(i)
                        ? 'var(--accent-blue)' : 'var(--text-muted)',
                    }}>
                      {day}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}