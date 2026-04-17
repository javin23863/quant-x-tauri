import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// StatusGrid — 4 key metric tiles
// Props: metrics: { testsPass, testsFail, phase, agentsActive, alerts }


interface StatusGridProps {
  metrics: {
    testsPass: number;
    testsFail: number;
    phase?: string;
    agentsActive?: number;
    alerts?: number;
  };
}

export function StatusGrid({  metrics  }: StatusGridProps) {
  const tiles = [
    {
      label: 'Tests Passing',
      value: metrics.testsPass,
      sub: `${metrics.testsFail} failing`,
      color: metrics.testsFail === 0 ? 'green' : 'red',
    },
    {
      label: 'Phase',
      value: metrics.phase,
      sub: 'current',
      color: 'blue',
    },
    {
      label: 'Agents Active',
      value: metrics.agentsActive,
      sub: 'of 5',
      color: 'green',
    },
    {
      label: 'Alerts',
      value: metrics.alerts,
      sub: metrics.alerts === 0 ? 'none' : 'active',
      color: metrics.alerts === 0 ? 'green' : 'red',
    },
  ];

  return (
    <div className="status-grid">
      {tiles.map(t => (
        <div key={t.label} className={`metric-tile color-${t.color}`}>
          <span className="metric-value">{t.value}</span>
          <span className="metric-label">{t.label}</span>
          <span className="metric-sub">{t.sub}</span>
        </div>
      ))}
    </div>
  );
}
