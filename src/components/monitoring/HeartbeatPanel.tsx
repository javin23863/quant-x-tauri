import React from 'react';

interface HeartbeatItem {
  status: string;
  latencyMs?: number;
  docsIndexed?: number;
  version?: string;
}

interface HeartbeatData {
  veraX?: HeartbeatItem;
  qmd?: HeartbeatItem;
  wsl?: HeartbeatItem;
  openclaw?: HeartbeatItem;
}

interface HeartbeatPanelProps {
  heartbeat?: HeartbeatData;
}

const INFRA_KEYS = ['veraX', 'qmd', 'wsl', 'openclaw'] as const;

const INFRA_LABELS: Record<string, string> = {
  veraX: 'Vera-X (port 8080)',
  qmd: 'QMD (WSL)',
  wsl: 'WSL Ubuntu',
  openclaw: 'OpenClaw CLI',
};

export default function HeartbeatPanel({ heartbeat }: HeartbeatPanelProps) {
  return (
    <section className="panel heartbeat-panel">
      <h2>INFRASTRUCTURE</h2>
      <div className="heartbeat-list">
        {INFRA_KEYS.map(key => {
          const item = (heartbeat && heartbeat[key]) || { status: 'unknown' };
          const statusClass =
            item.status === 'ok' ? 'hb-ok' :
            item.status === 'warn' ? 'hb-warn' :
            item.status === 'error' ? 'hb-error' : 'hb-unknown';
          return (
            <div key={key} className={`heartbeat-row ${statusClass}`}>
              <span className="hb-indicator"></span>
              <span className="hb-label">{INFRA_LABELS[key]}</span>
              <span className="hb-status">{item.status}</span>
              {item.latencyMs != null && (
                <span className="hb-detail">{item.latencyMs}ms</span>
              )}
              {item.docsIndexed != null && (
                <span className="hb-detail">{item.docsIndexed} docs</span>
              )}
              {item.version && (
                <span className="hb-detail">v{item.version}</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}