import { useState, useEffect, useMemo, useRef, useCallback } from 'react';

function asNumber(value: any, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

interface TimeSeriesPoint {
  time: number;
  value: number;
}

interface BaseTimeSeriesChartProps {
  data?: { time?: number | string; timestamp?: number | string; value?: number; close?: number }[];
  height?: number;
  width?: string | number;
  className?: string;
  type?: 'line' | 'area';
  lineColor?: string;
  areaColor?: string;
  lineWidth?: number;
  downsample?: boolean | { enabled?: boolean; maxPoints?: number };
  onRangeChange?: (range: any) => void;
}

function toUnixSeconds(value: any, fallback: number): number {
  if (typeof value === 'number') {
    return value > 2e10 ? Math.floor(value / 1000) : Math.floor(value);
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return Math.floor(parsed / 1000);
  }
  return fallback;
}

function normalizeData(data: any[], downsampleConfig: { enabled: boolean; maxPoints: number }): TimeSeriesPoint[] {
  const source = Array.isArray(data) ? data : [];
  let normalized = source.map((row: any, index: number) => ({
    time: toUnixSeconds(row && (row.time !== undefined ? row.time : row.timestamp), index + 1),
    value: asNumber(row && (row.value !== undefined ? row.value : row.close), 0),
  }));

  if (downsampleConfig.enabled && normalized.length > downsampleConfig.maxPoints) {
    const step = Math.ceil(normalized.length / downsampleConfig.maxPoints);
    normalized = normalized.filter((_, i) => i % step === 0);
  }

  return normalized;
}

function formatAxisNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return (value / 1e9).toFixed(2).replace(/\.00$/, '') + 'B';
  if (abs >= 1e6) return (value / 1e6).toFixed(2).replace(/\.00$/, '') + 'M';
  if (abs >= 1e3) return (value / 1e3).toFixed(2).replace(/\.00$/, '') + 'K';
  if (abs >= 1) return value.toFixed(2).replace(/\.00$/, '');
  return value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

export default function BaseTimeSeriesChart(props: BaseTimeSeriesChartProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const height = props.height || 280;
  const width = props.width || '100%';
  const type = props.type || 'line';
  const lineColor = props.lineColor || 'rgba(80,160,255,1)';
  const areaColor = props.areaColor || 'rgba(80,160,255,0.15)';

  const downsampleConfig = useMemo(() => {
    if (!props.downsample) return { enabled: false, maxPoints: 2000 };
    if (typeof props.downsample === 'object') return { enabled: props.downsample.enabled !== false, maxPoints: Math.max(50, asNumber(props.downsample.maxPoints, 2000)) };
    return { enabled: true, maxPoints: 2000 };
  }, [props.downsample]);

  const normalizedData = useMemo(() => normalizeData(props.data || [], downsampleConfig), [props.data, downsampleConfig]);

  const yMin = useMemo(() => {
    if (!normalizedData.length) return 0;
    return Math.min(...normalizedData.map(d => d.value));
  }, [normalizedData]);

  const yMax = useMemo(() => {
    if (!normalizedData.length) return 100;
    return Math.max(...normalizedData.map(d => d.value));
  }, [normalizedData]);

  const yPad = (yMax - yMin) * 0.05 || 1;
  const yLo = yMin - yPad;
  const yHi = yMax + yPad;

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!hostRef.current || !normalizedData.length) return;
    const rect = hostRef.current.getBoundingClientRect();
    const xPx = e.clientX - rect.left;
    const idx = Math.round((xPx / rect.width) * (normalizedData.length - 1));
    setHoverIndex(Math.max(0, Math.min(normalizedData.length - 1, idx)));
  }, [normalizedData.length]);

  const handleMouseLeave = useCallback(() => {
    setHoverIndex(null);
  }, []);

  const hovered = hoverIndex !== null ? normalizedData[hoverIndex] : null;

  return (
    <div
      className={`factory-base-chart ${props.className || ''}`}
      style={{ height: `${height}px`, width, position: 'relative', background: '#0a1424', borderRadius: '6px', overflow: 'hidden' }}
      ref={hostRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {normalizedData.length > 0 && (
        <>
          <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
            {Array.from({ length: 5 }).map((_, i) => {
              const y = 12 + ((height - 30) / 4) * i;
              return <line key={i} x1="12" y1={y} x2="100%" y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />;
            })}

            {(() => {
              const points = normalizedData.map((d, i) => {
                const x = 12 + (i / Math.max(normalizedData.length - 1, 1)) * (typeof width === 'number' ? width - 24 : 100);
                const y = 12 + (1 - (d.value - yLo) / (yHi - yLo)) * (height - 30);
                return `${x},${y}`;
              }).join(' ');

              const fillPoints = (() => {
                const n = normalizedData.length;
                const lastX = 12 + (typeof width === 'number' ? width - 24 : 100);
                const firstX = 12;
                return `${firstX},${height - 18} ${points} ${lastX},${height - 18}`;
              })();

              return (
                <>
                  {type === 'area' && <polygon points={fillPoints} fill={areaColor} />}
                  <polyline points={points} fill="none" stroke={lineColor} strokeWidth={asNumber(props.lineWidth, 2)} vectorEffect="non-scaling-stroke" />
                </>
              );
            })()}
          </svg>

          <div style={{ position: 'absolute', top: '8px', right: '12px', display: 'flex', gap: '12px', fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>
            <span>{formatAxisNumber(yMax)}</span>
            <span>{formatAxisNumber(yMin)}</span>
          </div>

          {hovered && (
            <div style={{
              position: 'absolute',
              top: '8px',
              left: '12px',
              background: 'rgba(10,20,36,0.9)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-primary)',
              pointerEvents: 'none',
            }}>
              {formatAxisNumber(hovered.value)}
            </div>
          )}
        </>
      )}

      {normalizedData.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '12px' }}>
          No chart data available
        </div>
      )}
    </div>
  );
}