import React, { useRef, useState, useEffect } from 'react';

interface EventFeedEvent {
  id: string;
  time: string;
  level: string;
  agent: string;
  message: string;
  isIncident?: boolean;
  severityInfo?: { icon: string; color: string; bg: string };
  status?: string;
  payload?: any;
}

interface IncidentSeverityInfo {
  icon: string;
  color: string;
  bg: string;
}

const LEVEL_COLOR: Record<string, string> = {
  info: 'var(--accent-green)',
  warning: 'var(--accent-yellow)',
  error: 'var(--accent-red)',
  system: 'var(--accent-blue)',
};

const INCIDENT_SEVERITY: Record<string, IncidentSeverityInfo> = {
  critical: { icon: '🔴', color: 'var(--accent-red)', bg: 'rgba(255,82,82,0.15)' },
  warning: { icon: '🟡', color: 'var(--accent-yellow)', bg: 'rgba(255,199,0,0.15)' },
  info: { icon: '🔵', color: 'var(--accent-blue)', bg: 'rgba(33,150,243,0.15)' },
};

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  broker_disconnect: 'Broker Disconnect',
  order_reject: 'Order Rejected',
  stale_data: 'Stale Data',
  position_mismatch: 'Position Mismatch',
  stop_failure: 'Stop Failure',
  partial_fill: 'Partial Fill',
  risk_breach: 'Risk Breach',
  emergency_flatten: 'Emergency Flatten',
};

function formatIncidentEvent(event: any): EventFeedEvent | null {
  if (!event.type?.startsWith('INCIDENT_')) return null;

  const payload = event.payload || {};
  const severity = payload.severity || 'info';
  const severityInfo = INCIDENT_SEVERITY[severity] || INCIDENT_SEVERITY.info;
  const typeLabel = INCIDENT_TYPE_LABELS[payload.incidentType] || payload.incidentType || 'Unknown';

  let message = '';
  let status = '';

  if (event.type === 'INCIDENT_CREATED') {
    message = `${severityInfo.icon} ${typeLabel}`;
    if (payload.autoAction) {
      message += ` → Auto-action: ${payload.autoAction.replace(/_/g, ' ')}`;
    }
    status = 'active';
  } else if (event.type === 'INCIDENT_RESOLVED') {
    message = `✅ ${typeLabel} resolved`;
    if (payload.resolution) {
      message += `: ${payload.resolution}`;
    }
    status = 'resolved';
  } else if (event.type === 'INCIDENT_AUTO_ACTION') {
    message = `⚡ Auto-action: ${payload.action?.replace(/_/g, ' ')}`;
    status = 'action';
  }

  return {
    id: payload.id || event.id || `inc-${Date.now()}`,
    time: event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString(),
    level: severity,
    agent: 'incident',
    message,
    status,
    isIncident: true,
    severityInfo,
    payload,
  };
}

interface EventFeedProps {
  events?: any[];
  maxHeight?: string;
}

export default function EventFeed({ events, maxHeight }: EventFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events, autoScroll]);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(atBottom);
  }

  const displayEvents: EventFeedEvent[] = (events || []).map(e => {
    const incidentFormat = formatIncidentEvent(e);
    if (incidentFormat) return incidentFormat;

    return {
      id: e.id || `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      time: e.time || (e.timestamp ? new Date(e.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString()),
      level: e.level || 'info',
      agent: e.agent || e.source || 'system',
      message: e.message || (e.payload ? JSON.stringify(e.payload) : ''),
      isIncident: false,
    };
  });

  return (
    <div className="event-feed-panel">
      <div className="panel-header">
        <span className="panel-title">Event Feed</span>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: 'var(--accent-green)',
            animation: 'hb-pulse 1.5s ease-in-out infinite',
            display: 'inline-block',
          }} />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {displayEvents.length} events
          </span>
          {!autoScroll && (
            <button className="panel-btn" onClick={() => setAutoScroll(true)}>
              ↓ Latest
            </button>
          )}
        </div>
      </div>
      <div
        className="event-list-inner"
        ref={containerRef}
        onScroll={handleScroll}
        style={{ maxHeight: maxHeight || '300px' }}
      >
        {displayEvents.length === 0 && (
          <div className="empty-state" style={{ padding: '24px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No events yet</div>
          </div>
        )}
        {[...displayEvents].reverse().map((e, i) => (
          <div
            key={e.id || i}
            className={`event-row ${e.isIncident ? 'incident-row' : ''}`}
            style={e.isIncident ? {
              background: e.severityInfo?.bg || 'transparent',
              borderLeft: `3px solid ${e.severityInfo?.color || 'var(--accent-blue)'}`,
              paddingLeft: '8px',
            } : {}}
          >
            <span className="event-time">{e.time}</span>
            <span className="event-agent" style={{ color: LEVEL_COLOR[e.level] || LEVEL_COLOR.info }}>
              [{e.agent || 'system'}]
            </span>
            <span className="event-msg">{e.message}</span>
            {e.isIncident && e.status === 'active' && (
              <span className="incident-status" style={{
                fontSize: '10px',
                background: 'var(--accent-red)',
                color: 'white',
                padding: '1px 4px',
                borderRadius: '3px',
                marginLeft: '4px',
              }}>ACTIVE</span>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}