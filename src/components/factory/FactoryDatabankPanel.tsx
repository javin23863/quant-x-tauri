import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDashboardStore } from '../../store/dashboard';
import { invoke } from '@tauri-apps/api/core';

interface RowData {
  [key: string]: any;
  __rowId: string;
}

interface ActionButton {
  id: string;
  label: string;
  primary?: boolean;
  disabled?: boolean;
}

function asArray(value: any): any[] {
  return Array.isArray(value) ? value : [];
}

function asNumber(value: any, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toRowId(tableId: string, row: any, index: number): string {
  if (!row || typeof row !== 'object') return tableId + '-row-' + String(index);
  if (tableId === 'batches') return String(row.id || row.batchRunId || ('batch-' + index));
  if (tableId === 'strategies') return String(row.id || row.strategyId || ('strategy-' + index));
  if (tableId === 'backtests') return String(row.id || row.backtestId || ('backtest-' + index));
  if (tableId === 'orders') return String(row.id || row.orderId || row.clientOrderId || ('order-' + index));
  if (tableId === 'positions') return String(row.id || row.positionId || row.symbol || ('position-' + index));
  if (tableId === 'signals') return String(row.id || row.signalId || row.seq || ('signal-' + index));
  if (tableId === 'trades') return String(row.id || row.tradeId || row.orderId || (String(row.timestamp || row.time || index) + '-trade-' + index));
  return String(row.id || ('row-' + index));
}

function formatCell(value: any): string {
  if (value === null || value === undefined || value === '') return '\u2014';
  if (typeof value === 'number') {
    const abs = Math.abs(value);
    if (abs >= 1000000) return (value / 1000000).toFixed(2).replace(/\.00$/, '') + 'M';
    if (abs >= 1000) return (value / 1000).toFixed(2).replace(/\.00$/, '') + 'K';
    return value.toFixed(2).replace(/\.00$/, '');
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return 'Array(' + String(value.length) + ')';
  if (typeof value === 'object') {
    const json = JSON.stringify(value);
    return json.length > 70 ? json.slice(0, 67) + '...' : json;
  }
  return String(value);
}

function compareValues(a: any, b: any): number {
  if (a === b) return 0;
  const aNum = Number(a);
  const bNum = Number(b);
  if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
  const aDate = Date.parse(a);
  const bDate = Date.parse(b);
  if (Number.isFinite(aDate) && Number.isFinite(bDate)) return aDate - bDate;
  return String(a || '').localeCompare(String(b || ''), undefined, { numeric: true, sensitivity: 'base' });
}

function mergeBatchRuns(fetchedRuns: any[], liveRuns: Record<string, any> | null): any[] {
  const merged = new Map<string, any>();
  asArray(fetchedRuns).forEach((run: any) => {
    if (!run) return;
    const id = run.id || run.batchRunId;
    if (!id) return;
    merged.set(String(id), Object.assign({}, run, { id: String(id) }));
  });
  Object.values(liveRuns || {}).forEach((run: any) => {
    if (!run) return;
    const id = run.id || run.batchRunId;
    if (!id) return;
    const key = String(id);
    merged.set(key, Object.assign({}, merged.get(key) || {}, run, { id: key }));
  });
  return Array.from(merged.values()).sort((a: any, b: any) =>
    new Date(b.updatedAt || b.startedAt || 0).getTime() - new Date(a.updatedAt || a.startedAt || 0).getTime()
  );
}

function deriveColumns(rows: any[]): string[] {
  const blocked = new Set(['recipe', 'bars', 'trades', 'equityCurve', 'drawdown', 'volume', 'runs', 'results', 'errors']);
  const ordered: string[] = [];
  const seen = new Set<string>();
  asArray(rows).slice(0, 20).forEach((row: any) => {
    if (!row || typeof row !== 'object') return;
    Object.keys(row).forEach((key: string) => {
      if (blocked.has(key) || seen.has(key)) return;
      seen.add(key);
      ordered.push(key);
    });
  });
  return ordered.slice(0, 10);
}

function rowActionsFor(tableId: string, row: any): ActionButton[] {
  if (tableId === 'strategies') {
    return [
      { id: 'strategy-save', label: 'Save' },
      { id: 'strategy-retest', label: 'Retest', primary: true },
      { id: 'strategy-delete', label: 'Delete' },
    ];
  }
  if (tableId === 'backtests') {
    return [
      { id: 'backtest-retest', label: 'Retest', primary: true },
      { id: 'backtest-delete', label: 'Delete' },
    ];
  }
  if (tableId === 'batches') {
    const status = String(row && row.status || '').toLowerCase();
    const items: ActionButton[] = [{ id: 'batch-toggle', label: status === 'paused' ? 'Resume' : 'Pause' }];
    if (status === 'running' || status === 'paused') items.push({ id: 'batch-cancel', label: 'Cancel' });
    if (status !== 'running' && status !== 'paused') items.push({ id: 'batch-delete', label: 'Delete' });
    return items;
  }
  return [];
}

function defaultSortKeyForTable(tableId: string): string {
  if (tableId === 'batches') return 'startedAt';
  if (tableId === 'backtests') return 'timestamp';
  if (tableId === 'strategies') return 'createdAt';
  if (tableId === 'orders') return 'updatedAt';
  if (tableId === 'signals') return 'timestamp';
  if (tableId === 'trades') return 'timestamp';
  if (tableId === 'positions') return 'updatedAt';
  return 'id';
}

export default function FactoryDatabankPanel() {
  const state = useDashboardStore();
  const dispatch = useDashboardStore.setState;

  const [selectedTable, setSelectedTable] = useState('backtests');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState('timestamp');
  const [sortDir, setSortDir] = useState<string>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [summary, setSummary] = useState<any>(null);
  const [batchRuns, setBatchRuns] = useState<any[]>([]);
  const [selectedByTable, setSelectedByTable] = useState<Record<string, Record<string, boolean>>>({});
  const [busy, setBusy] = useState(false);
  const [statusLine, setStatusLine] = useState('');
  const [error, setError] = useState('');

  const backtestResults = asArray((state as any).backtestResults);
  const latestBacktest: any = backtestResults[0] || null;

  const refreshSummary = useCallback(() => {
    return invoke('factory_live_summary')
      .then((result: any) => {
        if (result && result.ok) setSummary(result);
      })
      .catch(() => {});
  }, []);

  const refreshBatchRuns = useCallback(() => {
    return invoke('factory_backtest_batch_list', { limit: 100 })
      .then((result: any) => {
        if (result && result.ok) setBatchRuns(asArray(result.runs));
      })
      .catch(() => {});
  }, []);

  const refreshBacktests = useCallback(() => {
    return invoke('factory_backtest_results', { limit: 100 })
      .then((result: any) => {
        if (result && result.ok) {
          useDashboardStore.setState({ backtestResults: asArray(result.results) } as any);
        }
      })
      .catch(() => {});
  }, []);

  const refreshAll = useCallback(() => {
    return Promise.all([refreshSummary(), refreshBatchRuns(), refreshBacktests()]);
  }, [refreshBatchRuns, refreshBacktests, refreshSummary]);

  useEffect(() => {
    refreshSummary();
    refreshBatchRuns();
  }, [refreshBatchRuns, refreshSummary]);

  useEffect(() => {
    const nextSortKey = defaultSortKeyForTable(selectedTable);
    setSortKey(nextSortKey);
    setSortDir('desc');
    setPage(1);
    setError('');
    setStatusLine('');
  }, [selectedTable]);

  const tables = useMemo(() => {
    const mergedBatches = mergeBatchRuns(batchRuns, (state as any).activeBatchRuns || {});
    return {
      strategies: asArray((state as any).factoryResults),
      backtests: backtestResults,
      batches: mergedBatches,
      trades: latestBacktest && Array.isArray(latestBacktest.trades) ? latestBacktest.trades : [],
      orders: summary && Array.isArray(summary.orders) ? summary.orders : [],
      positions: summary && Array.isArray(summary.positions) ? summary.positions : [],
      signals: summary && Array.isArray(summary.signals) ? summary.signals : asArray((state as any).signals),
    };
  }, [batchRuns, backtestResults, latestBacktest, (state as any).activeBatchRuns, (state as any).factoryResults, (state as any).signals, summary]);

  const sourceRows: any[] = tables[selectedTable as keyof typeof tables] || [];

  const allRowsWithIds = useMemo(() => {
    return asArray(sourceRows).map((row: any, index: number) =>
      Object.assign({}, row, { __rowId: toRowId(selectedTable, row, index) })
    );
  }, [selectedTable, sourceRows]);

  const preparedRows = useMemo(() => {
    const filtered = allRowsWithIds.filter((row: any) => {
      if (!searchTerm) return true;
      return JSON.stringify(row).toLowerCase().indexOf(searchTerm.toLowerCase()) !== -1;
    });
    const sorted = filtered.slice().sort((a: any, b: any) => {
      const key = sortKey || defaultSortKeyForTable(selectedTable);
      const aVal = a[key];
      const bVal = b[key];
      const delta = compareValues(aVal, bVal);
      return sortDir === 'asc' ? delta : -delta;
    });
    return sorted;
  }, [allRowsWithIds, searchTerm, selectedTable, sortDir, sortKey]);

  const columns = useMemo(() => deriveColumns(preparedRows), [preparedRows]);

  const totalRows = preparedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / Math.max(1, pageSize)));
  const clampedPage = Math.max(1, Math.min(page, totalPages));
  const offset = (clampedPage - 1) * pageSize;
  const pageRows = preparedRows.slice(offset, offset + pageSize);

  useEffect(() => {
    if (page !== clampedPage) setPage(clampedPage);
  }, [clampedPage, page]);

  const selectedMapForTable = selectedByTable[selectedTable] || {};
  const selectedIds = Object.keys(selectedMapForTable).filter((id) => !!selectedMapForTable[id]);
  const selectedCount = selectedIds.length;

  const setFactoryStatus = useCallback((status: string, message: string) => {
    useDashboardStore.setState({ factoryStatus: { stage: 'databank', status, message } } as any);
  }, []);

  const clearSelection = useCallback((tableId?: string) => {
    const target = tableId || selectedTable;
    setSelectedByTable((prev) => Object.assign({}, prev, { [target]: {} }));
  }, [selectedTable]);

  const toggleRow = useCallback((rowId: string, checked: boolean) => {
    setSelectedByTable((prev) => {
      const tableMap = Object.assign({}, prev[selectedTable] || {});
      if (checked) { tableMap[rowId] = true; } else { delete tableMap[rowId]; }
      return Object.assign({}, prev, { [selectedTable]: tableMap });
    });
  }, [selectedTable]);

  const togglePage = useCallback((checked: boolean) => {
    setSelectedByTable((prev) => {
      const tableMap = Object.assign({}, prev[selectedTable] || {});
      pageRows.forEach((row: any) => {
        if (checked) { tableMap[row.__rowId] = true; } else { delete tableMap[row.__rowId]; }
      });
      return Object.assign({}, prev, { [selectedTable]: tableMap });
    });
  }, [pageRows, selectedTable]);

  const hasPageRows = pageRows.length > 0;
  const allPageRowsChecked = hasPageRows && pageRows.every((row: any) => !!selectedMapForTable[row.__rowId]);

  const withBusy = useCallback(async (label: string, fn: () => Promise<any>) => {
    setBusy(true);
    setError('');
    setStatusLine('');
    setFactoryStatus('running', label + '...');
    try {
      const result = await fn();
      setStatusLine(label + ' complete');
      setFactoryStatus('completed', label + ' complete');
      return result;
    } catch (err: any) {
      const message = err && err.message ? err.message : String(err);
      setError(message);
      setFactoryStatus('failed', message);
      throw err;
    } finally {
      setBusy(false);
    }
  }, [setFactoryStatus]);

  const tauriInvoke = useCallback(async (cmd: string, args?: any): Promise<any> => {
    try {
      const result = await invoke(cmd, args || {}) as any;
      if (result && typeof result === 'object' && (result as any).ok === false) {
        throw new Error((result as any).error || 'Command failed: ' + cmd);
      }
      return result;
    } catch (err: any) {
      throw new Error(err.message || 'Command failed: ' + cmd);
    }
  }, []);

  const selectedRows = useMemo(() => {
    const set = selectedMapForTable;
    return allRowsWithIds.filter((row: any) => !!set[row.__rowId]);
  }, [allRowsWithIds, selectedMapForTable]);

  const runStrategyBacktests = useCallback(async (strategyIds: string[]) => {
    const ids = Array.from(new Set(asArray(strategyIds).filter(Boolean))).slice(0, 20);
    if (ids.length === 0) throw new Error('No strategy IDs available for backtest run');
    const created: any[] = [];
    for (let i = 0; i < ids.length; i += 1) {
      const payload = await tauriInvoke('factory_backtest_run', { strategyId: ids[i] });
      if (payload && payload.backtest) {
        created.push(payload.backtest);
        useDashboardStore.setState((s: any) => ({
          backtestResults: [payload.backtest, ...(s.backtestResults || [])],
        } as any));
      }
    }
    return created;
  }, [tauriInvoke]);

  const saveSelectedStrategies = useCallback(() => {
    const rows = selectedRows;
    return withBusy('Saving selected strategies', async () => {
      for (let i = 0; i < rows.length; i += 1) {
        await tauriInvoke('factory_strategy_save_to_library', { strategyId: rows[i].id });
      }
      clearSelection('strategies');
    });
  }, [clearSelection, tauriInvoke, selectedRows, withBusy]);

  const deleteSelectedStrategies = useCallback(() => {
    const rows = selectedRows;
    return withBusy('Deleting selected strategies', async () => {
      for (let i = 0; i < rows.length; i += 1) {
        await tauriInvoke('factory_strategy_delete', { strategyId: rows[i].id });
      }
      const removedIds = new Set(rows.map((item: any) => item.id));
      useDashboardStore.setState((s: any) => ({
        factoryResults: asArray(s.factoryResults).filter((item: any) => !removedIds.has(item.id)),
        backtestResults: asArray(s.backtestResults).filter((item: any) => !removedIds.has(item.strategyId)),
      } as any));
      clearSelection('strategies');
      await refreshBatchRuns();
    });
  }, [clearSelection, refreshBatchRuns, tauriInvoke, selectedRows, withBusy]);

  const retestSelectedStrategies = useCallback(() => {
    const strategyIds = selectedRows.map((row: any) => row.id);
    return withBusy('Retesting selected strategies', async () => {
      await runStrategyBacktests(strategyIds);
      await refreshBacktests();
    });
  }, [refreshBacktests, runStrategyBacktests, selectedRows, withBusy]);

  const deleteSelectedBacktests = useCallback(() => {
    const rows = selectedRows;
    return withBusy('Deleting selected backtests', async () => {
      for (let i = 0; i < rows.length; i += 1) {
        await tauriInvoke('factory_backtest_delete', { backtestId: rows[i].id });
      }
      const removed = new Set(rows.map((item: any) => item.id));
      useDashboardStore.setState((s: any) => ({
        backtestResults: asArray(s.backtestResults).filter((item: any) => !removed.has(item.id)),
      } as any));
      clearSelection('backtests');
    });
  }, [clearSelection, tauriInvoke, selectedRows, withBusy]);

  const retestSelectedBacktests = useCallback(() => {
    const strategyIds = selectedRows.map((row: any) => row.strategyId).filter(Boolean);
    return withBusy('Retesting selected backtests', async () => {
      await runStrategyBacktests(strategyIds);
      await refreshBacktests();
    });
  }, [refreshBacktests, runStrategyBacktests, selectedRows, withBusy]);

  const pauseResumeSelectedBatch = useCallback(() => {
    const rows = selectedRows;
    if (rows.length === 0) return Promise.resolve();
    return withBusy('Pausing/resuming selected batches', async () => {
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        const status = String(row.status || '').toLowerCase();
        const action = status === 'paused' ? 'resume' : 'pause';
        await tauriInvoke('factory_backtest_batch_action', { batchRunId: row.id, action });
      }
      await refreshBatchRuns();
    });
  }, [refreshBatchRuns, tauriInvoke, selectedRows, withBusy]);

  const cancelSelectedBatch = useCallback(() => {
    const rows = selectedRows;
    return withBusy('Cancelling selected batches', async () => {
      for (let i = 0; i < rows.length; i += 1) {
        await tauriInvoke('factory_backtest_cancel_batch', { batchRunId: rows[i].id });
      }
      await refreshBatchRuns();
    });
  }, [refreshBatchRuns, tauriInvoke, selectedRows, withBusy]);

  const deleteSelectedBatch = useCallback(() => {
    const rows = selectedRows;
    return withBusy('Deleting selected batch records', async () => {
      for (let i = 0; i < rows.length; i += 1) {
        await tauriInvoke('factory_backtest_batch_delete', { batchRunId: rows[i].id });
      }
      clearSelection('batches');
      await refreshBatchRuns();
    });
  }, [clearSelection, refreshBatchRuns, tauriInvoke, selectedRows, withBusy]);

  const onRunAction = useCallback((actionId: string) => {
    if (busy) return;
    const run = async () => {
      if (actionId === 'refresh') return withBusy('Refreshing databank', refreshAll);
      if (actionId === 'clear-selection') { clearSelection(); return; }
      if (actionId === 'strategy-save') return saveSelectedStrategies();
      if (actionId === 'strategy-delete') return deleteSelectedStrategies();
      if (actionId === 'strategy-retest') return retestSelectedStrategies();
      if (actionId === 'backtest-delete') return deleteSelectedBacktests();
      if (actionId === 'backtest-retest') return retestSelectedBacktests();
      if (actionId === 'batch-toggle') return pauseResumeSelectedBatch();
      if (actionId === 'batch-cancel') return cancelSelectedBatch();
      if (actionId === 'batch-delete') return deleteSelectedBatch();
    };
    run().catch(() => {});
  }, [busy, cancelSelectedBatch, clearSelection, deleteSelectedBacktests, deleteSelectedBatch, deleteSelectedStrategies, pauseResumeSelectedBatch, refreshAll, retestSelectedBacktests, retestSelectedStrategies, saveSelectedStrategies, withBusy]);

  const actionButtons = useMemo((): ActionButton[] => {
    const items: ActionButton[] = [{ id: 'refresh', label: 'Refresh', disabled: busy }];
    if (selectedCount > 0) items.push({ id: 'clear-selection', label: 'Clear (' + selectedCount + ')', disabled: busy });
    if (selectedTable === 'strategies') {
      items.push({ id: 'strategy-save', label: 'Save', disabled: busy || selectedCount === 0 });
      items.push({ id: 'strategy-retest', label: 'Retest', disabled: busy || selectedCount === 0, primary: true });
      items.push({ id: 'strategy-delete', label: 'Delete', disabled: busy || selectedCount === 0 });
    } else if (selectedTable === 'backtests') {
      items.push({ id: 'backtest-retest', label: 'Retest', disabled: busy || selectedCount === 0, primary: true });
      items.push({ id: 'backtest-delete', label: 'Delete', disabled: busy || selectedCount === 0 });
    } else if (selectedTable === 'batches') {
      items.push({ id: 'batch-toggle', label: 'Pause/Resume', disabled: busy || selectedCount === 0 });
      items.push({ id: 'batch-cancel', label: 'Cancel', disabled: busy || selectedCount === 0 });
      items.push({ id: 'batch-delete', label: 'Delete', disabled: busy || selectedCount === 0 });
    }
    return items;
  }, [busy, selectedCount, selectedTable]);

  const runRowAction = useCallback((actionId: string, row: any) => {
    if (busy || !row) return;
    const run = async () => {
      if (actionId === 'strategy-save') return withBusy('Saving strategy ' + row.id, () => tauriInvoke('factory_strategy_save_to_library', { strategyId: row.id }));
      if (actionId === 'strategy-retest') return withBusy('Retesting strategy ' + row.id, async () => { await runStrategyBacktests([row.id]); await refreshBacktests(); });
      if (actionId === 'strategy-delete') return withBusy('Deleting strategy ' + row.id, async () => {
        await tauriInvoke('factory_strategy_delete', { strategyId: row.id });
        useDashboardStore.setState((s: any) => ({
          factoryResults: asArray(s.factoryResults).filter((item: any) => item.id !== row.id),
          backtestResults: asArray(s.backtestResults).filter((item: any) => item.strategyId !== row.id),
        } as any));
        toggleRow(row.__rowId, false);
        await refreshBatchRuns();
      });
      if (actionId === 'backtest-retest') return withBusy('Retesting backtest strategy', async () => { await runStrategyBacktests([row.strategyId]); await refreshBacktests(); });
      if (actionId === 'backtest-delete') return withBusy('Deleting backtest ' + row.id, async () => {
        await tauriInvoke('factory_backtest_delete', { backtestId: row.id });
        useDashboardStore.setState((s: any) => ({
          backtestResults: asArray(s.backtestResults).filter((item: any) => item.id !== row.id),
        } as any));
        toggleRow(row.__rowId, false);
      });
      if (actionId === 'batch-toggle') return withBusy('Pausing/resuming batch ' + row.id, async () => {
        const status = String(row.status || '').toLowerCase();
        const action = status === 'paused' ? 'resume' : 'pause';
        await tauriInvoke('factory_backtest_batch_action', { batchRunId: row.id, action });
        await refreshBatchRuns();
      });
      if (actionId === 'batch-cancel') return withBusy('Cancelling batch ' + row.id, async () => {
        await tauriInvoke('factory_backtest_cancel_batch', { batchRunId: row.id });
        await refreshBatchRuns();
      });
      if (actionId === 'batch-delete') return withBusy('Deleting batch record ' + row.id, async () => {
        await tauriInvoke('factory_backtest_batch_delete', { batchRunId: row.id });
        toggleRow(row.__rowId, false);
        await refreshBatchRuns();
      });
    };
    run().catch(() => {});
  }, [busy, refreshBacktests, refreshBatchRuns, runStrategyBacktests, tauriInvoke, toggleRow, withBusy]);

  const showRowActions = selectedTable === 'strategies' || selectedTable === 'backtests' || selectedTable === 'batches';

  const tableMeta = [
    { id: 'strategies', label: 'Strategies' },
    { id: 'backtests', label: 'Backtests' },
    { id: 'batches', label: 'Batch Runs' },
    { id: 'trades', label: 'Trades' },
    { id: 'orders', label: 'Orders' },
    { id: 'positions', label: 'Positions' },
    { id: 'signals', label: 'Signals' },
  ];

  return (
    <div className="factory-databank-panel factory-db-panel">
      <aside className="factory-db-sidebar">
        <input
          className="factory-input factory-db-search"
          type="text"
          placeholder="Search rows..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div className="factory-db-table-list">
          {tableMeta.map((item) => {
            const count = asArray((tables as any)[item.id]).length;
            return (
              <button
                key={item.id}
                type="button"
                className={`factory-db-table-btn ${selectedTable === item.id ? 'active' : ''}`}
                onClick={() => setSelectedTable(item.id)}
              >
                <span>{item.label}</span>
                <span className="factory-db-table-count">{String(count)}</span>
              </button>
            );
          })}
        </div>
      </aside>
      <section className="factory-db-main">
        <div className="factory-db-toolbar">
          <div className="factory-db-toolbar-left">
            <span className="factory-db-toolbar-title">{selectedTable.toUpperCase()}</span>
            <span className="factory-db-toolbar-meta">{String(totalRows)} rows</span>
            <span className="factory-db-toolbar-meta">Page {String(clampedPage)}/{String(totalPages)}</span>
          </div>
          <div className="factory-db-toolbar-right">
            <select
              className="factory-input factory-db-select"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
            >
              {columns.length === 0
                ? <option value={sortKey}>Sort</option>
                : columns.map((column) => <option key={column} value={column}>Sort: {column}</option>)
              }
            </select>
            <select className="factory-input factory-db-select" value={sortDir} onChange={(e) => setSortDir(e.target.value)}>
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
            <select
              className="factory-input factory-db-select"
              value={String(pageSize)}
              onChange={(e) => { const next = Math.max(10, Math.min(100, asNumber(e.target.value, 25))); setPageSize(next); setPage(1); }}
            >
              {[10, 25, 50, 100].map((size) => <option key={String(size)} value={String(size)}>{String(size)}/page</option>)}
            </select>
          </div>
        </div>

        <div className="factory-db-actions">
          {actionButtons.map((btn) => (
            <button
              key={btn.id}
              type="button"
              className={`factory-btn factory-btn-sm ${btn.primary ? 'factory-btn-primary' : ''}`}
              disabled={btn.disabled}
              onClick={() => onRunAction(btn.id)}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {error ? <div className="factory-error-banner">{error}</div> : null}
        {statusLine ? <div className="factory-db-status">{statusLine}</div> : null}

        <div className="factory-db-grid">
          {columns.length === 0 ? (
            <div className="factory-backtester-empty">No rows available for this dataset yet.</div>
          ) : (
            <table className="factory-db-table">
              <thead>
                <tr>
                  <th className="factory-db-col-check">
                    <input type="checkbox" checked={allPageRowsChecked} disabled={!hasPageRows} onChange={(e) => togglePage(e.target.checked)} />
                  </th>
                  {columns.map((column) => {
                    const active = sortKey === column;
                    return (
                      <th key={column} className={`factory-db-col ${active ? 'active' : ''}`}>
                        <button
                          type="button"
                          className="factory-db-col-btn"
                          onClick={() => {
                            if (sortKey === column) { setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }
                            else { setSortKey(column); setSortDir('desc'); }
                          }}
                        >
                          {column}{active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                        </button>
                      </th>
                    );
                  })}
                  {showRowActions ? <th className="factory-db-col-actions">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row: any) => {
                  const rowActions = rowActionsFor(selectedTable, row);
                  return (
                    <tr key={row.__rowId} className={selectedMapForTable[row.__rowId] ? 'selected' : ''}>
                      <td className="factory-db-col-check">
                        <input type="checkbox" checked={!!selectedMapForTable[row.__rowId]} onChange={(e) => toggleRow(row.__rowId, e.target.checked)} />
                      </td>
                      {columns.map((column) => {
                        const raw = row[column];
                        const display = formatCell(raw);
                        return <td key={column} title={typeof raw === 'object' ? JSON.stringify(raw) : String(raw)}>{display}</td>;
                      })}
                      {showRowActions ? (
                        <td className="factory-db-col-actions">
                          {rowActions.length === 0 ? '\u2014' : (
                            <div className="factory-db-row-actions">
                              {rowActions.map((action) => (
                                <button
                                  key={action.id}
                                  type="button"
                                  className={`factory-btn factory-btn-sm ${action.primary ? 'factory-btn-primary' : ''}`}
                                  disabled={busy}
                                  onClick={() => runRowAction(action.id, row)}
                                >
                                  {action.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="factory-db-footer">
          <button type="button" className="factory-btn factory-btn-sm" disabled={clampedPage <= 1} onClick={() => setPage(Math.max(1, clampedPage - 1))}>Prev</button>
          <span className="factory-db-footer-meta">Page {String(clampedPage)} of {String(totalPages)}</span>
          <button type="button" className="factory-btn factory-btn-sm" disabled={clampedPage >= totalPages} onClick={() => setPage(Math.min(totalPages, clampedPage + 1))}>Next</button>
        </div>
      </section>
    </div>
  );
}