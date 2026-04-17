import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useDashboardStore } from '../../store/dashboard';

interface Skill {
  name: string;
  successRate: number;
  description?: string;
  totalExecutions?: number;
  avgTokens?: number;
  avgDuration?: number;
  version?: string;
  needsEvolution?: boolean;
  evolutionReason?: string;
  errorPatterns?: Array<{ pattern: string; count: number }>;
}

interface SkillStats {
  totalSkills: number;
  avgSuccessRate: number;
  needingEvolution: number;
  totalEvolutions: number;
}

interface LineageEntry {
  version: string;
  reason: string;
  timestamp?: string;
  improvements?: string;
}

function SkillCard({ skill, onClick }: { skill: Skill; onClick: (skill: Skill) => void }) {
  const healthColor = skill.successRate >= 0.8 ? 'var(--accent-green)' :
                      skill.successRate >= 0.5 ? 'var(--accent-yellow)' : 'var(--accent-red)';

  const healthBg = skill.successRate >= 0.8 ? 'rgba(34, 197, 94, 0.1)' :
                   skill.successRate >= 0.5 ? 'rgba(234, 179, 8, 0.1)' : 'rgba(239, 68, 68, 0.1)';

  return (
    <div
      className="skill-card"
      onClick={() => onClick(skill)}
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '16px',
        cursor: 'pointer',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
          {skill.name}
        </div>
        <div style={{
          padding: '4px 8px',
          borderRadius: 'var(--radius-sm)',
          background: healthBg,
          color: healthColor,
          fontSize: '11px',
          fontWeight: 600,
          fontFamily: 'var(--font-mono)',
        }}>
          {(skill.successRate * 100).toFixed(0)}%
        </div>
      </div>

      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
        {skill.description || 'No description'}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div style={{ fontSize: '11px' }}>
          <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>Executions</div>
          <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{skill.totalExecutions || 0}</div>
        </div>
        <div style={{ fontSize: '11px' }}>
          <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>Avg Tokens</div>
          <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{skill.avgTokens || 0}</div>
        </div>
        <div style={{ fontSize: '11px' }}>
          <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>Avg Duration</div>
          <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{skill.avgDuration || 0}ms</div>
        </div>
        <div style={{ fontSize: '11px' }}>
          <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>Version</div>
          <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>v{skill.version || '1.0.0'}</div>
        </div>
      </div>

      {skill.needsEvolution && (
        <div style={{
          marginTop: '12px',
          padding: '8px',
          background: 'rgba(239, 68, 68, 0.1)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '11px',
          color: 'var(--accent-red)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <span>⚠️</span>
          <span>Needs evolution: {skill.evolutionReason || 'Low success rate'}</span>
        </div>
      )}
    </div>
  );
}

function EvolutionTimeline({ lineage }: { lineage: LineageEntry[] }) {
  if (!lineage || lineage.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '20px' }}>
        No evolution history
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {lineage.map((entry, idx) => (
        <div
          key={idx}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px',
            background: 'var(--bg-root)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'var(--accent-purple)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 600,
            fontSize: '11px',
          }}>
            v{entry.version}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{entry.reason}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'Unknown date'}
            </div>
          </div>
          {entry.improvements && (
            <div style={{ fontSize: '11px', color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>
              {entry.improvements}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SkillDetail({ skill, onClose }: { skill: Skill; onClose: () => void }) {
  const [lineage, setLineage] = useState<LineageEntry[]>([]);
  const [skillLoading, setSkillLoading] = useState(true);

  useEffect(() => {
    if (skill) {
      invoke<{ lineage?: LineageEntry[] }>(`openspace_skill_lineage`, { name: skill.name })
        .then(data => {
          setLineage(data.lineage || []);
          setSkillLoading(false);
        })
        .catch(() => setSkillLoading(false));
    }
  }, [skill]);

  if (!skill) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      bottom: 0,
      width: '400px',
      background: 'var(--bg-panel)',
      borderLeft: '1px solid var(--border-subtle)',
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        padding: '20px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>{skill.name}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>v{skill.version || '1.0.0'}</div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '20px',
          }}
        >
          ×
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
            Performance Metrics
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
              { label: 'Success Rate', value: `${(skill.successRate * 100).toFixed(1)}%` },
              { label: 'Total Runs', value: String(skill.totalExecutions || 0) },
              { label: 'Avg Tokens', value: String(skill.avgTokens || 0) },
              { label: 'Avg Duration', value: `${skill.avgDuration || 0}ms` },
            ].map(m => (
              <div key={m.label} style={{
                background: 'var(--bg-root)',
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
              }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>{m.label}</div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
            Evolution Timeline
          </div>
          {skillLoading ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>Loading...</div>
          ) : (
            <EvolutionTimeline lineage={lineage} />
          )}
        </div>

        {skill.errorPatterns && skill.errorPatterns.length > 0 && (
          <div style={{ marginTop: '24px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
              Error Patterns
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {skill.errorPatterns.slice(0, 5).map((err, idx) => (
                <div key={idx} style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '11px',
                }}>
                  <div style={{ color: 'var(--accent-red)', marginBottom: '4px' }}>{err.pattern}</div>
                  <div style={{ color: 'var(--text-muted)' }}>Count: {err.count}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OpenSpaceView() {
  const state = useDashboardStore() as any;
  const [skills, setSkills] = useState<Skill[]>([]);
  const [stats, setStats] = useState<SkillStats | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadSkills() {
      try {
        const data = await invoke<{ skills?: Skill[]; stats?: SkillStats }>('openspace_skills');
        if (mounted) {
          setSkills(data.skills || []);
          setStats(data.stats || null);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (mounted) {
          setError((err as Error).message || 'Failed to load skills');
          setLoading(false);
        }
      }
    }

    loadSkills();
    const timer = setInterval(loadSkills, 30000);
    return () => { mounted = false; clearInterval(timer); };
  }, []);

  const sortedSkills = [...skills].sort((a, b) => {
    if (a.needsEvolution && !b.needsEvolution) return -1;
    if (!a.needsEvolution && b.needsEvolution) return 1;
    return (a.successRate || 0) - (b.successRate || 0);
  });

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <div className="view-header">
        <div>
          <div className="view-title">OpenSpace — Skill Evolution</div>
          <div className="view-subtitle">Self-evolving skill engine with performance tracking and auto-improvement</div>
        </div>
        {stats && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {[
              { label: 'Skills', val: stats.totalSkills || 0, color: 'var(--accent-cyan)' },
              { label: 'Avg Success', val: `${stats.avgSuccessRate ? (stats.avgSuccessRate * 100).toFixed(0) : 0}%`, color: 'var(--accent-green)' },
              { label: 'Need Evolution', val: String(stats.needingEvolution || 0), color: 'var(--accent-purple)' },
              { label: 'Evolutions', val: String(stats.totalEvolutions || 0), color: 'var(--accent-yellow)' },
            ].map(s => (
              <div key={s.label} style={{
                padding: '8px 16px',
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
              }}>
                <div style={{ fontSize: '18px', fontWeight: 700, color: s.color, fontFamily: 'var(--font-mono)' }}>
                  {s.val}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: 'var(--text-muted)' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="spinner" style={{ width: '32px', height: '32px', border: '3px solid var(--border-subtle)', borderTopColor: 'var(--accent-cyan)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
            <div>Loading skill data...</div>
          </div>
        </div>
      )}

      {error && (
        <div style={{
          padding: '20px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid var(--accent-red)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--accent-red)',
          margin: '20px',
        }}>
          <div style={{ fontWeight: 600, marginBottom: '8px' }}>Error Loading Skills</div>
          <div style={{ fontSize: '12px' }}>{error}</div>
          <div style={{ fontSize: '11px', marginTop: '8px', color: 'var(--text-muted)' }}>
            Make sure the OpenSpace engine is running and the openspace_skills command is available.
          </div>
        </div>
      )}

      {!loading && !error && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '16px',
          padding: '20px',
        }}>
          {sortedSkills.length === 0 && (
            <div style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              padding: '40px',
              color: 'var(--text-muted)',
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔬</div>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>No Skills Tracked Yet</div>
              <div style={{ fontSize: '12px' }}>Skills will appear here as they are executed by the system.</div>
            </div>
          )}

          {sortedSkills.map(skill => (
            <SkillCard
              key={skill.name}
              skill={skill}
              onClick={setSelectedSkill}
            />
          ))}
        </div>
      )}

      {selectedSkill && (
        <SkillDetail
          skill={selectedSkill}
          onClose={() => setSelectedSkill(null)}
        />
      )}
    </div>
  );
}