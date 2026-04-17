import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useDashboardStore } from '../../store/dashboard';
import { invoke } from '@tauri-apps/api/core';
import FactoryModuleRail from './FactoryModuleRail';
import FactoryControlBar from './FactoryControlBar';
import FactoryDatabankPanel from './FactoryDatabankPanel';
import FactoryRobustnessPanel from './FactoryRobustnessPanel';
import FactoryStrategyPanel from './FactoryStrategyPanel';
import FactoryExecutionPanel from './FactoryExecutionPanel';
import FactoryMonitoringPanel from './FactoryMonitoringPanel';
import FactoryConsole from './FactoryConsole';
import FactoryEquityChart from './FactoryEquityChart';
import FactoryResultsGrid from './FactoryResultsGrid';

interface FactoryShellProps {
  initialModule?: string;
}

const FACTORY_TOP_SPLIT_KEY = 'qx.factory.topSplitPct';
const FACTORY_RAIL_WIDTH_KEY = 'qx.factory.railWidthPx';

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseStoredNumber(storageKey: string, fallbackValue: number, min: number, max: number): number {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return fallbackValue;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return fallbackValue;
    return clampNumber(parsed, min, max);
  } catch (_) {
    return fallbackValue;
  }
}

function newestBatchRun(batchRuns: Record<string, any> | null): any | null {
  const rows = Object.values(batchRuns || {});
  if (rows.length === 0) return null;
  return rows.slice().sort((a: any, b: any) =>
    new Date(b.updatedAt || b.startedAt || 0).getTime() - new Date(a.updatedAt || a.startedAt || 0).getTime()
  )[0];
}

function BacktesterView({ strategy }: { strategy: any }) {
  return (
    <div className="factory-backtester-view">
      {strategy ? (
        <div className="factory-backtester-active">
          <div className="factory-backtester-title">{strategy.primarySymbol || strategy.id}</div>
          <div className="factory-backtester-placeholder">Backtester view for strategy {strategy.id}</div>
        </div>
      ) : (
        <div className="factory-backtester-empty">Generate a strategy to run backtests</div>
      )}
    </div>
  );
}

export default function FactoryShell({ initialModule = 'builder' }: FactoryShellProps) {
  const state = useDashboardStore() as any;
  const shellRef = useRef<HTMLDivElement>(null);
  const topMainRef = useRef<HTMLDivElement>(null);

  const [dragMode, setDragMode] = useState<string | null>(null);
  const [topSplitPct, setTopSplitPct] = useState(() => parseStoredNumber(FACTORY_TOP_SPLIT_KEY, 64, 42, 78));
  const [railWidthPx, setRailWidthPx] = useState(() => parseStoredNumber(FACTORY_RAIL_WIDTH_KEY, 196, 136, 320));
  const [toolbarBusy, setToolbarBusy] = useState(false);

  const modules = useMemo(() => [
    { id: 'builder', label: 'Builder', icon: '🧱' },
    { id: 'backtester', label: 'Backtester', icon: '🧪' },
    { id: 'robustness', label: 'Robustness', icon: '🛡️' },
    { id: 'execution', label: 'Execution', icon: '⚡' },
    { id: 'monitor', label: 'Monitor', icon: '📡' },
    { id: 'databank', label: 'Databank', icon: '🗃️' },
  ], []);

  const workspaceTabs = useMemo(() => [
    { id: 'progress', label: 'Progress' },
    { id: 'settings', label: 'Settings' },
    { id: 'results', label: 'Results' },
    { id: 'monte-carlo', label: 'Monte Carlo' },
    { id: 'trades', label: 'Trades' },
    { id: 'logs', label: 'Logs' },
  ], []);

  const activeModule = state.factoryModule || initialModule;
  const workspaceTab = state.factoryWorkspaceTab || 'progress';

  const factoryResults = state.factoryResults || [];
  const latestStrategy = state.generatedStrategy || factoryResults[0] || null;
  const backtestResults = state.backtestResults || [];
  const latestBacktest = backtestResults[0] || null;
  const currentStatus = state.factoryStatus || null;

  const currentBatch = newestBatchRun(state.activeBatchRuns || {});
  const currentBatchId = currentBatch ? (currentBatch.batchRunId || currentBatch.id) : null;
  const currentBatchProgress = currentBatchId ? ((state.batchProgress || {})[currentBatchId] || null) : null;

  useEffect(() => {
    if (!initialModule) return;
    if (state.factoryModule === initialModule) return;
    useDashboardStore.setState({ factoryModule: initialModule } as any);
  }, [initialModule, state.factoryModule]);

  useEffect(() => {
    try { window.localStorage.setItem(FACTORY_TOP_SPLIT_KEY, String(topSplitPct)); } catch (_) {}
  }, [topSplitPct]);

  useEffect(() => {
    try { window.localStorage.setItem(FACTORY_RAIL_WIDTH_KEY, String(railWidthPx)); } catch (_) {}
  }, [railWidthPx]);

  useEffect(() => {
    if (!dragMode) {
      document.body.style.cursor = '';
      return;
    }
    const onMouseMove = (event: MouseEvent) => {
      if (dragMode === 'vertical' && shellRef.current) {
        const rect = shellRef.current.getBoundingClientRect();
        const nextPct = ((event.clientY - rect.top) / Math.max(rect.height, 1)) * 100;
        setTopSplitPct(clampNumber(nextPct, 42, 78));
      }
      if (dragMode === 'horizontal' && topMainRef.current) {
        const rect = topMainRef.current.getBoundingClientRect();
        const nextWidth = event.clientX - rect.left;
        setRailWidthPx(clampNumber(nextWidth, 136, 320));
      }
    };
    const onMouseUp = () => { setDragMode(null); };
    document.body.style.cursor = dragMode === 'vertical' ? 'row-resize' : 'col-resize';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
    };
  }, [dragMode]);

  const setStatus = useCallback((payload: any) => {
    useDashboardStore.setState({ factoryStatus: payload } as any);
  }, []);

  const setModule = useCallback((nextModule: string) => {
    const moduleToLegacyTab: Record<string, string> = {
      builder: 'factory-strategy',
      backtester: 'factory-strategy',
      robustness: 'factory-robustness',
      execution: 'factory-execution',
      monitor: 'factory-monitoring',
      databank: 'factory-databank',
    };
    useDashboardStore.setState({ factoryModule: nextModule, factoryTab: moduleToLegacyTab[nextModule] || 'factory-strategy' } as any);
  }, []);

  const setWorkspaceTab = useCallback((nextTab: string) => {
    useDashboardStore.setState({ factoryWorkspaceTab: nextTab } as any);
  }, []);

  const runSingleBacktest = useCallback(async () => {
    if (!latestStrategy) {
      setStatus({ stage: 'backtest', status: 'idle', message: 'Generate a strategy before running backtests.' });
      return;
    }
    setToolbarBusy(true);
    setStatus({ stage: 'backtest', status: 'running', message: 'Running backtest for ' + (latestStrategy.primarySymbol || latestStrategy.id) });
    try {
      const result = await invoke('factory_backtest_run', { strategyId: latestStrategy.id }) as any;
      if (result && result.ok === false) throw new Error(result.error || 'Backtest failed');
      const backtest = result.backtest || result;
      useDashboardStore.setState((s: any) => ({
        backtestResults: [backtest, ...(s.backtestResults || [])],
        factoryMetrics: backtest.metrics || null,
        factoryStatus: { stage: 'backtest', status: 'completed', message: 'Backtest complete for ' + (backtest.symbol || latestStrategy.primarySymbol || latestStrategy.id) },
      } as any));
    } catch (err: any) {
      setStatus({ stage: 'backtest', status: 'failed', message: err.message || String(err) });
    } finally {
      setToolbarBusy(false);
    }
  }, [latestStrategy, setStatus]);

  const runRobustness = useCallback(async (type: string) => {
    if (!latestStrategy) {
      setStatus({ stage: 'robustness', status: 'idle', message: 'Generate a strategy before robustness tests.' });
      return;
    }
    setToolbarBusy(true);
    setStatus({ stage: 'robustness', status: 'running', message: 'Running ' + type + ' on ' + latestStrategy.id });
    try {
      const result = await invoke('factory_backtest_robustness', { type, strategyId: latestStrategy.id }) as any;
      if (result && result.ok === false) throw new Error(result.error || ('Failed to run ' + type));
      const payload = result.wfo || result.monteCarlo || result.stress || result.bootstrap || null;
      useDashboardStore.setState({ factoryRobustness: payload, factoryStatus: { stage: 'robustness', status: 'completed', message: String(type).toUpperCase() + ' completed' } } as any);
      setModule('robustness');
    } catch (err: any) {
      setStatus({ stage: 'robustness', status: 'failed', message: err.message || String(err) });
    } finally {
      setToolbarBusy(false);
    }
  }, [latestStrategy, setModule, setStatus]);

  const loadDatabank = useCallback(async () => {
    setToolbarBusy(true);
    try {
      const result = await invoke('factory_backtest_results', { limit: 100 }) as any;
      if (result && result.ok) {
        useDashboardStore.setState({ backtestResults: result.results || [] } as any);
      }
      setStatus({ stage: 'databank', status: 'ready', message: 'Databank refreshed' });
    } catch (err: any) {
      setStatus({ stage: 'databank', status: 'failed', message: err.message || String(err) });
    } finally {
      setToolbarBusy(false);
    }
  }, [setStatus]);

  const saveLatestStrategy = useCallback(async () => {
    if (!latestStrategy) {
      setStatus({ stage: 'databank', status: 'idle', message: 'No strategy available to save.' });
      return;
    }
    setToolbarBusy(true);
    try {
      await invoke('factory_strategy_save_to_library', { strategyId: latestStrategy.id });
      setStatus({ stage: 'databank', status: 'completed', message: 'Saved strategy to library: ' + latestStrategy.id });
    } catch (err: any) {
      setStatus({ stage: 'databank', status: 'failed', message: err.message || String(err) });
    } finally {
      setToolbarBusy(false);
    }
  }, [latestStrategy, setStatus]);

  const deleteLatestBacktest = useCallback(async () => {
    if (!latestBacktest) {
      setStatus({ stage: 'databank', status: 'idle', message: 'No backtest result available to delete.' });
      return;
    }
    setToolbarBusy(true);
    try {
      await invoke('factory_backtest_delete', { backtestId: latestBacktest.id });
      useDashboardStore.setState((s: any) => ({
        backtestResults: (s.backtestResults || []).filter((item: any) => item.id !== latestBacktest.id),
      } as any));
      setStatus({ stage: 'databank', status: 'completed', message: 'Deleted backtest ' + latestBacktest.id });
    } catch (err: any) {
      setStatus({ stage: 'databank', status: 'failed', message: err.message || String(err) });
    } finally {
      setToolbarBusy(false);
    }
  }, [latestBacktest, setStatus]);

  const hasBatchControl = Boolean(currentBatch && !['completed', 'failed', 'cancelled'].includes(String(currentBatch.status || '').toLowerCase()));
  const pauseLabel = String(currentBatch && currentBatch.status || '').toLowerCase() === 'paused' ? 'Resume' : 'Pause';

  const handleStart = useCallback(() => {
    if (toolbarBusy) return;
    if (activeModule === 'builder' || activeModule === 'backtester') { runSingleBacktest(); return; }
    if (activeModule === 'robustness') { runRobustness(workspaceTab === 'monte-carlo' ? 'monte-carlo' : 'wfo'); return; }
    if (activeModule === 'databank') { loadDatabank(); return; }
    setStatus({ stage: activeModule, status: 'ready', message: 'Start action mapped for ' + activeModule });
  }, [activeModule, loadDatabank, runRobustness, runSingleBacktest, setStatus, toolbarBusy, workspaceTab]);

  const handleStop = useCallback(async () => {
    if (!hasBatchControl || !currentBatchId) {
      setStatus({ stage: 'batch', status: 'idle', message: 'No active batch run to stop.' });
      return;
    }
    setToolbarBusy(true);
    try {
      const result = await invoke('factory_backtest_cancel_batch', { batchRunId: currentBatchId }) as any;
      useDashboardStore.setState({ factoryBatchStatus: result } as any);
      setStatus({ stage: 'batch', status: 'cancelled', message: 'Batch run cancelled: ' + currentBatchId });
    } catch (err: any) {
      setStatus({ stage: 'batch', status: 'failed', message: err.message || String(err) });
    } finally {
      setToolbarBusy(false);
    }
  }, [currentBatchId, hasBatchControl, setStatus]);

  const handlePause = useCallback(async () => {
    if (!hasBatchControl || !currentBatchId) {
      setStatus({ stage: 'batch', status: 'idle', message: 'No active batch run to pause/resume.' });
      return;
    }
    const currentStatusValue = String(currentBatch && currentBatch.status || '').toLowerCase();
    const action = currentStatusValue === 'paused' ? 'resume' : 'pause';
    setToolbarBusy(true);
    try {
      const result = await invoke('factory_backtest_batch_action', { batchRunId: currentBatchId, action }) as any;
      if (result && result.ok === false) throw new Error(result.error || ('Batch ' + action + ' is not available yet.'));
      useDashboardStore.setState({ factoryBatchStatus: result.batchRun || result } as any);
      setStatus({ stage: 'batch', status: result.status || action, message: 'Batch ' + action + ' successful: ' + currentBatchId });
    } catch (err: any) {
      setStatus({ stage: 'batch', status: 'failed', message: err.message || String(err) });
    } finally {
      setToolbarBusy(false);
    }
  }, [currentBatch, currentBatchId, hasBatchControl, setStatus]);

  const renderWorkspace = useCallback(() => {
    if (activeModule === 'robustness') {
      return workspaceTab === 'logs' ? <FactoryConsole /> : <FactoryRobustnessPanel />;
    }
    if (activeModule === 'execution') {
      return workspaceTab === 'logs' ? <FactoryConsole /> : <FactoryExecutionPanel />;
    }
    if (activeModule === 'monitor') {
      return workspaceTab === 'logs' ? <FactoryConsole /> : <FactoryMonitoringPanel />;
    }
    if (activeModule === 'databank') {
      return workspaceTab === 'logs' ? <FactoryConsole /> : <FactoryDatabankPanel />;
    }
    if (activeModule === 'backtester') {
      if (workspaceTab === 'logs') return <FactoryConsole />;
      if (workspaceTab === 'monte-carlo') return <FactoryRobustnessPanel />;
      return <BacktesterView strategy={latestStrategy} />;
    }
    if (workspaceTab === 'settings') return <FactoryStrategyPanel />;
    if (workspaceTab === 'results') return <FactoryResultsGrid />;
    if (workspaceTab === 'monte-carlo') return <FactoryRobustnessPanel />;
    if (workspaceTab === 'trades') return <FactoryExecutionPanel />;
    if (workspaceTab === 'logs') return <FactoryConsole />;
    return (
      <div className="factory-builder-workspace">
        <div className="factory-builder-pane"><FactoryStrategyPanel /></div>
        <div className="factory-builder-pane"><BacktesterView strategy={latestStrategy} /></div>
      </div>
    );
  }, [activeModule, latestStrategy, workspaceTab]);

  const statusText = currentStatus
    ? (String(currentStatus.stage || 'factory').toUpperCase() + ': ' + (currentStatus.message || currentStatus.status || 'ready'))
    : 'FACTORY: Ready';

  return (
    <section ref={shellRef} className="factory-workbench">
      <div className="factory-workbench-top" style={{ height: topSplitPct + '%' }}>
        <div ref={topMainRef} className="factory-workbench-top-main">
          <div className="factory-workbench-rail-wrap" style={{ width: railWidthPx + 'px' }}>
            <FactoryModuleRail modules={modules} activeModule={activeModule} onSelect={setModule} />
          </div>
          <div
            className={`factory-rail-divider ${dragMode === 'horizontal' ? 'dragging' : ''}`}
            onMouseDown={() => setDragMode('horizontal')}
            role="separator"
            aria-orientation="vertical"
          />
          <div className="factory-workbench-workspace">
            <FactoryControlBar
              tabs={workspaceTabs}
              activeTab={workspaceTab}
              onTabSelect={setWorkspaceTab}
              onStart={handleStart}
              onStop={handleStop}
              onPause={handlePause}
              startDisabled={toolbarBusy}
              stopDisabled={toolbarBusy || !hasBatchControl}
              pauseDisabled={toolbarBusy || !hasBatchControl}
              pauseLabel={pauseLabel}
              statusText={statusText}
            />
            <div className="factory-workbench-content">{renderWorkspace()}</div>
          </div>
        </div>
      </div>
      <div
        className={`factory-divider ${dragMode === 'vertical' ? 'dragging' : ''}`}
        onMouseDown={() => setDragMode('vertical')}
        role="separator"
        aria-orientation="horizontal"
      >
        <div className="factory-divider-track"><div className="factory-divider-handle"><div className="factory-divider-grip" /></div></div>
      </div>
      <div className="factory-workbench-bottom" style={{ height: (100 - topSplitPct) + '%' }}>
        <div className="factory-databank-toolbar">
          <div className="factory-databank-toolbar-title">Results Databank</div>
          <div className="factory-databank-toolbar-actions">
            <button type="button" className="factory-btn factory-btn-sm" onClick={loadDatabank} disabled={toolbarBusy}>Load</button>
            <button type="button" className="factory-btn factory-btn-sm" onClick={saveLatestStrategy} disabled={toolbarBusy || !latestStrategy}>Save</button>
            <button type="button" className="factory-btn factory-btn-sm" onClick={deleteLatestBacktest} disabled={toolbarBusy || !latestBacktest}>Delete</button>
            <button type="button" className="factory-btn factory-btn-sm factory-btn-primary" onClick={runSingleBacktest} disabled={toolbarBusy || !latestStrategy}>Retest</button>
          </div>
        </div>
        <div className="factory-databank-body">
          <div className="factory-databank-main"><FactoryDatabankPanel /></div>
          <div className="factory-databank-aux">
            <div className="factory-databank-aux-card"><FactoryEquityChart backtest={latestBacktest} height={180} /></div>
            <div className="factory-databank-aux-card"><FactoryResultsGrid /></div>
          </div>
        </div>
        <div className="factory-databank-meta">
          <span>Strategies: {String(factoryResults.length)}</span>
          <span>Backtests: {String(backtestResults.length)}</span>
          <span>{currentBatchId ? ('Batch: ' + currentBatchId) : 'Batch: none'}</span>
          {currentBatchProgress ? <span>{String(currentBatchProgress.completedTasks || 0)}/{String(currentBatchProgress.totalTasks || 0)}</span> : null}
        </div>
      </div>
    </section>
  );
}