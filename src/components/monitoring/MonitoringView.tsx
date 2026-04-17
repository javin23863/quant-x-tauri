import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

const DEFAULT_GRAFANA_URL = 'http://localhost:3000';
const DEFAULT_PROMETHEUS_URL = 'http://localhost:9090';

interface ServicePanelProps {
  name: string;
  icon: string;
  storageKey: string;
  defaultUrl: string;
}

function ServicePanel({ name, icon, storageKey, defaultUrl }: ServicePanelProps) {
  const [url, setUrl] = useState(() => localStorage.getItem(storageKey) || defaultUrl);
  const [status, setStatus] = useState<string | null>(null);
  const [lastCheck, setLastCheck] = useState<string | null>(null);
  const [configuring, setConfiguring] = useState(false);
  const [inputUrl, setInputUrl] = useState(url);

  function checkStatus() {
    setStatus('checking');
    invoke('monitoring_status')
      .then((data: any) => {
        const svc = name.toLowerCase() === 'grafana' ? data.grafana : data.prometheus;
        if (svc) {
          setStatus(svc.online ? 'online' : 'offline');
          setLastCheck(svc.lastCheck);
          if (svc.url) setUrl(svc.url);
        } else {
          setStatus('offline');
        }
      })
      .catch(() => setStatus('offline'));
  }

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  function saveUrl() {
    localStorage.setItem(storageKey, inputUrl);
    setUrl(inputUrl);
    setConfiguring(false);
    setTimeout(checkStatus, 100);
  }

  const statusColor = status === 'online' ? 'var(--accent-green)' : status === 'checking' ? 'var(--accent-yellow)' : 'var(--accent-red)';
  const statusLabel = status === 'online' ? 'ONLINE' : status === 'checking' ? 'CHECKING…' : 'OFFLINE';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
        background: 'var(--bg-panel)', borderRadius: 8, flexShrink: 0,
        border: `1px solid ${status === 'online' ? 'rgba(16,185,129,0.2)' : 'var(--border-subtle)'}`,
      }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{url}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: statusColor }}>{statusLabel}</span>
        </div>
        <button
          onClick={() => { setConfiguring(!configuring); setInputUrl(url); }}
          style={{
            background: 'var(--bg-root)', border: '1px solid var(--border-subtle)', borderRadius: 6,
            color: 'var(--text-secondary)', padding: '4px 10px', cursor: 'pointer', fontSize: 11,
          }}
        >Configure</button>
        <button
          onClick={checkStatus}
          style={{
            background: 'var(--bg-root)', border: '1px solid var(--border-subtle)', borderRadius: 6,
            color: 'var(--text-secondary)', padding: '4px 10px', cursor: 'pointer', fontSize: 11,
          }}
        >↻ Refresh</button>
      </div>

      {configuring && (
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center', padding: '10px 16px',
          background: 'var(--bg-panel-alt)', borderRadius: 8, flexShrink: 0,
          border: '1px solid var(--border-subtle)',
        }}>
          <input
            value={inputUrl}
            onChange={e => setInputUrl(e.target.value)}
            placeholder={defaultUrl}
            style={{
              flex: 1, background: 'var(--bg-root)', border: '1px solid var(--border-active)',
              borderRadius: 6, color: 'var(--text-primary)', padding: '6px 10px', fontSize: 12,
              fontFamily: 'var(--font-mono)', outline: 'none',
            }}
          />
          <button
            onClick={saveUrl}
            style={{
              background: 'var(--accent-blue)', border: 'none', borderRadius: 6,
              color: '#fff', padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            }}
          >Save</button>
          <button
            onClick={() => setConfiguring(false)}
            style={{
              background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 6,
              color: 'var(--text-muted)', padding: '6px 10px', cursor: 'pointer', fontSize: 12,
            }}
          >Cancel</button>
        </div>
      )}

      <div style={{
        flex: 1, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-subtle)',
        background: 'var(--bg-root)', minHeight: 0,
      }}>
        {status === 'online' ? (
          <iframe
            src={url}
            className="monitoring-iframe"
            title={name}
            style={{ width: '100%', height: '100%', border: 'none', minHeight: 500 }}
          />
        ) : (
          <div className="monitoring-offline" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: 40, height: '100%',
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>{status === 'checking' ? '⏳' : '📡'}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, maxWidth: 360, textAlign: 'center', lineHeight: 1.7 }}>
              {status === 'checking'
                ? `Connecting to ${url}…`
                : `${name} is not reachable at ${url}. Start the service or update the URL above.`}
            </div>
            {status !== 'checking' && (
              <div style={{
                background: 'var(--bg-panel)', borderRadius: 8, padding: '14px 20px', maxWidth: 420,
                border: '1px solid var(--border-subtle)', textAlign: 'left',
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Quick Setup</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', lineHeight: 1.8 }}>
                  {name === 'Grafana' ? (
                    <>
                      <div># Install Grafana (Docker):</div>
                      <div style={{ color: 'var(--accent-cyan)' }}>docker run -d -p 3000:3000 grafana/grafana</div>
                      <div style={{ marginTop: 8 }}># Default login: admin / admin</div>
                    </>
                  ) : (
                    <>
                      <div># Install Prometheus (Docker):</div>
                      <div style={{ color: 'var(--accent-cyan)' }}>docker run -d -p 9090:9090 prom/prometheus</div>
                      <div style={{ marginTop: 8 }}># Default endpoint: http://localhost:9090</div>
                    </>
                  )}
                </div>
              </div>
            )}
            {lastCheck && (
              <div style={{ marginTop: 12, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {`Last checked: ${new Date(lastCheck).toLocaleTimeString()}`}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MonitoringView() {
  const [activeTab, setActiveTab] = useState('grafana');

  const tabs = [
    { id: 'grafana', label: 'Grafana', icon: '📊' },
    { id: 'prometheus', label: 'Prometheus', icon: '🔥' },
  ];

  return (
    <div className="monitoring-view">
      <div className="view-header">
        <div className="view-title">Monitoring</div>
        <div className="view-subtitle">Embedded Grafana & Prometheus dashboards</div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, transition: 'all 200ms',
              background: activeTab === tab.id ? 'var(--bg-active)' : 'var(--bg-panel)',
              color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent-blue)' : '2px solid transparent',
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        {activeTab === 'grafana' && (
          <ServicePanel name="Grafana" icon="📊" storageKey="mc_grafana_url" defaultUrl={DEFAULT_GRAFANA_URL} />
        )}
        {activeTab === 'prometheus' && (
          <ServicePanel name="Prometheus" icon="🔥" storageKey="mc_prometheus_url" defaultUrl={DEFAULT_PROMETHEUS_URL} />
        )}
      </div>
    </div>
  );
}