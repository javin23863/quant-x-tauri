import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { listen } from '@tauri-apps/api/event';

interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  source: string;
  message: string;
}

const LOG_LEVELS = ['INFO', 'WARN', 'ERROR', 'SUCCESS'];
const MAX_LOGS = 5000;
const MESSAGE_TRUNCATE = 200;

const LEVEL_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  INFO: { color: 'var(--text-secondary)', bg: 'transparent', icon: 'ℹ' },
  WARN: { color: 'var(--accent-yellow)', bg: 'rgba(245, 158, 11, 0.1)', icon: '⚠' },
  ERROR: { color: 'var(--accent-red)', bg: 'rgba(239, 68, 68, 0.1)', icon: '✕' },
  SUCCESS: { color: 'var(--accent-green)', bg: 'rgba(16, 185, 129, 0.1)', icon: '✓' },
};

function formatTimestamp(isoString: string): string {
  const d = new Date(isoString);
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

const LogRow = React.memo(function LogRow({ log, isExpanded, onToggleExpand, style }: {
  log: LogEntry;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  style?: React.CSSProperties;
}) {
  const config = LEVEL_CONFIG[log.level] || LEVEL_CONFIG.INFO;
  const displayMessage = isExpanded ? log.message : log.message.slice(0, MESSAGE_TRUNCATE);
  const needsExpand = log.message.length > MESSAGE_TRUNCATE;

  return (
    <div
      className={`log-row log-row-${log.level.toLowerCase()}`}
      style={{
        ...style,
        display: 'flex',
        alignItems: 'flex-start',
        padding: '4px 8px',
        fontFamily: 'var(--font-mono)',
        fontSize: '10px',
        lineHeight: '1.4',
        backgroundColor: config.bg,
        borderBottom: '1px solid var(--border-subtle)',
        cursor: needsExpand ? 'pointer' : 'default',
      }}
      onClick={needsExpand ? () => onToggleExpand(log.id) : undefined}
    >
      <span className="log-time" style={{ flexShrink: 0, width: '100px', color: 'var(--text-muted)' }}>
        {log.timestamp}
      </span>
      <span className="log-level" style={{ flexShrink: 0, width: '60px', color: config.color, fontWeight: 600 }}>
        [{log.level}]
      </span>
      <span className="log-source" style={{
        flexShrink: 0, width: '120px',
        color: 'var(--accent-blue)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        [{log.source}]
      </span>
      <span className="log-message" style={{
        flex: 1,
        color: 'var(--text-primary)',
        wordBreak: 'break-word',
        whiteSpace: isExpanded ? 'pre-wrap' : 'nowrap',
        overflow: isExpanded ? 'visible' : 'hidden',
        textOverflow: isExpanded ? 'unset' : 'ellipsis',
      }}>
        {displayMessage}
        {needsExpand && !isExpanded && '...'}
        {needsExpand && isExpanded && (
          <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>
            ▲ click to collapse
          </span>
        )}
      </span>
    </div>
  );
});

function VirtualizedLogList({ logs, expandedIds, onToggleExpand, height }: {
  logs: LogEntry[];
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ROW_HEIGHT = 22;
  const BUFFER = 10;

  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(height || 500);

  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER);
  const visibleCount = Math.ceil(containerHeight / ROW_HEIGHT) + BUFFER * 2;
  const endIndex = Math.min(logs.length, startIndex + visibleCount);

  const visibleLogs = logs.slice(startIndex, endIndex);
  const totalHeight = logs.length * ROW_HEIGHT;
  const offsetY = startIndex * ROW_HEIGHT;

  useEffect(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setContainerHeight(rect.height);
  }, [height]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        height: height || '100%',
        overflow: 'auto',
        position: 'relative',
        backgroundColor: 'var(--color-bg-primary)',
      }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ position: 'absolute', top: offsetY, left: 0, right: 0 }}>
          {visibleLogs.map(log => (
            <LogRow
              key={log.id}
              log={log}
              isExpanded={expandedIds.has(log.id)}
              onToggleExpand={onToggleExpand}
              style={{ position: 'relative' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface LogConsoleProps {
  maxHeight?: number;
}

export default function LogConsole({ maxHeight = 600 }: LogConsoleProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevLogsRef = useRef<LogEntry[]>([]);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unlisten = listen('log-event', (event: any) => {
      const data = event.payload;
      if (data) {
        addLog({
          id: data.id || `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: formatTimestamp(data.timestamp || new Date().toISOString()),
          level: data.level || 'INFO',
          source: data.source || 'system',
          message: data.message || '',
        });
      }
    });

    return () => { unlisten.then(fn => fn()); };
  }, []);

  const addLog = useCallback((log: LogEntry) => {
    setLogs(prev => {
      const newLogs = [log, ...prev];
      if (newLogs.length > MAX_LOGS) {
        return newLogs.slice(0, MAX_LOGS);
      }
      return newLogs;
    });
  }, []);

  const mapEventTypeToLevel = (type: string): string => {
    if (type.includes('error') || type.includes('ERROR') || type.includes('fail') || type.includes('reject')) return 'ERROR';
    if (type.includes('warn') || type.includes('WARN') || type.includes('alert')) return 'WARN';
    if (type.includes('success') || type.includes('complete') || type.includes('done')) return 'SUCCESS';
    return 'INFO';
  };

  useEffect(() => {
    if (autoScroll && bottomRef.current && logs.length !== prevLogsRef.current.length) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    prevLogsRef.current = logs;
  }, [logs, autoScroll]);

  const toggleExpand = useCallback((logId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  }, []);

  const filteredLogs = useMemo(() => {
    let result = logs;

    if (levelFilter !== 'ALL') {
      result = result.filter(l => l.level === levelFilter);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l =>
        l.message.toLowerCase().includes(q) ||
        l.source.toLowerCase().includes(q) ||
        l.timestamp.includes(q)
      );
    }

    return result;
  }, [logs, levelFilter, searchQuery]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && (document.activeElement as HTMLElement)?.tagName !== 'INPUT') {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('.log-console-search input')?.focus();
      }
      if (e.key === 'Escape' && document.activeElement instanceof HTMLInputElement) {
        document.activeElement.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleClear = () => {
    setLogs([]);
    setExpandedIds(new Set());
  };

  const handleExport = () => {
    const content = filteredLogs
      .map(l => `[${l.timestamp}] [${l.level}] [${l.source}] ${l.message}`)
      .join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `log-export-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const levelCounts = useMemo(() => {
    const counts: Record<string, number> = { INFO: 0, WARN: 0, ERROR: 0, SUCCESS: 0 };
    logs.forEach(l => {
      if (counts[l.level] !== undefined) counts[l.level]++;
    });
    return counts;
  }, [logs]);

  return (
    <div className="log-console-panel" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: 'var(--color-bg-primary)',
      border: '1px solid var(--color-border-default)',
      borderRadius: 'var(--border-radius-md)',
      fontFamily: 'var(--font-mono)',
    }}>
      <div className="log-console-header" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: '1px solid var(--color-border-default)',
        backgroundColor: 'var(--color-bg-secondary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
            Log Console
          </span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{
              display: 'inline-block',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--color-profit)',
              animation: 'hb-pulse 1.5s ease-in-out infinite',
            }} />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {filteredLogs.length} / {logs.length}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            style={{
              height: '24px',
              padding: '2px 8px',
              background: 'var(--color-bg-tertiary)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--border-radius-sm)',
              color: 'var(--text-primary)',
              fontSize: '10px',
              cursor: 'pointer',
            }}
          >
            <option value="ALL">ALL</option>
            {LOG_LEVELS.map(level => (
              <option key={level} value={level}>
                {level} ({levelCounts[level]})
              </option>
            ))}
          </select>

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            style={{
              height: '24px',
              padding: '2px 8px',
              background: autoScroll ? 'var(--color-active-dim)' : 'var(--color-bg-tertiary)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--border-radius-sm)',
              color: autoScroll ? 'var(--color-active)' : 'var(--text-secondary)',
              fontSize: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {autoScroll ? '⬇' : '○'} Auto-scroll
          </button>

          <button
            onClick={handleClear}
            style={{
              height: '24px',
              padding: '2px 8px',
              background: 'var(--color-bg-tertiary)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--border-radius-sm)',
              color: 'var(--text-secondary)',
              fontSize: '10px',
              cursor: 'pointer',
            }}
          >
            Clear
          </button>

          <button
            onClick={handleExport}
            style={{
              height: '24px',
              padding: '2px 8px',
              background: 'var(--color-bg-tertiary)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--border-radius-sm)',
              color: 'var(--text-secondary)',
              fontSize: '10px',
              cursor: 'pointer',
            }}
          >
            Export
          </button>
        </div>
      </div>

      <div className="log-console-search" style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--color-border-default)',
        display: 'flex',
        gap: '8px',
      }}>
        <input
          type="text"
          placeholder="Search logs... (press '/' to focus)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            height: '24px',
            padding: '4px 8px',
            background: 'var(--color-bg-tertiary)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--border-radius-sm)',
            color: 'var(--text-primary)',
            fontSize: '11px',
            outline: 'none',
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{
              height: '24px',
              padding: '4px 8px',
              background: 'var(--color-bg-tertiary)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--border-radius-sm)',
              color: 'var(--text-muted)',
              fontSize: '10px',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        )}
      </div>

      <div className="log-console-body" style={{ flex: 1, overflow: 'hidden' }}>
        {filteredLogs.length === 0 ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-muted)',
            fontSize: '12px',
          }}>
            No logs to display
          </div>
        ) : (
          <VirtualizedLogList
            logs={filteredLogs}
            expandedIds={expandedIds}
            onToggleExpand={toggleExpand}
            height={maxHeight - 100}
          />
        )}
        <div ref={bottomRef} />
      </div>

      <div className="log-console-footer" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 12px',
        borderTop: '1px solid var(--color-border-default)',
        backgroundColor: 'var(--color-bg-secondary)',
        fontSize: '10px',
        color: 'var(--text-muted)',
      }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          {LOG_LEVELS.map(level => {
            const config = LEVEL_CONFIG[level];
            return (
              <span key={level} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: config.color }}>●</span>
                {level}: {levelCounts[level]}
              </span>
            );
          })}
        </div>
        <div>
          Max: {MAX_LOGS.toLocaleString()} entries
        </div>
      </div>
    </div>
  );
}