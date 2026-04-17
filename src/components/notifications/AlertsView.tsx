import React, { useState, useEffect } from 'react';
import { useDashboardStore } from '../../store/dashboard';
import { invoke } from '@tauri-apps/api/core';
import MissionTabFrame from '../shared/MissionTabFrame';

interface AlertItem {
  id: string;
  severity: string;
  source?: string;
  agent?: string;
  message?: string;
  title?: string;
  payload?: any;
  timestamp?: string;
  createdAt?: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
}

type FilterType = 'all' | 'critical' | 'warning' | 'info';

export default function AlertsView() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const data = await invoke<AlertItem[] | { alerts: AlertItem[] }>('get_alerts', { limit: 100 });
      setAlerts(Array.isArray(data) ? data : (data as any).alerts || []);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
      setLoading(false);
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    setAcknowledging(alertId);
    try {
      await invoke('acknowledge_alert', { alertId });
      setAlerts(prev => prev.map(a =>
        a.id === alertId ? { ...a, acknowledged: true, acknowledgedAt: new Date().toISOString() } : a
      ));
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    } finally {
      setAcknowledging(null);
    }
  };

  const bulkAcknowledge = async () => {
    try {
      await invoke('bulk_acknowledge_alerts', { severity: filter === 'all' ? null : filter });
      fetchAlerts();
    } catch (err) {
      console.error('Failed to bulk acknowledge:', err);
    }
  };

  const severityColor = (sev: string | undefined): string => {
    switch (sev?.toLowerCase()) {
      case 'critical': return 'var(--accent-red)';
      case 'warning': return 'var(--accent-yellow)';
      case 'info': return 'var(--accent-blue)';
      default: return 'var(--text-muted)';
    }
  };

  const severityBg = (sev: string | undefined): string => {
    switch (sev?.toLowerCase()) {
      case 'critical': return 'rgba(239, 68, 68, 0.15)';
      case 'warning': return 'rgba(245, 158, 11, 0.15)';
      case 'info': return 'rgba(59, 130, 246, 0.15)';
      default: return 'var(--bg-panel)';
    }
  };

  const formatTime = (ts: string | undefined): string => {
    if (!ts) return '--';
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const filteredAlerts = alerts.filter(a => {
    if (filter === 'all') return true;
    return a.severity?.toLowerCase() === filter;
  });

  const stats = {
    total: alerts.length,
    critical: alerts.filter(a => a.severity?.toLowerCase() === 'critical').length,
    warning: alerts.filter(a => a.severity?.toLowerCase() === 'warning').length,
    info: alerts.filter(a => a.severity?.toLowerCase() === 'info').length,
    unacknowledged: alerts.filter(a => !a.acknowledged).length,
  };

  return (
    <MissionTabFrame
      number={9}
      title="Alerts"
      subtitle="Alert history and acknowledgment tracking"
    >
      <div className="alerts-view">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
          <div className="panel" style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
              {stats.total}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Total</div>
          </div>
          <div className="panel" style={{ padding: 16, textAlign: 'center', background: severityBg('critical') }}>
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', color: severityColor('critical') }}>
              {stats.critical}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Critical</div>
          </div>
          <div className="panel" style={{ padding: 16, textAlign: 'center', background: severityBg('warning') }}>
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', color: severityColor('warning') }}>
              {stats.warning}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Warning</div>
          </div>
          <div className="panel" style={{ padding: 16, textAlign: 'center', background: severityBg('info') }}>
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', color: severityColor('info') }}>
              {stats.info}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Info</div>
          </div>
          <div className="panel" style={{ padding: 16, textAlign: 'center', background: 'var(--bg-panel-alt)' }}>
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
              {stats.unacknowledged}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Unacknowledged</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-panel)', borderRadius: 'var(--radius-md)', padding: 4 }}>
            {(['all', 'critical', 'warning', 'info'] as FilterType[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 12,
                  fontWeight: filter === f ? 600 : 400,
                  cursor: 'pointer',
                  background: filter === f ? 'var(--accent-blue)' : 'transparent',
                  color: filter === f ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.2s',
                }}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <button
            onClick={bulkAcknowledge}
            style={{
              padding: '8px 16px',
              background: 'var(--bg-panel-alt)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              marginLeft: 'auto',
            }}
          >
            Acknowledge All {filter !== 'all' ? filter : ''}
          </button>
          <button
            onClick={fetchAlerts}
            style={{
              padding: '8px 12px',
              background: 'var(--bg-panel-alt)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="panel" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ color: 'var(--text-secondary)' }}>Loading alerts...</div>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="panel" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
            <div style={{ color: 'var(--text-secondary)' }}>No alerts matching filter</div>
          </div>
        ) : (
          <div className="panel" style={{ overflow: 'hidden', padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-panel-alt)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', width: 100 }}>Time</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', width: 100 }}>Severity</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', width: 120 }}>Source</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>Message</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', width: 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlerts.map((alert, idx) => (
                  <tr key={alert.id || idx} style={{ borderBottom: '1px solid var(--border-subtle)', opacity: alert.acknowledged ? 0.6 : 1 }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                      {formatTime(alert.timestamp || alert.createdAt)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 11,
                        fontWeight: 500,
                        background: severityBg(alert.severity),
                        color: severityColor(alert.severity),
                      }}>
                        {(alert.severity || 'info').toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
                      {alert.source || alert.agent || 'system'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)' }}>
                      {alert.message || alert.title || JSON.stringify(alert.payload || {})}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {alert.acknowledged ? (
                        <span style={{ fontSize: 11, color: 'var(--accent-green)' }}>✓ Acknowledged</span>
                      ) : (
                        <button
                          onClick={() => acknowledgeAlert(alert.id)}
                          disabled={acknowledging === alert.id}
                          style={{
                            padding: '6px 12px',
                            fontSize: 11,
                            background: acknowledging === alert.id ? 'var(--bg-panel)' : 'var(--accent-blue)',
                            color: acknowledging === alert.id ? 'var(--text-muted)' : '#fff',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            cursor: acknowledging === alert.id ? 'wait' : 'pointer',
                            opacity: acknowledging === alert.id ? 0.6 : 1,
                          }}
                        >
                          {acknowledging === alert.id ? '...' : 'Acknowledge'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </MissionTabFrame>
  );
}