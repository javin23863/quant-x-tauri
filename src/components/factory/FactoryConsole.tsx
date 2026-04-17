import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useDashboardStore } from '../../store/dashboard';
import { listen } from '@tauri-apps/api/event';

interface LogEntry {
  timestamp: string;
  level: string;
  source: string;
  message: string;
}

export default function FactoryConsole() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [bufferSize] = useState(1000);
  const consoleRef = useRef<HTMLDivElement | null>(null);
  const pausedLogsRef = useRef<string[]>([]);

  const config = useMemo(() => ({
    bufferSize: 1000,
    reconnectDelay: 3000,
    maxReconnectAttempts: 10,
  }), []);

  const formatTimestamp = (date?: Date | null) => {
    const d = date || new Date();
    const pad = (n: number, len = 2) => String(n).padStart(len, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
  };

  const formatLogLevel = (level?: string) => {
    const normalized = String(level || '').toUpperCase();
    if (normalized === 'ERROR' || normalized === 'ERR') return 'ERROR';
    if (normalized === 'WARN' || normalized === 'WARNING') return 'WARN';
    if (normalized === 'DEBUG' || normalized === 'DBG') return 'DEBUG';
    return 'INFO';
  };

  const highlightSyntax = (message: string) => {
    let msg = message;
    if (typeof msg !== 'string') {
      try { msg = JSON.stringify(msg); } catch { msg = String(msg); }
    }
    return msg
      .replace(/\b(error|failed|failure|exception|timeout|refused)\b/gi, '<span class="log-highlight-error">$1</span>')
      .replace(/\b(success|connected|started|completed|loaded)\b/gi, '<span class="log-highlight-success">$1</span>')
      .replace(/\b(warning|warn|deprecated)\b/gi, '<span class="log-highlight-warn">$1</span>')
      .replace(/\b(\d+ms|\d+s)\b/g, '<span class="log-highlight-time">$1</span>')
      .replace(/\b(localhost|[\d.]+:\d+)\b/g, '<span class="log-highlight-host">$1</span>')
      .replace(/"([^"]+)"/g, '<span class="log-highlight-string">"$1"</span>')
      .replace(/\b(true|false|null|undefined)\b/g, '<span class="log-highlight-keyword">$1</span>');
  };

  useEffect(() => {
    let cancelled = false;
    let reconnectAttempts = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = async () => {
      try {
        const unlisten = await listen<string>('factory-log', (event) => {
          if (isPaused) {
            pausedLogsRef.current.push(event.payload);
            if (pausedLogsRef.current.length > config.bufferSize) {
              pausedLogsRef.current = pausedLogsRef.current.slice(-config.bufferSize);
            }
            return;
          }
          try {
            const data = JSON.parse(event.payload);
            const logEntry: LogEntry = {
              timestamp: data.timestamp || new Date().toISOString(),
              level: formatLogLevel(data.level || 'INFO'),
              source: data.source || data.module || data.component || 'system',
              message: data.message || data.msg || JSON.stringify(data),
            };
            setLogs(prev => [...prev.slice(-(config.bufferSize - 1)), logEntry]);
          } catch {
            const logEntry: LogEntry = {
              timestamp: new Date().toISOString(),
              level: 'INFO',
              source: 'raw',
              message: event.payload,
            };
            setLogs(prev => [...prev.slice(-(config.bufferSize - 1)), logEntry]);
          }
        });

        if (!cancelled) {
          setIsConnected(true);
          reconnectAttempts = 0;
          setLogs(prev => [...prev.slice(-(config.bufferSize - 1)), {
            timestamp: new Date().toISOString(),
            level: 'INFO',
            source: 'console',
            message: 'Connected to VPS log stream',
          }]);
        }

        return unlisten;
      } catch {
        setIsConnected(false);
        if (reconnectAttempts < config.maxReconnectAttempts) {
          reconnectTimer = setTimeout(() => {
            reconnectAttempts++;
            connect();
          }, config.reconnectDelay);
        }
        return () => {};
      }
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [isPaused, config.bufferSize, config.maxReconnectAttempts, config.reconnectDelay]);

  useEffect(() => {
    if (autoScroll && consoleRef.current && !isPaused) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs, autoScroll, isPaused]);

  const handleResume = () => {
    setIsPaused(false);
    if (pausedLogsRef.current.length > 0) {
      setLogs(prev => {
        const newLogs = [...prev];
        for (const data of pausedLogsRef.current) {
          try {
            const parsed = JSON.parse(data);
            newLogs.push({
              timestamp: parsed.timestamp || new Date().toISOString(),
              level: formatLogLevel(parsed.level || 'INFO'),
              source: parsed.source || 'system',
              message: parsed.message || JSON.stringify(parsed),
            });
          } catch {
            newLogs.push({
              timestamp: new Date().toISOString(),
              level: 'INFO',
              source: 'raw',
              message: data,
            });
          }
        }
        return newLogs.slice(-config.bufferSize);
      });
      pausedLogsRef.current = [];
    }
  };

  const levelClass = (level: string) => {
    switch (level) {
      case 'ERROR': return 'factory-console-line-error';
      case 'WARN': return 'factory-console-line-warn';
      case 'DEBUG': return 'factory-console-line-debug';
      default: return 'factory-console-line-info';
    }
  };

  const levelColor = (level: string) => {
    switch (level) {
      case 'ERROR': return '#ff4444';
      case 'WARN': return '#ffaa00';
      case 'DEBUG': return '#888888';
      default: return '#00cc66';
    }
  };

  const filteredLogs = logs.filter(log => {
    if (filter !== 'all' && log.level !== filter) return false;
    if (searchTerm && !log.message.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !log.source.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const levelCounts = logs.reduce<Record<string, number>>((acc, log) => {
    acc[log.level] = (acc[log.level] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="factory-console-wrapper">
      <div className="factory-console-header">
        <div className="factory-console-filters">
          <span className="factory-console-connection-status">
            <span className={`connection-indicator ${isConnected ? 'connected' : 'disconnected'}`}></span>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>

          <button className={`factory-btn factory-btn-sm ${filter === 'all' ? 'factory-btn-active' : ''}`}
            onClick={() => setFilter('all')}>
            All ({logs.length})
          </button>
          <button className={`factory-btn factory-btn-sm ${filter === 'ERROR' ? 'factory-btn-active' : ''}`}
            onClick={() => setFilter('ERROR')} style={{ color: levelCounts.ERROR ? '#ff4444' : undefined }}>
            ERR ({levelCounts.ERROR || 0})
          </button>
          <button className={`factory-btn factory-btn-sm ${filter === 'WARN' ? 'factory-btn-active' : ''}`}
            onClick={() => setFilter('WARN')} style={{ color: levelCounts.WARN ? '#ffaa00' : undefined }}>
            WRN ({levelCounts.WARN || 0})
          </button>
          <button className={`factory-btn factory-btn-sm ${filter === 'INFO' ? 'factory-btn-active' : ''}`}
            onClick={() => setFilter('INFO')}>
            INF ({levelCounts.INFO || 0})
          </button>
          <button className={`factory-btn factory-btn-sm ${filter === 'DEBUG' ? 'factory-btn-active' : ''}`}
            onClick={() => setFilter('DEBUG')} style={{ color: '#888' }}>
            DBG ({levelCounts.DEBUG || 0})
          </button>
        </div>

        <div className="factory-console-controls">
          <input
            className="factory-input factory-console-search"
            type="text"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <button
            className={`factory-btn factory-btn-sm ${isPaused ? 'factory-btn-warning' : ''}`}
            onClick={() => isPaused ? handleResume() : setIsPaused(true)}
            title={isPaused ? 'Resume streaming' : 'Pause streaming'}
          >
            {isPaused ? '▶ Resume' : '⏸ Pause'}
          </button>

          <button
            className={`factory-btn factory-btn-sm ${autoScroll ? 'factory-btn-active' : ''}`}
            onClick={() => setAutoScroll(!autoScroll)}
            title="Toggle auto-scroll"
          >
            {autoScroll ? '↓ Auto' : '↓ Manual'}
          </button>

          <button
            className="factory-btn factory-btn-sm"
            onClick={() => setLogs([])}
            title="Clear all logs"
          >
            🗑 Clear
          </button>
        </div>
      </div>

      <div className="factory-console" ref={consoleRef}>
        {filteredLogs.length === 0 && (
          <div className="factory-console-line factory-console-line-info">
            <span className="factory-console-timestamp">[{formatTimestamp()}]</span>
            <span className="factory-console-source">[CONSOLE]</span>
            <span className="factory-console-message">
              {isConnected ? 'Waiting for logs...' : 'Connecting to VPS...'}
            </span>
          </div>
        )}
        {filteredLogs.map((log, idx) => (
          <div key={idx} className={`factory-console-line ${levelClass(log.level)}`}>
            <span className="factory-console-timestamp">
              [{formatTimestamp(new Date(log.timestamp))}]
            </span>
            <span
              className="factory-console-level"
              style={{ color: levelColor(log.level) }}
            >
              [{log.level}]
            </span>
            <span className="factory-console-source">[{log.source}]</span>
            <span
              className="factory-console-message"
              dangerouslySetInnerHTML={{ __html: highlightSyntax(log.message) }}
            />
          </div>
        ))}
      </div>

      <div className="factory-console-footer">
        <span className="factory-console-count">
          {filteredLogs.length} / {logs.length} logs
          {isPaused && pausedLogsRef.current.length > 0 && ` (${pausedLogsRef.current.length} queued)`}
        </span>
        <span className="factory-console-buffer">
          Buffer: {bufferSize}
        </span>
      </div>
    </div>
  );
}