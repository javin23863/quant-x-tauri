import { useState, useEffect, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';

export default function FactoryMonitoringPanel() {
  const [summary, setSummary] = useState<Record<string, any> | null>(null);
  const [monitoringStatus, setMonitoringStatus] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [liveResult, monitoringResult] = await Promise.all([
        invoke('factory_live_summary'),
        invoke('monitoring_status'),
      ]);
      setSummary(liveResult as Record<string, any>);
      setMonitoringStatus(monitoringResult as Record<string, any>);
      setError(null);
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => { clearInterval(timer); };
  }, [refresh]);

  const infrastructure = summary ? (summary.infrastructure || {}) : {} as Record<string, any>;
  const riskMetrics = summary ? (summary.riskMetrics || {}) : {} as Record<string, any>;
  const cards = [
    {
      name: 'Vera-X Proxy',
      status: (infrastructure.veraX && infrastructure.veraX.online) ? 'online' : 'offline',
      details: ['Latency ' + (infrastructure.veraX ? (infrastructure.veraX.latencyMs !== undefined ? infrastructure.veraX.latencyMs : '--') : '--') + 'ms'],
    },
    {
      name: 'Cloud Slots',
      status: (infrastructure.cloudSlots && infrastructure.cloudSlots.active && infrastructure.cloudSlots.active.length) ? 'online' : 'degraded',
      details: ['Active ' + (infrastructure.cloudSlots ? (infrastructure.cloudSlots.slotCount || 0) : 0) + '/' + (infrastructure.cloudSlots ? (infrastructure.cloudSlots.maxSlots || 3) : 3)],
    },
    {
      name: 'Deployment Mode',
      status: (infrastructure.deploymentMode && infrastructure.deploymentMode.mode) ? 'ready' : 'offline',
      details: [(infrastructure.deploymentMode ? infrastructure.deploymentMode.mode : 'unknown') || 'unknown'],
    },
    {
      name: 'Grafana',
      status: (monitoringStatus && monitoringStatus.grafana && monitoringStatus.grafana.online) ? 'online' : 'offline',
      details: [(monitoringStatus && monitoringStatus.grafana ? monitoringStatus.grafana.url : 'n/a') || 'n/a'],
    },
    {
      name: 'Prometheus',
      status: (monitoringStatus && monitoringStatus.prometheus && monitoringStatus.prometheus.online) ? 'online' : 'offline',
      details: [(monitoringStatus && monitoringStatus.prometheus ? monitoringStatus.prometheus.url : 'n/a') || 'n/a'],
    },
    {
      name: 'Risk Engine',
      status: riskMetrics.lastUpdated ? 'ready' : 'offline',
      details: ['Drawdown ' + (Number(riskMetrics.currentDrawdown || 0) * 100).toFixed(2) + '%', 'Leverage ' + Number(riskMetrics.leverage || 0).toFixed(2)],
    },
  ];

  const statusColor = (status: string) => {
    return (status === 'online' || status === 'ready') ? '#34D399' : (status === 'degraded' ? '#FBBF24' : '#F87171');
  };

  return (
    <div className="factory-monitoring-panel" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: '#E5E7EB', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Runtime Monitoring</div>
        <button className="factory-btn factory-btn-sm" onClick={refresh}>Refresh</button>
      </div>
      {error && <div className="factory-error-banner">{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
        {cards.map((card) => (
          <div key={card.name} style={{ border: '1px solid #374151', borderRadius: '6px', background: '#111827', padding: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', color: '#9CA3AF', textTransform: 'uppercase' }}>{card.name}</span>
              <span style={{ color: statusColor(card.status), fontSize: '10px', fontFamily: 'var(--font-mono)' }}>{String(card.status).toUpperCase()}</span>
            </div>
            {card.details.map((detail, index) => (
              <div key={index} style={{ marginTop: '6px', fontSize: '11px', color: '#E5E7EB', fontFamily: 'var(--font-mono)' }}>{detail}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}