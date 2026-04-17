import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface TVStatus {
  connected: boolean;
  lastSyncTime: string | null;
  lastSessionBriefTime: string | null;
  archiveCount: number;
}

interface SessionBrief {
  directional_bias: string | null;
  timeframe: string | null;
  session_id: string | null;
  watchlist: string[];
  warnings: string[];
}

interface PineValidation {
  passed: boolean;
  strategy_id: string | null;
  symbol: string | null;
  timeframe: string | null;
  checks: Array<{ name: string; passed: boolean }>;
}

interface ArchiveEntry {
  kind: string;
  created_at: string;
}

interface FastLaneItem {
  fast_event_id: string;
  headline: string;
  category: string;
  playbook: string;
  risk_posture: string;
}

interface FastLane {
  count: number;
  highest_urgency: number;
  items: FastLaneItem[];
}

interface PropCtx {
  chartSideReadiness: string | null;
  propFirmMode: boolean;
  propProfileId: string | null;
}

const pill = (txt: string, ok: boolean): React.ReactElement => (
  <span style={{
    padding: '3px 10px', borderRadius: 999, fontSize: 11,
    background: ok ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
    border: `1px solid ${ok ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
    color: ok ? 'var(--accent-green)' : 'var(--accent-yellow)',
  }}>{txt}</span>
);

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

export default function TradingViewView() {
  const [status, setStatus] = useState<TVStatus | null>(null);
  const [brief, setBrief] = useState<SessionBrief | null>(null);
  const [validation, setValidation] = useState<PineValidation | null>(null);
  const [archive, setArchive] = useState<ArchiveEntry[] | null>(null);
  const [fastLane, setFastLane] = useState<FastLane | null>(null);
  const [propCtx, setPropCtx] = useState<PropCtx | null>(null);

  useEffect(() => {
    const commands: Array<[string, React.Dispatch<React.SetStateAction<any>>]> = [
      ['tradingview_status', setStatus],
      ['tradingview_session_brief', setBrief],
      ['tradingview_pine_validation', setValidation],
      ['tradingview_archive', setArchive],
      ['live_intelligence_fast_lane', setFastLane],
      ['prop_firm_tradingview_context', setPropCtx],
    ];
    commands.forEach(([cmd, setter]) => {
      invoke(cmd).then((data: any) => setter(data)).catch(() => setter({ error: 'unavailable' }));
    });
  }, []);

  return (
    <div>
      <div className="view-header">
        <div>
          <div className="view-title">TradingView Bridge</div>
          <div className="view-subtitle">Chart-state bridge, morning brief, Pine validation, fast-lane context</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Connection', value: (status as any)?.connected ? 'Connected' : 'Degraded', ok: !!(status as any)?.connected },
          { label: 'Last Sync', value: (status as any)?.lastSyncTime ? new Date((status as any).lastSyncTime).toLocaleString() : '—' },
          { label: 'Last Brief', value: (status as any)?.lastSessionBriefTime ? new Date((status as any).lastSessionBriefTime).toLocaleString() : '—' },
          { label: 'Archive Entries', value: (status as any)?.archiveCount ?? '—' },
        ].map((x) => (
          <div key={x.label} className="panel" style={{ padding: 16 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>{x.label}</div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{x.value}</div>
            {x.ok != null && <div style={{ marginTop: 8 }}>{pill(x.ok ? 'live' : 'optional/degraded', !!x.ok)}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="panel" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Session Brief</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {brief?.directional_bias && pill(`bias: ${brief.directional_bias}`, brief.directional_bias !== 'neutral')}
            {brief?.timeframe && <span style={{ ...mono, fontSize: 12, color: 'var(--text-secondary)' }}>TF {brief.timeframe}</span>}
            {brief?.session_id && <span style={{ ...mono, fontSize: 12, color: 'var(--text-muted)' }}>{brief.session_id}</span>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>Watchlist</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {(brief?.watchlist || []).map((s: string) => <span key={s} style={{ padding: '2px 8px', border: '1px solid var(--border-subtle)', borderRadius: 999, ...mono }}>{s}</span>)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Warnings</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-secondary)', fontSize: 12 }}>
            {(brief?.warnings || ['No brief yet']).map((w: string, i: number) => <li key={i}>{w}</li>)}
          </ul>
        </div>

        <div className="panel" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Pine Validation</div>
          <div style={{ marginBottom: 10 }}>{pill(validation?.passed ? 'pass' : 'awaiting / fail', !!validation?.passed)}</div>
          <div style={{ ...mono, fontSize: 12, marginBottom: 8 }}>Strategy: {validation?.strategy_id || '—'}</div>
          <div style={{ ...mono, fontSize: 12, marginBottom: 8 }}>Symbol/TF: {validation?.symbol || '—'} / {validation?.timeframe || '—'}</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-secondary)', fontSize: 12 }}>
            {(validation?.checks || []).slice(0, 6).map((c: { name: string; passed: boolean }, i: number) => <li key={i}>{c.name}: {c.passed ? 'ok' : 'check'}</li>)}
          </ul>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="panel" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Breaking-News Fast Lane</div>
          <div style={{ ...mono, fontSize: 12, marginBottom: 10 }}>items: {fastLane?.count ?? 0} · highest urgency: {fastLane?.highest_urgency ?? 0}</div>
          {(fastLane?.items || []).slice(0, 5).map((item: FastLaneItem) => (
            <div key={item.fast_event_id} style={{ padding: '10px 0', borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{item.headline}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{item.category} · {item.playbook} · risk {item.risk_posture}</div>
            </div>
          ))}
        </div>

        <div className="panel" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Prop Overlay Context</div>
          <div style={{ marginBottom: 8 }}>{pill(propCtx?.chartSideReadiness || 'degraded', propCtx?.chartSideReadiness === 'ready')}</div>
          <div style={{ ...mono, fontSize: 12, marginBottom: 8 }}>prop mode: {String(!!propCtx?.propFirmMode)}</div>
          <div style={{ ...mono, fontSize: 12, marginBottom: 12 }}>profile: {propCtx?.propProfileId || '—'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Recent archive</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-secondary)', fontSize: 12 }}>
            {(archive || []).slice(0, 5).map((e: ArchiveEntry, i: number) => <li key={i}>{e.kind} · {e.created_at || '—'}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}