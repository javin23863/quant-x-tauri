import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface HeatmapItem {
  sector: string;
  value: number;
  pnl: number;
  exposurePct: number;
  positions: { symbol?: string; ticker?: string; pnl?: number }[];
}

interface HeatmapData {
  data: HeatmapItem[];
  totalValue: number;
  totalPnL: number;
}

const SECTORS = [
  'Technology', 'Financials', 'Healthcare', 'Consumer', 'Energy',
  'Industrial', 'Real Estate', 'Materials', 'Utilities', 'ETF', 'Other',
];

function getPnLColor(pnl: number): string {
  if (pnl === 0 || pnl === null || pnl === undefined) return 'rgba(255,255,255,0.08)';
  const maxLoss = -5000;
  const maxGain = 5000;
  const clampedPnL = Math.max(maxLoss, Math.min(maxGain, pnl));
  if (clampedPnL < 0) {
    const t = Math.abs(clampedPnL) / Math.abs(maxLoss);
    return `rgba(239,68,68,${0.3 + t * 0.7})`;
  } else {
    const t = clampedPnL / maxGain;
    return `rgba(16,185,129,${0.3 + t * 0.7})`;
  }
}

function formatCurrency(value: number): string {
  if (value === null || value === undefined) return '—';
  const abs = Math.abs(value);
  const sign = value >= 0 ? '+' : '-';
  if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(2)}M`;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

function formatValue(value: number): string {
  if (value === null || value === undefined) return '—';
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

export default function ExposureHeatmap() {
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null);
  const [hoveredSector, setHoveredSector] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await invoke('performance_heatmap') as any;
        setHeatmapData(data);
        setLastUpdate(new Date());
      } catch (err) {
        console.error('ExposureHeatmap fetch error:', err);
      }
    }
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const data = heatmapData?.data || [];
  const totalValue = heatmapData?.totalValue || 0;
  const totalPnL = heatmapData?.totalPnL || 0;

  const sectorMap: Record<string, HeatmapItem> = {};
  data.forEach(item => {
    if (item.sector) sectorMap[item.sector] = item;
  });
  SECTORS.forEach(sector => {
    if (!sectorMap[sector]) {
      sectorMap[sector] = { sector, value: 0, pnl: 0, exposurePct: 0, positions: [] };
    }
  });

  const totalExposure = Object.values(sectorMap).reduce((sum, s) => sum + (s.exposurePct || 0), 0);
  const normalizedSectors = Object.values(sectorMap).map(s => ({
    ...s,
    normalizedPct: totalExposure > 0 ? (s.exposurePct || 0) / totalExposure : (1 / SECTORS.length),
  }));

  const hovered = hoveredSector ? sectorMap[hoveredSector] : null;

  return (
    <div style={{ padding: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', padding: '0 4px' }}>
        <div style={{ display: 'flex', gap: '24px' }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>Portfolio Value</div>
            <div style={{ fontSize: '24px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>{formatValue(totalValue)}</div>
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>Total P&L</div>
            <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: totalPnL >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>{formatCurrency(totalPnL)}</div>
          </div>
        </div>
        {lastUpdate && (
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Updated {lastUpdate.toLocaleTimeString()}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'flex-start', padding: '4px', minHeight: '200px' }}>
        {normalizedSectors.map(sector => {
          const size = Math.max(40, Math.min(120, 40 + sector.normalizedPct * 400));
          const bgColor = getPnLColor(sector.pnl);
          const isHovered = hoveredSector === sector.sector;
          return (
            <div
              key={sector.sector}
              style={{
                width: size,
                height: size,
                background: bgColor,
                borderRadius: '6px',
                border: `1px solid ${isHovered ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.12)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
              }}
              onMouseEnter={() => setHoveredSector(sector.sector)}
              onMouseLeave={() => setHoveredSector(null)}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '4px' }}>
                <div style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.9)', textShadow: '0 1px 2px rgba(0,0,0,0.5)', whiteSpace: 'nowrap' }}>
                  {sector.sector === 'Real Estate' ? 'Real Est.' : sector.sector}
                </div>
                <div style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
                  {((sector.exposurePct || 0) * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {hovered && (
        <div style={{
          position: 'fixed', bottom: '24px', left: '24px',
          background: 'rgba(18,24,38,0.98)', border: '1px solid var(--border-subtle)',
          borderRadius: '8px', padding: '12px 14px', minWidth: '200px', maxWidth: '280px',
          zIndex: 1000, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{hovered.sector}</span>
            <span style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: hovered.pnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>{formatCurrency(hovered.pnl)}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '10px' }}>
            <div><div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Value</div><div style={{ fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{formatValue(hovered.value)}</div></div>
            <div><div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Exposure</div><div style={{ fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{((hovered.exposurePct || 0) * 100).toFixed(1)}%</div></div>
            <div><div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Positions</div><div style={{ fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{hovered.positions?.length || 0}</div></div>
          </div>
          {hovered.positions && hovered.positions.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Positions</div>
              {hovered.positions.slice(0, 5).map((pos, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{pos.symbol || pos.ticker || '—'}</span>
                  <span style={{ fontSize: '11px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: (pos.pnl || 0) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>{formatCurrency(pos.pnl || 0)}</span>
                </div>
              ))}
              {hovered.positions.length > 5 && (
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', paddingTop: '4px' }}>+{hovered.positions.length - 5} more</div>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center', padding: '8px 4px 4px' }}>
        <div style={{ display: 'flex', width: '120px', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ flex: 1, background: 'rgba(239,68,68,1)' }} />
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.3)' }} />
          <div style={{ flex: 1, background: 'rgba(16,185,129,1)' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '120px', fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
          <span>Loss</span>
          <span>Neutral</span>
          <span>Gain</span>
        </div>
      </div>
    </div>
  );
}