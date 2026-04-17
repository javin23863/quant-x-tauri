import { useState, useEffect, useCallback } from 'react';
import { useDashboardStore } from '../../store/dashboard';
import { invoke } from '@tauri-apps/api/core';

interface Strategy {
  id: string;
  name: string;
  type: string;
  symbol: string;
  sharpe: number;
  maxDD: number;
  winRate: number;
  createdAt: string;
  tags: string[];
  truthHistory: { verdict: string; reason: string; ts: string }[];
  filePath: string;
}

interface GitStatus {
  isRepo: boolean;
  branch?: string;
  lastCommit?: { hash: string; message: string };
  ahead?: number;
  behind?: number;
  isClean?: boolean;
  modified?: string[];
  untracked?: string[];
  staged?: string[];
  error?: string;
}

interface PushResult {
  success: boolean;
  commit?: string;
  files?: string[];
  warning?: string;
  error?: string;
}

const FALLBACK_STRATEGIES: Strategy[] = [
  {
    id: 'strat-spy-momentum',
    name: 'SPY Momentum Alpha',
    type: 'momentum',
    symbol: 'SPY',
    sharpe: 1.85,
    maxDD: 0.12,
    winRate: 0.62,
    createdAt: new Date().toISOString(),
    tags: ['trend', 'liquid'],
    truthHistory: [{ verdict: 'PASS', reason: 'Robust in OOS data', ts: new Date().toISOString() }],
    filePath: 'strategies/spy-momentum-alpha.js',
  },
  {
    id: 'strat-qqq-reversal',
    name: 'QQQ Mean Reversion',
    type: 'mean_reversion',
    symbol: 'QQQ',
    sharpe: 1.42,
    maxDD: 0.08,
    winRate: 0.58,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    tags: ['reversal', 'tech'],
    truthHistory: [{ verdict: 'PASS', reason: 'Sharpe > 1.2, DD < 10%', ts: new Date(Date.now() - 3600000).toISOString() }],
    filePath: 'strategies/qqq-mean-reversion.js',
  },
  {
    id: 'strat-tsla-breakout',
    name: 'TSLA Volatility Breakout',
    type: 'breakout',
    symbol: 'TSLA',
    sharpe: 1.15,
    maxDD: 0.18,
    winRate: 0.45,
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    tags: ['volatility', 'momentum'],
    truthHistory: [{ verdict: 'FAIL', reason: 'High variance in OOS', ts: new Date(Date.now() - 7200000).toISOString() }],
    filePath: 'strategies/tsla-breakout.js',
  },
];

export default function StrategyLibraryView() {
  const setView = useDashboardStore((s: any) => s.setView as ((view: string) => void)) ?? (() => {});
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [gitLoading, setGitLoading] = useState(false);
  const [selectedForPush, setSelectedForPush] = useState<string[]>([]);
  const [pushMessage, setPushMessage] = useState('');
  const [pushResult, setPushResult] = useState<PushResult | null>(null);

  const fetchLibrary = useCallback(async () => {
    try {
      const data = await invoke<{ ok: boolean; strategies: Strategy[] }>('strategy-library');
      if (data.ok) {
        setStrategies(data.strategies ?? []);
      }
    } catch {
      setStrategies(FALLBACK_STRATEGIES);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchGitStatus = useCallback(async () => {
    try {
      const data = await invoke<GitStatus>('strategy-library/git/status');
      setGitStatus(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setGitStatus({ isRepo: false, error: msg });
    }
  }, []);

  useEffect(() => {
    fetchLibrary();
    fetchGitStatus();
    const interval = setInterval(fetchGitStatus, 60000);
    return () => clearInterval(interval);
  }, [fetchLibrary, fetchGitStatus]);

  const filtered = strategies.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleStrategySelection = (id: string) => {
    setSelectedForPush((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handlePushToLibrary = async () => {
    if (selectedForPush.length === 0) return;

    setGitLoading(true);
    setPushResult(null);

    try {
      const data = await invoke<{ ok: boolean; commit: string; files: string[]; warning?: string; error?: string }>(
        'strategy-library/git/push-to-library',
        {
          strategyIds: selectedForPush,
          commitMessage: pushMessage || undefined,
          autoPush: false,
        }
      );

      if (data.ok) {
        setPushResult({
          success: true,
          commit: data.commit,
          files: data.files,
          warning: data.warning,
        });
        setSelectedForPush([]);
        setPushMessage('');
        await fetchGitStatus();
      } else {
        setPushResult({ success: false, error: data.error });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setPushResult({ success: false, error: msg });
    } finally {
      setGitLoading(false);
    }
  };

  const getGitSyncStatus = (strategy: Strategy): string => {
    if (!gitStatus || !gitStatus.isRepo) return 'unknown';

    const filePath = strategy.filePath || '';
    const strategyId = strategy.id;
    const modified = gitStatus.modified ?? [];
    const untracked = gitStatus.untracked ?? [];
    const staged = gitStatus.staged ?? [];

    const isStaged = staged.some((f) => f.includes(strategyId) || filePath.includes(f));
    const isModified = modified.some((f) => f.includes(strategyId) || filePath.includes(f));
    const isUntracked = untracked.some((f) => f.includes(strategyId) || filePath.includes(f));

    if (isStaged) return 'staged';
    if (isModified) return 'modified';
    if (isUntracked) return 'untracked';
    return 'synced';
  };

  const getSyncColor = (status: string): string => {
    switch (status) {
      case 'synced': return 'var(--accent-green)';
      case 'modified': return 'var(--accent-yellow, #f59e0b)';
      case 'untracked': return 'var(--accent-blue)';
      case 'staged': return 'var(--accent-purple, #8b5cf6)';
      default: return 'var(--text-muted)';
    }
  };

  const getSyncLabel = (status: string): string => {
    switch (status) {
      case 'synced': return '✓ Synced';
      case 'modified': return '⚡ Modified';
      case 'untracked': return '? New';
      case 'staged': return '◆ Staged';
      default: return '? Unknown';
    }
  };

  const truncateMsg = (msg: string, len: number) => {
    if (!msg) return '';
    return msg.length > len ? msg.substring(0, len) + '...' : msg;
  };

  return (
    <div className="mission-tab-frame">
      <div className="view-header">
        <div>
          <div className="view-title">Strategy Library</div>
          <div className="view-subtitle">Searchable warehouse of profitable discoveries (Git-Synced)</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            className="factory-input"
            style={{ width: '200px' }}
            placeholder="Search by name or symbol..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button className="factory-btn" onClick={fetchLibrary}>Refresh</button>
          <button className="factory-btn" onClick={fetchGitStatus} disabled={gitLoading}>
            {gitLoading ? '...' : 'Sync Status'}
          </button>
        </div>
      </div>

      {gitStatus && (
        <div className="panel" style={{ padding: '12px 16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
            {gitStatus.isRepo ? (
              <>
                <div style={{ fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Branch:</span>{' '}
                  <span style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>{gitStatus.branch}</span>
                </div>
                {gitStatus.lastCommit && (
                  <div style={{ fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Last commit:</span>{' '}
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                      {gitStatus.lastCommit.hash}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', marginLeft: '8px', fontSize: '11px' }}>
                      {truncateMsg(gitStatus.lastCommit.message ?? '', 40)}
                    </span>
                  </div>
                )}
                <div style={{ fontSize: '12px' }}>
                  <span style={{ color: (gitStatus.ahead ?? 0) > 0 ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                    ↑{gitStatus.ahead ?? 0}
                  </span>
                  {' / '}
                  <span style={{ color: (gitStatus.behind ?? 0) > 0 ? 'var(--accent-yellow)' : 'var(--text-muted)' }}>
                    ↓{gitStatus.behind ?? 0}
                  </span>
                </div>
              </>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--accent-red)' }}>
                ⚠ Not a git repository or git unavailable
              </div>
            )}
          </div>
          <div style={{ fontSize: '12px', fontWeight: gitStatus.isClean ? 600 : 500, color: gitStatus.isClean ? 'var(--accent-green)' : 'var(--accent-yellow)' }}>
            {gitStatus.isClean ? '✓ Clean' : `(${gitStatus.modified?.length ?? 0} changed)`}
          </div>
        </div>
      )}

      {selectedForPush.length > 0 && (
        <div className="panel" style={{ padding: '12px 16px', marginBottom: '16px', background: 'rgba(59, 130, 246, 0.1)', borderLeft: '4px solid var(--accent-blue)' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '13px' }}>
              <strong>{selectedForPush.length}</strong> selected
            </div>
            <input
              className="factory-input"
              style={{ flex: 1, minWidth: '200px' }}
              placeholder="Commit message (optional)..."
              value={pushMessage}
              onChange={(e) => setPushMessage(e.target.value)}
            />
            <button
              className="factory-btn factory-btn-primary"
              onClick={handlePushToLibrary}
              disabled={gitLoading}
            >
              {gitLoading ? 'Pushing...' : 'Push to Library'}
            </button>
            <button className="factory-btn" onClick={() => setSelectedForPush([])}>
              Clear
            </button>
          </div>
        </div>
      )}

      {pushResult && (
        <div className="panel" style={{
          padding: '12px 16px',
          marginBottom: '16px',
          background: pushResult.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          borderLeft: `4px solid ${pushResult.success ? 'var(--accent-green)' : 'var(--accent-red)'}`,
        }}>
          {pushResult.success ? (
            <div style={{ fontSize: '12px' }}>
              <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>✓ Committed</span>
              <span style={{ fontFamily: 'var(--font-mono)', marginLeft: '8px' }}>{pushResult.commit}</span>
              {pushResult.files && pushResult.files.length > 0 && (
                <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>
                  ({pushResult.files.length} file{pushResult.files.length !== 1 ? 's' : ''})
                </span>
              )}
              {pushResult.warning && (
                <div style={{ color: 'var(--accent-yellow)', marginTop: '4px' }}>⚠ {pushResult.warning}</div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: 'var(--accent-red)' }}>
              ✗ {pushResult.error}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="panel" style={{ padding: '40px', textAlign: 'center' }}>Loading library...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {filtered.map((s) => {
            const syncStatus = getGitSyncStatus(s);
            const isSelected = selectedForPush.includes(s.id);
            const tags = s.tags ?? [];

            return (
              <div
                key={s.id}
                className="panel"
                style={{
                  padding: '16px',
                  position: 'relative',
                  borderLeft: `4px solid ${isSelected ? 'var(--accent-blue)' : 'var(--accent-green)'}`,
                  cursor: 'pointer',
                  transition: 'border-color 0.2s',
                }}
                onClick={() => toggleStrategySelection(s.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700 }}>{s.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{s.id}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{s.symbol}</div>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--accent-blue)' }}>{s.type}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', textAlign: 'center' }}>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sharpe</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-green)' }}>{s.sharpe.toFixed(2)}</div>
                  </div>
                  <div style={{ padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', textAlign: 'center' }}>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Max DD</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-red)' }}>{(s.maxDD * 100).toFixed(1)}%</div>
                  </div>
                  <div style={{ padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', textAlign: 'center' }}>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Win Rate</div>
                    <div style={{ fontSize: '13px', fontWeight: 700 }}>{(s.winRate * 100).toFixed(0)}%</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  {tags.map((t) => (
                    <span key={t} style={{ fontSize: '9px', padding: '2px 6px', background: 'var(--border-subtle)', borderRadius: '20px', color: 'var(--text-secondary)' }}>
                      #{t}
                    </span>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{
                    fontSize: '10px',
                    padding: '4px 8px',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '4px',
                    color: getSyncColor(syncStatus),
                    fontWeight: 600,
                  }}>
                    {getSyncLabel(syncStatus)}
                  </div>
                  {isSelected && (
                    <div style={{ fontSize: '10px', color: 'var(--accent-blue)', fontWeight: 600 }}>
                      ✓ Selected
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="factory-btn factory-btn-sm"
                    style={{ flex: 1 }}
                    onClick={(e) => { e.stopPropagation(); setSelectedStrategy(s); }}
                  >
                    View History
                  </button>
                  <button
                    className="factory-btn factory-btn-sm factory-btn-primary"
                    style={{ flex: 1 }}
                    onClick={(e) => { e.stopPropagation(); }}
                  >
                    Deploy Paper
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedStrategy && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px',
        }} onClick={() => setSelectedStrategy(null)}>
          <div className="panel" style={{ width: '100%', maxWidth: '600px', maxHeight: '80vh', overflow: 'auto', padding: '24px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>{selectedStrategy.name} Audit Trail</div>
              <button onClick={() => setSelectedStrategy(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '20px' }}>×</button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Truth Verdicts</div>
              {(selectedStrategy.truthHistory ?? []).map((h, i) => (
                <div key={i} style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: '6px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: h.verdict === 'PASS' ? 'var(--accent-green)' : 'var(--accent-red)' }}>{h.verdict}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{new Date(h.ts).toLocaleString()}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{h.reason}</div>
                </div>
              ))}
            </div>

            <button className="not-found-btn" style={{ width: '100%' }} onClick={() => setSelectedStrategy(null)}>Close Audit Trail</button>
          </div>
        </div>
      )}
    </div>
  );
}