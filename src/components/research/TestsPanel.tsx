import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// TestsPanel — layer-by-layer pass/fail bars
// Props: layers: Array<{ layer, pass, fail, total }>


interface TestsPanelProps {
  layers: Array<{ layer: string; pass: number; fail: number; total: number }>;
}

export function TestsPanel({  layers  }: TestsPanelProps) {
  if (!layers || layers.length === 0) {
    return (
      <section className="panel tests-panel">
        <h2>TEST SUITE</h2>
        <div className="loading">No test data</div>
      </section>
    );
  }

  return (
    <section className="panel tests-panel">
      <h2>TEST SUITE</h2>
      <div className="tests-list">
        {layers.map(l => {
          const pct = l.total > 0 ? Math.round((l.pass / l.total) * 100) : 0;
          const barClass = pct === 100 ? 'bar-green' : pct >= 80 ? 'bar-yellow' : 'bar-red';
          return (
            <div key={l.layer} className="test-row">
              <span className="test-layer-name">{l.layer}</span>
              <div className="test-bar-track">
                <div className={`test-bar-fill ${barClass}`} style={{ width: `${pct}%` }}></div>
              </div>
              <span className="test-counts">
                <span className="pass-count">{l.pass}</span>
                <span className="fail-count"> / {l.total}</span>
                {l.fail > 0 && <span className="fail-badge">{l.fail} fail</span>}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
